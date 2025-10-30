import Gio from "gi://Gio?version=2.0";
import GLib from "gi://GLib?version=2.0";
import GObject from "gi://GObject?version=2.0";
import { sessionBus } from "./bluetooth.js";

export const OBEX_SERVICE = "org.bluez.obex";
export const OBEX_CLIENT_INTERFACE = "org.bluez.obex.Client1";
export const OBEX_TRANSFER_INTERFACE = "org.bluez.obex.Transfer1";
export const OBEX_OBJECT_PUSH_INTERFACE = "org.bluez.obex.ObjectPush1";

export class ObexManager extends GObject.Object {
    private clientProxy: Gio.DBusProxy;
    private activeTransfers: Map<string, Gio.DBusProxy> = new Map();

    static {
        GObject.registerClass(
            {
                Signals: {
                    "transfer-started": {
                        param_types: [GObject.TYPE_STRING, GObject.TYPE_STRING],
                    },
                    "transfer-progress": {
                        param_types: [
                            GObject.TYPE_STRING,
                            GObject.TYPE_UINT64,
                            GObject.TYPE_UINT64,
                        ],
                    },
                    "transfer-completed": {
                        param_types: [GObject.TYPE_STRING],
                    },
                    "transfer-failed": {
                        param_types: [GObject.TYPE_STRING, GObject.TYPE_STRING],
                    },
                },
            },
            this,
        );
    }

    constructor() {
        super();

        this.clientProxy = Gio.DBusProxy.new_sync(
            sessionBus,
            Gio.DBusProxyFlags.NONE,
            null,
            OBEX_SERVICE,
            "/org/bluez/obex",
            OBEX_CLIENT_INTERFACE,
            null,
        );
    }

    public async createSession(deviceAddress: string): Promise<string | null> {
        try {
            const result = await new Promise<GLib.Variant<any>>(
                (resolve, reject) => {
                    this.clientProxy.call(
                        "CreateSession",
                        new GLib.Variant("(sa{sv})", [
                            deviceAddress,
                            {
                                Target: new GLib.Variant("s", "opp"),
                            },
                        ]),
                        Gio.DBusCallFlags.NONE,
                        -1,
                        null,
                        (proxy, result) => {
                            try {
                                const response = proxy?.call_finish(result);
                                if (response) {
                                    resolve(response);
                                } else {
                                    reject(
                                        new Error(
                                            "No sessionPath returned from session creation",
                                        ),
                                    );
                                }
                            } catch (error) {
                                reject(error);
                            }
                        },
                    );
                },
            );

            const [sessionPath] = result.deep_unpack() as [string];
            return sessionPath;
        } catch (error) {
            log(`Failed to create OBEX session: ${error}`);
            return null;
        }
    }

    public async removeSession(sessionPath: string): Promise<void> {
        try {
            await new Promise<void>((resolve, reject) => {
                this.clientProxy.call(
                    "RemoveSession",
                    new GLib.Variant("(o)", [sessionPath]),
                    Gio.DBusCallFlags.NONE,
                    -1,
                    null,
                    (proxy, result) => {
                        try {
                            proxy?.call_finish(result);
                            resolve();
                        } catch (error) {
                            reject(error);
                        }
                    },
                );
            });
        } catch (error) {
            log(`Failed to remove OBEX session: ${error}`);
            throw error;
        }
    }

    private _setupTransferMonitoring(
        transferPath: string,
        transferProxy: Gio.DBusProxy,
    ): void {
        // Monitor transfer progress
        transferProxy.connect("g-properties-changed", (_, changed) => {
            const statusValue = changed.lookup_value("Status", null);
            const transferredValue = changed.lookup_value("Transferred", null);
            const sizeValue = transferProxy.get_cached_property("Size");

            if (statusValue) {
                const status = statusValue.get_string()[0];

                if (status === "complete") {
                    this.emit("transfer-completed", transferPath);
                    this.activeTransfers.delete(transferPath);
                } else if (status === "error") {
                    this.emit(
                        "transfer-failed",
                        transferPath,
                        "Transfer failed",
                    );
                    this.activeTransfers.delete(transferPath);
                }
            }

            if (transferredValue && sizeValue) {
                const transferred = transferredValue.get_uint64();
                const size = sizeValue.get_uint64();
                this.emit("transfer-progress", transferPath, transferred, size);
            }
        });
    }

    public async sendFile(
        deviceAddress: string,
        filePath: string,
    ): Promise<string | null> {
        let sessionPath: string | null = null;

        try {
            // Create session
            sessionPath = await this.createSession(deviceAddress);
            if (!sessionPath) {
                throw new Error("Failed to create OBEX session");
            }

            // Create ObjectPush proxy for the session
            const objectPushProxy = Gio.DBusProxy.new_sync(
                sessionBus,
                Gio.DBusProxyFlags.NONE,
                null,
                OBEX_SERVICE,
                sessionPath,
                OBEX_OBJECT_PUSH_INTERFACE,
                null,
            );

            // Start file transfer
            const result = await new Promise<any>((resolve, reject) => {
                objectPushProxy.call(
                    "SendFile",
                    new GLib.Variant("(s)", [filePath]),
                    Gio.DBusCallFlags.NONE,
                    -1,
                    null,
                    (proxy, result) => {
                        try {
                            const response = proxy?.call_finish(result);
                            resolve(response);
                        } catch (error) {
                            reject(error);
                        }
                    },
                );
            });

            const [transferPath] = result.deep_unpack() as [
                string,
                Record<string, GLib.Variant>,
            ];

            // Store transfer proxy for monitoring
            const transferProxy = Gio.DBusProxy.new_sync(
                sessionBus,
                Gio.DBusProxyFlags.NONE,
                null,
                OBEX_SERVICE,
                transferPath,
                OBEX_TRANSFER_INTERFACE,
                null,
            );

            this.activeTransfers.set(transferPath, transferProxy);
            this._setupTransferMonitoring(transferPath, transferProxy);

            // Extract filename from path for the signal
            const filename = filePath.split("/").pop() || filePath;
            this.emit("transfer-started", transferPath, filename);

            return transferPath;
        } catch (error) {
            log(`Failed to send file: ${error}`);

            // Clean up session if it was created
            if (sessionPath) {
                try {
                    await this.removeSession(sessionPath);
                } catch (e) {
                    log(`Failed to clean up session: ${e}`);
                }
            }

            return null;
        }
    }

    public cancelTransfer(transferPath: string): void {
        const transferProxy = this.activeTransfers.get(transferPath);
        if (transferProxy) {
            try {
                transferProxy.call_sync(
                    "Cancel",
                    null,
                    Gio.DBusCallFlags.NONE,
                    -1,
                    null,
                );
                this.activeTransfers.delete(transferPath);
            } catch (error) {
                log(`Failed to cancel transfer: ${error}`);
            }
        }
    }

    public destroy(): void {
        // Cancel all active transfers
        for (const [transferPath] of this.activeTransfers) {
            this.cancelTransfer(transferPath);
        }
        this.activeTransfers.clear();
    }
}

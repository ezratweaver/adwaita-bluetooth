import Adw from "gi://Adw";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import Gio from "gi://Gio?version=2.0";
import { Device } from "./bluetooth/device.js";
import { Adapter } from "./bluetooth/adapter.js";
import { BluetoothUUID } from "./bluetooth/device-metadata.js";
import { FileTransferProgressDialog } from "./file-transfer-progress-dialog.js";
import { ObexManager } from "./bluetooth/obex.js";

export class DeviceDetailsModal extends Adw.Window {
    private device: Device;
    private adapter: Adapter;
    private _connection_switch!: Gtk.Switch;
    private _connection_spinner!: Adw.Spinner;
    private _paired_row!: Adw.ActionRow;
    private _type_row!: Adw.ActionRow;
    private _address_row!: Adw.ActionRow;
    private _send_files_group!: Adw.PreferencesGroup;
    private _send_files_button!: Adw.ButtonRow;
    private _forget_button!: Adw.ButtonRow;
    private _device_icon!: Gtk.Image;
    private _device_name!: Gtk.Label;

    static {
        GObject.registerClass(
            {
                Template:
                    "resource:///com/ezratweaver/AdwBluetooth/ui/device-details-modal.ui",
                InternalChildren: [
                    "connection_switch",
                    "connection_spinner",
                    "paired_row",
                    "type_row",
                    "address_row",
                    "send_files_group",
                    "send_files_button",
                    "forget_button",
                    "device_icon",
                    "device_name",
                ],
            },
            this,
        );
    }

    constructor(device: Device, adapter: Adapter, parent: Gtk.Window) {
        super({
            transientFor: parent,
        });

        this.device = device;
        this.adapter = adapter;

        this._paired_row.set_subtitle(device.paired ? "Yes" : "No");
        this._type_row.set_subtitle(device.deviceType);
        this._address_row.set_subtitle(device.address);

        this._device_icon.set_from_icon_name(
            device.icon || "bluetooth-symbolic",
        );
        this._device_name.set_text(device.alias);

        this.device.bind_property(
            "connected",
            this._connection_switch,
            "active",
            GObject.BindingFlags.SYNC_CREATE,
        );

        this.device.bind_property(
            "connecting",
            this._connection_switch,
            "visible",
            GObject.BindingFlags.SYNC_CREATE |
                GObject.BindingFlags.INVERT_BOOLEAN,
        );

        this.device.bind_property(
            "connecting",
            this._connection_spinner,
            "visible",
            GObject.BindingFlags.SYNC_CREATE,
        );

        this._connection_switch.connect("state-set", (_, switchTurnedOn) => {
            if (switchTurnedOn && !device.connected) {
                if (this.adapter.discovering) {
                    this.adapter.stopDiscovery();
                }
                device.connectDevice().catch((error) => {
                    log(
                        `An error occured trying to connect to device: ${error}`,
                    );
                    this._connection_switch.set_active(false); // Ensure switch is off
                    device.disconnectDevice(); // Explicity cut connection when timeout/failure occurs
                });
            } else if (!switchTurnedOn && device.connected) {
                device.disconnectDevice();
            }
            return false;
        });

        // Show send files group only if device supports Object Push
        if (
            this.device.uuids.has(BluetoothUUID.OBJECT_PUSH) &&
            this.device.connected
        ) {
            this._send_files_group.set_visible(true);
        }

        this._send_files_button.connect("activated", () => {
            this.showFilePicker();
        });

        this._forget_button.connect("activated", () => {
            this.showForgetDialog();
        });
    }

    private showForgetDialog(): void {
        const dialog = new Adw.AlertDialog({
            heading: "Forget Device?",
            body: `"${this.device.alias}" will be removed from your saved devices. You will have to set it up again to use it.`,
        });

        dialog.add_response("cancel", "Cancel");
        dialog.add_response("forget", "Forget");
        dialog.set_response_appearance(
            "forget",
            Adw.ResponseAppearance.DESTRUCTIVE,
        );

        dialog.connect("response", (_, response) => {
            if (response === "forget") {
                this.adapter.removeDevice(this.device.devicePath);
                this.close();
            }
        });

        dialog.present(this);
    }

    private showFilePicker(): void {
        const fileDialog = new Gtk.FileDialog({
            title: "Choose file to send",
            modal: true,
        });

        fileDialog.open(this, null, (dialog, result) => {
            try {
                const file = dialog?.open_finish(result);
                if (file) {
                    this.sendFile(file);
                }
            } catch (error: any) {
                if (error.code !== Gio.IOErrorEnum.CANCELLED) {
                    log(`File dialog error: ${error}`);
                }
            }
        });
    }

    private async sendFile(file: Gio.File): Promise<void> {
        const obexManager = this.adapter.obexManager;
        if (!obexManager) {
            this.showDialog(
                "OBEX not available",
                "File sending is not supported on this system.",
            );
            return;
        }

        const filePath = file.get_path();
        if (!filePath) {
            this.showDialog("Invalid file", "Could not get file path.");
            return;
        }

        const filename = file.get_basename() ?? "unknown file";

        const sessionPath = await obexManager.createSession(
            this.device.address,
        );

        if (!sessionPath) {
            this.showDialog(
                "Connection failed",
                "Could not establish connection to device.",
            );
            return;
        }

        const progressDialog = new FileTransferProgressDialog(
            filePath,
            this.device.alias,
        );

        let transferPath: string | null = null;
        let signalIds: number[] = [];

        const cleanupSignals = () => {
            signalIds.forEach((id) => obexManager.disconnect(id));
            signalIds = [];
        };

        const cleanupSession = async () => {
            try {
                await obexManager.removeSession(sessionPath);
            } catch (error) {
                log(`Failed to cleanup session: ${error}`);
            }
        };

        const attemptTransfer = async () => {
            progressDialog.hideError();

            if (transferPath) {
                obexManager.cancelTransfer(transferPath);
                transferPath = null;
            }

            cleanupSignals();
            progressDialog.updateProgress(0, 1);

            signalIds.push(
                obexManager.connect(
                    "transfer-progress",
                    (_, path: string, transferred: number, total: number) => {
                        if (path === transferPath) {
                            progressDialog.updateProgress(transferred, total);
                        }
                    },
                ),

                obexManager.connect("transfer-completed", (_, path: string) => {
                    if (path === transferPath) {
                        progressDialog.close();
                        this.showDialog(
                            "File sent successfully",
                            `"${filename}" was sent to ${this.device.alias}.`,
                        );
                        cleanupSignals();
                        cleanupSession();
                    }
                }),

                obexManager.connect(
                    "transfer-failed",
                    (_, path: string, error: string) => {
                        if (path === transferPath) {
                            progressDialog.showError(
                                `Failed to send "${filename}": ${error}`,
                            );
                        }
                    },
                ),
            );

            try {
                transferPath = await obexManager.sendFileWithSession(
                    sessionPath,
                    filePath,
                );

                if (!transferPath) {
                    progressDialog.showError("Could not start file transfer.");
                }
            } catch (error) {
                progressDialog.showError(`Failed to send file: ${error}`);
            }
        };

        progressDialog.connect("cancelled", () => {
            if (transferPath) {
                obexManager.cancelTransfer(transferPath);
            }
            cleanupSignals();
            cleanupSession();
        });

        progressDialog.connect("retry", attemptTransfer);

        progressDialog.present(this);
        await attemptTransfer();
    }

    private showDialog(heading: string, body: string): void {
        const dialog = new Adw.AlertDialog({
            heading,
            body,
        });
        dialog.add_response("ok", "OK");
        dialog.present(this);
    }
}

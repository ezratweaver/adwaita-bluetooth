import Gio from "gi://Gio?version=2.0";
import GLib from "gi://GLib?version=2.0";
import GObject from "gi://GObject?version=2.0";
import { sessionBus } from "./bluetooth.js";

export const OBEX_SERVICE = "org.bluez.obex";
export const OBEX_CLIENT_INTERFACE = "org.bluez.obex.Client1";

export class ObexManager extends GObject.Object {
    private clientProxy: Gio.DBusProxy;

    static {
        GObject.registerClass({}, this);
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
            const result = await new Promise<any>((resolve, reject) => {
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
                            resolve(response);
                        } catch (error) {
                            reject(error);
                        }
                    },
                );
            });

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
}

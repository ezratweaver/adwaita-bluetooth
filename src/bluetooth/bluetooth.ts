import Gio from "gi://Gio";
import { Adapter, ADAPTER_INTERFACE } from "./adapter.js";

export const BLUEZ_SERVICE = "org.bluez";

// D-Bus system interfaces
const DBUS_OBJECTMANAGER_INTERFACE = "org.freedesktop.DBus.ObjectManager";

export const DBUS_PROPERTIES_SET = "org.freedesktop.DBus.Properties.Set";
export const DBUS_PROPERTIES_GET = "org.freedesktop.DBus.Properties.Get";

export interface ErrorPopUp {
    title: string;
    description: string;
}

export interface BluetoothCallbacks {
    onPowerChanged: (powered: boolean) => void;
    onError: (error: ErrorPopUp) => void;
}

/*
 * This class serves as a wrapper around the Adapter class, the purpose
 * for this is to eventually allow switching between adapters, this
 * calls will manage that switching.
 *
 * This class will also manage other system effects on bluetooth, such as rfkill
 */
export class BluetoothManager {
    private callbacks: BluetoothCallbacks;
    private systemBus: Gio.DBusConnection;

    private adapter: Adapter | null = null;

    constructor(callbacks: BluetoothCallbacks) {
        this.callbacks = callbacks;
        this.systemBus = Gio.bus_get_sync(Gio.BusType.SYSTEM, null);

        this._initialize();
    }

    private _initialize(): void {
        try {
            const adapterPath = this._getDefaultAdapter();

            if (!adapterPath) {
                this.callbacks.onError({
                    title: "No Bluetooth adapter found",
                    description:
                        "Could not find bluetooth adapter to connect to, please ensure bluetooth is properly configured.",
                });
                return;
            }

            this.adapter = new Adapter({
                systemBus: this.systemBus,
                adapterPath,
                devicePaths: [],
                onError: this.callbacks.onError,
                onPowerChanged: this.callbacks.onPowerChanged,
            });
        } catch (e) {
            this.callbacks.onError({
                title: "Unknown Error",
                description: e instanceof Error ? e.message : String(e),
            });
        }
    }

    private _getDefaultAdapter(): string | null {
        const bluezObjectsProxy = Gio.DBusProxy.new_sync(
            this.systemBus,
            Gio.DBusProxyFlags.NONE,
            null,
            BLUEZ_SERVICE,
            "/",
            DBUS_OBJECTMANAGER_INTERFACE,
            null,
        );

        const result = bluezObjectsProxy.call_sync(
            "GetManagedObjects",
            null,
            Gio.DBusCallFlags.NONE,
            -1,
            null,
        );

        const [managedObjects] = result.deep_unpack() as [
            Record<string, Record<string, any>>,
        ];

        for (const [path, interfaces] of Object.entries(managedObjects)) {
            if (ADAPTER_INTERFACE in interfaces) {
                return path;
            }
        }

        return null;
    }

    public setAdapterPower(powered: boolean): boolean {
        if (!this.adapter) {
            this.callbacks.onError({
                title: "No Bluetooth adapter found",
                description:
                    "Could not find bluetooth adapter to connect to, please ensure bluetooth is properly configured.",
            });
            return false;
        }

        return this.adapter.setAdapterPower(powered);
    }

    public destroy(): void {
        this.adapter = null;
    }
}

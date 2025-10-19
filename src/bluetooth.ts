import Gio from "gi://Gio";
import GLib from "gi://GLib?version=2.0";

const BLUEZ_SERVICE = "org.bluez";

// D-Bus system interfaces
const DBUS_OBJECTMANAGER_INTERFACE = "org.freedesktop.DBus.ObjectManager";
const DBUS_PROPERTIES_INTERFACE = "org.freedesktop.DBus.Properties";

// Bluez interfaces
const ADAPTER_INTERFACE = "org.bluez.Adapter1";

export interface ErrorPopUp {
    title: string;
    description: string;
}

export interface BluetoothCallbacks {
    onPowerChanged: (powered: boolean) => void;
    onError: (error: ErrorPopUp) => void;
}

export class BluetoothManager {
    private callbacks: BluetoothCallbacks;
    private systemBus: Gio.DBusConnection;
    private adapterPath: string | null = null;
    private adapterPropertiesProxy: Gio.DBusProxy | null = null;

    // Adapter state
    private adapterPowered: boolean = false;

    constructor(callbacks: BluetoothCallbacks) {
        this.callbacks = callbacks;
        this.systemBus = Gio.bus_get_sync(Gio.BusType.SYSTEM, null);

        this._initialize();
    }

    // TODO: Update to track intial devices aswell
    private _initialize(): void {
        try {
            this.adapterPath = this._getDefaultAdapter();

            if (!this.adapterPath) {
                this.callbacks.onError({
                    title: "No Bluetooth adapter found",
                    description:
                        "Could not find bluetooth adapter to connect to, please ensure bluetooth is properly configured.",
                });
                return;
            }

            this._setupAdapterPropertiesProxy();

            // Sync the powered state on the object with Bluez
            if (!this.adapterPropertiesProxy) return;

            const result = this.adapterPropertiesProxy.call_sync(
                "Get",
                new GLib.Variant("(ss)", [ADAPTER_INTERFACE, "Powered"]),
                Gio.DBusCallFlags.NONE,
                -1,
            );

            const [value] = result.deep_unpack() as [GLib.Variant];

            this._setPoweredState(value.get_boolean());
        } catch (e) {
            this.callbacks.onError({
                title: "Unknown Error",
                description: e instanceof Error ? e.message : String(e),
            });
        }
    }

    private _setupAdapterPropertiesProxy(): void {
        if (!this.adapterPath) return;

        this.adapterPropertiesProxy = Gio.DBusProxy.new_sync(
            this.systemBus,
            Gio.DBusProxyFlags.NONE,
            null,
            BLUEZ_SERVICE,
            this.adapterPath,
            DBUS_PROPERTIES_INTERFACE,
        );

        this.adapterPropertiesProxy.connect(
            "g-properties-changed",
            (_, changed) => {
                const poweredValueChanged = changed.lookup_value(
                    "Powered",
                    null,
                );

                if (poweredValueChanged) {
                    this._setPoweredState(poweredValueChanged.get_boolean());
                }
            },
        );
    }

    private _getDefaultAdapter(): string | null {
        const bluezObjectsProxy = Gio.DBusProxy.new_sync(
            this.systemBus,
            Gio.DBusProxyFlags.NONE,
            null,
            BLUEZ_SERVICE,
            "/",
            DBUS_OBJECTMANAGER_INTERFACE,
        );

        const result = bluezObjectsProxy.call_sync(
            "GetManagedObjects",
            null,
            Gio.DBusCallFlags.NONE,
            -1,
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

    private _setPoweredState(powered: boolean): void {
        if (this.adapterPowered === powered) return;

        this.adapterPowered = powered;
        this.callbacks.onPowerChanged(powered);
    }

    public setAdapterPower(powered: boolean): void {
        if (!this.adapterPropertiesProxy) {
            this.callbacks.onError({
                title: "No Bluetooth adapter found",
                description:
                    "Could not find bluetooth adapter to connect to, please ensure bluetooth is properly configured.",
            });
            return;
        }

        try {
            this.adapterPropertiesProxy.call_sync(
                "Set",
                new GLib.Variant("(ssv)", [
                    ADAPTER_INTERFACE,
                    "Powered",
                    new GLib.Variant("b", powered),
                ]),
                Gio.DBusCallFlags.NONE,
                -1,
            );
        } catch (e) {
            this.callbacks.onError({
                title: "Error Enabling/Disabling Bluetooth Adapter",
                description: e instanceof Error ? e.message : String(e),
            });
        }
    }

    public get isPowered(): boolean {
        return this.adapterPowered;
    }

    public destroy(): void {
        this.adapterPropertiesProxy = null;
        this.adapterPath = null;
    }
}

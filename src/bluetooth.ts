import Gio from "gi://Gio";
import GLib from "gi://GLib";

const BLUEZ_SERVICE = "org.bluez";
const DBUS_OM_IFACE = "org.freedesktop.DBus.ObjectManager";
const DBUS_PROP_IFACE = "org.freedesktop.DBus.Properties";
const ADAPTER_IFACE = "org.bluez.Adapter1";

export interface BluetoothCallbacks {
    onPowerChanged: (powered: boolean) => void;
    onError: (error: string) => void;
}

export class BluetoothManager {
    private callbacks: BluetoothCallbacks;
    private systemBus: Gio.DBusConnection;
    private adapterPath: string | null = null;
    private propsProxy: Gio.DBusProxy | null = null;
    private adapterPowered: boolean = false;

    constructor(callbacks: BluetoothCallbacks) {
        this.callbacks = callbacks;
        this.systemBus = Gio.bus_get_sync(Gio.BusType.SYSTEM, null);

        this.initialize();
    }

    private initialize(): void {
        try {
            this.adapterPath = this.getDefaultAdapter();
            if (!this.adapterPath) {
                this.callbacks.onError("No Bluetooth adapter found");
                return;
            }

            this.setupPropsProxy();
            this.updatePowerState();
        } catch (e) {
            this.callbacks.onError(e instanceof Error ? e.message : String(e));
        }
    }

    private setupPropsProxy(): void {
        if (!this.adapterPath) return;

        this.propsProxy = Gio.DBusProxy.new_sync(
            this.systemBus,
            Gio.DBusProxyFlags.NONE,
            null,
            BLUEZ_SERVICE,
            this.adapterPath,
            DBUS_PROP_IFACE,
            null,
        );

        this.propsProxy.connect(
            "g-properties-changed",
            (_: Gio.DBusProxy, changed: GLib.Variant) => {
                const poweredVariant = changed.lookup_value("Powered", null);
                if (poweredVariant) {
                    const powered = poweredVariant.get_boolean();
                    this.setPowered(powered);
                }
            },
        );
    }

    private getDefaultAdapter(): string | null {
        const objManager = Gio.DBusProxy.new_sync(
            this.systemBus,
            Gio.DBusProxyFlags.NONE,
            null,
            BLUEZ_SERVICE,
            "/",
            DBUS_OM_IFACE,
            null,
        );

        const result = objManager.call_sync(
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
            if (ADAPTER_IFACE in interfaces) {
                return path;
            }
        }

        return null;
    }

    private updatePowerState(): void {
        if (!this.propsProxy) return;

        const result = this.propsProxy.call_sync(
            "Get",
            new GLib.Variant("(ss)", [ADAPTER_IFACE, "Powered"]),
            Gio.DBusCallFlags.NONE,
            -1,
            null,
        );

        const [value] = result.deep_unpack() as [GLib.Variant];
        this.setPowered(value.get_boolean());
    }

    private setPowered(powered: boolean): void {
        if (this.adapterPowered === powered) return;

        this.adapterPowered = powered;
        this.callbacks.onPowerChanged(powered);
    }

    public setPower(powered: boolean): void {
        if (!this.propsProxy) {
            this.callbacks.onError("No Bluetooth adapter available");
            return;
        }

        try {
            this.propsProxy.call_sync(
                "Set",
                new GLib.Variant("(ssv)", [
                    ADAPTER_IFACE,
                    "Powered",
                    new GLib.Variant("b", powered),
                ]),
                Gio.DBusCallFlags.NONE,
                -1,
                null,
            );
        } catch (e) {
            this.callbacks.onError(e instanceof Error ? e.message : String(e));
        }
    }

    public get isPowered(): boolean {
        return this.adapterPowered;
    }

    public destroy(): void {
        this.propsProxy = null;
        this.adapterPath = null;
    }
}

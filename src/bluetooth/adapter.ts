import Gio from "gi://Gio?version=2.0";
import GObject from "gi://GObject?version=2.0";
import GLib from "gi://GLib?version=2.0";
import { Device } from "./device.js";
import { BLUEZ_SERVICE, DBUS_PROPERTIES_SET } from "./bluetooth.js";

export const ADAPTER_INTERFACE = "org.bluez.Adapter1";

interface AdapterProps {
    adapterPath: string;
    devicePaths: string[];
    systemBus: Gio.DBusConnection;
}

export class Adapter extends GObject.Object {
    private systemBus: Gio.DBusConnection;
    private adapterPath: string;
    private devicePaths: string[] = [];
    private adapterProxy: Gio.DBusProxy;

    private _powered: boolean = false;
    private _savedDevices: Device[] = [];

    static {
        GObject.registerClass(
            {
                Properties: {
                    powered: GObject.ParamSpec.boolean(
                        "powered",
                        "Powered",
                        "Adapter powered state",
                        GObject.ParamFlags.READABLE,
                        false,
                    ),
                },
            },
            this,
        );
    }

    constructor(props: AdapterProps) {
        super();
        this.systemBus = props.systemBus;
        this.adapterPath = props.adapterPath;
        this.devicePaths = props.devicePaths;

        this.adapterProxy = Gio.DBusProxy.new_sync(
            this.systemBus,
            Gio.DBusProxyFlags.NONE,
            null,
            BLUEZ_SERVICE,
            this.adapterPath,
            ADAPTER_INTERFACE,
            null,
        );

        this._loadProperties();
        this._setupPropertyChangeListener();
        this._syncSavedDevices();
        this._sortDevices();
    }

    private _loadProperties(): void {
        const poweredPacked = this.adapterProxy.get_cached_property("Powered");
        const poweredUnpacked = poweredPacked?.deep_unpack() as boolean;
        this._setPoweredState(poweredUnpacked);
    }

    private _setupPropertyChangeListener(): void {
        this.adapterProxy.connect("g-properties-changed", (_, changed) => {
            const poweredValueChanged = changed.lookup_value("Powered", null);
            if (poweredValueChanged) {
                this._setPoweredState(poweredValueChanged.get_boolean());
            }
        });
    }

    private _syncSavedDevices(): void {
        for (const devicePath of this.devicePaths) {
            const device = new Device({
                devicePath: devicePath,
                systemBus: this.systemBus,
            });
            if (device.paired) {
                this.savedDevices.push(device);
            }
        }
    }

    /*
     * Sorts devices by priority as:
     *
     * 1. Connected devices first
     * 2. Known but not connected devices second
     * 3. Unknown/non paired devices last
     */
    private _sortDevices(): void {
        this._savedDevices.sort((a, b) => {
            if (a.connected && !b.connected) {
                return -1;
            } else if (!a.connected && b.connected) {
                return 1;
            }

            if (a.paired && !b.paired) {
                return -1;
            } else if (!a.paired && b.paired) {
                return 1;
            }

            return 0;
        });
    }

    private _setPoweredState(powered: boolean): void {
        if (this._powered === powered) return;
        this._powered = powered;
        this.notify("powered");
    }

    get powered(): boolean {
        return this._powered;
    }

    public setAdapterPower(powered: boolean): void {
        this.adapterProxy.call_sync(
            DBUS_PROPERTIES_SET,
            new GLib.Variant("(ssv)", [
                ADAPTER_INTERFACE,
                "Powered",
                new GLib.Variant("b", powered),
            ]),
            Gio.DBusCallFlags.NONE,
            -1,
            null,
        );
    }

    get savedDevices(): Device[] {
        return this._savedDevices;
    }
}

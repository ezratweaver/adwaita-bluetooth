import Gio from "gi://Gio?version=2.0";
import { Device } from "./device.js";
import { BLUEZ_SERVICE, DBUS_PROPERTIES_SET } from "./bluetooth.js";
import GLib from "gi://GLib?version=2.0";

export const ADAPTER_INTERFACE = "org.bluez.Adapter1";

export interface AdapterProps {
    adapterPath: string;
    devicePaths: string[];
    systemBus: Gio.DBusConnection;
    onPowerChanged: (powered: boolean) => void;
}

export class Adapter {
    private systemBus: Gio.DBusConnection;

    private adapterPath: string;
    private devicePaths: string[] = [];

    private adapterProxy: Gio.DBusProxy;

    private onPowerChanged: (powered: boolean) => void;

    private devices: Device[] = [];
    private powered: boolean = false;

    constructor(props: AdapterProps) {
        this.systemBus = props.systemBus;
        this.adapterPath = props.adapterPath;
        this.devicePaths = props.devicePaths;
        this.onPowerChanged = props.onPowerChanged;

        this.adapterProxy = Gio.DBusProxy.new_sync(
            this.systemBus,
            Gio.DBusProxyFlags.NONE,
            null,
            BLUEZ_SERVICE,
            this.adapterPath,
            ADAPTER_INTERFACE,
            null,
        );

        const poweredPacked = this.adapterProxy.get_cached_property("Powered");

        const poweredUnpacked = poweredPacked?.deep_unpack() as boolean;

        this._setPoweredState(poweredUnpacked);

        // intialize callback to check if powered state changes
        this.adapterProxy.connect("g-properties-changed", (_, changed) => {
            const poweredValueChanged = changed.lookup_value("Powered", null);

            if (poweredValueChanged) {
                this._setPoweredState(poweredValueChanged.get_boolean());
            }
        });
    }

    private _setPoweredState(powered: boolean): void {
        if (this.powered === powered) return;

        this.powered = powered;
        this.onPowerChanged(powered);
    }

    public setAdapterPower(powered: boolean): boolean {
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

        return true;
    }
}

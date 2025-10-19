import Gio from "gi://Gio?version=2.0";
import { Device } from "./device.js";
import { BLUEZ_SERVICE, DBUS_PROPERTIES_SET, ErrorPopUp } from "./bluetooth.js";
import GLib from "gi://GLib?version=2.0";

export const ADAPTER_INTERFACE = "org.bluez.Adapter1";

export interface AdapterProps {
    adapterPath: string;
    devicePaths: string[];
    systemBus: Gio.DBusConnection;
    onPowerChanged: (powered: boolean) => void;
    onError: (error: ErrorPopUp) => void;
}

export class Adapter {
    private systemBus: Gio.DBusConnection;

    private adapterPath: string;
    private devicePaths: string[] = [];

    private adapterProxy: Gio.DBusProxy | null = null;

    private onPowerChanged: (powered: boolean) => void;
    private onError: (error: ErrorPopUp) => void;

    private devices: Device[] = [];
    private powered: boolean = false;

    constructor(props: AdapterProps) {
        this.systemBus = props.systemBus;
        this.adapterPath = props.adapterPath;
        this.devicePaths = props.devicePaths;
        this.onPowerChanged = props.onPowerChanged;
        this.onError = props.onError;

        this._setupAdapterProxy();
        this._syncAdapterState();
    }

    private _setupAdapterProxy(): void {
        this.adapterProxy = Gio.DBusProxy.new_sync(
            this.systemBus,
            Gio.DBusProxyFlags.NONE,
            null,
            BLUEZ_SERVICE,
            this.adapterPath,
            ADAPTER_INTERFACE,
            null,
        );
    }

    private _syncAdapterState(): void {
        if (!this.adapterProxy) {
            this.onError({
                title: "Failed to access adapter",
                description: "Could not read bluetooth adapter properties.",
            });
            return;
        }

        const isPoweredPacked =
            this.adapterProxy.get_cached_property("Powered");

        const isPoweredUnpacked = isPoweredPacked?.deep_unpack() as boolean;

        this._setPoweredState(isPoweredUnpacked);

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
        if (!this.adapterProxy) {
            this.onError({
                title: "No Bluetooth adapter found",
                description:
                    "Could not find bluetooth adapter to connect to, please ensure bluetooth is properly configured.",
            });
            return false;
        }

        try {
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
        } catch (e) {
            this.onError({
                title: "Error Enabling/Disabling Bluetooth Adapter",
                description: e instanceof Error ? e.message : String(e),
            });

            return false;
        }
    }
}

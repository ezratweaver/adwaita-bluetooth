import Gio from "gi://Gio?version=2.0";
import { BLUEZ_SERVICE } from "./bluetooth.js";
import GLib from "gi://GLib?version=2.0";

export const DEVICE_INTERFACE = "org.bluez.Device1";

interface DeviceProps {
    devicePath: string;
    systemBus: Gio.DBusConnection;
}

export class Device {
    private systemBus: Gio.DBusConnection;
    private devicePath: string;
    private deviceProxy: Gio.DBusProxy;

    public address: string;
    public alias: string;
    public blocked: boolean;
    public bonded: boolean;
    public connected: boolean;
    public name: string;
    public paired: boolean;
    public trusted: boolean;

    constructor(props: DeviceProps) {
        this.systemBus = props.systemBus;
        this.devicePath = props.devicePath;

        this.deviceProxy = Gio.DBusProxy.new_sync(
            this.systemBus,
            Gio.DBusProxyFlags.NONE,
            null,
            BLUEZ_SERVICE,
            this.devicePath,
            DEVICE_INTERFACE,
            null,
        );

        const unpackProperty = <T>(prop: string): T => {
            const value = this.deviceProxy
                .get_cached_property(prop)
                ?.deep_unpack() as T | undefined;

            if (value === undefined) {
                throw new Error(`Missing device property: ${prop}`);
            }

            return value;
        };

        this.address = unpackProperty<string>("Address");
        this.alias = unpackProperty<string>("Alias");
        this.blocked = unpackProperty<boolean>("Blocked");
        this.bonded = unpackProperty<boolean>("Bonded");
        this.connected = unpackProperty<boolean>("Connected");
        this.name = unpackProperty<string>("Name");
        this.paired = unpackProperty<boolean>("Paired");
        this.trusted = unpackProperty<boolean>("Trusted");

        this.deviceProxy.connect("g-properties-changed", (_, changed) => {
            const addressChanged = changed.lookup_value("Address", null);
            const aliasChanged = changed.lookup_value("Alias", null);
            const blockedChanged = changed.lookup_value("Blocked", null);
            const bondedChanged = changed.lookup_value("Bonded", null);
            const connectedChanged = changed.lookup_value("Connected", null);
            const nameChanged = changed.lookup_value("Name", null);
            const pairedChanged = changed.lookup_value("Paired", null);
            const trustedChanged = changed.lookup_value("Trusted", null);

            if (addressChanged) {
                this.address = addressChanged.get_string()[0];
            }
            if (aliasChanged) {
                this.alias = aliasChanged.get_string()[0];
            }
            if (blockedChanged) {
                this.blocked = blockedChanged.get_boolean();
            }
            if (bondedChanged) {
                this.bonded = bondedChanged.get_boolean();
            }
            if (connectedChanged) {
                this.connected = connectedChanged.get_boolean();
            }
            if (nameChanged) {
                this.name = nameChanged.get_string()[0];
            }
            if (pairedChanged) {
                this.paired = pairedChanged.get_boolean();
            }
            if (trustedChanged) {
                this.trusted = trustedChanged.get_boolean();
            }
        });
    }
}

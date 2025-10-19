import Gio from "gi://Gio?version=2.0";
import { BLUEZ_SERVICE } from "./bluetooth";

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
    }
}

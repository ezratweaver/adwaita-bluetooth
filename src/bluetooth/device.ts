import Gio from "gi://Gio?version=2.0";
import GObject from "gi://GObject?version=2.0";
import { BLUEZ_SERVICE } from "./bluetooth.js";
import { BluetoothAgent } from "./agent.js";
import { incrementDeviceConnectionCount } from "../gsettings.js";

export const DEVICE_INTERFACE = "org.bluez.Device1";

export function getDeviceTypeFromClass(cod: number): string {
    const major = (cod >> 8) & 0x1f;
    const minor = (cod >> 2) & 0x3f;

    switch (major) {
        case 0x01: // Computer
            switch (minor) {
                case 0x03:
                    return "Laptop";
                case 0x04:
                    return "Handheld PC/PDA";
                case 0x06:
                    return "Wearable Computer";
                default:
                    return "Computer";
            }

        case 0x02: // Phone
            switch (minor) {
                case 0x01:
                    return "Cellular Phone";
                case 0x03:
                    return "Smartphone";
                default:
                    return "Phone";
            }

        case 0x04: // Audio/Video
            switch (minor) {
                case 0x01:
                    return "Headset";
                case 0x08:
                    return "Speaker";
                case 0x0c:
                    return "Headphones";
                case 0x10:
                    return "Portable Audio";
                case 0x14:
                    return "Car Audio";
                default:
                    return "Audio Device";
            }

        case 0x05:
            return "Peripheral";
        case 0x06:
            return "Imaging Device";
        case 0x07:
            return "Wearable";
        case 0x08:
            return "Toy";
        case 0x09:
            return "Health Device";
        default:
            return "Unknown Device";
    }
}

interface DeviceProps {
    devicePath: string;
    systemBus: Gio.DBusConnection;
    agent: BluetoothAgent;
}

export class Device extends GObject.Object {
    private systemBus: Gio.DBusConnection;
    private deviceProxy: Gio.DBusProxy;
    private agent: BluetoothAgent;

    private _devicePath: string;
    private _address: string | undefined;
    private _alias: string | undefined;
    private _blocked: boolean | undefined;
    private _bonded: boolean | undefined;
    private _connected: boolean | undefined;
    private _name: string | undefined;
    private _paired: boolean | undefined;
    private _trusted: boolean | undefined;
    private _class: number | undefined;
    private _icon: string | undefined;
    private _connecting: boolean = false;

    static {
        GObject.registerClass(
            {
                Properties: {
                    address: GObject.ParamSpec.string(
                        "address",
                        "Address",
                        "Device address",
                        GObject.ParamFlags.READABLE,
                        "",
                    ),
                    alias: GObject.ParamSpec.string(
                        "alias",
                        "Alias",
                        "Device alias",
                        GObject.ParamFlags.READABLE,
                        "",
                    ),
                    blocked: GObject.ParamSpec.boolean(
                        "blocked",
                        "Blocked",
                        "Device blocked",
                        GObject.ParamFlags.READABLE,
                        false,
                    ),
                    bonded: GObject.ParamSpec.boolean(
                        "bonded",
                        "Bonded",
                        "Device bonded",
                        GObject.ParamFlags.READABLE,
                        false,
                    ),
                    connected: GObject.ParamSpec.boolean(
                        "connected",
                        "Connected",
                        "Device connected",
                        GObject.ParamFlags.READABLE,
                        false,
                    ),
                    name: GObject.ParamSpec.string(
                        "name",
                        "Name",
                        "Device name",
                        GObject.ParamFlags.READABLE,
                        "",
                    ),
                    paired: GObject.ParamSpec.boolean(
                        "paired",
                        "Paired",
                        "Device paired",
                        GObject.ParamFlags.READABLE,
                        false,
                    ),
                    trusted: GObject.ParamSpec.boolean(
                        "trusted",
                        "Trusted",
                        "Device trusted",
                        GObject.ParamFlags.READABLE,
                        false,
                    ),
                    connecting: GObject.ParamSpec.boolean(
                        "connecting",
                        "Connecting",
                        "Device connecting",
                        GObject.ParamFlags.READABLE,
                        false,
                    ),
                    deviceClass: GObject.ParamSpec.uint(
                        "device-class",
                        "Device Class",
                        "Device class",
                        GObject.ParamFlags.READABLE,
                        0,
                        0xffffff,
                        0,
                    ),
                    icon: GObject.ParamSpec.string(
                        "icon",
                        "Icon",
                        "Device icon",
                        GObject.ParamFlags.READABLE,
                        "",
                    ),
                },
                Signals: {
                    "device-changed": {},
                },
            },
            this,
        );
    }

    constructor(props: DeviceProps) {
        super();
        this.systemBus = props.systemBus;
        this._devicePath = props.devicePath;

        this.deviceProxy = Gio.DBusProxy.new_sync(
            this.systemBus,
            Gio.DBusProxyFlags.NONE,
            null,
            BLUEZ_SERVICE,
            this._devicePath,
            DEVICE_INTERFACE,
            null,
        );

        this.agent = props.agent;

        this._loadProperties();
        this._setupPropertyChangeListener();
    }

    private _loadProperties(): void {
        const unpackProperty = <T>(prop: string): T | undefined => {
            const value = this.deviceProxy
                .get_cached_property(prop)
                ?.deep_unpack() as T | undefined;
            return value;
        };

        this._address = unpackProperty<string>("Address");
        this._alias = unpackProperty<string>("Alias");
        this._blocked = unpackProperty<boolean>("Blocked");
        this._bonded = unpackProperty<boolean>("Bonded");
        this._connected = unpackProperty<boolean>("Connected");
        this._name = unpackProperty<string>("Name");
        this._paired = unpackProperty<boolean>("Paired");
        this._trusted = unpackProperty<boolean>("Trusted");
        this._class = unpackProperty<number>("Class");
        this._icon = unpackProperty<string>("Icon");
    }

    private _setupPropertyChangeListener(): void {
        this.deviceProxy.connect("g-properties-changed", (_, changed) => {
            let changed_any = false;

            const propertyMap: Record<string, string> = {
                Address: "_address",
                Alias: "_alias",
                Blocked: "_blocked",
                Bonded: "_bonded",
                Connected: "_connected",
                Name: "_name",
                Paired: "_paired",
                Trusted: "_trusted",
                Class: "_class",
                Icon: "_icon",
            };

            for (const [dbusProp, privateProp] of Object.entries(propertyMap)) {
                const changedValue = changed.lookup_value(dbusProp, null);
                if (changedValue) {
                    const isBoolean =
                        dbusProp === "Blocked" ||
                        dbusProp === "Bonded" ||
                        dbusProp === "Connected" ||
                        dbusProp === "Paired" ||
                        dbusProp === "Trusted";

                    const isNumber = dbusProp === "Class";

                    const newValue = isBoolean
                        ? changedValue.get_boolean()
                        : isNumber
                          ? changedValue.get_uint32()
                          : changedValue.get_string()[0];

                    if ((this as any)[privateProp] !== newValue) {
                        (this as any)[privateProp] = newValue;
                        const notifyProp =
                            dbusProp === "Class"
                                ? "device-class"
                                : dbusProp.toLowerCase();
                        this.notify(notifyProp);
                        changed_any = true;

                        // Notify displayName if alias, name, or address changed
                        if (
                            dbusProp === "Alias" ||
                            dbusProp === "Name" ||
                            dbusProp === "Address"
                        ) {
                            this.notify("display-name");
                        }
                    }
                }
            }

            if (changed_any) {
                this.emit("device-changed");
            }
        });
    }

    private _setConnecting(connecting: boolean): void {
        if (this._connecting === connecting) return;
        this._connecting = connecting;
        this.notify("connecting");
    }

    get connectedStatus(): string {
        let deviceStatus: string;
        if (this.connected) {
            deviceStatus = "Connected";
        } else if (!this.connected && this.paired) {
            deviceStatus = "Disconnected";
        } else {
            deviceStatus = "Not Set Up";
        }

        return deviceStatus;
    }

    public async connectDevice(): Promise<void> {
        if (this._connecting) return; // Don't do anything if we are mid disconnect / connect

        this._setConnecting(true);
        try {
            await new Promise<void>((resolve, reject) => {
                this.deviceProxy.call(
                    "Connect",
                    null,
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
        } finally {
            this._setConnecting(false);
        }
    }

    public async disconnectDevice(): Promise<void> {
        if (this._connecting) return; // Don't do anything if we are mid disconnect / connect

        this._setConnecting(true);
        try {
            await new Promise<void>((resolve, reject) => {
                this.deviceProxy.call(
                    "Disconnect",
                    null,
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
        } finally {
            this._setConnecting(false);
        }
    }

    public async pairDevice(): Promise<void> {
        if (this._connecting) return;

        try {
            this.agent.register();
            this._setConnecting(true);

            await new Promise<void>((resolve, reject) => {
                this.deviceProxy.call(
                    "Pair",
                    null,
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
        } finally {
            this.agent.unregister();
            this._setConnecting(false);
        }
    }

    // Getters for all properties
    get devicePath(): string {
        return this._devicePath;
    }

    get address(): string {
        return this._address ?? "";
    }

    get alias(): string {
        return this._alias || "Unknown Device";
    }

    get blocked(): boolean {
        return this._blocked ?? false;
    }

    get bonded(): boolean {
        return this._bonded ?? false;
    }

    get connected(): boolean {
        return this._connected ?? false;
    }

    get name(): string {
        return this._name ?? "";
    }

    get paired(): boolean {
        return this._paired ?? false;
    }

    get trusted(): boolean {
        return this._trusted ?? false;
    }

    get connecting(): boolean {
        return this._connecting;
    }

    get deviceClass(): number {
        return this._class ?? 0;
    }

    get icon(): string {
        return this._icon ?? "";
    }

    get deviceType(): string {
        return getDeviceTypeFromClass(this.deviceClass);
    }
}

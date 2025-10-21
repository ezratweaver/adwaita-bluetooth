import Gio from "gi://Gio?version=2.0";
import GObject from "gi://GObject?version=2.0";
import { BLUEZ_SERVICE } from "./bluetooth.js";

export const DEVICE_INTERFACE = "org.bluez.Device1";

interface DeviceProps {
    devicePath: string;
    systemBus: Gio.DBusConnection;
}

export class Device extends GObject.Object {
    private systemBus: Gio.DBusConnection;
    private deviceProxy: Gio.DBusProxy;

    private _devicePath: string;
    private _address: string | undefined;
    private _alias: string | undefined;
    private _blocked: boolean | undefined;
    private _bonded: boolean | undefined;
    private _connected: boolean | undefined;
    private _name: string | undefined;
    private _paired: boolean | undefined;
    private _trusted: boolean | undefined;

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

                    const newValue = isBoolean
                        ? changedValue.get_boolean()
                        : changedValue.get_string()[0];

                    if ((this as any)[privateProp] !== newValue) {
                        (this as any)[privateProp] = newValue;
                        this.notify(dbusProp.toLowerCase());
                        changed_any = true;
                    }
                }
            }

            if (changed_any) {
                this.emit("device-changed");
            }
        });
    }

    // Getters for all properties
    get devicePath(): string {
        return this._devicePath;
    }

    get address(): string {
        return this._address ?? "";
    }

    get alias(): string {
        return this._alias ?? "";
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
        return new Promise((resolve, reject) => {
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
    }

    public async disconnectDevice(): Promise<void> {
        return new Promise((resolve, reject) => {
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
    }
}

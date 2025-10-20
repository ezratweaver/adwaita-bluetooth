import Gio from "gi://Gio?version=2.0";
import GObject from "gi://GObject?version=2.0";
import GLib from "gi://GLib?version=2.0";
import { Device, DEVICE_INTERFACE } from "./device.js";
import { BLUEZ_SERVICE, DBUS_PROPERTIES_SET } from "./bluetooth.js";

export const ADAPTER_INTERFACE = "org.bluez.Adapter1";

interface AdapterProps {
    adapterPath: string;
    systemBus: Gio.DBusConnection;
}

export class Adapter extends GObject.Object {
    private systemBus: Gio.DBusConnection;
    private adapterPath: string;
    private devicePaths: string[] = [];
    private adapterProxy: Gio.DBusProxy;

    private _powered: boolean = false;
    private _discovering: boolean = false;
    private _devices: Device[] = [];

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
                    discovering: GObject.ParamSpec.boolean(
                        "discovering",
                        "Discovering",
                        "Adapter currently discovering devices",
                        GObject.ParamFlags.READABLE,
                        false,
                    ),
                },
                Signals: {
                    "device-added": {
                        param_types: [Device.$gtype],
                    },
                    "device-removed": {
                        param_types: [GObject.TYPE_STRING],
                    },
                },
            },
            this,
        );
    }

    constructor(props: AdapterProps) {
        super();
        this.systemBus = props.systemBus;
        this.adapterPath = props.adapterPath;

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

        if (this._powered) {
            this.setAdapterDiscovering();
        }
    }

    private _loadProperties(): void {
        const powered = this.adapterProxy.get_cached_property("Powered");
        this._setPoweredState(powered?.deep_unpack() as boolean);

        const discovering =
            this.adapterProxy.get_cached_property("Discovering");

        this._setDiscoveringState(discovering?.deep_unpack() as boolean);
    }

    private _setupPropertyChangeListener(): void {
        this.adapterProxy.connect("g-properties-changed", (_, changed) => {
            const poweredValueChanged = changed.lookup_value("Powered", null);
            if (poweredValueChanged) {
                this._setPoweredState(poweredValueChanged.get_boolean());
            }

            const discoveringValueChanged = changed.lookup_value(
                "Discovering",
                null,
            );
            if (discoveringValueChanged) {
                this._setDiscoveringState(
                    discoveringValueChanged.get_boolean(),
                );
            }
        });
    }

    private _syncSavedDevices(): void {
        const objectManager = Gio.DBusObjectManagerClient.new_for_bus_sync(
            Gio.BusType.SYSTEM,
            Gio.DBusObjectManagerClientFlags.NONE,
            BLUEZ_SERVICE,
            "/",
            null,
            null,
        );

        for (const obj of objectManager.get_objects()) {
            const path = obj.get_object_path();
            if (
                path.includes(this.adapterPath) &&
                obj.get_interface(DEVICE_INTERFACE)
            ) {
                this.devicePaths.push(path);
            }
        }

        for (const devicePath of this.devicePaths) {
            let device: Device;
            try {
                device = new Device({
                    devicePath: devicePath,
                    systemBus: this.systemBus,
                });
            } catch (e) {
                log(
                    `Encountered an error while creating device ${devicePath}: ${e}`,
                );
                continue;
            }
            if (device.paired) {
                this.devices.push(device);
            }

            device.connect("device-changed", () => {
                this._sortDevices();
            });
        }

        objectManager.connect("object-added", (_, object) => {
            const hasDeviceInterface = object.get_interface(DEVICE_INTERFACE);

            if (hasDeviceInterface) {
                const path = object.get_object_path();
                if (path.includes(this.adapterPath)) {
                    let newDevice: Device;
                    try {
                        newDevice = new Device({
                            systemBus: this.systemBus,
                            devicePath: path as string,
                        });
                    } catch {
                        // Device failed to load, we're not gonna throw a fit about it
                        return;
                    }

                    this.devicePaths.push(path);
                    this.devices.push(newDevice);
                    this.emit("device-added", newDevice);
                }
            }
        });

        objectManager.connect("object-removed", (_, object) => {
            const hasDeviceInterface = object.get_interface(DEVICE_INTERFACE);

            if (hasDeviceInterface) {
                const path = object.get_object_path();
                if (path.includes(this.adapterPath)) {
                    const deviceIndex = this.devices.findIndex(
                        (device) => device.devicePath === path,
                    );

                    if (deviceIndex !== -1) {
                        this.devices.splice(deviceIndex, 1);
                        this.devicePaths = this.devicePaths.filter(
                            (p) => p !== path,
                        );
                        this.emit("device-removed", path);
                    }
                }
            }
        });
    }

    /*
     * Sorts devices by priority as:
     *
     * 1. Connected devices first
     * 2. Known but not connected devices second
     * 3. Unknown/non paired devices last
     */
    private _sortDevices(): void {
        this._devices.sort((a, b) => {
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

    private _setDiscoveringState(discovering: boolean) {
        if (this._discovering === discovering) return;
        this._discovering = discovering;
        this.notify("discovering");
    }

    private _setPoweredState(powered: boolean): void {
        if (this._powered === powered) return;
        this._powered = powered;
        this.notify("powered");
    }

    private StartDiscovery() {
        this.adapterProxy.call_sync(
            "StartDiscovery",
            null,
            Gio.DBusCallFlags.NONE,
            -1,
            null,
        );
    }

    private StopDiscovery() {
        this.adapterProxy.call_sync(
            "StopDiscovery",
            null,
            Gio.DBusCallFlags.NONE,
            -1,
            null,
        );
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

        if (powered) {
            this.setAdapterDiscovering();
        }
    }

    public setAdapterDiscovering(): void {
        this.StartDiscovery();

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 30 * 1000, () => {
            this.StopDiscovery();

            return false;
        });
    }

    get powered(): boolean {
        return this._powered;
    }

    get discovering(): boolean {
        return this._discovering;
    }

    get devices(): Device[] {
        return this._devices;
    }

    func_dispose() {
        if (this.discovering) {
            this.StopDiscovery();
        }

        super.vfunc_dispose();
    }
}

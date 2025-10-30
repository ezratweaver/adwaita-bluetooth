import Gio from "gi://Gio?version=2.0";
import GObject from "gi://GObject?version=2.0";
import GLib from "gi://GLib?version=2.0";
import { Device, DEVICE_INTERFACE } from "./device.js";
import {
    BLUEZ_SERVICE,
    DBUS_OBJECT_MANAGER,
    DBUS_PROPERTIES_SET,
    systemBus,
} from "./bluetooth.js";
import { BluetoothAgent } from "./agent.js";
import { ObexManager } from "./obex.js";

export const ADAPTER_INTERFACE = "org.bluez.Adapter1";

export class Adapter extends GObject.Object {
    private adapterPath: string;
    private devicePaths: string[] = [];
    private adapterProxy: Gio.DBusProxy;
    private agent: BluetoothAgent;
    private obex: ObexManager | null = null;

    private discoveryTimeoutId: number | null = null;

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
                        param_types: [GObject.TYPE_STRING],
                    },
                    "device-removed": {
                        param_types: [GObject.TYPE_STRING],
                    },
                },
            },
            this,
        );
    }

    constructor(adapterPath: string) {
        super();
        this.adapterPath = adapterPath;

        this.adapterProxy = Gio.DBusProxy.new_sync(
            systemBus,
            Gio.DBusProxyFlags.NONE,
            null,
            BLUEZ_SERVICE,
            this.adapterPath,
            ADAPTER_INTERFACE,
            null,
        );

        this.agent = new BluetoothAgent();

        try {
            this.obex = new ObexManager();
        } catch (e) {
            log(`Failed to initialize OBEX manager: ${e}`);
        }

        this._loadProperties();
        this._setupPropertyChangeListener();
        this._syncSavedDevices();

        if (this._powered) {
            this.startDiscovery();
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
        systemBus.signal_subscribe(
            BLUEZ_SERVICE,
            DBUS_OBJECT_MANAGER,
            "InterfacesAdded",
            "/",
            null,
            Gio.DBusSignalFlags.NONE,
            (_, _1, _2, _3, _4, parameters) => {
                const [path, interfaces] = parameters.deep_unpack() as [
                    string,
                    Record<string, Record<string, GLib.Variant>>,
                ];

                if (
                    path.includes(this.adapterPath) &&
                    interfaces[DEVICE_INTERFACE]
                ) {
                    log(`New device discovered ${path}`);

                    let newDevice: Device;
                    try {
                        newDevice = new Device({
                            blockAgent: this.agent.blockAgent.bind(this.agent),
                            freeAgent: this.agent.freeAgent.bind(this.agent),
                            devicePath: path,
                        });
                    } catch (e) {
                        log(`Failed to create device ${path}: ${e}`);
                        return;
                    }

                    if (!this.devicePaths.includes(path)) {
                        this.devicePaths.push(path);
                    }

                    this.devices.push(newDevice);

                    this.emit("device-added", newDevice.devicePath);
                }
            },
        );

        systemBus.signal_subscribe(
            BLUEZ_SERVICE,
            DBUS_OBJECT_MANAGER,
            "InterfacesRemoved",
            "/",
            null,
            Gio.DBusSignalFlags.NONE,
            (_, _1, _2, _3, _4, parameters) => {
                const [path, interfaces] = parameters.deep_unpack() as [
                    string,
                    string[],
                ];

                if (
                    path.includes(this.adapterPath) &&
                    interfaces.includes(DEVICE_INTERFACE)
                ) {
                    log(`Device getting removed ${path}`);

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
            },
        );

        const result = systemBus.call_sync(
            BLUEZ_SERVICE,
            "/",
            DBUS_OBJECT_MANAGER,
            "GetManagedObjects",
            null,
            new GLib.VariantType("(a{oa{sa{sv}}})"),
            Gio.DBusCallFlags.NONE,
            -1,
            null,
        );

        const [objects] = result.deep_unpack() as [
            Record<string, Record<string, Record<string, GLib.Variant>>>,
        ];

        for (const [path, interfaces] of Object.entries(objects)) {
            if (
                path.includes(this.adapterPath) &&
                interfaces[DEVICE_INTERFACE]
            ) {
                this.devicePaths.push(path);

                let device: Device;
                try {
                    device = new Device({
                        devicePath: path,
                        blockAgent: this.agent.blockAgent.bind(this.agent),
                        freeAgent: this.agent.freeAgent.bind(this.agent),
                    });
                } catch (e) {
                    log(
                        `Encountered an error while creating device ${path}: ${e}`,
                    );
                    continue;
                }

                log(`Discovered ${device.devicePath} on initial device sync`);

                if (device.paired) {
                    this.devices.push(device);
                }
            }
        }
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

    public startDiscovery() {
        this.adapterProxy.call_sync(
            "StartDiscovery",
            null,
            Gio.DBusCallFlags.NONE,
            -1,
            null,
        );
    }

    public stopDiscovery() {
        if (this.discoveryTimeoutId) {
            GLib.source_remove(this.discoveryTimeoutId);
        }

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
            this.startDiscovery();
        }
    }

    public removeDevice(devicePath: string): void {
        this.adapterProxy.call_sync(
            "RemoveDevice",
            new GLib.Variant("(o)", [devicePath]),
            Gio.DBusCallFlags.NONE,
            -1,
            null,
        );
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

    get bluetoothAgent(): BluetoothAgent {
        return this.agent;
    }

    get obexManager(): ObexManager | null {
        return this.obex;
    }

    func_dispose() {
        if (this.discovering) {
            this.stopDiscovery();
        }

        this.bluetoothAgent.unregister();

        for (const device of this.devices) {
            if (device.connecting) {
                // If we are mid connecting a device, close that connection
                device.disconnectDevice();
            }
        }

        super.vfunc_dispose();
    }
}

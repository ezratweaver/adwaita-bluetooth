import Gio from "gi://Gio";
import { Adapter, ADAPTER_INTERFACE } from "./adapter.js";
import { DEVICE_INTERFACE } from "./device.js";

export const BLUEZ_SERVICE = "org.bluez";

// D-Bus system interfaces
const DBUS_OBJECTMANAGER_INTERFACE = "org.freedesktop.DBus.ObjectManager";

export const DBUS_PROPERTIES_SET = "org.freedesktop.DBus.Properties.Set";

interface AdapterPathWithDevicePaths {
    adapterPath: string;
    devicePaths: string[];
}

export interface ErrorPopUp {
    title: string;
    description: string;
}

export class BluetoothManager {
    private systemBus: Gio.DBusConnection;

    private _adapter: Adapter | null = null;

    constructor() {
        this.systemBus = Gio.bus_get_sync(Gio.BusType.SYSTEM, null);
        this._initialize();
    }

    private _initialize(): void {
        try {
            const adapterPaths = this._getAdaptersAndDevices();

            // TODO: Allow user to pick between adapters
            const firstAdapter = adapterPaths[0];

            if (firstAdapter?.adapterPath) {
                this._adapter = new Adapter({
                    systemBus: this.systemBus,
                    adapterPath: firstAdapter.adapterPath,
                    devicePaths: firstAdapter.devicePaths,
                });
            }
        } catch (error) {
            // Silently fail - adapter will be null
        }
    }

    private _getAdaptersAndDevices(): AdapterPathWithDevicePaths[] {
        const bluezObjectsProxy = Gio.DBusProxy.new_sync(
            this.systemBus,
            Gio.DBusProxyFlags.NONE,
            null,
            BLUEZ_SERVICE,
            "/",
            DBUS_OBJECTMANAGER_INTERFACE,
            null,
        );

        const result = bluezObjectsProxy.call_sync(
            "GetManagedObjects",
            null,
            Gio.DBusCallFlags.NONE,
            -1,
            null,
        );

        const [managedObjects] = result.deep_unpack() as [
            Record<string, Record<string, any>>,
        ];

        const pathsAndInterfaces = Object.entries(managedObjects);

        const adapterPaths: string[] = [];
        for (const [path, interfaces] of pathsAndInterfaces) {
            if (ADAPTER_INTERFACE in interfaces) {
                adapterPaths.push(path);
            }
        }

        const adaptersAndDevices: AdapterPathWithDevicePaths[] = [];
        for (const adapterPath of adapterPaths) {
            const adapterAndDevice: AdapterPathWithDevicePaths = {
                adapterPath,
                devicePaths: [],
            };
            for (const [path, interfaces] of pathsAndInterfaces) {
                if (
                    path.includes(adapterPath) &&
                    DEVICE_INTERFACE in interfaces
                ) {
                    adapterAndDevice.devicePaths.push(path);
                }
            }
            adaptersAndDevices.push(adapterAndDevice);
        }

        return adaptersAndDevices;
    }

    get adapter(): Adapter | null {
        return this._adapter;
    }

    public destroy(): void {
        this._adapter = null;
    }
}

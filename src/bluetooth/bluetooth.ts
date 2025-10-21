import Gio from "gi://Gio";
import { Adapter, ADAPTER_INTERFACE } from "./adapter.js";
import { BluetoothAgent } from "./agent.js";

export const BLUEZ_SERVICE = "org.bluez";

export const DBUS_OBJECT_MANAGER = "org.freedesktop.DBus.ObjectManager";
export const DBUS_PROPERTIES_SET = "org.freedesktop.DBus.Properties.Set";

export interface ErrorPopUp {
    title: string;
    description: string;
}

export class BluetoothManager {
    private systemBus: Gio.DBusConnection;
    private _adapter: Adapter | null = null;
    private _agent: BluetoothAgent | null = null;

    constructor() {
        this.systemBus = Gio.bus_get_sync(Gio.BusType.SYSTEM, null);
        this._initialize();
        this._setupAgent();
    }

    private _initialize(): void {
        try {
            const adapterPaths = this._getAdaptersAndDevices();

            // TODO: Allow user to pick between adapters
            const firstAdapter = adapterPaths[0];

            if (firstAdapter) {
                try {
                    this._adapter = new Adapter({
                        systemBus: this.systemBus,
                        adapterPath: firstAdapter,
                    });
                } catch (e) {
                    log(`Error occured while initializing Adapter: ${e}`);
                }
            }
        } catch (error) {
            // Silently fail - adapter will be null
        }
    }

    private _getAdaptersAndDevices(): string[] {
        const objectManager = Gio.DBusObjectManagerClient.new_for_bus_sync(
            Gio.BusType.SYSTEM,
            Gio.DBusObjectManagerClientFlags.NONE,
            BLUEZ_SERVICE,
            "/",
            null,
            null,
        );

        const adapterPaths: string[] = [];
        for (const obj of objectManager.get_objects()) {
            const path = obj.get_object_path();
            if (obj.get_interface(ADAPTER_INTERFACE)) {
                adapterPaths.push(path);
            }
        }

        return adapterPaths;
    }

    get adapter(): Adapter | null {
        return this._adapter;
    }

    private _setupAgent(): void {
        this._agent = new BluetoothAgent({
            systemBus: this.systemBus,
        });

        try {
            this._agent.register();
            log("Bluetooth pairing agent registered successfully");
        } catch (error) {
            log(`Failed to register pairing agent: ${error}`);
            this._agent = null;
        }
    }

    get agent(): BluetoothAgent | null {
        return this._agent;
    }

    public destroy(): void {
        if (this._agent) {
            this._agent.unregister();
            this._agent = null;
        }
        this._adapter = null;
    }
}

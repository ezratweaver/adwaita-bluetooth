import Adw from "gi://Adw";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import { BluetoothManager, ErrorPopUp } from "./bluetooth/bluetooth.js";
import { Device } from "./bluetooth/device.js";

export class Window extends Adw.ApplicationWindow {
    private _bluetooth_toggle!: Gtk.Switch;
    private _disabled_state!: Gtk.Box;
    private _enabled_state!: Gtk.Box;
    private _devices_list!: Gtk.ListBox;
    private _discovering_spinner!: Adw.Spinner;

    private _bluetoothManager: BluetoothManager;

    private _deviceElements: Map<
        string,
        {
            row: Adw.ActionRow;
            spinner: Adw.Spinner;
            statusLabel: Gtk.Label;
        }
    > = new Map();

    static {
        GObject.registerClass(
            {
                Template: "resource:///com/eweaver/adw_bluetooth/ui/window.ui",
                InternalChildren: [
                    "toastOverlay",
                    "bluetooth-toggle",
                    "disabled-state",
                    "enabled-state",
                    "devices-list",
                    "discovering-spinner",
                ],
            },
            this,
        );

        Gtk.Widget.add_shortcut(
            new Gtk.Shortcut({
                action: new Gtk.NamedAction({ action_name: "window.close" }),
                trigger: Gtk.ShortcutTrigger.parse_string("<Control>w"),
            }),
        );
    }

    constructor(params?: Partial<Adw.ApplicationWindow.ConstructorProps>) {
        super(params);

        this._bluetoothManager = new BluetoothManager();

        if (!this._bluetoothManager.adapter) {
            this._showError({
                title: "No Bluetooth Adapter",
                description:
                    "Ensure BlueZ is configured correctly and try again",
            });
            return;
        }

        this._bluetoothManager.adapter.bind_property(
            "powered",
            this._bluetooth_toggle,
            "active",
            GObject.BindingFlags.SYNC_CREATE,
        );

        this._bluetoothManager.adapter.bind_property(
            "powered",
            this._disabled_state,
            "visible",
            GObject.BindingFlags.SYNC_CREATE |
                GObject.BindingFlags.INVERT_BOOLEAN,
        );

        this._bluetoothManager.adapter.bind_property(
            "powered",
            this._enabled_state,
            "visible",
            GObject.BindingFlags.SYNC_CREATE,
        );

        this._bluetoothManager.adapter.bind_property(
            "discovering",
            this._discovering_spinner,
            "visible",
            GObject.BindingFlags.SYNC_CREATE,
        );

        this._bluetooth_toggle.connect("state-set", (_, state) => {
            if (!this._bluetoothManager.adapter) {
                return true; // Prevent switch toggle if no adapter
            }

            try {
                this._bluetoothManager.adapter.setAdapterPower(state);
                return false; // Allow switch to toggle
            } catch (error) {
                this._showError({
                    title: "Power Control Error",
                    description: `Failed to set adapter power: ${error}`,
                });
                return true; // Prevent switch toggle on error
            }
        });

        this._bluetoothManager.adapter.devices.forEach(({ devicePath }) =>
            this._addDevice(devicePath),
        );

        this._bluetoothManager.adapter.connect(
            "device-added",
            (_, devicePath: string) => this._addDevice(devicePath),
        );
        this._bluetoothManager.adapter.connect(
            "device-removed",
            (_, devicePath: string) => this._removeDevice(devicePath),
        );
    }

    private _showError = (error: ErrorPopUp) => {
        const dialog = new Adw.AlertDialog({
            heading: error.title,
            body: error.description,
            closeResponse: "ok",
            defaultResponse: "ok",
        });

        dialog.add_response("ok", "OK");

        dialog.present(this);
    };

    private _addDevice(devicePath: string) {
        const device = this._bluetoothManager.adapter?.devices.find(
            (d) => d.devicePath === devicePath,
        );
        if (!device) {
            return;
        }

        const deviceHasName = !!device.name;

        const row = new Adw.ActionRow({
            name: device.devicePath,
            title: device.alias,
            activatable: true,
        });

        const statusLabel = new Gtk.Label({
            label: device.connectedStatus,
        });

        const spinner = new Adw.Spinner({
            visible: false,
        });

        row.add_suffix(statusLabel);
        row.add_suffix(spinner);

        this._deviceElements.set(device.devicePath, {
            row,
            spinner,
            statusLabel,
        });

        row.connect("activated", () => {
            this._handleDevicePair(device);
        });

        if (deviceHasName) {
            this._devices_list.append(row);
        }

        device.connect("device-changed", (device: Device) => {
            row.set_title(device.alias);

            statusLabel.set_label(device.connectedStatus);

            if (!deviceHasName && !!device.name) {
                this._devices_list.append(row);
            }
        });
    }

    private _removeDevice(devicePath: string) {
        const elements = this._deviceElements.get(devicePath);

        if (elements) {
            this._devices_list.remove(elements.row);
            this._deviceElements.delete(devicePath);
        }
    }

    private async _handleDevicePair(device: Device) {
        if (!device.paired) {
            return;
        }

        const elements = this._deviceElements.get(device.devicePath);
        if (!elements) return;

        elements.spinner.set_visible(true);
        elements.statusLabel.set_visible(false);

        try {
            if (device.connected) {
                await device.disconnectDevice();
            } else {
                await device.connectDevice();
            }
        } catch (error) {
            this._showError({
                title: "Connection Error",
                description: `Failed to ${device.connected ? "disconnect from" : "connect to"} ${device.alias}: ${error}`,
            });
        } finally {
            elements.spinner.set_visible(false);
            elements.statusLabel.set_visible(true);
        }
    }

    vfunc_close_request(): boolean {
        this._bluetoothManager.destroy();
        return super.vfunc_close_request();
    }
}

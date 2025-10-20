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

    private _displayedDevices: Map<string, Adw.ActionRow> = new Map();

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

        for (const device of this._bluetoothManager.adapter.devices) {
            this._addDevice(device);
        }

        this._bluetoothManager.adapter.connect("device-added", this._addDevice);
        this._bluetoothManager.adapter.connect(
            "device-removed",
            this._removeDevice,
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

    private _addDevice(device: Device) {
        const row = new Adw.ActionRow({
            name: device.devicePath,
            title: device.name,
            activatable: true,
        });

        const icon = new Gtk.Image({
            icon_name: "bluetooth-active-symbolic",
        });

        row.add_prefix(icon);

        const statusLabel = new Gtk.Label({
            label: device.connectedStatus,
        });

        row.add_suffix(statusLabel);

        this._devices_list.append(row);

        device.connect("device-changed", (device: Device) => {
            row.set_title(device.name);

            statusLabel.set_label(device.connectedStatus);
        });

        this._displayedDevices.set(device.devicePath, row);
    }

    private _removeDevice(devicePath: string) {
        const row = this._displayedDevices.get(devicePath);

        if (row) this._devices_list.remove(row);

        this._displayedDevices.delete(devicePath);
    }

    vfunc_close_request(): boolean {
        this._bluetoothManager.destroy();
        return super.vfunc_close_request();
    }
}

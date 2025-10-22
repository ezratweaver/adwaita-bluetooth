import Adw from "gi://Adw";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import { BluetoothManager, ErrorPopUp } from "./bluetooth/bluetooth.js";
import { Device } from "./bluetooth/device.js";
import { DeviceDetailsWindow } from "./device-details-window.js";

export class Window extends Adw.ApplicationWindow {
    private _bluetooth_toggle!: Gtk.Switch;
    private _disabled_state!: Gtk.Box;
    private _enabled_state!: Gtk.Box;
    private _devices_list!: Gtk.ListBox;
    private _discovering_spinner!: Adw.Spinner;
    private _toast_overlay!: Adw.ToastOverlay;

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
                    "toast-overlay",
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

        /*
         * Sorts devices by priority as:
         *
         * 1. Connected devices first
         * 2. Known but not connected devices second
         * 3. Unknown/non paired devices last
         */
        this._devices_list.set_sort_func((row1, row2) => {
            const device1 = this._bluetoothManager.adapter?.devices.find(
                (d) => d.devicePath === row1.name,
            );
            const device2 = this._bluetoothManager.adapter?.devices.find(
                (d) => d.devicePath === row2.name,
            );

            if (!device1 || !device2) return 0;

            if (device1.connected && !device2.connected) return -1;
            if (!device1.connected && device2.connected) return 1;

            if (device1.paired && !device2.paired) return -1;
            if (!device1.paired && device2.paired) return 1;

            return 0;
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

        // Listen for PIN requests from the agent
        this._bluetoothManager.adapter.bluetoothAgent.connect(
            "pin-request",
            (_, devicePath: string, requestId: string) =>
                this._showPinDialog(devicePath, requestId),
        );

        // Listen for confirmation requests from the agent
        this._bluetoothManager.adapter.bluetoothAgent.connect(
            "confirmation-request",
            (_, devicePath: string, requestId: string, passkey: number) =>
                this._showConfirmationDialog(devicePath, requestId, passkey),
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

    private _showPinDialog(devicePath: string, requestId: string) {
        // Get device info for the dialog
        const device = this._bluetoothManager.adapter?.devices.find(
            (d) => d.devicePath === devicePath,
        );
        const deviceName = device?.alias;

        const dialog = new Adw.AlertDialog({
            heading: "PIN Required",
            body: `Enter the PIN code for ${deviceName}`,
            closeResponse: "cancel",
            defaultResponse: "pair",
        });

        dialog.add_response("cancel", "Cancel");
        dialog.add_response("pair", "Pair");
        dialog.set_response_appearance(
            "pair",
            Adw.ResponseAppearance.SUGGESTED,
        );

        // Create PIN entry
        const pinEntry = new Gtk.Entry({
            placeholder_text: "Enter PIN (e.g. 0000)",
            max_length: 16,
            input_purpose: Gtk.InputPurpose.DIGITS,
        });

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
        });
        box.append(pinEntry);
        dialog.set_extra_child(box);

        dialog.connect("response", (_, response) => {
            if (response === "pair") {
                const pin = pinEntry.get_text().trim();
                if (pin) {
                    this._bluetoothManager.adapter?.bluetoothAgent.providePinCode(
                        requestId,
                        pin,
                    );
                } else {
                    this._bluetoothManager.adapter?.bluetoothAgent.cancelPinRequest(
                        requestId,
                    );
                }
            } else {
                this._bluetoothManager.adapter?.bluetoothAgent.cancelPinRequest(
                    requestId,
                );
            }
        });

        dialog.present(this);
        pinEntry.grab_focus();
    }

    private _showConfirmationDialog(
        devicePath: string,
        requestId: string,
        passkey: number,
    ) {
        // Get device info for the dialog
        const device = this._bluetoothManager.adapter?.devices.find(
            (d) => d.devicePath === devicePath,
        );
        const deviceName = device?.alias;

        const dialog = new Adw.AlertDialog({
            heading: "Confirm Pairing",
            body: `Confirm that the passkey shown on ${deviceName} matches:\n\n${passkey.toString().padStart(6, "0")}`,
            closeResponse: "cancel",
            defaultResponse: "confirm",
        });

        dialog.add_response("cancel", "Cancel");
        dialog.add_response("confirm", "Confirm");
        dialog.set_response_appearance(
            "confirm",
            Adw.ResponseAppearance.SUGGESTED,
        );

        dialog.connect("response", (_, response) => {
            if (response === "confirm") {
                this._bluetoothManager.adapter?.bluetoothAgent.confirmPairing(
                    requestId,
                );
            } else {
                this._bluetoothManager.adapter?.bluetoothAgent.cancelConfirmation(
                    requestId,
                );
            }
        });

        dialog.present(this);
    }

    private _showDeviceDetails(device: Device) {
        const detailsWindow = new DeviceDetailsWindow(
            device,
            this._bluetoothManager.adapter!,
            this,
        );
        detailsWindow.present();
    }

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

        device.bind_property(
            "connecting",
            spinner,
            "visible",
            GObject.BindingFlags.SYNC_CREATE,
        );

        device.bind_property(
            "connecting",
            statusLabel,
            "visible",
            GObject.BindingFlags.SYNC_CREATE |
                GObject.BindingFlags.INVERT_BOOLEAN,
        );

        this._deviceElements.set(device.devicePath, {
            row,
            spinner,
            statusLabel,
        });

        row.connect("activated", () => {
            if (!device.connecting) {
                if (device.paired) {
                    this._showDeviceDetails(device);
                } else {
                    this._handleDevicePair(device);
                }
            }
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

            // Trigger resort when connection status changes
            this._devices_list.invalidate_sort();
        });
    }

    private _removeDevice(devicePath: string) {
        const elements = this._deviceElements.get(devicePath);

        if (elements) {
            // Check if the row is actually a child before removing
            const parent = elements.row.get_parent();
            if (parent === this._devices_list) {
                try {
                    this._devices_list.remove(elements.row);
                } catch (error) {
                    log(`Error removing device row: ${error}`);
                }
            }

            this._deviceElements.delete(devicePath);
        }
    }

    private async _handleDevicePair(device: Device) {
        try {
            if (!device.paired) {
                // Pair first if not paired
                await device.pairDevice();
                // After successful pairing, connect automatically
                await device.connectDevice();
            } else if (device.connected) {
                // If connected, disconnect
                await device.disconnectDevice();
            } else {
                // If paired but not connected, connect
                await device.connectDevice();
            }
        } catch (error) {
            const action = !device.paired
                ? "pair with"
                : device.connected
                  ? "disconnect from"
                  : "connect to";

            log(`An error occurred while trying to ${action} device: ${error}`);

            const toast = new Adw.Toast({
                title: `Failed to ${action} ${device.alias}`,
                timeout: 3,
            });
            this._toast_overlay.add_toast(toast);
        }
    }

    vfunc_close_request(): boolean {
        this._bluetoothManager.destroy();
        return super.vfunc_close_request();
    }
}

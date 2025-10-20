import Adw from "gi://Adw";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import { BluetoothManager, ErrorPopUp } from "./bluetooth/bluetooth.js";

export class Window extends Adw.ApplicationWindow {
    private _bluetooth_toggle!: Gtk.Switch;
    private _disabled_state!: Gtk.Box;

    private _bluetoothManager: BluetoothManager;

    static {
        GObject.registerClass(
            {
                Template: "resource:///com/eweaver/adw_bluetooth/ui/window.ui",
                InternalChildren: [
                    "toastOverlay",
                    "bluetooth-toggle",
                    "disabled-state",
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
            this._ShowError({
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

        this._bluetooth_toggle.connect("state-set", (_, state) => {
            if (!this._bluetoothManager.adapter) {
                return true; // Prevent switch toggle if no adapter
            }

            try {
                this._bluetoothManager.adapter.setAdapterPower(state);
                return false; // Allow switch to toggle
            } catch (error) {
                this._ShowError({
                    title: "Power Control Error",
                    description: `Failed to set adapter power: ${error}`,
                });
                return true; // Prevent switch toggle on error
            }
        });
    }

    private _ShowError = (error: ErrorPopUp) => {
        const dialog = new Adw.AlertDialog({
            heading: error.title,
            body: error.description,
            closeResponse: "ok",
            defaultResponse: "ok",
        });

        dialog.add_response("ok", "OK");

        dialog.present(this);
    };

    vfunc_close_request(): boolean {
        this._bluetoothManager.destroy();
        return super.vfunc_close_request();
    }
}

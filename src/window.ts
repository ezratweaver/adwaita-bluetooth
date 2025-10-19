import Adw from "gi://Adw";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import { BluetoothManager, ErrorPopUp } from "./bluetooth.js";

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
        // Disable X button on the top right, since we are targeting Hyprland / Tiling WMs
        this.set_deletable(false);

        this._bluetoothManager = new BluetoothManager({
            onError: this._onError,
            onPowerChanged: this._onPowerChanged,
        });

        this._bluetooth_toggle.connect("state-set", (switch_, state) => {
            this._bluetoothManager.setAdapterPower(state);

            switch_.set_active(state);
            this._disabled_state.visible = !state;
        });
    }

    private _onError(error: ErrorPopUp) {
        log(error);
    }

    private _onPowerChanged(powered: boolean) {
        this._bluetooth_toggle.set_active(powered);
        this._disabled_state.visible = !powered;
    }
}

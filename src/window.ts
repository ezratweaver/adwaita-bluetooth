import Adw from "gi://Adw";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import {
    getDefaultAdapter,
    isAdapterPowered,
    setAdapterPower,
} from "./bluetooth.js";

export class Window extends Adw.ApplicationWindow {
    private _bluetooth_toggle!: Gtk.Switch;

    static {
        GObject.registerClass(
            {
                Template: "resource:///com/eweaver/adw_bluetooth/ui/window.ui",
                InternalChildren: ["toastOverlay", "bluetooth-toggle"],
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

        const defaultAdapter = getDefaultAdapter();
        let adapterPowered: boolean = false;

        if (defaultAdapter) {
            adapterPowered = isAdapterPowered(defaultAdapter);
        } else {
            // Implement logic to display to the user, that no adapters were found
            return;
        }

        this._bluetooth_toggle.set_active(adapterPowered);

        this._bluetooth_toggle.connect("state-set", (switch_, state) => {
            setAdapterPower(defaultAdapter, state);

            switch_.set_active(state);
        });

        this.set_deletable(false); // Disable X button on the top right, since we are targeting Hyprland / Tiling WMs
    }
}

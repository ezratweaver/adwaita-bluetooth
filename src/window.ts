import Adw from "gi://Adw";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";

export class Window extends Adw.ApplicationWindow {
    static {
        GObject.registerClass(
            {
                Template: "resource:///com/eweaver/adw_bluetooth/ui/window.ui",
                InternalChildren: ["toastOverlay"],
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

        this.set_deletable(false); // Disable X button on the top right, since we are targeting Hyprland / Tiling WMs
    }
}

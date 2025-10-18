import Adw from "gi://Adw";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";

export class Window extends Adw.ApplicationWindow {
    private _toastOverlay!: Adw.ToastOverlay;

    static {
        GObject.registerClass(
            {
                Template: "resource:///com/eweaver/adw_bluetooth/window.ui",
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

        const openLink = new Gio.SimpleAction({
            name: "open-link",
            parameter_type: GLib.VariantType.new("s"),
        });

        openLink.connect("activate", (_source, param) => {
            if (param) {
                // When using a variant parameter, we need to get the type we expect
                const link = param.get_string()[0];

                const launcher = new Gtk.UriLauncher({ uri: link });

                launcher
                    .launch(this, null)
                    .then(() => {
                        const toast = new Adw.Toast({
                            title: _("Opened link"),
                        });
                        this._toastOverlay.add_toast(toast);
                    })
                    .catch(console.error);
            }
        });

        this.add_action(openLink);
    }
}

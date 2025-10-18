import Adw from "gi://Adw";
import Gio from "gi://Gio";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";

import { Window } from "./window.js";

export class Application extends Adw.Application {
    private window?: Window;

    static {
        GObject.registerClass(this);
    }

    constructor() {
        super({
            application_id: "com.eweaver.adw_bluetooth",
            flags: Gio.ApplicationFlags.DEFAULT_FLAGS,
        });

        const quit_action = new Gio.SimpleAction({ name: "quit" });
        quit_action.connect("activate", () => {
            this.quit();
        });

        this.add_action(quit_action);
        this.set_accels_for_action("app.quit", ["<Control>q"]);

        const show_about_action = new Gio.SimpleAction({ name: "about" });
        show_about_action.connect("activate", () => {
            const aboutDialog = new Adw.AboutDialog({
                application_name: _("AdwBluetooth"),
                application_icon: "bluetooth",
                developer_name: "Ezra Weaver",
                version: "0.0.1",
            });

            aboutDialog.present(this.active_window);
        });

        this.add_action(show_about_action);

        Gio._promisify(Gtk.UriLauncher.prototype, "launch", "launch_finish");
    }

    public vfunc_activate(): void {
        if (!this.window) {
            this.window = new Window({ application: this });
        }

        this.window.present();
    }
}

export function main(argv: string[]): Promise<number> {
    const app = new Application();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
    return app.runAsync(argv);
}

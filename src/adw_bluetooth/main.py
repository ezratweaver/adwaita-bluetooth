#!/usr/bin/env python3
import sys
import gi

gi.require_version("Gtk", "4.0")
gi.require_version("Adw", "1")

from gi.repository import Gtk, Adw, Gio


class AdwBluetooth(Adw.Application):
    def __init__(self):
        super().__init__(application_id="com.eweaver.adw-bluetooth")

    def do_activate(self, *args):
        win = MainWindow(self)
        win.present()


class MainWindow(Adw.ApplicationWindow):
    def __init__(self, app):
        super().__init__(application=app, title="Bluetooth")

        # Libadwaita layout pattern
        view = Adw.ToolbarView()

        # Header bar goes in the top bar
        header = Adw.HeaderBar()
        view.add_top_bar(header)

        self.set_content(view)


if __name__ == "__main__":
    app = AdwBluetooth()
    app.run(sys.argv)

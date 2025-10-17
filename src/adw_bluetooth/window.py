import gi

gi.require_version("Gtk", "4.0")
gi.require_version("Adw", "1")

from gi.repository import Adw


class AdwBluetooth(Adw.Application):
    def __init__(self):
        super().__init__(application_id="com.eweaver.adwbluetooth")

    def do_activate(self, *args):
        win = MainWindow(self)
        win.present()


class MainWindow(Adw.ApplicationWindow):
    def __init__(self, app):
        super().__init__(
            application=app, title="Bluetooth", default_height=510, default_width=550
        )

        # Libadwaita layout pattern
        view = Adw.ToolbarView()

        # Header bar goes in the top bar
        header = Adw.HeaderBar()
        view.add_top_bar(header)

        self.set_content(view)

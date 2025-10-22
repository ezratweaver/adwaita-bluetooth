import Adw from "gi://Adw";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import { Device } from "./bluetooth/device.js";
import GLib from "gi://GLib?version=2.0";

export class DeviceDetailsWindow extends Adw.Window {
    private device: Device;
    private _connection_switch!: Gtk.Switch;
    private _paired_row!: Adw.ActionRow;
    private _type_row!: Adw.ActionRow;
    private _address_row!: Adw.ActionRow;
    private _forget_button!: Adw.ButtonRow;
    private _device_icon!: Gtk.Image;
    private _device_name!: Gtk.Label;

    static {
        GObject.registerClass(
            {
                Template:
                    "resource:///com/eweaver/adw_bluetooth/ui/device-details.ui",
                InternalChildren: [
                    "connection_switch",
                    "paired_row",
                    "type_row",
                    "address_row",
                    "forget_button",
                    "device_icon",
                    "device_name",
                ],
            },
            this,
        );
    }

    constructor(device: Device, parent: Gtk.Window) {
        super({
            transientFor: parent,
        });

        this.device = device;

        this._paired_row.set_subtitle(device.paired ? "Yes" : "No");
        this._type_row.set_subtitle(device.deviceType);
        this._address_row.set_subtitle(device.address);

        this._device_icon.set_from_icon_name(
            device.icon || "bluetooth-symbolic",
        );
        this._device_name.set_text(
            device.alias || device.name || device.address,
        );

        this.device.bind_property(
            "connected",
            this._connection_switch,
            "active",
            GObject.BindingFlags.SYNC_CREATE,
        );

        this._connection_switch.connect("state-set", (_, state) => {
            if (state && !device.connected) {
                device.connectDevice();
            } else if (!state && device.connected) {
                device.disconnectDevice();
            }
            return false;
        });

        this._forget_button.connect("activated", () => {
            this.showForgetDialog();
        });
    }

    private showForgetDialog(): void {
        const deviceName =
            this.device.alias || this.device.name || this.device.address;

        const dialog = new Adw.AlertDialog({
            heading: "Forget Device?",
            body: `"${deviceName}" will be removed from your saved devices. You will have to set it up again to use it.`,
        });

        dialog.add_response("cancel", "Cancel");
        dialog.add_response("forget", "Forget");
        dialog.set_response_appearance(
            "forget",
            Adw.ResponseAppearance.DESTRUCTIVE,
        );

        dialog.connect("response", (_, response) => {
            if (response === "forget") {
                // TODO: Implement device removal
                this.close();
            }
        });

        dialog.present(this);
    }
}

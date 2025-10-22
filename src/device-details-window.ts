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
    }
}

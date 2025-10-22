import Adw from "gi://Adw";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import { Device } from "./bluetooth/device.js";

export class DeviceDetailsWindow extends Adw.Window {
    private device: Device;
    private _paired_row!: Adw.ActionRow;
    private _type_row!: Adw.ActionRow;
    private _address_row!: Adw.ActionRow;

    static {
        GObject.registerClass(
            {
                Template:
                    "resource:///com/eweaver/adw_bluetooth/ui/device-details.ui",
                InternalChildren: ["paired_row", "type_row", "address_row"],
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
        this._type_row.set_subtitle("N/A");
        this._address_row.set_subtitle(device.address);
    }
}

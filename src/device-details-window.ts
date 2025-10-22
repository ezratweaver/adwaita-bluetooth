import Adw from "gi://Adw";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import { Device } from "./bluetooth/device.js";

export class DeviceDetailsWindow extends Adw.Window {
    private device: Device;

    static {
        GObject.registerClass(
            {
                Template:
                    "resource:///com/eweaver/adw_bluetooth/ui/device-details.ui",
            },
            this,
        );
    }

    constructor(device: Device, parent: Gtk.Window) {
        super({
            transientFor: parent,
            title: `${device.alias} Details`,
        });

        this.device = device;
    }
}

import Adw from "gi://Adw";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";

export class PinConfirmationDialog extends Adw.Dialog {
    private _cancel_button!: Gtk.Button;
    private _confirm_button!: Gtk.Button;
    private _device_message!: Gtk.Label;
    private _pin_label!: Gtk.Label;

    static {
        GObject.registerClass(
            {
                Template:
                    "resource:///com/eweaver/adw_bluetooth/ui/pin-confirmation.ui",
                InternalChildren: [
                    "cancel_button",
                    "confirm_button",
                    "device_message",
                    "pin_label",
                ],
                Signals: {
                    confirmed: {},
                    cancelled: {},
                },
            },
            this,
        );
    }

    constructor(deviceName: string, pin: string) {
        super();

        this._device_message.set_text(
            `Please confirm that the following PIN matches the one displayed on "${deviceName}".`,
        );
        this._pin_label.set_text(pin.padStart(6, "0"));

        this._cancel_button.connect("clicked", () => {
            this.emit("cancelled");
            this.close();
        });

        this._confirm_button.connect("clicked", () => {
            this.emit("confirmed");
            this.close();
        });
    }
}
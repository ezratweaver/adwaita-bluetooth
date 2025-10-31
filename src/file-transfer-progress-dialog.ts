import Adw from "gi://Adw";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";

export class FileTransferProgressDialog extends Adw.Dialog {
    private _cancel_button!: Gtk.Button;
    private _retry_button!: Gtk.Button;
    private _from_label!: Gtk.Label;
    private _to_label!: Gtk.Label;
    private _progress_bar!: Gtk.ProgressBar;
    private _error_box!: Gtk.Box;
    private _error_label!: Gtk.Label;

    static {
        GObject.registerClass(
            {
                Template:
                    "resource:///com/ezratweaver/AdwBluetooth/ui/file-transfer-progress.ui",
                InternalChildren: [
                    "cancel_button",
                    "retry_button",
                    "from_label",
                    "to_label",
                    "progress_bar",
                    "error_box",
                    "error_label",
                ],
                Signals: {
                    cancelled: {},
                    retry: {},
                },
            },
            this,
        );
    }

    constructor(deviceName: string) {
        super();

        this._to_label.set_text(deviceName);

        this._cancel_button.connect("clicked", () => {
            this.emit("cancelled");
            this.close();
        });

        this._retry_button.connect("clicked", () => {
            this.emit("retry");
        });
    }

    public updateProgress(transferred: number, total: number): void {
        const progress = transferred / total;
        this._progress_bar.set_fraction(progress);
    }

    public updateCurrentFile(filePath: string): void {
        this._from_label.set_text(filePath);
    }

    public showError(error: string): void {
        this._error_label.set_text(error);
        this._error_box.set_visible(true);
        this._retry_button.set_sensitive(true);
        this._retry_button.set_visible(true);
    }

    public hideError(): void {
        this._error_box.set_visible(false);
        this._retry_button.set_sensitive(false);
        this._retry_button.set_visible(false);
    }
}

import Gio from "gi://Gio";
import GLib from "gi://GLib?version=2.0";

const BLUEZ_SERVICE = "org.bluez";
const DBUS_OM_IFACE = "org.freedesktop.DBus.ObjectManager";
const DBUS_PROP_IFACE = "org.freedesktop.DBus.Properties";
const ADAPTER_IFACE = "org.bluez.Adapter1";

const systemBus = Gio.bus_get_sync(Gio.BusType.SYSTEM, null);

/*
 * TODO: Implement support for changing adapters
 */

/**
 * Return the first available Bluetooth adapter path.
 */
export function getDefaultAdapter(): string | null {
    const objManager = new Gio.DBusProxy({
        g_connection: systemBus,
        g_name: BLUEZ_SERVICE,
        g_object_path: "/",
        g_interface_name: DBUS_OM_IFACE,
    });

    const [managedObjects] = objManager
        .call_sync("GetManagedObjects", null, Gio.DBusCallFlags.NONE, -1, null)
        .deep_unpack() as any;

    for (const [path, interfaces] of Object.entries(managedObjects)) {
        if (ADAPTER_IFACE in (interfaces as any)) {
            return path;
        }
    }

    return null;
}

/**
 * Check whether the given adapter is powered on.
 */
export function isAdapterPowered(adapterPath: string): boolean {
    const propsProxy = new Gio.DBusProxy({
        g_connection: systemBus,
        g_name: BLUEZ_SERVICE,
        g_object_path: adapterPath,
        g_interface_name: DBUS_PROP_IFACE,
    });

    const [value]: [GLib.Variant] = propsProxy
        .call_sync(
            "Get",
            new GLib.Variant("(ss)", [ADAPTER_IFACE, "Powered"]),
            Gio.DBusCallFlags.NONE,
            -1,
            null,
        )
        .deep_unpack();

    return value.unpack() as boolean;
}

/**
 * Set adapter power state (true = on, false = off).
 */
export function setAdapterPower(adapterPath: string, powered: boolean): void {
    const propsProxy = new Gio.DBusProxy({
        g_connection: systemBus,
        g_name: BLUEZ_SERVICE,
        g_object_path: adapterPath,
        g_interface_name: DBUS_PROP_IFACE,
    });

    propsProxy.call_sync(
        "Set",
        new GLib.Variant("(ssv)", [
            ADAPTER_IFACE,
            "Powered",
            new GLib.Variant("b", powered),
        ]),
        Gio.DBusCallFlags.NONE,
        -1,
        null,
    );
}

export const DEVICE_INTERFACE = "org.bluez.Device1";

export interface Device {
    address: string;
    devicePath: string;
    alias: string;
    blocked: boolean;
    bonded: boolean;
    connected: boolean;
    name: string;
    paired: boolean;
    trusted: boolean;
}

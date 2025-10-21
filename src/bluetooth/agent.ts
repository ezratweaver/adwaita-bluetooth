import Gio from "gi://Gio?version=2.0";
import GLib from "gi://GLib?version=2.0";
import { BLUEZ_SERVICE } from "./bluetooth.js";

export const AGENT_INTERFACE = "org.bluez.Agent1";
export const AGENT_MANAGER_INTERFACE = "org.bluez.AgentManager1";

interface AgentProps {
    systemBus: Gio.DBusConnection;
}

export class BluetoothAgent {
    private systemBus: Gio.DBusConnection;
    private agentPath: string = "/com/eweaver/adw_bluetooth/agent";
    private agentNodeInfo: Gio.DBusNodeInfo;
    private registrationId: number | null = null;

    constructor(props: AgentProps) {
        this.systemBus = props.systemBus;

        const agentXml = `
            <node>
                <interface name="org.bluez.Agent1">
                    <method name="RequestPinCode">
                        <arg name="device" type="o" direction="in"/>
                        <arg name="pincode" type="s" direction="out"/>
                    </method>
                    <method name="DisplayPinCode">
                        <arg name="device" type="o" direction="in"/>
                        <arg name="pincode" type="s" direction="in"/>
                    </method>
                    <method name="RequestPasskey">
                        <arg name="device" type="o" direction="in"/>
                        <arg name="passkey" type="u" direction="out"/>
                    </method>
                    <method name="DisplayPasskey">
                        <arg name="device" type="o" direction="in"/>
                        <arg name="passkey" type="u" direction="in"/>
                        <arg name="entered" type="q" direction="in"/>
                    </method>
                    <method name="RequestConfirmation">
                        <arg name="device" type="o" direction="in"/>
                        <arg name="passkey" type="u" direction="in"/>
                    </method>
                    <method name="RequestAuthorization">
                        <arg name="device" type="o" direction="in"/>
                    </method>
                    <method name="AuthorizeService">
                        <arg name="device" type="o" direction="in"/>
                        <arg name="uuid" type="s" direction="in"/>
                    </method>
                    <method name="Cancel"/>
                </interface>
            </node>
        `;

        this.agentNodeInfo = Gio.DBusNodeInfo.new_for_xml(agentXml);
    }

    public register(): void {
        const agentInterface =
            this.agentNodeInfo.lookup_interface(AGENT_INTERFACE);
        if (!agentInterface) {
            throw new Error("Failed to lookup Agent interface");
        }

        this.registrationId = this.systemBus.register_object(
            this.agentPath,
            agentInterface,
            this._handleMethodCall.bind(this),
            null,
            null,
        );

        // Register agent with BlueZ
        this.systemBus.call_sync(
            BLUEZ_SERVICE,
            "/org/bluez",
            AGENT_MANAGER_INTERFACE,
            "RegisterAgent",
            new GLib.Variant("(os)", [this.agentPath, "NoInputNoOutput"]),
            null,
            Gio.DBusCallFlags.NONE,
            -1,
            null,
        );

        // Request default agent
        this.systemBus.call_sync(
            BLUEZ_SERVICE,
            "/org/bluez",
            AGENT_MANAGER_INTERFACE,
            "RequestDefaultAgent",
            new GLib.Variant("(o)", [this.agentPath]),
            null,
            Gio.DBusCallFlags.NONE,
            -1,
            null,
        );
    }

    public unregister(): void {
        if (this.registrationId) {
            this.systemBus.unregister_object(this.registrationId);
            this.registrationId = null;
        }

        try {
            this.systemBus.call_sync(
                BLUEZ_SERVICE,
                "/org/bluez",
                AGENT_MANAGER_INTERFACE,
                "UnregisterAgent",
                new GLib.Variant("(o)", [this.agentPath]),
                null,
                Gio.DBusCallFlags.NONE,
                -1,
                null,
            );
        } catch (error) {
            log(`Failed to unregister agent: ${error}`);
        }
    }

    private _handleMethodCall(
        _: Gio.DBusConnection,
        _1: string,
        _2: string,
        _3: string,
        methodName: string,
        parameters: GLib.Variant,
        invocation: Gio.DBusMethodInvocation,
    ): void {
        const handleAsync = async () => {
            try {
                switch (methodName) {
                    case "RequestPinCode": {
                        // TODO: Implement PIN code input dialog
                        invocation.return_dbus_error(
                            "org.bluez.Error.Rejected",
                            "PIN request not implemented yet",
                        );
                        break;
                    }
                    case "DisplayPinCode": {
                        // TODO: Implement PIN code display dialog
                        invocation.return_value(null);
                        break;
                    }
                    case "RequestPasskey": {
                        // TODO: Implement passkey input dialog
                        invocation.return_dbus_error(
                            "org.bluez.Error.Rejected",
                            "Passkey request not implemented yet",
                        );
                        break;
                    }
                    case "DisplayPasskey": {
                        // TODO: Implement passkey display dialog
                        invocation.return_value(null);
                        break;
                    }
                    case "RequestConfirmation": {
                        // Auto-confirm for devices that support it
                        invocation.return_value(null);
                        break;
                    }
                    case "RequestAuthorization": {
                        // Auto-authorize pairing requests
                        invocation.return_value(null);
                        break;
                    }
                    case "AuthorizeService": {
                        // Auto-authorize service connections
                        invocation.return_value(null);
                        break;
                    }
                    case "Cancel": {
                        invocation.return_value(null);
                        break;
                    }
                    default:
                        invocation.return_dbus_error(
                            "org.freedesktop.DBus.Error.UnknownMethod",
                            `Unknown method: ${methodName}`,
                        );
                        break;
                }
            } catch (error) {
                invocation.return_dbus_error(
                    "org.bluez.Error.Failed",
                    `Agent error: ${error}`,
                );
            }
        };

        handleAsync().catch((error) => {
            log(`Agent method call error: ${error}`);
            invocation.return_dbus_error(
                "org.bluez.Error.Failed",
                `Agent error: ${error}`,
            );
        });
    }
}

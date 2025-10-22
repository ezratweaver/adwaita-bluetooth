import Gio from "gi://Gio?version=2.0";
import GLib from "gi://GLib?version=2.0";
import GObject from "gi://GObject?version=2.0";
import { BLUEZ_SERVICE } from "./bluetooth.js";

export const AGENT_INTERFACE = "org.bluez.Agent1";
export const AGENT_MANAGER_INTERFACE = "org.bluez.AgentManager1";

interface AgentProps {
    systemBus: Gio.DBusConnection;
}

export class BluetoothAgent extends GObject.Object {
    private systemBus: Gio.DBusConnection;
    private agentPath: string = "/com/eweaver/adw_bluetooth/agent";
    private agentNodeInfo: Gio.DBusNodeInfo;
    private registrationId: number | null = null;
    private pendingRequests: Map<string, Gio.DBusMethodInvocation> = new Map();

    static {
        GObject.registerClass(
            {
                Signals: {
                    "confirmation-request": {
                        param_types: [
                            GObject.TYPE_STRING,
                            GObject.TYPE_STRING,
                            GObject.TYPE_UINT,
                        ],
                    },
                },
            },
            this,
        );
    }

    constructor(props: AgentProps) {
        super();
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
        if (this.registrationId) {
            throw new Error("Another device is already using agent to pair");
        }

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
            new GLib.Variant("(os)", [this.agentPath, "DisplayYesNo"]),
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
                    case "DisplayPinCode": {
                        // TODO: Implement PIN code display dialog to show to user
                        invocation.return_dbus_error(
                            "org.bluez.Error.Rejected",
                            "Passkey request not implemented yet",
                        );
                        break;
                    }
                    case "DisplayPasskey": {
                        // TODO: Implement passkey display dialog to show to user
                        invocation.return_dbus_error(
                            "org.bluez.Error.Rejected",
                            "Passkey request not implemented yet",
                        );
                        break;
                    }
                    case "RequestAuthorization": {
                        // TODO: Implement pop-up for devices to request pairing, give a yes or no for user to accept / decline
                        invocation.return_dbus_error(
                            "org.bluez.Error.Rejected",
                            "Passkey request not implemented yet",
                        );
                        break;
                    }
                    case "RequestConfirmation": {
                        const [devicePath, passkey] =
                            parameters.deep_unpack() as [string, number];
                        const requestId = `confirm-${Date.now()}`;

                        this.pendingRequests.set(requestId, invocation);

                        this.emit(
                            "confirmation-request",
                            devicePath,
                            requestId,
                            passkey,
                        );
                        break;
                    }
                    case "AuthorizeService": {
                        // When a bluetooth peripheral requests for access to a specifc service, this gets called
                        // Most modern bluetooth managers accept by default, so thats what we'll do.
                        invocation.return_value(null);
                        break;
                    }
                    case "Cancel": {
                        // TODO: Update state on pairing cancelling
                        this.unregister();
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
                this.unregister();
                invocation.return_dbus_error(
                    "org.bluez.Error.Failed",
                    `Agent error: ${error}`,
                );
            }
        };

        handleAsync();
    }

    public confirmPairing(requestId: string): void {
        const invocation = this.pendingRequests.get(requestId);
        if (invocation) {
            invocation.return_value(null);
            this.pendingRequests.delete(requestId);

            this.unregister();
        }
    }

    public cancelConfirmation(requestId: string): void {
        const invocation = this.pendingRequests.get(requestId);
        if (invocation) {
            invocation.return_dbus_error(
                "org.bluez.Error.Canceled",
                "Pairing confirmation canceled by user",
            );
            this.pendingRequests.delete(requestId);

            this.unregister();
        }
    }
}

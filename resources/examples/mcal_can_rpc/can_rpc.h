#ifndef ECB_CAN_RPC_H
#define ECB_CAN_RPC_H

/*
 * JSON-RPC method names for a PC AUTOSAR MCAL CAN driver talking to `ecb_cli rpc`.
 * Transport: TCP NDJSON (one JSON object + '\n' per message), default 127.0.0.1:17320.
 *
 * See docs/en/um/cli/rpc.md
 */

#define ECB_RPC_DEFAULT_HOST "127.0.0.1"
#define ECB_RPC_DEFAULT_PORT 17320

#define ECB_RPC_SYS_PING "sys.ping"
#define ECB_RPC_SYS_VERSION "sys.version"
#define ECB_RPC_SYS_LIST_METHODS "sys.listMethods"
#define ECB_RPC_RPC_DISCOVER "rpc.discover"
#define ECB_RPC_SYS_SHUTDOWN "sys.shutdown"

#define ECB_RPC_HW_LIST_VENDORS "hw.listVendors"
#define ECB_RPC_HW_LIST_DEVICES "hw.listDevices"
#define ECB_RPC_HW_GET_VERSION "hw.getVersion"

#define ECB_RPC_CAN_OPEN "can.open"
#define ECB_RPC_CAN_CLOSE "can.close"
#define ECB_RPC_CAN_LIST "can.list"
#define ECB_RPC_CAN_WRITE "can.write"
#define ECB_RPC_CAN_READ "can.read"
#define ECB_RPC_CAN_READ_POLL "can.readPoll"
#define ECB_RPC_CAN_SUBSCRIBE "can.subscribe"
#define ECB_RPC_CAN_SET_MODE "can.setMode"

#define ECB_RPC_CAN_INIT "Can.Init"
#define ECB_RPC_CAN_DEINIT "Can.DeInit"
#define ECB_RPC_CAN_GET_VERSION_INFO "Can.GetVersionInfo"
#define ECB_RPC_CAN_SET_CONTROLLER_MODE "Can.SetControllerMode"
#define ECB_RPC_CAN_GET_CONTROLLER_MODE "Can.GetControllerMode"
#define ECB_RPC_CAN_DISABLE_INTERRUPTS "Can.DisableControllerInterrupts"
#define ECB_RPC_CAN_ENABLE_INTERRUPTS "Can.EnableControllerInterrupts"
#define ECB_RPC_CAN_WRITE_HTH "Can.Write"
#define ECB_RPC_CAN_GET_ERROR_STATE "Can.GetControllerErrorState"
#define ECB_RPC_CAN_TX_ERR_CNT "Can.GetControllerTxErrorCounter"
#define ECB_RPC_CAN_RX_ERR_CNT "Can.GetControllerRxErrorCounter"
#define ECB_RPC_CAN_SET_BAUDRATE "Can.SetBaudrate"
#define ECB_RPC_CAN_CHECK_WAKEUP "Can.CheckWakeup"
#define ECB_RPC_CAN_MF_WRITE "Can.MainFunction_Write"
#define ECB_RPC_CAN_MF_READ "Can.MainFunction_Read"
#define ECB_RPC_CAN_MF_BUSOFF "Can.MainFunction_BusOff"
#define ECB_RPC_CAN_MF_WAKEUP "Can.MainFunction_Wakeup"
#define ECB_RPC_CAN_MF_MODE "Can.MainFunction_Mode"

/* Std_ReturnType / Can_ReturnType */
#ifndef E_OK
#define E_OK 0u
#endif
#ifndef E_NOT_OK
#define E_NOT_OK 1u
#endif
#ifndef CAN_BUSY
#define CAN_BUSY 2u
#endif

#define CAN_T_START "CAN_T_START"
#define CAN_T_STOP "CAN_T_STOP"
#define CAN_T_SLEEP "CAN_T_SLEEP"
#define CAN_T_WAKEUP "CAN_T_WAKEUP"

#endif

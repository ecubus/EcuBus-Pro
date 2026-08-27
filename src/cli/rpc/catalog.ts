import type { RpcMethodDescriptor } from './types'

export const RPC_METHOD_CATALOG: RpcMethodDescriptor[] = [
  {
    name: 'sys.ping',
    summary: 'Health check. Returns server timestamp.',
    params: []
  },
  {
    name: 'sys.version',
    summary: 'Return JSON-RPC API version and role (adapter | gateway).',
    params: []
  },
  {
    name: 'sys.listMethods',
    summary: 'List available JSON-RPC methods.',
    params: []
  },
  {
    name: 'rpc.discover',
    summary: 'OpenRPC-style method discovery (alias of sys.listMethods with descriptors).',
    params: []
  },
  {
    name: 'sys.shutdown',
    summary: 'Close all CAN controllers and stop the JSON-RPC server.',
    params: []
  },
  {
    name: 'hw.listVendors',
    summary: 'List CAN vendors supported on this platform.',
    params: []
  },
  {
    name: 'hw.listDevices',
    summary: 'Enumerate available CAN adapters for a vendor.',
    params: [
      { name: 'vendor', type: 'string', required: true, summary: 'peak | kvaser | simulate | ...' }
    ]
  },
  {
    name: 'hw.getVersion',
    summary: 'Return the native library version string for a vendor.',
    params: [{ name: 'vendor', type: 'string', required: true }]
  },
  {
    name: 'can.open',
    summary: 'Open a CAN controller (low-level). Returns controllerId.',
    params: [
      { name: 'vendor', type: 'string', required: true },
      { name: 'handle', type: 'number|string', required: true },
      { name: 'controllerId', type: 'number', summary: 'Optional fixed controller id' },
      { name: 'name', type: 'string' },
      { name: 'canfd', type: 'boolean' },
      { name: 'silent', type: 'boolean' },
      { name: 'bitrate', type: 'object|number' },
      { name: 'bitratefd', type: 'object|number' }
    ]
  },
  {
    name: 'can.close',
    summary: 'Close one controller, or all controllers if controllerId is omitted.',
    params: [{ name: 'controllerId', type: 'number' }]
  },
  {
    name: 'can.list',
    summary: 'List open controllers and their Hoh mapping.',
    params: []
  },
  {
    name: 'can.write',
    summary: 'Transmit a CAN / CAN-FD frame on a controller (bypasses HTH).',
    params: [
      { name: 'controllerId', type: 'number', required: true },
      { name: 'id', type: 'number|string', required: true },
      { name: 'data', type: 'number[]|hex', required: true },
      { name: 'idType', type: 'STANDARD|EXTENDED' },
      { name: 'canfd', type: 'boolean' },
      { name: 'brs', type: 'boolean' },
      { name: 'remote', type: 'boolean' },
      { name: 'name', type: 'string' }
    ]
  },
  {
    name: 'can.writeMany',
    summary: 'Transmit multiple frames. Each item has the same shape as can.write params.',
    params: [{ name: 'frames', type: 'object[]', required: true }]
  },
  {
    name: 'can.read',
    summary: 'Block until at least one RX frame is available, or timeout.',
    params: [
      { name: 'controllerId', type: 'number', summary: 'Omit to read from all controllers' },
      { name: 'timeoutMs', type: 'number', summary: 'Default 0 (non-blocking). Use >0 to wait.' },
      { name: 'max', type: 'number', summary: 'Max frames to return (default 64)' }
    ]
  },
  {
    name: 'can.readPoll',
    summary: 'Non-blocking drain of the session RX queue (alias of can.read with timeoutMs=0).',
    params: [
      { name: 'controllerId', type: 'number' },
      { name: 'max', type: 'number' }
    ]
  },
  {
    name: 'can.subscribe',
    summary: 'Push RX / TX / bus-off as JSON-RPC notifications to this connection.',
    params: [{ name: 'controllerId', type: 'number', summary: 'Omit to subscribe all' }]
  },
  {
    name: 'can.unsubscribe',
    summary: 'Stop push notifications for this connection.',
    params: [{ name: 'controllerId', type: 'number' }]
  },
  {
    name: 'can.getState',
    summary: 'Return mode, error state, queue depths, and bus-load snapshot.',
    params: [{ name: 'controllerId', type: 'number', required: true }]
  },
  {
    name: 'can.getBusLoading',
    summary: 'Return bus-load statistics for a controller.',
    params: [
      { name: 'controllerId', type: 'number', required: true },
      { name: 'timeDiffMs', type: 'number' }
    ]
  },
  {
    name: 'can.setMode',
    summary: 'Set controller mode (STARTED / STOPPED / SLEEP).',
    params: [
      { name: 'controllerId', type: 'number', required: true },
      { name: 'mode', type: 'string', required: true }
    ]
  },
  {
    name: 'can.reset',
    summary: 'Re-open a controller after bus-off or error (keeps Hoh config).',
    params: [{ name: 'controllerId', type: 'number', required: true }]
  },
  {
    name: 'can.startPeriodSend',
    summary: 'Start cyclic transmission. Returns taskId.',
    params: [
      { name: 'controllerId', type: 'number', required: true },
      { name: 'id', type: 'number|string', required: true },
      { name: 'data', type: 'number[]|hex', required: true },
      { name: 'periodMs', type: 'number', required: true },
      { name: 'durationMs', type: 'number' }
    ]
  },
  {
    name: 'can.stopPeriodSend',
    summary: 'Stop a cyclic transmission task.',
    params: [
      { name: 'controllerId', type: 'number', required: true },
      { name: 'taskId', type: 'string', required: true }
    ]
  },
  {
    name: 'can.changePeriodData',
    summary: 'Update payload of a running cyclic task.',
    params: [
      { name: 'controllerId', type: 'number', required: true },
      { name: 'taskId', type: 'string', required: true },
      { name: 'data', type: 'number[]|hex', required: true }
    ]
  },
  {
    name: 'Can.Init',
    summary: 'AUTOSAR Can_Init: create controllers and hardware objects.',
    autosar: 'Can_Init',
    params: [
      { name: 'config', type: 'object', summary: 'controllers[], hardwareObjects[], rxQueueSize' }
    ]
  },
  {
    name: 'Can.DeInit',
    summary: 'AUTOSAR Can_DeInit: close all controllers.',
    autosar: 'Can_DeInit',
    params: []
  },
  {
    name: 'Can.GetVersionInfo',
    summary: 'AUTOSAR Can_GetVersionInfo.',
    autosar: 'Can_GetVersionInfo',
    params: []
  },
  {
    name: 'Can.SetControllerMode',
    summary:
      'AUTOSAR Can_SetControllerMode (CAN_T_START / CAN_T_STOP / CAN_T_SLEEP / CAN_T_WAKEUP).',
    autosar: 'Can_SetControllerMode',
    params: [
      { name: 'controller', type: 'number', required: true },
      { name: 'transition', type: 'string', required: true }
    ]
  },
  {
    name: 'Can.GetControllerMode',
    summary: 'AUTOSAR Can_GetControllerMode.',
    autosar: 'Can_GetControllerMode',
    params: [{ name: 'controller', type: 'number', required: true }]
  },
  {
    name: 'Can.DisableControllerInterrupts',
    summary: 'Nested disable of push notifications (MainFunction polling still works).',
    autosar: 'Can_DisableControllerInterrupts',
    params: [{ name: 'controller', type: 'number', required: true }]
  },
  {
    name: 'Can.EnableControllerInterrupts',
    summary: 'Undo one Can.DisableControllerInterrupts nesting level.',
    autosar: 'Can_EnableControllerInterrupts',
    params: [{ name: 'controller', type: 'number', required: true }]
  },
  {
    name: 'Can.Write',
    summary: 'AUTOSAR Can_Write(Hth, PduInfo). Returns E_OK / E_NOT_OK / CAN_BUSY.',
    autosar: 'Can_Write',
    params: [
      { name: 'hth', type: 'number', required: true },
      { name: 'swPduHandle', type: 'number' },
      { name: 'id', type: 'number|string', summary: 'Required for BASIC / dynamic HTH' },
      { name: 'sdu', type: 'number[]|hex', required: true },
      { name: 'length', type: 'number' },
      { name: 'idType', type: 'STANDARD|EXTENDED' },
      { name: 'canfd', type: 'boolean' },
      { name: 'brs', type: 'boolean' },
      { name: 'remote', type: 'boolean' }
    ]
  },
  {
    name: 'Can.GetControllerErrorState',
    summary: 'AUTOSAR Can_GetControllerErrorState.',
    autosar: 'Can_GetControllerErrorState',
    params: [{ name: 'controller', type: 'number', required: true }]
  },
  {
    name: 'Can.GetControllerTxErrorCounter',
    summary: 'AUTOSAR Can_GetControllerTxErrorCounter (0 if hardware does not expose it).',
    autosar: 'Can_GetControllerTxErrorCounter',
    params: [{ name: 'controller', type: 'number', required: true }]
  },
  {
    name: 'Can.GetControllerRxErrorCounter',
    summary: 'AUTOSAR Can_GetControllerRxErrorCounter (0 if hardware does not expose it).',
    autosar: 'Can_GetControllerRxErrorCounter',
    params: [{ name: 'controller', type: 'number', required: true }]
  },
  {
    name: 'Can.SetBaudrate',
    summary: 'AUTOSAR Can_SetBaudrate. Re-opens the controller with a new bitrate.',
    autosar: 'Can_SetBaudrate',
    params: [
      { name: 'controller', type: 'number', required: true },
      { name: 'baudRateConfigID', type: 'string|number' },
      { name: 'bitrate', type: 'object|number' },
      { name: 'bitratefd', type: 'object|number' }
    ]
  },
  {
    name: 'Can.CheckWakeup',
    summary: 'AUTOSAR Can_CheckWakeup. Returns E_OK if a wakeup event is pending.',
    autosar: 'Can_CheckWakeup',
    params: [{ name: 'controller', type: 'number', required: true }]
  },
  {
    name: 'Can.MainFunction_Write',
    summary: 'Drain TX confirmations (CanIf_TxConfirmation).',
    autosar: 'Can_MainFunction_Write',
    params: [{ name: 'max', type: 'number' }]
  },
  {
    name: 'Can.MainFunction_Read',
    summary: 'Drain RX indications (CanIf_RxIndication).',
    autosar: 'Can_MainFunction_Read',
    params: [{ name: 'max', type: 'number' }]
  },
  {
    name: 'Can.MainFunction_BusOff',
    summary: 'Drain bus-off events (CanIf_ControllerBusOff).',
    autosar: 'Can_MainFunction_BusOff',
    params: []
  },
  {
    name: 'Can.MainFunction_Wakeup',
    summary: 'Drain wakeup events (CanIf_ControllerWakeup).',
    autosar: 'Can_MainFunction_Wakeup',
    params: []
  },
  {
    name: 'Can.MainFunction_Mode',
    summary: 'Drain mode indications (CanIf_ControllerModeIndication).',
    autosar: 'Can_MainFunction_Mode',
    params: []
  }
]

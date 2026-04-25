/**
 * CMSIS-DAP v2 (WinUSB bulk) N-API addon — built from `swig/cmsis_dap.i` + `src/cmsis_dap.cpp`.
 * Rebuild: `npm run cmsis-dap` from the repo root (re-run `swig/s.bat` in `swig` if you change the `.i` file).
 */
import native from './build/Release/cmsis_dap.node'

export default native

export const {
  cmsis_dap_get_last_error,
  cmsis_dap_list_device_paths,
  cmsis_dap_open,
  cmsis_dap_close,
  cmsis_dap_transact,
  cmsis_dap_command,
  CmsisDapStringVector,
  CmsisDapU8Vector
} = native

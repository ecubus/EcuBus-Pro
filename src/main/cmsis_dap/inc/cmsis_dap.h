/**
 * CMSIS-DAP v2 (USB bulk) host API using WinUSB on Windows.
 * Enumerates the ARM-defined WinUSB device interface and uses bulk IN/OUT pipes.
 */
#pragma once

#include <cstddef>
#include <cstdint>
#include <vector>
#include <string>

struct cmsis_dap_device;

/**
 * @return Last Win32 / library error (GetLastError) from the previous operation, or 0.
 */
uint32_t cmsis_dap_get_last_error(void);

/**
 * Discover CMSIS-DAP v2 WinUSB device interface paths.
 */
std::vector<std::string> cmsis_dap_list_device_paths(void);

/**
 * Open a device by the path returned from cmsis_dap_list_device_paths (UTF-8).
 * @return nullptr on failure; use cmsis_dap_get_last_error().
 */
cmsis_dap_device* cmsis_dap_open(const char* device_path_utf8);

void cmsis_dap_close(cmsis_dap_device* dev);

/**
 * Send a DAP command on the bulk OUT pipe and read the response on the first bulk IN pipe.
 *
 * @param response_out  Pre-sized buffer; written length in *response_len
 * @param response_cap  Capacity of response_out
 * @param response_len  Set to bytes read
 * @return 0 on success, -1 on failure
 */
int cmsis_dap_transact(cmsis_dap_device* dev, const uint8_t* cmd, size_t cmd_len, uint8_t* response_out,
  size_t response_cap, size_t* response_len, uint32_t timeout_ms);

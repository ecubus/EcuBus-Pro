%module cmsis_dap

%{
#include "cmsis_dap.h"
%}

%include <stdint.i>
%include <std_string.i>
%include <std_vector.i>

%template(CmsisDapStringVector) std::vector<std::string>;
%template(CmsisDapU8Vector) std::vector<uint8_t>;

%include "cmsis_dap.h"

%inline %{
#include <cstdint>
#include <vector>

/**
 * One-shot DAP request/response: sends cmd on bulk OUT, reads response on first bulk IN.
 * On failure returns an empty vector (use cmsis_dap_get_last_error() for Win32).
 */
static std::vector<uint8_t> cmsis_dap_command(
  cmsis_dap_device* dev, const std::vector<uint8_t>& cmd, uint32_t timeout_ms) {
  if (!dev || cmd.empty()) {
    return {};
  }
  std::vector<uint8_t> out(4096u);
  size_t n = 0;
  if (cmsis_dap_transact(
        dev, cmd.data(), cmd.size(), out.data(), out.size(), &n, timeout_ms) != 0) {
    return {};
  }
  out.resize(n);
  return out;
}
%}

#include "cmsis_dap.h"

#ifdef _WIN32

/* windows.h must precede winusb.h for user-mode builds (WDK usbd stack). */
#include <windows.h>
#include <winusb.h>
#include <setupapi.h>
#include <cstring>
#include <string>
#include <algorithm>
#include <vector>

#include <stringapiset.h>

#pragma comment(lib, "winusb.lib")
#pragma comment(lib, "setupapi.lib")

/* ARM CMSIS-DAP v2 WinUSB device interface (ARM CMSIS_DAP_v2.inf) */
static const GUID kCmsisDapV2DevInterface = {
  0xCDB3B5AD, 0x293B, 0x4663, { 0xAA, 0x36, 0x1A, 0xAE, 0x46, 0x06, 0x37, 0x76 } };

static uint32_t g_last_error = 0;

static void set_error(void) {
  g_last_error = static_cast<uint32_t>(::GetLastError());
}

static void clear_error(void) {
  g_last_error = 0;
  ::SetLastError(0);
}

static std::wstring utf8_to_wide(const char* s) {
  if (!s) {
    return L"";
  }
  int n = ::MultiByteToWideChar(CP_UTF8, 0, s, -1, nullptr, 0);
  if (n <= 0) {
    return L"";
  }
  std::wstring w(static_cast<size_t>(n) - 1, L'\0');
  ::MultiByteToWideChar(CP_UTF8, 0, s, -1, &w[0], n);
  return w;
}

static std::string wide_to_utf8(const wchar_t* w) {
  if (!w) {
    return std::string();
  }
  int n = ::WideCharToMultiByte(CP_UTF8, 0, w, -1, nullptr, 0, nullptr, nullptr);
  if (n <= 0) {
    return std::string();
  }
  std::string s(static_cast<size_t>(n) - 1, '\0');
  ::WideCharToMultiByte(CP_UTF8, 0, w, -1, &s[0], n, nullptr, nullptr);
  return s;
}

struct cmsis_dap_device {
  HANDLE hDevice{ INVALID_HANDLE_VALUE };
  WINUSB_INTERFACE_HANDLE hWinusb{ nullptr };
  UCHAR bulkIn{ 0 };
  UCHAR bulkOut{ 0 };
  bool hasBulkSwo{ false };
  UCHAR bulkSwo{ 0 };
  USHORT maxPacketIn{ 64 };
  USHORT maxPacketOut{ 64 };
};

static bool is_bulk_in(UCHAR addr) { return (addr & 0x80) != 0; }

/* CMSIS-DAP v2: first BULK OUT, first BULK IN (response), second BULK IN (optional SWO). */
static bool find_bulk_pipes(WINUSB_INTERFACE_HANDLE wusb, USHORT& maxIn, USHORT& maxOut, UCHAR& inAddr,
  UCHAR& outAddr, bool& hasSwo, UCHAR& swoAddr) {
  USB_INTERFACE_DESCRIPTOR ifDesc{};
  if (!::WinUsb_QueryInterfaceSettings(wusb, 0, &ifDesc)) {
    return false;
  }
  (void)ifDesc; /* bNumEndpoints available if needed for validation */
  hasSwo = false;
  inAddr = 0;
  outAddr = 0;
  swoAddr = 0;
  maxIn = 64;
  maxOut = 64;
  /* Pipe index: 0 = default control, 1..N = first endpoint, ... (MSDN) */
  std::vector<UCHAR> bulkInAddrs;
  std::vector<USHORT> bulkInMps;
  for (ULONG pipeNum = 0; pipeNum < 32; ++pipeNum) {
    WINUSB_PIPE_INFORMATION pipeInfo{};
    if (!::WinUsb_QueryPipe(wusb, 0, static_cast<UCHAR>(pipeNum + 1), &pipeInfo)) {
      const DWORD e = ::GetLastError();
      if (e == ERROR_INVALID_PARAMETER) {
        break;
      }
      return false;
    }
    if (pipeInfo.PipeType != UsbdPipeTypeBulk) {
      continue;
    }
    if (is_bulk_in(pipeInfo.PipeId)) {
      bulkInAddrs.push_back(pipeInfo.PipeId);
      bulkInMps.push_back(pipeInfo.MaximumPacketSize);
    } else {
      if (outAddr == 0) {
        outAddr = pipeInfo.PipeId;
        maxOut = static_cast<USHORT>(pipeInfo.MaximumPacketSize);
      }
    }
  }
  if (bulkInAddrs.empty() || outAddr == 0) {
    return false;
  }
  inAddr = bulkInAddrs[0];
  maxIn = bulkInMps[0];
  if (bulkInAddrs.size() > 1) {
    hasSwo = true;
    swoAddr = bulkInAddrs[1];
  }
  return true;
}

uint32_t cmsis_dap_get_last_error(void) { return g_last_error; }

std::vector<std::string> cmsis_dap_list_device_paths(void) {
  std::vector<std::string> paths;
  clear_error();
  HDEVINFO hdi = ::SetupDiGetClassDevs(&kCmsisDapV2DevInterface, nullptr, nullptr,
    DIGCF_PRESENT | DIGCF_DEVICEINTERFACE);
  if (hdi == INVALID_HANDLE_VALUE) {
    set_error();
    return paths;
  }
  for (unsigned i = 0;; ++i) {
    SP_DEVICE_INTERFACE_DATA ifData{};
    ifData.cbSize = sizeof(ifData);
    if (!::SetupDiEnumDeviceInterfaces(hdi, nullptr, &kCmsisDapV2DevInterface, i, &ifData)) {
      if (::GetLastError() == ERROR_NO_MORE_ITEMS) {
        break;
      }
      continue;
    }
    DWORD need = 0;
    ::SetupDiGetDeviceInterfaceDetailW(hdi, &ifData, nullptr, 0, &need, nullptr);
    if (need < sizeof(SP_DEVICE_INTERFACE_DETAIL_DATA_W)) {
      continue;
    }
    /* Wide API so paths are not limited by ANSI. */
    PSP_DEVICE_INTERFACE_DETAIL_DATA_W detail =
      static_cast<PSP_DEVICE_INTERFACE_DETAIL_DATA_W>(::LocalAlloc(LMEM_FIXED, need));
    if (detail == nullptr) {
      continue;
    }
    detail->cbSize = sizeof(*detail);
    if (!::SetupDiGetDeviceInterfaceDetailW(hdi, &ifData, detail, need, &need, nullptr)) {
      ::LocalFree(detail);
      continue;
    }
    paths.push_back(wide_to_utf8(detail->DevicePath));
    ::LocalFree(detail);
  }
  ::SetupDiDestroyDeviceInfoList(hdi);
  return paths;
}

cmsis_dap_device* cmsis_dap_open(const char* device_path_utf8) {
  clear_error();
  if (!device_path_utf8) {
    return nullptr;
  }
  std::wstring path = utf8_to_wide(device_path_utf8);
  if (path.empty()) {
    set_error();
    return nullptr;
  }
  HANDLE h = ::CreateFileW(path.c_str(), GENERIC_READ | GENERIC_WRITE, FILE_SHARE_READ | FILE_SHARE_WRITE,
    nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
  if (h == INVALID_HANDLE_VALUE) {
    set_error();
    return nullptr;
  }
  WINUSB_INTERFACE_HANDLE wusb = nullptr;
  if (!::WinUsb_Initialize(h, &wusb)) {
    set_error();
    ::CloseHandle(h);
    return nullptr;
  }
  auto* d = new cmsis_dap_device();
  d->hDevice = h;
  d->hWinusb = wusb;
  if (!find_bulk_pipes(wusb, d->maxPacketIn, d->maxPacketOut, d->bulkIn, d->bulkOut, d->hasBulkSwo,
        d->bulkSwo)) {
    g_last_error = static_cast<uint32_t>(::GetLastError());
    if (g_last_error == 0) {
      g_last_error = static_cast<uint32_t>(0xC0000001UL);
    } /* EPIPE generic */
    ::WinUsb_Free(wusb);
    ::CloseHandle(h);
    delete d;
    return nullptr;
  }
  ULONG tmo = 5000;
  ::WinUsb_SetPipePolicy(wusb, d->bulkIn, PIPE_TRANSFER_TIMEOUT, sizeof(ULONG), &tmo);
  ::WinUsb_SetPipePolicy(wusb, d->bulkOut, PIPE_TRANSFER_TIMEOUT, sizeof(ULONG), &tmo);
  g_last_error = 0;
  return d;
}

void cmsis_dap_close(cmsis_dap_device* dev) {
  if (!dev) {
    return;
  }
  if (dev->hWinusb) {
    ::WinUsb_Free(dev->hWinusb);
  }
  if (dev->hDevice != INVALID_HANDLE_VALUE) {
    ::CloseHandle(dev->hDevice);
  }
  delete dev;
}

int cmsis_dap_transact(cmsis_dap_device* dev, const uint8_t* cmd, size_t cmd_len, uint8_t* response_out,
  size_t response_cap, size_t* response_len, uint32_t timeout_ms) {
  clear_error();
  if (response_len) {
    *response_len = 0;
  }
  if (!dev || !cmd || !response_out || !response_len || response_cap == 0) {
    return -1;
  }
  if (dev->hWinusb == nullptr) {
    return -1;
  }
  /* Optional per-call timeout (ms) */
  ULONG t = timeout_ms == 0u ? 5000u : (std::min)(timeout_ms, 60u * 1000u);
  ::WinUsb_SetPipePolicy(dev->hWinusb, dev->bulkIn, PIPE_TRANSFER_TIMEOUT, sizeof(ULONG), &t);
  ::WinUsb_SetPipePolicy(dev->hWinusb, dev->bulkOut, PIPE_TRANSFER_TIMEOUT, sizeof(ULONG), &t);

  size_t sent = 0;
  const uint8_t* p = cmd;
  /* Chunk writes if the probe uses small max packet (e.g. 64) */
  while (sent < cmd_len) {
    size_t chunk = std::min<size_t>(cmd_len - sent, static_cast<size_t>(dev->maxPacketOut > 0 ? dev->maxPacketOut : 64));
    ULONG wrote = 0;
    if (!::WinUsb_WritePipe(dev->hWinusb, dev->bulkOut, const_cast<UCHAR*>(p + sent), static_cast<ULONG>(chunk), &wrote,
          nullptr)) {
      set_error();
      return -1;
    }
    if (wrote == 0) {
      g_last_error = static_cast<uint32_t>(0xC00000E8UL);
      return -1; /* EPIPE / short */
    }
    sent += wrote;
  }

  /* Read DAP response: may be multiple IN packets up to one logical response */
  size_t total = 0;
  for (int nread = 0; nread < 64; ++nread) {
    ULONG toRead = static_cast<ULONG>(std::min(response_cap - total, size_t(4096)));
    if (toRead == 0) {
      break;
    }
    ULONG read = 0;
    if (!::WinUsb_ReadPipe(dev->hWinusb, dev->bulkIn, response_out + total, toRead, &read, nullptr)) {
      set_error();
      if (total > 0) {
        *response_len = total;
        return 0; /* return partial on failure after some data? strict: -1 */
      }
      return -1;
    }
    if (read == 0) {
      break;
    }
    total += read;
    /* Short read usually ends a USB transaction on the IN side */
    if (read < static_cast<ULONG>(dev->maxPacketIn) || (dev->maxPacketIn == 0 && read < 64u)) {
      break;
    }
  }
  *response_len = total;
  g_last_error = 0;
  return 0;
}

#else

uint32_t cmsis_dap_get_last_error(void) { return 0; }

std::vector<std::string> cmsis_dap_list_device_paths(void) { return {}; }

cmsis_dap_device* cmsis_dap_open(const char*) { return nullptr; }

void cmsis_dap_close(cmsis_dap_device*) {}

int cmsis_dap_transact(cmsis_dap_device*, const uint8_t*, size_t, uint8_t*, size_t, size_t*, uint32_t) { return -1; }

#endif

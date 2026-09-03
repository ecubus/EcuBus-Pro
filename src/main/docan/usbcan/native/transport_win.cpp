#include <napi.h>

#include <windows.h>
#include <setupapi.h>
#include <winusb.h>

#include <algorithm>
#include <atomic>
#include <chrono>
#include <condition_variable>
#include <cstdint>
#include <cwctype>
#include <deque>
#include <map>
#include <memory>
#include <mutex>
#include <set>
#include <sstream>
#include <string>
#include <thread>
#include <vector>

namespace {

constexpr size_t kTransferSize = 512;
constexpr size_t kTxQueueLimit = 512;
constexpr DWORD kIoTimeoutMs = 2000;
constexpr DWORD kRxPollMs = 100;

struct InterfaceInfo {
  std::wstring path;
  std::wstring label;
  uint8_t number = 0;
  uint8_t endpointIn = 0;
  uint8_t endpointOut = 0;
  bool busy = false;
};

struct TxJob {
  uint32_t token = 0;
  std::vector<uint8_t> bytes;
  uint32_t delayBeforeMs = 0;
  uint32_t delayAfterMs = 0;
};

struct TxResult {
  uint32_t token = 0;
  bool ok = false;
  std::string error;
};

struct ErrorResult {
  DWORD code = ERROR_SUCCESS;
  std::string operation;
  std::string detail;
};

std::mutex gDevicesMutex;
std::map<uint32_t, std::shared_ptr<class UsbTransport>> gDevices;
std::atomic<uint32_t> gNextHandle{1};

std::wstring ToLower(std::wstring value) {
  std::transform(value.begin(), value.end(), value.begin(),
                 [](wchar_t ch) { return static_cast<wchar_t>(std::towlower(ch)); });
  return value;
}

std::wstring Utf8ToWide(const std::string& value) {
  if (value.empty()) return {};
  const int length = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(),
                                         static_cast<int>(value.size()), nullptr, 0);
  if (length <= 0) throw std::runtime_error("invalid UTF-8 device path");
  std::wstring result(static_cast<size_t>(length), L'\0');
  MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(),
                      static_cast<int>(value.size()), result.data(), length);
  return result;
}

std::string WideToUtf8(const std::wstring& value) {
  if (value.empty()) return {};
  const int length = WideCharToMultiByte(CP_UTF8, 0, value.data(),
                                         static_cast<int>(value.size()), nullptr, 0,
                                         nullptr, nullptr);
  if (length <= 0) return {};
  std::string result(static_cast<size_t>(length), '\0');
  WideCharToMultiByte(CP_UTF8, 0, value.data(), static_cast<int>(value.size()),
                      result.data(), length, nullptr, nullptr);
  return result;
}

std::string WindowsError(const std::string& operation, DWORD code = GetLastError()) {
  LPWSTR message = nullptr;
  const DWORD flags = FORMAT_MESSAGE_ALLOCATE_BUFFER | FORMAT_MESSAGE_FROM_SYSTEM |
                      FORMAT_MESSAGE_IGNORE_INSERTS;
  FormatMessageW(flags, nullptr, code, 0, reinterpret_cast<LPWSTR>(&message), 0, nullptr);
  std::wstring detail = message ? message : L"unknown error";
  if (message) LocalFree(message);
  while (!detail.empty() && (detail.back() == L'\r' || detail.back() == L'\n' ||
                             detail.back() == L' ')) {
    detail.pop_back();
  }
  std::ostringstream text;
  text << operation << " failed (WinError " << code << "): " << WideToUtf8(detail);
  return text.str();
}

GUID ParseGuid(const wchar_t* text) {
  GUID guid{};
  if (CLSIDFromString(text, &guid) != NOERROR) {
    throw std::runtime_error("invalid device interface GUID");
  }
  return guid;
}

uint8_t InterfaceNumberFromPath(const std::wstring& path) {
  const std::wstring lower = ToLower(path);
  const size_t marker = lower.find(L"&mi_");
  if (marker == std::wstring::npos || marker + 7 > lower.size()) return 0;
  wchar_t* end = nullptr;
  const unsigned long value = std::wcstoul(lower.c_str() + marker + 4, &end, 16);
  return value <= 0xff ? static_cast<uint8_t>(value) : 0;
}

std::wstring PhysicalInterfaceKey(const std::wstring& path) {
  const std::wstring lower = ToLower(path);
  const size_t suffix = lower.rfind(L"#{");
  return suffix == std::wstring::npos ? lower : lower.substr(0, suffix);
}

std::vector<InterfaceInfo> EnumerateGuid(const GUID& guid) {
  std::vector<InterfaceInfo> result;
  HDEVINFO set = SetupDiGetClassDevsW(&guid, nullptr, nullptr,
                                      DIGCF_PRESENT | DIGCF_DEVICEINTERFACE);
  if (set == INVALID_HANDLE_VALUE) {
    throw std::runtime_error(WindowsError("SetupDiGetClassDevsW"));
  }

  for (DWORD index = 0;; ++index) {
    SP_DEVICE_INTERFACE_DATA interfaceData{};
    interfaceData.cbSize = sizeof(interfaceData);
    if (!SetupDiEnumDeviceInterfaces(set, nullptr, &guid, index, &interfaceData)) {
      const DWORD error = GetLastError();
      if (error == ERROR_NO_MORE_ITEMS) break;
      SetupDiDestroyDeviceInfoList(set);
      throw std::runtime_error(WindowsError("SetupDiEnumDeviceInterfaces", error));
    }

    DWORD required = 0;
    SP_DEVINFO_DATA deviceData{};
    deviceData.cbSize = sizeof(deviceData);
    SetupDiGetDeviceInterfaceDetailW(set, &interfaceData, nullptr, 0, &required,
                                     &deviceData);
    if (GetLastError() != ERROR_INSUFFICIENT_BUFFER || required == 0) continue;

    std::vector<uint8_t> detailStorage(required);
    auto* detail = reinterpret_cast<SP_DEVICE_INTERFACE_DETAIL_DATA_W*>(detailStorage.data());
    detail->cbSize = sizeof(SP_DEVICE_INTERFACE_DETAIL_DATA_W);
    if (!SetupDiGetDeviceInterfaceDetailW(set, &interfaceData, detail, required, nullptr,
                                          &deviceData)) {
      continue;
    }

    wchar_t friendlyName[256]{};
    DWORD propertyType = 0;
    DWORD propertySize = 0;
    if (!SetupDiGetDeviceRegistryPropertyW(set, &deviceData, SPDRP_FRIENDLYNAME,
                                           &propertyType,
                                           reinterpret_cast<PBYTE>(friendlyName),
                                           sizeof(friendlyName), &propertySize)) {
      SetupDiGetDeviceRegistryPropertyW(set, &deviceData, SPDRP_DEVICEDESC,
                                        &propertyType,
                                        reinterpret_cast<PBYTE>(friendlyName),
                                        sizeof(friendlyName), &propertySize);
    }

    InterfaceInfo item;
    item.path = detail->DevicePath;
    item.label = friendlyName[0] ? friendlyName : L"USB CAN interface";
    item.number = InterfaceNumberFromPath(item.path);
    result.push_back(std::move(item));
  }

  SetupDiDestroyDeviceInfoList(set);
  return result;
}

bool QueryEndpoints(InterfaceInfo& item) {
  HANDLE file = CreateFileW(item.path.c_str(), GENERIC_READ | GENERIC_WRITE,
                            FILE_SHARE_READ | FILE_SHARE_WRITE, nullptr, OPEN_EXISTING,
                            FILE_ATTRIBUTE_NORMAL | FILE_FLAG_OVERLAPPED, nullptr);
  if (file == INVALID_HANDLE_VALUE) {
    item.busy = true;
    return false;
  }

  WINUSB_INTERFACE_HANDLE usb = nullptr;
  if (!WinUsb_Initialize(file, &usb)) {
    item.busy = true;
    CloseHandle(file);
    return false;
  }

  USB_INTERFACE_DESCRIPTOR descriptor{};
  bool valid = WinUsb_QueryInterfaceSettings(usb, 0, &descriptor) != FALSE;
  if (valid) {
    item.number = descriptor.bInterfaceNumber;
    for (uint8_t index = 0; index < descriptor.bNumEndpoints; ++index) {
      WINUSB_PIPE_INFORMATION pipe{};
      if (!WinUsb_QueryPipe(usb, 0, index, &pipe)) {
        valid = false;
        break;
      }
      if (pipe.PipeType != UsbdPipeTypeBulk) continue;
      if (USB_ENDPOINT_DIRECTION_IN(pipe.PipeId)) {
        item.endpointIn = pipe.PipeId;
      } else {
        item.endpointOut = pipe.PipeId;
      }
    }
    valid = valid && item.endpointIn != 0 && item.endpointOut != 0;
  }

  WinUsb_Free(usb);
  CloseHandle(file);
  return valid;
}

std::vector<InterfaceInfo> EnumerateInterfaces(uint16_t vid, uint16_t pid) {
  // The first GUID is the system WinUSB class. The second is retained for
  // compatibility with candle/INF installations that expose only that class.
  const GUID guids[] = {
      ParseGuid(L"{dee824ef-729b-4a0e-9c14-b7117d33a817}"),
      ParseGuid(L"{c15b4308-04d3-11e6-b3ea-6057189e6443}"),
  };

  wchar_t identityBuffer[64]{};
  swprintf_s(identityBuffer, L"vid_%04x&pid_%04x", vid, pid);
  const std::wstring identity = ToLower(identityBuffer);
  std::map<std::wstring, InterfaceInfo> unique;

  for (const GUID& guid : guids) {
    for (auto& item : EnumerateGuid(guid)) {
      if (ToLower(item.path).find(identity) == std::wstring::npos) continue;
      unique.emplace(PhysicalInterfaceKey(item.path), std::move(item));
    }
  }

  std::vector<InterfaceInfo> result;
  result.reserve(unique.size());
  for (auto& [key, item] : unique) {
    (void)key;
    QueryEndpoints(item);
    result.push_back(std::move(item));
  }
  std::sort(result.begin(), result.end(), [](const auto& left, const auto& right) {
    if (left.path == right.path) return left.number < right.number;
    return left.path < right.path;
  });
  return result;
}

class UsbTransport : public std::enable_shared_from_this<UsbTransport> {
 public:
  UsbTransport(Napi::Env env, const std::wstring& path, Napi::Function rxCallback,
               Napi::Function errorCallback, Napi::Function txCallback)
      : path_(path),
        rxTsfn_(Napi::ThreadSafeFunction::New(env, rxCallback, "usbcan-rx", 4096, 1)),
        errorTsfn_(Napi::ThreadSafeFunction::New(env, errorCallback, "usbcan-error", 8, 1)),
        txTsfn_(Napi::ThreadSafeFunction::New(env, txCallback, "usbcan-tx", 1024, 1)) {}

  ~UsbTransport() { Close(); }

  void Open() {
    file_ = CreateFileW(path_.c_str(), GENERIC_READ | GENERIC_WRITE,
                        FILE_SHARE_READ | FILE_SHARE_WRITE, nullptr, OPEN_EXISTING,
                        FILE_ATTRIBUTE_NORMAL | FILE_FLAG_OVERLAPPED, nullptr);
    if (file_ == INVALID_HANDLE_VALUE) {
      throw std::runtime_error(WindowsError("CreateFileW"));
    }
    if (!WinUsb_Initialize(file_, &usb_)) {
      const std::string error = WindowsError("WinUsb_Initialize");
      CloseHandle(file_);
      file_ = INVALID_HANDLE_VALUE;
      throw std::runtime_error(error);
    }

    USB_INTERFACE_DESCRIPTOR descriptor{};
    if (!WinUsb_QueryInterfaceSettings(usb_, 0, &descriptor)) {
      const std::string error = WindowsError("WinUsb_QueryInterfaceSettings");
      CloseHandles();
      throw std::runtime_error(error);
    }
    interfaceNumber_ = descriptor.bInterfaceNumber;
    for (uint8_t index = 0; index < descriptor.bNumEndpoints; ++index) {
      WINUSB_PIPE_INFORMATION pipe{};
      if (!WinUsb_QueryPipe(usb_, 0, index, &pipe)) {
        const std::string error = WindowsError("WinUsb_QueryPipe");
        CloseHandles();
        throw std::runtime_error(error);
      }
      if (pipe.PipeType != UsbdPipeTypeBulk) continue;
      if (USB_ENDPOINT_DIRECTION_IN(pipe.PipeId)) {
        endpointIn_ = pipe.PipeId;
      } else {
        endpointOut_ = pipe.PipeId;
      }
    }
    if (endpointIn_ == 0 || endpointOut_ == 0) {
      CloseHandles();
      throw std::runtime_error("WinUSB interface has no bulk IN/OUT endpoint pair");
    }

    UCHAR enabled = TRUE;
    WinUsb_SetPipePolicy(usb_, endpointIn_, ALLOW_PARTIAL_READS, sizeof(enabled), &enabled);
    WinUsb_SetPipePolicy(usb_, endpointIn_, AUTO_CLEAR_STALL, sizeof(enabled), &enabled);
    WinUsb_SetPipePolicy(usb_, endpointOut_, AUTO_CLEAR_STALL, sizeof(enabled), &enabled);
    txThread_ = std::thread(&UsbTransport::TxLoop, this);
  }

  uint8_t InterfaceNumber() const { return interfaceNumber_; }

  void StartRx() {
    bool expected = false;
    if (!rxStarted_.compare_exchange_strong(expected, true)) return;
    rxThread_ = std::thread(&UsbTransport::RxLoop, this);
  }

  std::vector<uint8_t> ControlIn(uint8_t requestType, uint8_t request,
                                 uint16_t value, uint16_t index, uint16_t length) {
    std::lock_guard<std::mutex> lock(controlMutex_);
    EnsureOpen();
    std::vector<uint8_t> result(length);
    WINUSB_SETUP_PACKET setup{requestType, request, value, index, length};
    ULONG transferred = 0;
    if (!WinUsb_ControlTransfer(usb_, setup, result.data(), length, &transferred, nullptr)) {
      throw std::runtime_error(WindowsError("WinUsb_ControlTransfer(IN)"));
    }
    if (transferred != length) {
      std::ostringstream error;
      error << "short control read: " << transferred << '/' << length;
      throw std::runtime_error(error.str());
    }
    return result;
  }

  void ControlOut(uint8_t requestType, uint8_t request, uint16_t value,
                  uint16_t index, const std::vector<uint8_t>& bytes) {
    std::lock_guard<std::mutex> lock(controlMutex_);
    EnsureOpen();
    WINUSB_SETUP_PACKET setup{requestType, request, value, index,
                              static_cast<USHORT>(bytes.size())};
    ULONG transferred = 0;
    auto* data = const_cast<uint8_t*>(bytes.data());
    if (!WinUsb_ControlTransfer(usb_, setup, data, static_cast<ULONG>(bytes.size()),
                                &transferred, nullptr)) {
      throw std::runtime_error(WindowsError("WinUsb_ControlTransfer(OUT)"));
    }
    if (transferred != bytes.size()) {
      std::ostringstream error;
      error << "short control write: " << transferred << '/' << bytes.size();
      throw std::runtime_error(error.str());
    }
  }

  bool Enqueue(uint32_t token, const uint8_t* data, size_t length,
               uint32_t delayBeforeMs, uint32_t delayAfterMs) {
    std::lock_guard<std::mutex> lock(txMutex_);
    if (closing_ || txQueue_.size() >= kTxQueueLimit) return false;
    txQueue_.push_back(TxJob{token, std::vector<uint8_t>(data, data + length),
                             delayBeforeMs, delayAfterMs});
    txCondition_.notify_one();
    return true;
  }

  void Close() {
    bool expected = false;
    if (!closing_.compare_exchange_strong(expected, true)) return;
    txCondition_.notify_all();
    if (file_ != INVALID_HANDLE_VALUE) CancelIoEx(file_, nullptr);
    if (rxThread_.joinable()) rxThread_.join();
    if (txThread_.joinable()) txThread_.join();
    CloseHandles();
    rxTsfn_.Release();
    errorTsfn_.Release();
    txTsfn_.Release();
  }

 private:
  void EnsureOpen() const {
    if (closing_ || file_ == INVALID_HANDLE_VALUE || usb_ == nullptr) {
      throw std::runtime_error("WinUSB transport is closed");
    }
  }

  void CloseHandles() {
    if (usb_ != nullptr) {
      WinUsb_Free(usb_);
      usb_ = nullptr;
    }
    if (file_ != INVALID_HANDLE_VALUE) {
      CloseHandle(file_);
      file_ = INVALID_HANDLE_VALUE;
    }
  }

  bool ReadOnce(HANDLE event, OVERLAPPED& overlapped, std::vector<uint8_t>& output,
                DWORD& errorCode) {
    ResetEvent(event);
    ZeroMemory(&overlapped, sizeof(overlapped));
    overlapped.hEvent = event;
    ULONG transferred = 0;
    BOOL started = WinUsb_ReadPipe(usb_, endpointIn_, output.data(),
                                   static_cast<ULONG>(output.size()), &transferred,
                                   &overlapped);
    if (started) {
      output.resize(transferred);
      return true;
    }
    errorCode = GetLastError();
    if (errorCode != ERROR_IO_PENDING) return false;

    while (!closing_) {
      const DWORD wait = WaitForSingleObject(event, kRxPollMs);
      if (wait == WAIT_TIMEOUT) continue;
      if (wait != WAIT_OBJECT_0) {
        errorCode = GetLastError();
        return false;
      }
      if (!WinUsb_GetOverlappedResult(usb_, &overlapped, &transferred, FALSE)) {
        errorCode = GetLastError();
        return false;
      }
      output.resize(transferred);
      return true;
    }
    CancelIoEx(file_, &overlapped);
    ULONG ignored = 0;
    WinUsb_GetOverlappedResult(usb_, &overlapped, &ignored, TRUE);
    errorCode = ERROR_OPERATION_ABORTED;
    return false;
  }

  bool WriteOnce(HANDLE event, OVERLAPPED& overlapped,
                 const std::vector<uint8_t>& bytes, DWORD& errorCode) {
    ResetEvent(event);
    ZeroMemory(&overlapped, sizeof(overlapped));
    overlapped.hEvent = event;
    ULONG transferred = 0;
    BOOL started = WinUsb_WritePipe(usb_, endpointOut_,
                                    const_cast<uint8_t*>(bytes.data()),
                                    static_cast<ULONG>(bytes.size()), &transferred,
                                    &overlapped);
    if (!started) {
      errorCode = GetLastError();
      if (errorCode != ERROR_IO_PENDING) return false;
      const DWORD wait = WaitForSingleObject(event, kIoTimeoutMs);
      if (wait == WAIT_TIMEOUT) {
        CancelIoEx(file_, &overlapped);
        ULONG ignored = 0;
        WinUsb_GetOverlappedResult(usb_, &overlapped, &ignored, TRUE);
        errorCode = WAIT_TIMEOUT;
        return false;
      }
      if (wait != WAIT_OBJECT_0 ||
          !WinUsb_GetOverlappedResult(usb_, &overlapped, &transferred, FALSE)) {
        errorCode = GetLastError();
        return false;
      }
    }
    if (transferred != bytes.size()) {
      errorCode = ERROR_WRITE_FAULT;
      return false;
    }
    return true;
  }

  void RxLoop() {
    HANDLE event = CreateEventW(nullptr, TRUE, FALSE, nullptr);
    if (event == nullptr) {
      ReportError("CreateEventW(RX)", GetLastError());
      return;
    }
    OVERLAPPED overlapped{};
    while (!closing_) {
      std::vector<uint8_t> bytes(kTransferSize);
      DWORD error = ERROR_SUCCESS;
      if (!ReadOnce(event, overlapped, bytes, error)) {
        if (!closing_ && error != ERROR_OPERATION_ABORTED) {
          ReportError("WinUsb_ReadPipe", error);
        }
        break;
      }
      if (bytes.empty()) continue;
      auto* payload = new std::vector<uint8_t>(std::move(bytes));
      const napi_status status = rxTsfn_.NonBlockingCall(
          payload, [](Napi::Env env, Napi::Function callback,
                      std::vector<uint8_t>* value) {
            callback.Call({Napi::Buffer<uint8_t>::Copy(env, value->data(), value->size())});
            delete value;
          });
      if (status != napi_ok) {
        delete payload;
        if (!closing_ && status != napi_closing) {
          ReportError("RX callback queue", ERROR_NOT_ENOUGH_MEMORY);
        }
      }
    }
    CloseHandle(event);
  }

  void TxLoop() {
    HANDLE event = CreateEventW(nullptr, TRUE, FALSE, nullptr);
    if (event == nullptr) {
      ReportError("CreateEventW(TX)", GetLastError());
      return;
    }
    OVERLAPPED overlapped{};
    while (true) {
      TxJob job;
      {
        std::unique_lock<std::mutex> lock(txMutex_);
        txCondition_.wait(lock, [&] { return closing_ || !txQueue_.empty(); });
        if (closing_ && txQueue_.empty()) break;
        job = std::move(txQueue_.front());
        txQueue_.pop_front();
      }
      if (!closing_ && job.delayBeforeMs > 0) {
        std::this_thread::sleep_for(std::chrono::milliseconds(job.delayBeforeMs));
      }

      DWORD error = ERROR_SUCCESS;
      const bool ok = !closing_ && WriteOnce(event, overlapped, job.bytes, error);
      if (ok && job.delayAfterMs > 0) {
        std::this_thread::sleep_for(std::chrono::milliseconds(job.delayAfterMs));
      }
      auto* result = new TxResult{job.token, ok,
                                  ok ? std::string{} : WindowsError("WinUsb_WritePipe", error)};
      const napi_status status = txTsfn_.NonBlockingCall(
          result, [](Napi::Env env, Napi::Function callback, TxResult* value) {
            Napi::Object object = Napi::Object::New(env);
            object.Set("token", Napi::Number::New(env, value->token));
            object.Set("ok", Napi::Boolean::New(env, value->ok));
            if (!value->ok) object.Set("error", Napi::String::New(env, value->error));
            callback.Call({object});
            delete value;
          });
      if (status != napi_ok) delete result;
    }

    std::deque<TxJob> abandoned;
    {
      std::lock_guard<std::mutex> lock(txMutex_);
      abandoned.swap(txQueue_);
    }
    for (const auto& job : abandoned) {
      auto* result = new TxResult{job.token, false, "WinUSB transport is closed"};
      const napi_status status = txTsfn_.NonBlockingCall(
          result, [](Napi::Env env, Napi::Function callback, TxResult* value) {
            Napi::Object object = Napi::Object::New(env);
            object.Set("token", Napi::Number::New(env, value->token));
            object.Set("ok", Napi::Boolean::New(env, false));
            object.Set("error", Napi::String::New(env, value->error));
            callback.Call({object});
            delete value;
          });
      if (status != napi_ok) delete result;
    }
    CloseHandle(event);
  }

  void ReportError(const std::string& operation, DWORD code) {
    auto* result = new ErrorResult{code, operation, WindowsError(operation, code)};
    const napi_status status = errorTsfn_.NonBlockingCall(
        result, [](Napi::Env env, Napi::Function callback, ErrorResult* value) {
          Napi::Object object = Napi::Object::New(env);
          object.Set("operation", Napi::String::New(env, value->operation));
          object.Set("code", Napi::Number::New(env, value->code));
          object.Set("message", Napi::String::New(env, value->detail));
          callback.Call({object});
          delete value;
        });
    if (status != napi_ok) delete result;
  }

  std::wstring path_;
  HANDLE file_ = INVALID_HANDLE_VALUE;
  WINUSB_INTERFACE_HANDLE usb_ = nullptr;
  uint8_t interfaceNumber_ = 0;
  uint8_t endpointIn_ = 0;
  uint8_t endpointOut_ = 0;
  std::atomic<bool> closing_{false};
  std::atomic<bool> rxStarted_{false};
  std::thread rxThread_;
  std::thread txThread_;
  std::mutex controlMutex_;
  std::mutex txMutex_;
  std::condition_variable txCondition_;
  std::deque<TxJob> txQueue_;
  Napi::ThreadSafeFunction rxTsfn_;
  Napi::ThreadSafeFunction errorTsfn_;
  Napi::ThreadSafeFunction txTsfn_;
};

std::shared_ptr<UsbTransport> Lookup(uint32_t handle) {
  std::lock_guard<std::mutex> lock(gDevicesMutex);
  const auto found = gDevices.find(handle);
  if (found == gDevices.end()) throw std::runtime_error("invalid WinUSB transport handle");
  return found->second;
}

Napi::Value ListDevices(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 2 || !info[0].IsNumber() || !info[1].IsNumber()) {
    throw Napi::TypeError::New(env, "listDevices expects vid and pid");
  }
  try {
    const auto interfaces = EnumerateInterfaces(
        static_cast<uint16_t>(info[0].As<Napi::Number>().Uint32Value()),
        static_cast<uint16_t>(info[1].As<Napi::Number>().Uint32Value()));
    Napi::Array output = Napi::Array::New(env, interfaces.size());
    for (size_t index = 0; index < interfaces.size(); ++index) {
      const auto& item = interfaces[index];
      Napi::Object object = Napi::Object::New(env);
      object.Set("path", Napi::String::New(env, WideToUtf8(item.path)));
      object.Set("label", Napi::String::New(env, WideToUtf8(item.label)));
      object.Set("interfaceNumber", Napi::Number::New(env, item.number));
      object.Set("endpointIn", Napi::Number::New(env, item.endpointIn));
      object.Set("endpointOut", Napi::Number::New(env, item.endpointOut));
      object.Set("busy", Napi::Boolean::New(env, item.busy));
      output.Set(index, object);
    }
    return output;
  } catch (const std::exception& error) {
    throw Napi::Error::New(env, error.what());
  }
}

Napi::Value Open(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 4 || !info[0].IsString() || !info[1].IsFunction() ||
      !info[2].IsFunction() || !info[3].IsFunction()) {
    throw Napi::TypeError::New(env, "open expects path, rx callback, error callback, tx callback");
  }
  try {
    auto device = std::make_shared<UsbTransport>(
        env, Utf8ToWide(info[0].As<Napi::String>().Utf8Value()),
        info[1].As<Napi::Function>(), info[2].As<Napi::Function>(),
        info[3].As<Napi::Function>());
    device->Open();
    const uint32_t handle = gNextHandle.fetch_add(1);
    {
      std::lock_guard<std::mutex> lock(gDevicesMutex);
      gDevices.emplace(handle, device);
    }
    Napi::Object result = Napi::Object::New(env);
    result.Set("handle", Napi::Number::New(env, handle));
    result.Set("interfaceNumber", Napi::Number::New(env, device->InterfaceNumber()));
    return result;
  } catch (const std::exception& error) {
    throw Napi::Error::New(env, error.what());
  }
}

Napi::Value StartRx(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  try {
    Lookup(info[0].As<Napi::Number>().Uint32Value())->StartRx();
    return env.Undefined();
  } catch (const std::exception& error) {
    throw Napi::Error::New(env, error.what());
  }
}

Napi::Value Control(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 6) {
    throw Napi::TypeError::New(env, "control expects handle, type, request, value, index, data/length");
  }
  try {
    auto device = Lookup(info[0].As<Napi::Number>().Uint32Value());
    const uint8_t requestType = static_cast<uint8_t>(info[1].As<Napi::Number>().Uint32Value());
    const uint8_t request = static_cast<uint8_t>(info[2].As<Napi::Number>().Uint32Value());
    const uint16_t value = static_cast<uint16_t>(info[3].As<Napi::Number>().Uint32Value());
    const uint16_t index = static_cast<uint16_t>(info[4].As<Napi::Number>().Uint32Value());
    if ((requestType & 0x80) != 0) {
      const uint16_t length = static_cast<uint16_t>(info[5].As<Napi::Number>().Uint32Value());
      const auto bytes = device->ControlIn(requestType, request, value, index, length);
      return Napi::Buffer<uint8_t>::Copy(env, bytes.data(), bytes.size());
    }
    if (!info[5].IsBuffer()) {
      throw std::runtime_error("control OUT payload must be a Buffer");
    }
    const auto input = info[5].As<Napi::Buffer<uint8_t>>();
    device->ControlOut(requestType, request, value, index,
                       std::vector<uint8_t>(input.Data(), input.Data() + input.Length()));
    return env.Undefined();
  } catch (const std::exception& error) {
    throw Napi::Error::New(env, error.what());
  }
}

Napi::Value Write(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 5 || !info[1].IsBuffer()) {
    throw Napi::TypeError::New(
        env, "write expects handle, Buffer, token, delayBeforeMs, delayAfterMs");
  }
  try {
    const auto input = info[1].As<Napi::Buffer<uint8_t>>();
    const bool queued = Lookup(info[0].As<Napi::Number>().Uint32Value())
                            ->Enqueue(info[2].As<Napi::Number>().Uint32Value(),
                                      input.Data(), input.Length(),
                                      info[3].As<Napi::Number>().Uint32Value(),
                                      info[4].As<Napi::Number>().Uint32Value());
    return Napi::Boolean::New(env, queued);
  } catch (const std::exception& error) {
    throw Napi::Error::New(env, error.what());
  }
}

Napi::Value Close(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  std::shared_ptr<UsbTransport> device;
  {
    std::lock_guard<std::mutex> lock(gDevicesMutex);
    const uint32_t handle = info[0].As<Napi::Number>().Uint32Value();
    const auto found = gDevices.find(handle);
    if (found == gDevices.end()) return env.Undefined();
    device = found->second;
    gDevices.erase(found);
  }
  device->Close();
  return env.Undefined();
}

void Cleanup(void*) {
  std::map<uint32_t, std::shared_ptr<UsbTransport>> devices;
  {
    std::lock_guard<std::mutex> lock(gDevicesMutex);
    devices.swap(gDevices);
  }
  for (auto& [handle, device] : devices) {
    (void)handle;
    device->Close();
  }
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("listDevices", Napi::Function::New(env, ListDevices));
  exports.Set("open", Napi::Function::New(env, Open));
  exports.Set("startRx", Napi::Function::New(env, StartRx));
  exports.Set("control", Napi::Function::New(env, Control));
  exports.Set("write", Napi::Function::New(env, Write));
  exports.Set("close", Napi::Function::New(env, Close));
  napi_add_env_cleanup_hook(env, Cleanup, nullptr);
  return exports;
}

}  // namespace

NODE_API_MODULE(usbcan, Init)

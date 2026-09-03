#include <napi.h>

#include "../api/vkgs_usb.h"

#include <atomic>
#include <chrono>
#include <condition_variable>
#include <cstdint>
#include <cstdio>
#include <deque>
#include <map>
#include <memory>
#include <mutex>
#include <sstream>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

namespace {

constexpr size_t kTransferSize = 512;
constexpr size_t kTxQueueLimit = 512;
constexpr uint32_t kIoTimeoutMs = 2000;
constexpr uint32_t kRxPollMs = 100;

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
  int32_t code = 0;
  std::string operation;
  std::string detail;
};

std::mutex gDevicesMutex;
std::map<uint32_t, std::shared_ptr<class UsbTransport>> gDevices;
std::atomic<uint32_t> gNextHandle{1};

std::string ApiErrorMessage(const vkgs_usb_error_t &error) {
  std::ostringstream output;
  output << (error.operation[0] != '\0' ? error.operation : "VKGS USB");
  if (error.message[0] != '\0')
    output << " failed: " << error.message;
  if (error.native_code != 0)
    output << " (code " << error.native_code << ')';
  return output.str();
}

int32_t ApiErrorCode(const vkgs_usb_error_t &error) {
  return error.native_code != 0 ? error.native_code
                                : static_cast<int32_t>(error.status);
}

class UsbTransport {
public:
  UsbTransport(Napi::Env env, std::string path, Napi::Function rxCallback,
               Napi::Function errorCallback, Napi::Function txCallback)
      : path_(std::move(path)), rxTsfn_(Napi::ThreadSafeFunction::New(
                                    env, rxCallback, "vkgs-usb-rx", 4096, 1)),
        errorTsfn_(Napi::ThreadSafeFunction::New(env, errorCallback,
                                                 "vkgs-usb-error", 8, 1)),
        txTsfn_(Napi::ThreadSafeFunction::New(env, txCallback, "vkgs-usb-tx",
                                              1024, 1)) {}

  ~UsbTransport() { Close(); }

  void Open() {
    vkgs_usb_error_t error{};
    device_ = vkgs_usb_open(path_.c_str(), &error);
    if (device_ == nullptr)
      throw std::runtime_error(ApiErrorMessage(error));
    txThread_ = std::thread(&UsbTransport::TxLoop, this);
  }

  uint8_t InterfaceNumber() const { return vkgs_usb_interface_number(device_); }

  void StartRx() {
    EnsureOpen();
    bool expected = false;
    if (!rxStarted_.compare_exchange_strong(expected, true))
      return;
    rxThread_ = std::thread(&UsbTransport::RxLoop, this);
  }

  std::vector<uint8_t> ControlIn(uint8_t requestType, uint8_t request,
                                 uint16_t value, uint16_t index,
                                 uint16_t length) {
    std::lock_guard<std::mutex> lock(controlMutex_);
    EnsureOpen();
    std::vector<uint8_t> result(length);
    vkgs_usb_error_t error{};
    if (!vkgs_usb_control_in(device_, requestType, request, value, index,
                             result.data(), length, kIoTimeoutMs, &error)) {
      throw std::runtime_error(ApiErrorMessage(error));
    }
    return result;
  }

  void ControlOut(uint8_t requestType, uint8_t request, uint16_t value,
                  uint16_t index, const uint8_t *data, size_t length) {
    std::lock_guard<std::mutex> lock(controlMutex_);
    EnsureOpen();
    if (length > UINT16_MAX)
      throw std::runtime_error("VKGS USB control payload is too large");
    vkgs_usb_error_t error{};
    if (!vkgs_usb_control_out(device_, requestType, request, value, index, data,
                              static_cast<uint16_t>(length), kIoTimeoutMs,
                              &error)) {
      throw std::runtime_error(ApiErrorMessage(error));
    }
  }

  bool Enqueue(uint32_t token, const uint8_t *data, size_t length,
               uint32_t delayBeforeMs, uint32_t delayAfterMs) {
    if (data == nullptr || length == 0)
      return false;
    std::lock_guard<std::mutex> lock(txMutex_);
    if (closing_ || txQueue_.size() >= kTxQueueLimit)
      return false;
    txQueue_.push_back(TxJob{token, std::vector<uint8_t>(data, data + length),
                             delayBeforeMs, delayAfterMs});
    txCondition_.notify_one();
    return true;
  }

  void Close() {
    bool expected = false;
    if (!closing_.compare_exchange_strong(expected, true))
      return;
    txCondition_.notify_all();
    vkgs_usb_cancel(device_);
    if (rxThread_.joinable())
      rxThread_.join();
    if (txThread_.joinable())
      txThread_.join();
    vkgs_usb_close(device_);
    device_ = nullptr;
    rxTsfn_.Release();
    errorTsfn_.Release();
    txTsfn_.Release();
  }

private:
  void EnsureOpen() const {
    if (closing_ || device_ == nullptr) {
      throw std::runtime_error("VKGS USB transport is closed");
    }
  }

  bool WaitDelay(uint32_t delayMs) {
    if (delayMs == 0)
      return !closing_;
    std::unique_lock<std::mutex> lock(txMutex_);
    return !txCondition_.wait_for(lock, std::chrono::milliseconds(delayMs),
                                  [&] { return closing_.load(); });
  }

  void RxLoop() {
    while (!closing_) {
      std::vector<uint8_t> bytes(kTransferSize);
      size_t transferred = 0;
      vkgs_usb_error_t error{};
      if (!vkgs_usb_bulk_read(device_, bytes.data(), bytes.size(), &transferred,
                              kRxPollMs, &error)) {
        if (!closing_ && error.status != VKGS_USB_STATUS_CANCELLED)
          ReportError(error);
        break;
      }
      if (transferred == 0)
        continue;
      bytes.resize(transferred);
      auto *payload = new std::vector<uint8_t>(std::move(bytes));
      const napi_status status = rxTsfn_.NonBlockingCall(
          payload, [](Napi::Env env, Napi::Function callback,
                      std::vector<uint8_t> *value) {
            callback.Call({Napi::Buffer<uint8_t>::Copy(env, value->data(),
                                                       value->size())});
            delete value;
          });
      if (status != napi_ok) {
        delete payload;
        if (!closing_ && status != napi_closing) {
          vkgs_usb_error_t queueError{};
          queueError.status = VKGS_USB_STATUS_SYSTEM_ERROR;
          queueError.native_code = 0;
          std::snprintf(queueError.operation, sizeof(queueError.operation),
                        "RX callback queue");
          std::snprintf(queueError.message, sizeof(queueError.message),
                        "callback queue is full");
          ReportError(queueError);
          break;
        }
      }
    }
  }

  void TxLoop() {
    while (true) {
      TxJob job;
      {
        std::unique_lock<std::mutex> lock(txMutex_);
        txCondition_.wait(lock, [&] { return closing_ || !txQueue_.empty(); });
        if (closing_ && txQueue_.empty())
          break;
        job = std::move(txQueue_.front());
        txQueue_.pop_front();
      }

      bool ok = WaitDelay(job.delayBeforeMs);
      vkgs_usb_error_t error{};
      size_t transferred = 0;
      if (ok) {
        ok = vkgs_usb_bulk_write(device_, job.bytes.data(), job.bytes.size(),
                                 &transferred, kIoTimeoutMs, &error);
      }
      if (ok)
        ok = WaitDelay(job.delayAfterMs);
      std::string detail;
      if (!ok) {
        detail = error.status != VKGS_USB_STATUS_OK
                     ? ApiErrorMessage(error)
                     : "VKGS USB transport is closed";
      }
      PostTxResult(new TxResult{job.token, ok, std::move(detail)});
    }

    std::deque<TxJob> abandoned;
    {
      std::lock_guard<std::mutex> lock(txMutex_);
      abandoned.swap(txQueue_);
    }
    for (const auto &job : abandoned) {
      PostTxResult(
          new TxResult{job.token, false, "VKGS USB transport is closed"});
    }
  }

  void PostTxResult(TxResult *result) {
    const napi_status status = txTsfn_.NonBlockingCall(
        result, [](Napi::Env env, Napi::Function callback, TxResult *value) {
          Napi::Object object = Napi::Object::New(env);
          object.Set("token", Napi::Number::New(env, value->token));
          object.Set("ok", Napi::Boolean::New(env, value->ok));
          if (!value->ok)
            object.Set("error", Napi::String::New(env, value->error));
          callback.Call({object});
          delete value;
        });
    if (status != napi_ok)
      delete result;
  }

  void ReportError(const vkgs_usb_error_t &error) {
    auto *result = new ErrorResult{ApiErrorCode(error), error.operation,
                                   ApiErrorMessage(error)};
    const napi_status status = errorTsfn_.NonBlockingCall(
        result, [](Napi::Env env, Napi::Function callback, ErrorResult *value) {
          Napi::Object object = Napi::Object::New(env);
          object.Set("operation", Napi::String::New(env, value->operation));
          object.Set("code", Napi::Number::New(env, value->code));
          object.Set("message", Napi::String::New(env, value->detail));
          callback.Call({object});
          delete value;
        });
    if (status != napi_ok)
      delete result;
  }

  std::string path_;
  vkgs_usb_device_t *device_ = nullptr;
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
  if (found == gDevices.end())
    throw std::runtime_error("invalid VKGS USB transport handle");
  return found->second;
}

uint32_t ReadHandle(const Napi::CallbackInfo &info) {
  if (info.Length() == 0 || !info[0].IsNumber()) {
    throw Napi::TypeError::New(info.Env(),
                               "a numeric transport handle is required");
  }
  return info[0].As<Napi::Number>().Uint32Value();
}

Napi::Value ListDevices(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  vkgs_usb_device_list_t list{};
  vkgs_usb_error_t error{};
  if (!vkgs_usb_list_scan(&list, &error)) {
    throw Napi::Error::New(env, ApiErrorMessage(error));
  }
  Napi::Array output = Napi::Array::New(env, list.count);
  for (size_t index = 0; index < list.count; ++index) {
    const auto &item = list.devices[index];
    Napi::Object object = Napi::Object::New(env);
    object.Set("path", Napi::String::New(env, item.path));
    object.Set("label", Napi::String::New(env, item.label));
    object.Set("interfaceNumber",
               Napi::Number::New(env, item.interface_number));
    object.Set("endpointIn", Napi::Number::New(env, item.endpoint_in));
    object.Set("endpointOut", Napi::Number::New(env, item.endpoint_out));
    object.Set("busy", Napi::Boolean::New(env, item.busy));
    output.Set(index, object);
  }
  return output;
}

Napi::Value Open(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  if (info.Length() < 4 || !info[0].IsString() || !info[1].IsFunction() ||
      !info[2].IsFunction() || !info[3].IsFunction()) {
    throw Napi::TypeError::New(
        env, "open expects path, rx callback, error callback, tx callback");
  }
  try {
    auto device = std::make_shared<UsbTransport>(
        env, info[0].As<Napi::String>().Utf8Value(),
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
    result.Set("interfaceNumber",
               Napi::Number::New(env, device->InterfaceNumber()));
    return result;
  } catch (const std::exception &error) {
    throw Napi::Error::New(env, error.what());
  }
}

Napi::Value StartRx(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  try {
    Lookup(ReadHandle(info))->StartRx();
    return env.Undefined();
  } catch (const std::exception &error) {
    throw Napi::Error::New(env, error.what());
  }
}

Napi::Value Control(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  if (info.Length() < 6 || !info[0].IsNumber() || !info[1].IsNumber() ||
      !info[2].IsNumber() || !info[3].IsNumber() || !info[4].IsNumber()) {
    throw Napi::TypeError::New(
        env,
        "control expects handle, type, request, value, index, data/length");
  }
  try {
    auto device = Lookup(ReadHandle(info));
    const uint8_t requestType =
        static_cast<uint8_t>(info[1].As<Napi::Number>().Uint32Value());
    const uint8_t request =
        static_cast<uint8_t>(info[2].As<Napi::Number>().Uint32Value());
    const uint16_t value =
        static_cast<uint16_t>(info[3].As<Napi::Number>().Uint32Value());
    const uint16_t index =
        static_cast<uint16_t>(info[4].As<Napi::Number>().Uint32Value());
    if ((requestType & 0x80) != 0) {
      if (!info[5].IsNumber())
        throw std::runtime_error("control IN length must be numeric");
      const uint32_t rawLength = info[5].As<Napi::Number>().Uint32Value();
      if (rawLength > UINT16_MAX)
        throw std::runtime_error("control IN length is too large");
      const auto bytes = device->ControlIn(requestType, request, value, index,
                                           static_cast<uint16_t>(rawLength));
      return Napi::Buffer<uint8_t>::Copy(env, bytes.data(), bytes.size());
    }
    if (!info[5].IsBuffer())
      throw std::runtime_error("control OUT payload must be a Buffer");
    const auto input = info[5].As<Napi::Buffer<uint8_t>>();
    device->ControlOut(requestType, request, value, index, input.Data(),
                       input.Length());
    return env.Undefined();
  } catch (const std::exception &error) {
    throw Napi::Error::New(env, error.what());
  }
}

Napi::Value Write(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  if (info.Length() < 5 || !info[0].IsNumber() || !info[1].IsBuffer() ||
      !info[2].IsNumber() || !info[3].IsNumber() || !info[4].IsNumber()) {
    throw Napi::TypeError::New(
        env,
        "write expects handle, Buffer, token, delayBeforeMs, delayAfterMs");
  }
  try {
    const auto input = info[1].As<Napi::Buffer<uint8_t>>();
    const bool queued =
        Lookup(ReadHandle(info))
            ->Enqueue(info[2].As<Napi::Number>().Uint32Value(), input.Data(),
                      input.Length(), info[3].As<Napi::Number>().Uint32Value(),
                      info[4].As<Napi::Number>().Uint32Value());
    return Napi::Boolean::New(env, queued);
  } catch (const std::exception &error) {
    throw Napi::Error::New(env, error.what());
  }
}

Napi::Value Close(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  std::shared_ptr<UsbTransport> device;
  {
    std::lock_guard<std::mutex> lock(gDevicesMutex);
    const auto found = gDevices.find(ReadHandle(info));
    if (found == gDevices.end())
      return env.Undefined();
    device = found->second;
    gDevices.erase(found);
  }
  device->Close();
  return env.Undefined();
}

void Cleanup(void *) {
  std::map<uint32_t, std::shared_ptr<UsbTransport>> devices;
  {
    std::lock_guard<std::mutex> lock(gDevicesMutex);
    devices.swap(gDevices);
  }
  for (auto &entry : devices)
    entry.second->Close();
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

} // namespace

NODE_API_MODULE(vkgs_usb, Init)

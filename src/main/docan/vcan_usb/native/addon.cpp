#include <napi.h>

#include "../api/vcan_usb.h"

#include <atomic>
#include <chrono>
#include <cmath>
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
  bool fatal = true;
};

std::mutex gDevicesMutex;
std::map<uint32_t, std::shared_ptr<class UsbTransport>> gDevices;
std::atomic<uint32_t> gNextHandle{1};

std::string ApiErrorMessage(const vcan_usb_error_t &error) {
  std::ostringstream output;
  output << (error.operation[0] != '\0' ? error.operation : "VCAN USB");
  if (error.message[0] != '\0')
    output << " failed: " << error.message;
  if (error.native_code != 0)
    output << " (code " << error.native_code << ')';
  return output.str();
}

int32_t ApiErrorCode(const vcan_usb_error_t &error) {
  return error.native_code != 0 ? error.native_code
                                : static_cast<int32_t>(error.status);
}

uint32_t ReadUint32Value(const Napi::Value &value, const char *name) {
  if (!value.IsNumber())
    throw std::runtime_error(std::string(name) + " must be numeric");
  const double number = value.As<Napi::Number>().DoubleValue();
  if (!std::isfinite(number) || number < 0 || number > UINT32_MAX ||
      std::floor(number) != number)
    throw std::runtime_error(std::string(name) +
                             " must be an unsigned 32-bit integer");
  return static_cast<uint32_t>(number);
}

uint32_t ReadUint32(const Napi::Object &object, const char *name) {
  return ReadUint32Value(object.Get(name), name);
}

bool ReadBoolean(const Napi::Object &object, const char *name) {
  const Napi::Value value = object.Get(name);
  if (!value.IsBoolean())
    throw std::runtime_error(std::string(name) + " must be boolean");
  return value.As<Napi::Boolean>().Value();
}

vcan_usb_timing_t ReadTiming(const Napi::Value &value, const char *name) {
  if (!value.IsObject())
    throw std::runtime_error(std::string(name) + " timing is required");
  const Napi::Object object = value.As<Napi::Object>();
  return vcan_usb_timing_t{
      ReadUint32(object, "clockHz"),   ReadUint32(object, "bitrateHz"),
      ReadUint32(object, "prescaler"), ReadUint32(object, "tseg1"),
      ReadUint32(object, "tseg2"),     ReadUint32(object, "sjw")};
}

Napi::Object TimingLimitsToJs(Napi::Env env,
                              const vcan_usb_timing_limits_t &value) {
  Napi::Object output = Napi::Object::New(env);
  output.Set("feature", Napi::Number::New(env, value.feature));
  output.Set("fclk_can", Napi::Number::New(env, value.clock_hz));
  output.Set("tseg1_min", Napi::Number::New(env, value.tseg1_min));
  output.Set("tseg1_max", Napi::Number::New(env, value.tseg1_max));
  output.Set("tseg2_min", Napi::Number::New(env, value.tseg2_min));
  output.Set("tseg2_max", Napi::Number::New(env, value.tseg2_max));
  output.Set("sjw_max", Napi::Number::New(env, value.sjw_max));
  output.Set("brp_min", Napi::Number::New(env, value.brp_min));
  output.Set("brp_max", Napi::Number::New(env, value.brp_max));
  output.Set("brp_inc", Napi::Number::New(env, value.brp_inc));
  return output;
}

Napi::Object CapabilitiesToJs(Napi::Env env,
                              const vcan_usb_capabilities_t &value) {
  Napi::Object output = Napi::Object::New(env);
  output.Set("nominal", TimingLimitsToJs(env, value.nominal));
  if (value.has_data_timing)
    output.Set("data", TimingLimitsToJs(env, value.data));
  output.Set("fdSupported", Napi::Boolean::New(env, value.fd_supported));
  output.Set("listenOnlySupported",
             Napi::Boolean::New(env, value.listen_only_supported));
  output.Set("terminationSupported",
             Napi::Boolean::New(env, value.termination_supported));
  return output;
}

Napi::Object AppliedTimingToJs(Napi::Env env,
                               const vcan_usb_applied_timing_t &value) {
  Napi::Object output = Napi::Object::New(env);
  output.Set("requestedBitrate",
             Napi::Number::New(env, value.requested_bitrate_hz));
  output.Set("actualBitrate", Napi::Number::New(env, value.actual_bitrate_hz));
  output.Set("samplePointPermille",
             Napi::Number::New(env, value.sample_point_permille));
  output.Set("prescaler", Napi::Number::New(env, value.prescaler));
  output.Set("tseg1", Napi::Number::New(env, value.tseg1));
  output.Set("tseg2", Napi::Number::New(env, value.tseg2));
  output.Set("sjw", Napi::Number::New(env, value.sjw));
  output.Set("wirePrescaler", Napi::Number::New(env, value.wire_prescaler));
  output.Set("wireTseg1", Napi::Number::New(env, value.wire_tseg1));
  output.Set("wireTseg2", Napi::Number::New(env, value.wire_tseg2));
  output.Set("wireSjw", Napi::Number::New(env, value.wire_sjw));
  return output;
}

Napi::Object DeviceInfoToJs(Napi::Env env,
                            const vcan_usb_device_info_t &value) {
  Napi::Object output = Napi::Object::New(env);
  output.Set("swVersion", Napi::Number::New(env, value.software_version));
  output.Set("hwVersion", Napi::Number::New(env, value.hardware_version));
  Napi::Array uid = Napi::Array::New(env, 4);
  Napi::Array uuid = Napi::Array::New(env, 4);
  for (uint32_t index = 0; index < 4; ++index) {
    uid.Set(index, Napi::Number::New(env, value.uid[index]));
    uuid.Set(index, Napi::Number::New(env, value.uuid[index]));
  }
  output.Set("uid", uid);
  output.Set("uuid", uuid);
  return output;
}

Napi::Object AppliedConfigToJs(Napi::Env env,
                               const vcan_usb_applied_config_t &value) {
  Napi::Object output = Napi::Object::New(env);
  output.Set("nominal", AppliedTimingToJs(env, value.nominal));
  if (value.has_data_timing)
    output.Set("data", AppliedTimingToJs(env, value.data));
  output.Set("hardwareTimestamps",
             Napi::Boolean::New(env, value.hardware_timestamps));
  return output;
}

Napi::Object RxRecordToJs(Napi::Env env, const vcan_usb_rx_record_t &value) {
  Napi::Object output = Napi::Object::New(env);
  if (value.kind == VCAN_USB_RX_FRAME) {
    output.Set("kind", "frame");
    output.Set("id", Napi::Number::New(env, value.frame.id));
    output.Set("data", Napi::Buffer<uint8_t>::Copy(env, value.frame.data,
                                                   value.frame.length));
    output.Set("fd", Napi::Boolean::New(env, value.frame.fd));
    output.Set("brs", Napi::Boolean::New(env, value.frame.brs));
    output.Set("extended", Napi::Boolean::New(env, value.frame.extended));
    output.Set("remote", Napi::Boolean::New(env, value.frame.remote));
    output.Set("overflow", Napi::Boolean::New(env, value.frame.overflow));
    output.Set("esi", Napi::Boolean::New(env, value.frame.esi));
    output.Set("error", Napi::Boolean::New(env, value.frame.error));
    output.Set(
        "timestampUs",
        Napi::Number::New(env, static_cast<double>(value.frame.timestamp_us)));
  } else if (value.kind == VCAN_USB_RX_STATE) {
    output.Set("kind", "state");
    output.Set("state", Napi::Number::New(env, value.state));
    output.Set("rxErrorCount", Napi::Number::New(env, value.rx_error_count));
    output.Set("txErrorCount", Napi::Number::New(env, value.tx_error_count));
    output.Set("timestampUs",
               Napi::Number::New(env, static_cast<double>(value.timestamp_us)));
  } else {
    output.Set("kind", "bus-error");
    output.Set("errorFlag", Napi::Number::New(env, value.error_flag));
    output.Set("errorCode", Napi::Number::New(env, value.error_code));
    output.Set("rxErrorCount", Napi::Number::New(env, value.rx_error_count));
    output.Set("txErrorCount", Napi::Number::New(env, value.tx_error_count));
    output.Set("errorLoggingCount",
               Napi::Number::New(env, value.error_logging_count));
  }
  return output;
}

class UsbTransport {
public:
  UsbTransport(Napi::Env env, std::string path, Napi::Function rxCallback,
               Napi::Function errorCallback, Napi::Function txCallback)
      : path_(std::move(path)), rxTsfn_(Napi::ThreadSafeFunction::New(
                                    env, rxCallback, "vcan-usb-rx", 4096, 1)),
        errorTsfn_(Napi::ThreadSafeFunction::New(env, errorCallback,
                                                 "vcan-usb-error", 8, 1)),
        txTsfn_(Napi::ThreadSafeFunction::New(env, txCallback, "vcan-usb-tx",
                                              1024, 1)) {}

  ~UsbTransport() { Close(); }

  void Open() {
    vcan_usb_error_t error{};
    device_ = vcan_usb_open(path_.c_str(), &error);
    if (device_ == nullptr)
      throw std::runtime_error(ApiErrorMessage(error));
    txThread_ = std::thread(&UsbTransport::TxLoop, this);
  }

  uint8_t InterfaceNumber() const { return vcan_usb_interface_number(device_); }

  void StartRx() {
    EnsureOpen();
    bool expected = false;
    if (!rxStarted_.compare_exchange_strong(expected, true))
      return;
    rxThread_ = std::thread(&UsbTransport::RxLoop, this);
  }

  vcan_usb_capabilities_t Capabilities() {
    std::lock_guard<std::mutex> lock(controlMutex_);
    EnsureOpen();
    vcan_usb_capabilities_t result{};
    vcan_usb_error_t error{};
    if (!vcan_usb_get_capabilities(device_, &result, &error))
      throw std::runtime_error(ApiErrorMessage(error));
    return result;
  }

  vcan_usb_device_info_t DeviceInfo() {
    std::lock_guard<std::mutex> lock(controlMutex_);
    EnsureOpen();
    vcan_usb_device_info_t result{};
    vcan_usb_error_t error{};
    if (!vcan_usb_get_device_info(device_, &result, &error))
      throw std::runtime_error(ApiErrorMessage(error));
    return result;
  }

  bool Termination() {
    std::lock_guard<std::mutex> lock(controlMutex_);
    EnsureOpen();
    bool result = false;
    vcan_usb_error_t error{};
    if (!vcan_usb_get_termination(device_, &result, &error))
      throw std::runtime_error(ApiErrorMessage(error));
    return result;
  }

  vcan_usb_applied_config_t Configure(const vcan_usb_config_t &config) {
    std::lock_guard<std::mutex> lock(controlMutex_);
    EnsureOpen();
    vcan_usb_applied_config_t result{};
    vcan_usb_error_t error{};
    if (!vcan_usb_configure(device_, &config, &result, &error))
      throw std::runtime_error(ApiErrorMessage(error));
    return result;
  }

  void Stop() {
    std::lock_guard<std::mutex> lock(controlMutex_);
    EnsureOpen();
    vcan_usb_error_t error{};
    if (!vcan_usb_stop(device_, &error))
      throw std::runtime_error(ApiErrorMessage(error));
  }

  bool EnqueueFrame(uint32_t token, const vcan_usb_frame_t &frame,
                    uint32_t delayBeforeMs, uint32_t delayAfterMs,
                    std::vector<uint8_t> *normalized) {
    EnsureOpen();
    uint8_t wire[VCAN_USB_MAX_WIRE_FRAME]{};
    size_t wireLength = 0;
    uint8_t normalizedLength = 0;
    vcan_usb_error_t error{};
    if (!vcan_usb_encode_frame(device_, &frame, wire, sizeof(wire), &wireLength,
                               &normalizedLength, &error))
      throw std::runtime_error(ApiErrorMessage(error));
    normalized->assign(frame.data, frame.data + frame.length);
    normalized->resize(normalizedLength, 0);
    return Enqueue(token, wire, wireLength, delayBeforeMs, delayAfterMs);
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
    vcan_usb_cancel(device_);
    if (rxThread_.joinable())
      rxThread_.join();
    if (txThread_.joinable())
      txThread_.join();
    vcan_usb_close(device_);
    device_ = nullptr;
    rxTsfn_.Release();
    errorTsfn_.Release();
    txTsfn_.Release();
  }

private:
  void EnsureOpen() const {
    if (closing_ || device_ == nullptr) {
      throw std::runtime_error("VCAN USB transport is closed");
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
      vcan_usb_error_t error{};
      if (!vcan_usb_bulk_read(device_, bytes.data(), bytes.size(), &transferred,
                              kRxPollMs, &error)) {
        if (!closing_ && error.status != VCAN_USB_STATUS_CANCELLED)
          ReportError(error);
        break;
      }
      if (transferred == 0)
        continue;
      vcan_usb_rx_batch_t batch{};
      if (!vcan_usb_decode(device_, bytes.data(), transferred, &batch,
                           &error)) {
        vcan_usb_decoder_reset(device_);
        ReportError(error, false);
        continue;
      }
      if (batch.count == 0)
        continue;
      auto *payload = new std::vector<vcan_usb_rx_record_t>(
          batch.records, batch.records + batch.count);
      const napi_status status = rxTsfn_.NonBlockingCall(
          payload, [](Napi::Env env, Napi::Function callback,
                      std::vector<vcan_usb_rx_record_t> *value) {
            Napi::Array records = Napi::Array::New(env, value->size());
            for (size_t index = 0; index < value->size(); ++index)
              records.Set(index, RxRecordToJs(env, (*value)[index]));
            callback.Call({records});
            delete value;
          });
      if (status != napi_ok) {
        delete payload;
        if (!closing_ && status != napi_closing) {
          vcan_usb_error_t queueError{};
          queueError.status = VCAN_USB_STATUS_SYSTEM_ERROR;
          queueError.native_code = 0;
          std::snprintf(queueError.operation, sizeof(queueError.operation),
                        "RX callback queue");
          std::snprintf(queueError.message, sizeof(queueError.message),
                        "callback queue is full");
          ReportError(queueError, true);
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
      vcan_usb_error_t error{};
      size_t transferred = 0;
      if (ok) {
        ok = vcan_usb_bulk_write(device_, job.bytes.data(), job.bytes.size(),
                                 &transferred, kIoTimeoutMs, &error);
      }
      if (ok)
        ok = WaitDelay(job.delayAfterMs);
      std::string detail;
      if (!ok) {
        detail = error.status != VCAN_USB_STATUS_OK
                     ? ApiErrorMessage(error)
                     : "VCAN USB transport is closed";
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
          new TxResult{job.token, false, "VCAN USB transport is closed"});
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

  void ReportError(const vcan_usb_error_t &error, bool fatal = true) {
    auto *result = new ErrorResult{ApiErrorCode(error), error.operation,
                                   ApiErrorMessage(error), fatal};
    const napi_status status = errorTsfn_.NonBlockingCall(
        result, [](Napi::Env env, Napi::Function callback, ErrorResult *value) {
          Napi::Object object = Napi::Object::New(env);
          object.Set("operation", Napi::String::New(env, value->operation));
          object.Set("code", Napi::Number::New(env, value->code));
          object.Set("message", Napi::String::New(env, value->detail));
          object.Set("fatal", Napi::Boolean::New(env, value->fatal));
          callback.Call({object});
          delete value;
        });
    if (status != napi_ok)
      delete result;
  }

  std::string path_;
  vcan_usb_device_t *device_ = nullptr;
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
    throw std::runtime_error("invalid VCAN USB transport handle");
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
  vcan_usb_device_list_t list{};
  vcan_usb_error_t error{};
  if (!vcan_usb_list_scan(&list, &error)) {
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

Napi::Value FallbackCapabilities(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  vcan_usb_capabilities_t capabilities{};
  vcan_usb_fallback_capabilities(&capabilities);
  return CapabilitiesToJs(env, capabilities);
}

Napi::Value ReadCapabilities(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  try {
    return CapabilitiesToJs(env, Lookup(ReadHandle(info))->Capabilities());
  } catch (const std::exception &error) {
    throw Napi::Error::New(env, error.what());
  }
}

Napi::Value ReadDeviceInfo(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  try {
    return DeviceInfoToJs(env, Lookup(ReadHandle(info))->DeviceInfo());
  } catch (const std::exception &error) {
    throw Napi::Error::New(env, error.what());
  }
}

Napi::Value GetTermination(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  try {
    return Napi::Boolean::New(env, Lookup(ReadHandle(info))->Termination());
  } catch (const std::exception &error) {
    throw Napi::Error::New(env, error.what());
  }
}

Napi::Value Configure(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  if (info.Length() < 2 || !info[1].IsObject())
    throw Napi::TypeError::New(env, "configure expects handle and config");
  try {
    const Napi::Object input = info[1].As<Napi::Object>();
    vcan_usb_config_t config{};
    config.nominal = ReadTiming(input.Get("nominal"), "nominal");
    config.fd = ReadBoolean(input, "fd");
    config.listen_only = ReadBoolean(input, "listenOnly");
    config.termination = ReadBoolean(input, "termination");
    if (config.fd)
      config.data = ReadTiming(input.Get("data"), "data");
    return AppliedConfigToJs(env, Lookup(ReadHandle(info))->Configure(config));
  } catch (const std::exception &error) {
    throw Napi::Error::New(env, error.what());
  }
}

Napi::Value Stop(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  try {
    Lookup(ReadHandle(info))->Stop();
    return env.Undefined();
  } catch (const std::exception &error) {
    throw Napi::Error::New(env, error.what());
  }
}

Napi::Value WriteFrame(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  if (info.Length() < 5 || !info[1].IsObject()) {
    throw Napi::TypeError::New(
        env,
        "writeFrame expects handle, frame, token, delayBeforeMs, delayAfterMs");
  }
  try {
    const Napi::Object input = info[1].As<Napi::Object>();
    const Napi::Value dataValue = input.Get("data");
    if (!dataValue.IsBuffer())
      throw std::runtime_error("frame data must be a Buffer");
    const auto data = dataValue.As<Napi::Buffer<uint8_t>>();
    if (data.Length() > VCAN_USB_MAX_FRAME_DATA)
      throw std::runtime_error("frame data exceeds 64 bytes");
    vcan_usb_frame_t frame{};
    frame.id = ReadUint32(input, "id");
    frame.length = static_cast<uint8_t>(data.Length());
    if (frame.length > 0)
      std::memcpy(frame.data, data.Data(), frame.length);
    frame.fd = ReadBoolean(input, "fd");
    frame.brs = ReadBoolean(input, "brs");
    frame.extended = ReadBoolean(input, "extended");
    frame.remote = ReadBoolean(input, "remote");
    std::vector<uint8_t> normalized;
    const bool queued =
        Lookup(ReadHandle(info))
            ->EnqueueFrame(ReadUint32Value(info[2], "token"), frame,
                           ReadUint32Value(info[3], "delayBeforeMs"),
                           ReadUint32Value(info[4], "delayAfterMs"),
                           &normalized);
    return queued ? Napi::Buffer<uint8_t>::Copy(env, normalized.data(),
                                                normalized.size())
                  : env.Null();
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
  exports.Set("fallbackCapabilities",
              Napi::Function::New(env, FallbackCapabilities));
  exports.Set("readCapabilities", Napi::Function::New(env, ReadCapabilities));
  exports.Set("readDeviceInfo", Napi::Function::New(env, ReadDeviceInfo));
  exports.Set("getTermination", Napi::Function::New(env, GetTermination));
  exports.Set("configure", Napi::Function::New(env, Configure));
  exports.Set("stop", Napi::Function::New(env, Stop));
  exports.Set("writeFrame", Napi::Function::New(env, WriteFrame));
  exports.Set("close", Napi::Function::New(env, Close));
  napi_add_env_cleanup_hook(env, Cleanup, nullptr);
  return exports;
}

} // namespace

NODE_API_MODULE(vcan_usb, Init)

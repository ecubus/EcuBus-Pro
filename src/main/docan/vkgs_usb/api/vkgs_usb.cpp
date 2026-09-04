#include "vkgs_usb.h"

#include <libusb.h>

#include <algorithm>
#include <atomic>
#include <cerrno>
#include <chrono>
#include <climits>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <map>
#include <memory>
#include <mutex>
#include <new>
#include <set>
#include <sstream>
#include <string>
#include <thread>
#include <utility>
#include <vector>

namespace {

constexpr uint16_t kDeviceVid = 0x1d50;
constexpr uint16_t kDevicePid = 0x606f;
constexpr uint32_t kDefaultTimeoutMs = 2000;
constexpr uint32_t kDefaultPollMs = 100;
constexpr size_t kMaxPortDepth = 16;
constexpr const char *kPathPrefix = "libusb://1d50:606f/";

/* Effective HPM MCAN limits after the firmware translates the USB fields to
 * the SDK's low-level timing structure.  Keep these local to this driver: the
 * similarly shaped Candle protocol does not use the same wire semantics. */
constexpr uint32_t kNominalTseg1Min = 1;
constexpr uint32_t kNominalTseg1Max = 128;
constexpr uint32_t kNominalTseg2Min = 2;
constexpr uint32_t kNominalTseg2Max = 32;
constexpr uint32_t kNominalSjwMax = 64;
constexpr uint32_t kNominalBrpMax = 256;
constexpr uint32_t kDataTseg1Min = 1;
constexpr uint32_t kDataTseg1Max = 30;
constexpr uint32_t kDataTseg2Min = 1;
constexpr uint32_t kDataTseg2Max = 15;
constexpr uint32_t kDataSjwMax = 15;
constexpr uint32_t kDataBrpMax = 32;

/* VKGS firmware consumes zero-based register fields, unlike Candle's
 * host-semantic gs_usb timing values.  Validation guarantees value > 0. */
constexpr uint32_t EncodeTimingRegister(uint32_t value) { return value - 1U; }
static_assert(EncodeTimingRegister(1U) == 0U);
static_assert(EncodeTimingRegister(128U) == 127U);

struct DeviceKey {
  uint8_t bus = 0;
  uint8_t address = 0;
  uint8_t interface_number = 0;
  std::vector<uint8_t> ports;
};

struct InterfaceInfo {
  uint8_t number = 0;
  uint8_t alternate_setting = 0;
  uint8_t endpoint_in = 0;
  uint8_t endpoint_out = 0;
};

struct EnumeratedInterface {
  std::string path;
  std::string label;
  InterfaceInfo interface;
  bool busy = false;
};
struct SharedUsbDevice {
  libusb_context *context = nullptr;
  libusb_device_handle *handle = nullptr;
  std::mutex interface_mutex;
  std::mutex control_mutex;
  std::set<uint8_t> claimed_interfaces;

  ~SharedUsbDevice() {
    if (handle != nullptr)
      libusb_close(handle);
    if (context != nullptr)
      libusb_exit(context);
  }
};

std::mutex gOpenDevicesMutex;
std::map<std::string, std::weak_ptr<SharedUsbDevice>> gOpenDevices;

void CopyText(char *destination, size_t capacity, const std::string &source) {
  if (destination == nullptr || capacity == 0)
    return;
  const size_t length = std::min(capacity - 1, source.size());
  if (length > 0)
    std::memcpy(destination, source.data(), length);
  destination[length] = '\0';
}

vkgs_usb_status_t StatusFromLibusb(int code, bool cancelled) {
  if (cancelled) {
    return VKGS_USB_STATUS_CANCELLED;
  }
  if (code == LIBUSB_ERROR_INVALID_PARAM) {
    return VKGS_USB_STATUS_INVALID_ARGUMENT;
  }
  if (code == LIBUSB_ERROR_TIMEOUT)
    return VKGS_USB_STATUS_TIMEOUT;
  if (code == LIBUSB_ERROR_NOT_FOUND) {
    return VKGS_USB_STATUS_ENDPOINT_NOT_FOUND;
  }
  return VKGS_USB_STATUS_SYSTEM_ERROR;
}

std::string LibusbMessage(int code) {
  const char *name = libusb_error_name(code);
  const char *detail = libusb_strerror(static_cast<libusb_error>(code));
  std::string message = name != nullptr ? name : "LIBUSB_ERROR_UNKNOWN";
  if (detail != nullptr && detail[0] != '\0' && message != detail) {
    message += ": ";
    message += detail;
  }
  return message;
}

void SetError(vkgs_usb_error_t *error, vkgs_usb_status_t status,
              const char *operation, int32_t native_code,
              const std::string &detail) {
  if (error == nullptr)
    return;
  vkgs_usb_error_clear(error);
  error->status = status;
  error->native_code = native_code;
  CopyText(error->operation, sizeof(error->operation),
           operation != nullptr ? operation : "libusb");
  CopyText(error->message, sizeof(error->message),
           detail.empty() ? "operation failed" : detail);
}

void SetLibusbError(vkgs_usb_error_t *error, const char *operation, int code,
                    bool cancelled = false) {
  SetError(error, StatusFromLibusb(code, cancelled), operation, code,
           cancelled ? "USB transfer was cancelled" : LibusbMessage(code));
}

bool ParseByte(const std::string &text, uint8_t *output) {
  if (text.empty() || output == nullptr)
    return false;
  errno = 0;
  char *end = nullptr;
  const unsigned long value = std::strtoul(text.c_str(), &end, 10);
  if (errno != 0 || end == text.c_str() || *end != '\0' || value > UINT8_MAX) {
    return false;
  }
  *output = static_cast<uint8_t>(value);
  return true;
}

std::vector<uint8_t> GetPorts(libusb_device *device) {
  uint8_t ports[kMaxPortDepth]{};
  const int count =
      libusb_get_port_numbers(device, ports, static_cast<int>(kMaxPortDepth));
  if (count <= 0)
    return {};
  return std::vector<uint8_t>(ports, ports + count);
}

std::string MakePath(libusb_device *device, uint8_t interface_number) {
  std::ostringstream output;
  output << kPathPrefix << static_cast<unsigned>(libusb_get_bus_number(device))
         << '/';
  const auto ports = GetPorts(device);
  if (ports.empty()) {
    output << 'a' << static_cast<unsigned>(libusb_get_device_address(device));
  } else {
    output << 'p';
    for (size_t index = 0; index < ports.size(); ++index) {
      if (index != 0)
        output << '.';
      output << static_cast<unsigned>(ports[index]);
    }
  }
  output << '/' << static_cast<unsigned>(interface_number);
  return output.str();
}

bool ParsePath(const char *path, DeviceKey *key) {
  if (path == nullptr || key == nullptr)
    return false;
  const std::string value(path);
  if (value.compare(0, std::strlen(kPathPrefix), kPathPrefix) != 0)
    return false;
  const std::string body = value.substr(std::strlen(kPathPrefix));
  const size_t first = body.find('/');
  const size_t second = first == std::string::npos ? std::string::npos
                                                   : body.find('/', first + 1);
  if (first == std::string::npos || second == std::string::npos ||
      body.find('/', second + 1) != std::string::npos) {
    return false;
  }
  DeviceKey parsed;
  if (!ParseByte(body.substr(0, first), &parsed.bus) ||
      !ParseByte(body.substr(second + 1), &parsed.interface_number)) {
    return false;
  }
  const std::string location = body.substr(first + 1, second - first - 1);
  if (location.size() < 2)
    return false;
  if (location[0] == 'a') {
    if (!ParseByte(location.substr(1), &parsed.address))
      return false;
  } else if (location[0] == 'p') {
    size_t start = 1;
    while (start < location.size()) {
      const size_t end = location.find('.', start);
      uint8_t port = 0;
      if (!ParseByte(location.substr(start, end - start), &port) || port == 0) {
        return false;
      }
      parsed.ports.push_back(port);
      if (parsed.ports.size() > kMaxPortDepth)
        return false;
      if (end == std::string::npos)
        break;
      if (end + 1 >= location.size())
        return false;
      start = end + 1;
    }
    if (parsed.ports.empty())
      return false;
  } else {
    return false;
  }
  *key = std::move(parsed);
  return true;
}

bool Matches(libusb_device *device, const DeviceKey &key) {
  if (libusb_get_bus_number(device) != key.bus)
    return false;
  if (!key.ports.empty())
    return GetPorts(device) == key.ports;
  return libusb_get_device_address(device) == key.address;
}

bool FindInterface(libusb_device *device, uint8_t interface_number,
                   InterfaceInfo *result) {
  libusb_config_descriptor *config = nullptr;
  int status = libusb_get_active_config_descriptor(device, &config);
  if (status != LIBUSB_SUCCESS) {
    status = libusb_get_config_descriptor(device, 0, &config);
  }
  if (status != LIBUSB_SUCCESS || config == nullptr)
    return false;

  bool found = false;
  InterfaceInfo fallback{};
  bool has_fallback = false;
  for (uint8_t interface_index = 0;
       interface_index < config->bNumInterfaces && !found; ++interface_index) {
    const libusb_interface &usb_interface = config->interface[interface_index];
    for (int alternate_index = 0;
         alternate_index < usb_interface.num_altsetting; ++alternate_index) {
      const libusb_interface_descriptor &descriptor =
          usb_interface.altsetting[alternate_index];
      if (descriptor.bInterfaceNumber != interface_number)
        continue;
      InterfaceInfo candidate{};
      candidate.number = descriptor.bInterfaceNumber;
      candidate.alternate_setting = descriptor.bAlternateSetting;
      for (uint8_t endpoint_index = 0;
           endpoint_index < descriptor.bNumEndpoints; ++endpoint_index) {
        const libusb_endpoint_descriptor &endpoint =
            descriptor.endpoint[endpoint_index];
        if ((endpoint.bmAttributes & LIBUSB_TRANSFER_TYPE_MASK) !=
            LIBUSB_TRANSFER_TYPE_BULK) {
          continue;
        }
        if ((endpoint.bEndpointAddress & LIBUSB_ENDPOINT_DIR_MASK) ==
            LIBUSB_ENDPOINT_IN) {
          candidate.endpoint_in = endpoint.bEndpointAddress;
        } else {
          candidate.endpoint_out = endpoint.bEndpointAddress;
        }
      }
      if (candidate.endpoint_in == 0 || candidate.endpoint_out == 0)
        continue;
      if (!has_fallback) {
        fallback = candidate;
        has_fallback = true;
      }
      if (candidate.alternate_setting == 0) {
        *result = candidate;
        found = true;
        break;
      }
    }
  }
  if (!found && has_fallback) {
    *result = fallback;
    found = true;
  }
  libusb_free_config_descriptor(config);
  return found;
}

std::vector<InterfaceInfo> FindInterfaces(libusb_device *device) {
  libusb_config_descriptor *config = nullptr;
  int status = libusb_get_active_config_descriptor(device, &config);
  if (status != LIBUSB_SUCCESS) {
    status = libusb_get_config_descriptor(device, 0, &config);
  }
  if (status != LIBUSB_SUCCESS || config == nullptr)
    return {};
  std::vector<InterfaceInfo> output;
  for (uint8_t interface_index = 0; interface_index < config->bNumInterfaces;
       ++interface_index) {
    const libusb_interface &usb_interface = config->interface[interface_index];
    if (usb_interface.num_altsetting <= 0)
      continue;
    const uint8_t number = usb_interface.altsetting[0].bInterfaceNumber;
    InterfaceInfo info{};
    if (FindInterface(device, number, &info))
      output.push_back(info);
  }
  libusb_free_config_descriptor(config);
  return output;
}

std::string PhysicalKey(const DeviceKey &key) {
  std::ostringstream output;
  output << static_cast<unsigned>(key.bus) << '/';
  if (key.ports.empty()) {
    output << 'a' << static_cast<unsigned>(key.address);
  } else {
    output << 'p';
    for (size_t index = 0; index < key.ports.size(); ++index) {
      if (index != 0)
        output << '.';
      output << static_cast<unsigned>(key.ports[index]);
    }
  }
  return output.str();
}

std::string PhysicalKey(libusb_device *device) {
  DeviceKey key;
  key.bus = libusb_get_bus_number(device);
  key.address = libusb_get_device_address(device);
  key.ports = GetPorts(device);
  return PhysicalKey(key);
}

std::shared_ptr<SharedUsbDevice> AcquireDevice(const DeviceKey &key,
                                               vkgs_usb_error_t *error) {
  const std::string physical_key = PhysicalKey(key);
  std::lock_guard<std::mutex> registry_lock(gOpenDevicesMutex);
  const auto existing = gOpenDevices.find(physical_key);
  if (existing != gOpenDevices.end()) {
    if (auto shared = existing->second.lock())
      return shared;
    gOpenDevices.erase(existing);
  }

  std::shared_ptr<SharedUsbDevice> shared;
  try {
    shared = std::make_shared<SharedUsbDevice>();
  } catch (const std::bad_alloc &) {
    SetError(error, VKGS_USB_STATUS_SYSTEM_ERROR, "libusb_open",
             LIBUSB_ERROR_NO_MEM, "unable to allocate the shared USB device");
    return {};
  }

  int status = libusb_init(&shared->context);
  if (status != LIBUSB_SUCCESS) {
    SetLibusbError(error, "libusb_init", status);
    return {};
  }
  libusb_device **devices = nullptr;
  const ssize_t count = libusb_get_device_list(shared->context, &devices);
  if (count < 0) {
    SetLibusbError(error, "libusb_get_device_list", static_cast<int>(count));
    return {};
  }

  status = LIBUSB_ERROR_NO_DEVICE;
  for (ssize_t index = 0; index < count; ++index) {
    libusb_device_descriptor descriptor{};
    if (libusb_get_device_descriptor(devices[index], &descriptor) !=
            LIBUSB_SUCCESS ||
        descriptor.idVendor != kDeviceVid ||
        descriptor.idProduct != kDevicePid || !Matches(devices[index], key)) {
      continue;
    }
    status = libusb_open(devices[index], &shared->handle);
    break;
  }
  libusb_free_device_list(devices, 1);
  if (shared->handle == nullptr || status != LIBUSB_SUCCESS) {
    SetLibusbError(error, "libusb_open", status);
    return {};
  }

  gOpenDevices[physical_key] = shared;
  return shared;
}
std::string ReadLabel(libusb_device_handle *handle,
                      const libusb_device_descriptor &descriptor) {
  if (handle == nullptr || descriptor.iProduct == 0)
    return "VKGS USB";
  unsigned char value[VKGS_USB_LABEL_CAPACITY]{};
  const int length = libusb_get_string_descriptor_ascii(
      handle, descriptor.iProduct, value, static_cast<int>(sizeof(value) - 1));
  return length > 0 ? std::string(reinterpret_cast<char *>(value), length)
                    : "VKGS USB";
}

bool ProbeBusy(libusb_device *device, uint8_t interface_number,
               std::string *label, const libusb_device_descriptor &descriptor) {
  std::shared_ptr<SharedUsbDevice> shared;
  {
    std::lock_guard<std::mutex> registry_lock(gOpenDevicesMutex);
    const auto existing = gOpenDevices.find(PhysicalKey(device));
    if (existing != gOpenDevices.end())
      shared = existing->second.lock();
  }
  if (shared) {
    *label = ReadLabel(shared->handle, descriptor);
    std::lock_guard<std::mutex> interface_lock(shared->interface_mutex);
    return shared->claimed_interfaces.count(interface_number) != 0;
  }

  libusb_device_handle *handle = nullptr;
  const int open_status = libusb_open(device, &handle);
  if (open_status != LIBUSB_SUCCESS || handle == nullptr)
    return true;
  *label = ReadLabel(handle, descriptor);
  bool busy = false;
  const int kernel_active =
      libusb_kernel_driver_active(handle, interface_number);
  if (kernel_active != 1) {
    const int claim_status = libusb_claim_interface(handle, interface_number);
    busy = claim_status != LIBUSB_SUCCESS;
    if (!busy)
      libusb_release_interface(handle, interface_number);
  }
  libusb_close(handle);
  return busy;
}
bool ValidateOpen(vkgs_usb_device_t *device, vkgs_usb_error_t *error,
                  const char *operation);

} // namespace

struct vkgs_usb_device {
  std::shared_ptr<SharedUsbDevice> owner;
  libusb_context *context = nullptr;
  libusb_device_handle *handle = nullptr;
  uint8_t interface_number = 0;
  uint8_t alternate_setting = 0;
  uint8_t endpoint_in = 0;
  uint8_t endpoint_out = 0;
  bool claimed = false;
  bool manually_detached = false;
  std::atomic<bool> cancelled{false};
  std::atomic<bool> fd_mode{false};
  std::atomic<bool> timestamps_enabled{false};
  std::mutex protocol_mutex;
  std::mutex decoder_mutex;
  bool capabilities_cached = false;
  vkgs_usb_capabilities_t capabilities{};
  std::vector<uint8_t> decoder_tail;
};

namespace {

constexpr uint32_t kFeatureListenOnly = 1U << 0;
constexpr uint32_t kFeatureHardwareTimestamp = 1U << 4;
constexpr uint32_t kFeatureFd = 1U << 8;
constexpr uint32_t kFeatureBtConstExt = 1U << 10;
constexpr uint32_t kFeatureTermination = 1U << 11;
constexpr uint32_t kFeatureBerrReporting = 1U << 12;
constexpr uint32_t kModeListenOnly = 1U << 0;
constexpr uint32_t kModeHardwareTimestamp = 1U << 4;
constexpr uint32_t kModeFd = 1U << 8;
constexpr uint32_t kModeBerrReporting = 1U << 12;
constexpr uint8_t kRequestHostFormat = 0;
constexpr uint8_t kRequestBitTiming = 1;
constexpr uint8_t kRequestMode = 2;
constexpr uint8_t kRequestBtConst = 4;
constexpr uint8_t kRequestDataBitTiming = 10;
constexpr uint8_t kRequestBtConstExt = 11;
constexpr uint8_t kRequestFallbackSetTermination = 12;
constexpr uint8_t kRequestFallbackGetTermination = 13;
constexpr uint8_t kRequestDeviceInfo = 33;
constexpr uint8_t kRequestBusLoad = 36;
constexpr uint8_t kRequestTermination = 37;
constexpr uint32_t kEchoRx = 0xffffffffU;
constexpr uint32_t kEchoLoad = 0xa3c95e3dU;
constexpr uint32_t kEchoState = 0xa4c95e3dU;
constexpr uint32_t kEchoBerr = 0xa6c95e3dU;
constexpr size_t kHeaderSize = 12;
constexpr size_t kStateSize = 28;
constexpr size_t kBerrSize = 16;
constexpr size_t kLoadSize = 28;
constexpr uint8_t kFlagOverflow = 1U << 0;
constexpr uint8_t kFlagFd = 1U << 1;
constexpr uint8_t kFlagBrs = 1U << 2;
constexpr uint8_t kFlagEsi = 1U << 3;
constexpr uint32_t kCanEffFlag = 0x80000000U;
constexpr uint32_t kCanRtrFlag = 0x40000000U;
constexpr uint32_t kCanErrorFlag = 0x20000000U;
constexpr uint32_t kCanSffMask = 0x7ffU;
constexpr uint32_t kCanIdMask = 0x1fffffffU;
constexpr uint8_t kDlcLengths[16] = {0, 1,  2,  3,  4,  5,  6,  7,
                                     8, 12, 16, 20, 24, 32, 48, 64};

uint32_t ReadLe32(const uint8_t *data);
uint64_t ReadLe64(const uint8_t *data);
void WriteLe32(uint8_t *data, uint32_t value);
bool ProtocolError(vkgs_usb_error_t *error, const char *operation,
                   const std::string &message,
                   vkgs_usb_status_t status = VKGS_USB_STATUS_PROTOCOL_ERROR);
bool ControlGet(vkgs_usb_device_t *device, uint8_t request, size_t length,
                std::vector<uint8_t> *payload, vkgs_usb_error_t *error);
void FillFallback(vkgs_usb_capabilities_t *capabilities);
bool GetCapabilitiesUnlocked(vkgs_usb_device_t *device,
                             vkgs_usb_capabilities_t *capabilities,
                             vkgs_usb_error_t *error);
bool ValidateTiming(const vkgs_usb_timing_t &timing,
                    const vkgs_usb_timing_limits_t &limits,
                    vkgs_usb_applied_timing_t *applied, vkgs_usb_error_t *error,
                    const char *phase);
bool SetTiming(vkgs_usb_device_t *device, uint8_t request,
               const vkgs_usb_applied_timing_t &timing,
               vkgs_usb_error_t *error);
bool SetMode(vkgs_usb_device_t *device, uint32_t mode, uint32_t flags,
             vkgs_usb_error_t *error);
bool SetHostFormat(vkgs_usb_device_t *device, vkgs_usb_error_t *error);
bool SetBusLoad(vkgs_usb_device_t *device, bool enabled,
                vkgs_usb_error_t *error);
bool SetTermination(vkgs_usb_device_t *device, bool enabled,
                    vkgs_usb_error_t *error);
uint8_t LengthToDlc(uint8_t length, bool fd);
uint8_t DlcToLength(uint8_t dlc, bool fd);
bool AppendRecord(vkgs_usb_rx_batch_t *batch, vkgs_usb_rx_record_t **record,
                  vkgs_usb_error_t *error);

} // namespace

void vkgs_usb_fallback_capabilities(vkgs_usb_capabilities_t *capabilities) {
  FillFallback(capabilities);
}

bool vkgs_usb_get_capabilities(vkgs_usb_device_t *device,
                               vkgs_usb_capabilities_t *capabilities,
                               vkgs_usb_error_t *error) {
  if (!ValidateOpen(device, error, "vkgs_usb_get_capabilities") ||
      capabilities == nullptr) {
    if (capabilities == nullptr)
      ProtocolError(error, "vkgs_usb_get_capabilities",
                    "capabilities output is null",
                    VKGS_USB_STATUS_INVALID_ARGUMENT);
    return false;
  }
  std::lock_guard<std::mutex> lock(device->protocol_mutex);
  vkgs_usb_error_clear(error);
  return GetCapabilitiesUnlocked(device, capabilities, error);
}

bool vkgs_usb_get_device_info(vkgs_usb_device_t *device,
                              vkgs_usb_device_info_t *info,
                              vkgs_usb_error_t *error) {
  if (!ValidateOpen(device, error, "vkgs_usb_get_device_info") ||
      info == nullptr) {
    if (info == nullptr)
      ProtocolError(error, "vkgs_usb_get_device_info", "info output is null",
                    VKGS_USB_STATUS_INVALID_ARGUMENT);
    return false;
  }
  std::lock_guard<std::mutex> lock(device->protocol_mutex);
  vkgs_usb_error_clear(error);
  std::vector<uint8_t> payload;
  if (!ControlGet(device, kRequestDeviceInfo, 40, &payload, error))
    return false;
  std::memset(info, 0, sizeof(*info));
  info->software_version = ReadLe32(payload.data());
  info->hardware_version = ReadLe32(payload.data() + 4);
  for (size_t index = 0; index < 4; ++index) {
    info->uid[index] = ReadLe32(payload.data() + 8 + index * 4);
    info->uuid[index] = ReadLe32(payload.data() + 24 + index * 4);
  }
  return true;
}

bool vkgs_usb_get_termination(vkgs_usb_device_t *device, bool *enabled,
                              vkgs_usb_error_t *error) {
  if (!ValidateOpen(device, error, "vkgs_usb_get_termination") ||
      enabled == nullptr) {
    if (enabled == nullptr)
      ProtocolError(error, "vkgs_usb_get_termination", "state output is null",
                    VKGS_USB_STATUS_INVALID_ARGUMENT);
    return false;
  }
  std::lock_guard<std::mutex> lock(device->protocol_mutex);
  std::vector<uint8_t> payload;
  vkgs_usb_error_t primary_error{};
  if (!ControlGet(device, kRequestTermination, 4, &payload, &primary_error) &&
      !ControlGet(device, kRequestFallbackGetTermination, 4, &payload, error))
    return false;
  *enabled = ReadLe32(payload.data()) != 0;
  return true;
}

bool vkgs_usb_configure(vkgs_usb_device_t *device,
                        const vkgs_usb_config_t *config,
                        vkgs_usb_applied_config_t *applied,
                        vkgs_usb_error_t *error) {
  if (!ValidateOpen(device, error, "vkgs_usb_configure") || config == nullptr ||
      applied == nullptr) {
    if (config == nullptr || applied == nullptr)
      ProtocolError(error, "vkgs_usb_configure", "configuration is null",
                    VKGS_USB_STATUS_INVALID_ARGUMENT);
    return false;
  }
  std::lock_guard<std::mutex> lock(device->protocol_mutex);
  vkgs_usb_error_clear(error);
  vkgs_usb_capabilities_t capabilities{};
  if (!GetCapabilitiesUnlocked(device, &capabilities, error))
    return false;
  if (config->fd && !capabilities.fd_supported)
    return ProtocolError(error, "vkgs_usb_configure", "CAN FD is not supported",
                         VKGS_USB_STATUS_UNSUPPORTED);
  if (config->listen_only && !capabilities.listen_only_supported)
    return ProtocolError(error, "vkgs_usb_configure",
                         "listen-only mode is not supported",
                         VKGS_USB_STATUS_UNSUPPORTED);

  vkgs_usb_applied_config_t result{};
  if (!ValidateTiming(config->nominal, capabilities.nominal, &result.nominal,
                      error, "VKGS nominal timing"))
    return false;
  if (config->fd) {
    const auto &limits =
        capabilities.has_data_timing ? capabilities.data : capabilities.nominal;
    if (!ValidateTiming(config->data, limits, &result.data, error,
                        "VKGS data timing"))
      return false;
    result.has_data_timing = true;
  }

  device->fd_mode.store(false);
  device->timestamps_enabled.store(false);
  if (!SetMode(device, 0, 0, error) || !SetHostFormat(device, error) ||
      !SetTiming(device, kRequestBitTiming, result.nominal, error) ||
      (config->fd &&
       !SetTiming(device, kRequestDataBitTiming, result.data, error)) ||
      !SetBusLoad(device, false, error))
    return false;
  vkgs_usb_error_t termination_error{};
  if (!SetTermination(device, config->termination, &termination_error) &&
      (config->termination || capabilities.termination_supported)) {
    if (error != nullptr)
      *error = termination_error;
    return false;
  }

  uint32_t flags = config->listen_only ? kModeListenOnly : 0;
  if (config->fd)
    flags |= kModeFd;
  if ((capabilities.nominal.feature & kFeatureBerrReporting) != 0)
    flags |= kModeBerrReporting;
  const bool timestamps =
      (capabilities.nominal.feature & kFeatureHardwareTimestamp) != 0;
  if (timestamps)
    flags |= kModeHardwareTimestamp;
  vkgs_usb_decoder_reset(device);
  /* RX already runs while START is issued. Publish the expected record format
   * before firmware can deliver the first timestamped frame. */
  device->fd_mode.store(config->fd);
  device->timestamps_enabled.store(timestamps);
  if (!SetMode(device, 1, flags, error)) {
    device->fd_mode.store(false);
    device->timestamps_enabled.store(false);
    return false;
  }
  result.hardware_timestamps = timestamps;
  *applied = result;
  return true;
}

bool vkgs_usb_stop(vkgs_usb_device_t *device, vkgs_usb_error_t *error) {
  if (!ValidateOpen(device, error, "vkgs_usb_stop"))
    return false;
  std::lock_guard<std::mutex> lock(device->protocol_mutex);
  bool result = SetMode(device, 0, 0, error);
  if (result)
    result = SetHostFormat(device, error);
  device->fd_mode.store(false);
  device->timestamps_enabled.store(false);
  return result;
}

bool vkgs_usb_encode_frame(vkgs_usb_device_t *device,
                           const vkgs_usb_frame_t *frame, uint8_t *wire,
                           size_t capacity, size_t *wire_length,
                           uint8_t *normalized_length,
                           vkgs_usb_error_t *error) {
  if (!ValidateOpen(device, error, "vkgs_usb_encode_frame") ||
      frame == nullptr || wire == nullptr || wire_length == nullptr ||
      normalized_length == nullptr) {
    if (frame == nullptr || wire == nullptr || wire_length == nullptr ||
        normalized_length == nullptr)
      ProtocolError(error, "vkgs_usb_encode_frame", "invalid frame output",
                    VKGS_USB_STATUS_INVALID_ARGUMENT);
    return false;
  }
  const uint32_t maximum_id = frame->extended ? kCanIdMask : kCanSffMask;
  if (frame->id > maximum_id || frame->length > (frame->fd ? 64 : 8) ||
      (frame->fd && frame->remote) || (frame->fd && !device->fd_mode.load()))
    return ProtocolError(error, "vkgs_usb_encode_frame",
                         "invalid CAN frame for the configured mode",
                         VKGS_USB_STATUS_INVALID_ARGUMENT);
  const uint8_t dlc = LengthToDlc(frame->length, frame->fd);
  if (dlc == 0xff)
    return ProtocolError(error, "vkgs_usb_encode_frame",
                         "CAN payload exceeds protocol limits",
                         VKGS_USB_STATUS_INVALID_ARGUMENT);
  const uint8_t data_length = DlcToLength(dlc, frame->fd);
  const bool wide_frame = device->fd_mode.load() || frame->fd;
  const size_t size = kHeaderSize + (wide_frame ? 64U : 8U);
  if (capacity < size)
    return ProtocolError(error, "vkgs_usb_encode_frame",
                         "wire buffer is too small",
                         VKGS_USB_STATUS_INVALID_ARGUMENT);
  std::memset(wire, 0, size);
  uint32_t can_id = frame->id & kCanIdMask;
  if (frame->extended)
    can_id |= kCanEffFlag;
  if (frame->remote)
    can_id |= kCanRtrFlag;
  uint8_t flags = frame->fd ? kFlagFd : 0;
  if (frame->fd && frame->brs)
    flags |= kFlagBrs;
  WriteLe32(wire, 0);
  WriteLe32(wire + 4, can_id);
  wire[8] = dlc;
  wire[9] = device->interface_number;
  wire[10] = flags;
  if (frame->length > 0)
    std::memcpy(wire + kHeaderSize, frame->data, frame->length);
  *wire_length = size;
  *normalized_length = data_length;
  return true;
}

bool vkgs_usb_decode(vkgs_usb_device_t *device, const uint8_t *wire,
                     size_t wire_length, vkgs_usb_rx_batch_t *batch,
                     vkgs_usb_error_t *error) {
  if (!ValidateOpen(device, error, "vkgs_usb_decode") ||
      (wire_length > 0 && wire == nullptr) || batch == nullptr) {
    if ((wire_length > 0 && wire == nullptr) || batch == nullptr)
      ProtocolError(error, "vkgs_usb_decode", "invalid decoder input",
                    VKGS_USB_STATUS_INVALID_ARGUMENT);
    return false;
  }
  std::lock_guard<std::mutex> lock(device->decoder_mutex);
  std::memset(batch, 0, sizeof(*batch));
  std::vector<uint8_t> buffer;
  buffer.reserve(device->decoder_tail.size() + wire_length);
  buffer.insert(buffer.end(), device->decoder_tail.begin(),
                device->decoder_tail.end());
  if (wire_length > 0)
    buffer.insert(buffer.end(), wire, wire + wire_length);
  device->decoder_tail.clear();
  size_t offset = 0;
  const bool timestamps = device->timestamps_enabled.load();
  while (offset < buffer.size()) {
    const size_t remaining = buffer.size() - offset;
    if (remaining < 4) {
      const auto begin = buffer.begin() + offset;
      if (std::any_of(begin, buffer.end(),
                      [](uint8_t value) { return value != 0; }))
        device->decoder_tail.assign(begin, buffer.end());
      break;
    }
    const uint8_t *item = buffer.data() + offset;
    const uint32_t echo = ReadLe32(item);
    if (echo == 0) {
      offset = buffer.size();
      break;
    }
    if (remaining < kHeaderSize) {
      device->decoder_tail.assign(buffer.begin() + offset, buffer.end());
      break;
    }
    const bool is_event =
        echo == kEchoState || echo == kEchoBerr || echo == kEchoLoad;
    size_t size = 0;
    if (echo == kEchoState)
      size = kStateSize;
    else if (echo == kEchoBerr)
      size = kBerrSize;
    else if (echo == kEchoLoad)
      size = kLoadSize;
    else
      size = kHeaderSize + ((item[10] & kFlagFd) != 0 ? 64U : 8U) +
             (timestamps ? 8U : 0U);
    const uint8_t channel = item[is_event ? 4 : 9];
    if (channel != device->interface_number) {
      device->decoder_tail.clear();
      return ProtocolError(error, "VKGS decode",
                           "bulk frame channel does not match interface");
    }
    if (offset + size > buffer.size()) {
      device->decoder_tail.assign(buffer.begin() + offset, buffer.end());
      break;
    }
    vkgs_usb_rx_record_t *record = nullptr;
    if (echo == kEchoRx) {
      const uint32_t raw_id = ReadLe32(item + 4);
      const uint8_t flags = item[10];
      const bool fd = (flags & kFlagFd) != 0;
      const bool extended = (raw_id & kCanEffFlag) != 0;
      const uint8_t length = DlcToLength(item[8], fd);
      if (!AppendRecord(batch, &record, error))
        return false;
      record->kind = VKGS_USB_RX_FRAME;
      record->frame.id = raw_id & (extended ? kCanIdMask : kCanSffMask);
      record->frame.length = length;
      if (length > 0)
        std::memcpy(record->frame.data, item + kHeaderSize, length);
      record->frame.fd = fd;
      record->frame.brs = fd && (flags & kFlagBrs) != 0;
      record->frame.extended = extended;
      record->frame.remote = !fd && (raw_id & kCanRtrFlag) != 0;
      record->frame.timestamp_us = timestamps ? ReadLe64(item + size - 8) : 0;
      record->frame.overflow = (flags & kFlagOverflow) != 0;
      record->frame.esi = fd && (flags & kFlagEsi) != 0;
      record->frame.error = (raw_id & kCanErrorFlag) != 0;
    } else if (echo == kEchoState) {
      if (!AppendRecord(batch, &record, error))
        return false;
      record->kind = VKGS_USB_RX_STATE;
      record->timestamp_us = ReadLe64(item + 8);
      record->state = ReadLe32(item + 16);
      record->rx_error_count = ReadLe32(item + 20);
      record->tx_error_count = ReadLe32(item + 24);
    } else if (echo == kEchoBerr) {
      if (!AppendRecord(batch, &record, error))
        return false;
      record->kind = VKGS_USB_RX_BUS_ERROR;
      record->error_flag = item[8];
      record->error_code = item[9];
      record->rx_error_count = item[10];
      record->tx_error_count = item[11];
      record->error_logging_count = item[12];
    }
    offset += size;
  }
  return true;
}

void vkgs_usb_decoder_reset(vkgs_usb_device_t *device) {
  if (device == nullptr)
    return;
  std::lock_guard<std::mutex> lock(device->decoder_mutex);
  device->decoder_tail.clear();
}

namespace {

bool ValidateOpen(vkgs_usb_device_t *device, vkgs_usb_error_t *error,
                  const char *operation) {
  if (device != nullptr && device->owner && device->handle != nullptr &&
      device->claimed) {
    return true;
  }
  SetError(error, VKGS_USB_STATUS_NOT_OPEN, operation, LIBUSB_ERROR_NO_DEVICE,
           "VKGS USB device is not open");
  return false;
}

bool ControlTransfer(vkgs_usb_device_t *device, uint8_t request_type,
                     uint8_t request, uint16_t value, uint16_t index,
                     uint8_t *data, uint16_t length, uint32_t timeout_ms,
                     vkgs_usb_error_t *error) {
  if (!ValidateOpen(device, error, "libusb_control_transfer"))
    return false;
  if (device->cancelled.load()) {
    SetLibusbError(error, "libusb_control_transfer", LIBUSB_ERROR_INTERRUPTED,
                   true);
    return false;
  }
  std::lock_guard<std::mutex> control_lock(device->owner->control_mutex);
  const int transferred = libusb_control_transfer(
      device->handle, request_type, request, value, index, data, length,
      timeout_ms == 0 ? kDefaultTimeoutMs : timeout_ms);
  if (transferred < 0) {
    SetLibusbError(error, "libusb_control_transfer", transferred,
                   device->cancelled.load());
    return false;
  }
  if (transferred != length) {
    char detail[96]{};
    std::snprintf(detail, sizeof(detail), "short control transfer: %d/%u",
                  transferred, length);
    SetError(error, VKGS_USB_STATUS_SHORT_TRANSFER, "libusb_control_transfer",
             LIBUSB_ERROR_IO, detail);
    return false;
  }
  return true;
}

} // namespace

void vkgs_usb_error_clear(vkgs_usb_error_t *error) {
  if (error == nullptr)
    return;
  std::memset(error, 0, sizeof(*error));
  error->status = VKGS_USB_STATUS_OK;
}

bool vkgs_usb_list_scan(vkgs_usb_device_list_t *list, vkgs_usb_error_t *error) {
  if (list == nullptr) {
    SetError(error, VKGS_USB_STATUS_INVALID_ARGUMENT, "vkgs_usb_list_scan",
             LIBUSB_ERROR_INVALID_PARAM, "device list is null");
    return false;
  }
  std::memset(list, 0, sizeof(*list));
  vkgs_usb_error_clear(error);
  libusb_context *context = nullptr;
  int status = libusb_init(&context);
  if (status != LIBUSB_SUCCESS) {
    SetLibusbError(error, "libusb_init", status);
    return false;
  }
  libusb_device **devices = nullptr;
  const ssize_t count = libusb_get_device_list(context, &devices);
  if (count < 0) {
    SetLibusbError(error, "libusb_get_device_list", static_cast<int>(count));
    libusb_exit(context);
    return false;
  }

  std::vector<EnumeratedInterface> found;
  for (ssize_t index = 0; index < count; ++index) {
    libusb_device_descriptor descriptor{};
    if (libusb_get_device_descriptor(devices[index], &descriptor) !=
            LIBUSB_SUCCESS ||
        descriptor.idVendor != kDeviceVid ||
        descriptor.idProduct != kDevicePid) {
      continue;
    }
    for (const auto &usb_interface : FindInterfaces(devices[index])) {
      EnumeratedInterface item;
      item.path = MakePath(devices[index], usb_interface.number);
      item.interface = usb_interface;
      item.label = "VKGS USB";
      item.busy = ProbeBusy(devices[index], usb_interface.number, &item.label,
                            descriptor);
      found.push_back(std::move(item));
    }
  }
  libusb_free_device_list(devices, 1);
  libusb_exit(context);

  std::sort(found.begin(), found.end(),
            [](const auto &left, const auto &right) {
              return left.path < right.path;
            });
  list->count =
      std::min(found.size(), static_cast<size_t>(VKGS_USB_MAX_DEVICES));
  for (size_t index = 0; index < list->count; ++index) {
    const auto &source = found[index];
    auto &target = list->devices[index];
    CopyText(target.path, sizeof(target.path), source.path);
    CopyText(target.label, sizeof(target.label), source.label);
    target.interface_number = source.interface.number;
    target.endpoint_in = source.interface.endpoint_in;
    target.endpoint_out = source.interface.endpoint_out;
    target.busy = source.busy;
  }
  return true;
}

vkgs_usb_device_t *vkgs_usb_open(const char *path, vkgs_usb_error_t *error) {
  vkgs_usb_error_clear(error);
  DeviceKey key;
  if (!ParsePath(path, &key)) {
    SetError(error, VKGS_USB_STATUS_INVALID_ARGUMENT, "vkgs_usb_open",
             LIBUSB_ERROR_INVALID_PARAM, "invalid libusb device path");
    return nullptr;
  }
  auto *result = new (std::nothrow) vkgs_usb_device_t();
  if (result == nullptr) {
    SetError(error, VKGS_USB_STATUS_SYSTEM_ERROR, "vkgs_usb_open",
             LIBUSB_ERROR_NO_MEM, "unable to allocate the USB device");
    return nullptr;
  }
  result->owner = AcquireDevice(key, error);
  if (!result->owner) {
    vkgs_usb_close(result);
    return nullptr;
  }
  result->context = result->owner->context;
  result->handle = result->owner->handle;

  InterfaceInfo usb_interface{};
  libusb_device *usb_device = libusb_get_device(result->handle);
  if (usb_device == nullptr ||
      !FindInterface(usb_device, key.interface_number, &usb_interface)) {
    SetError(error, VKGS_USB_STATUS_ENDPOINT_NOT_FOUND, "vkgs_usb_open",
             LIBUSB_ERROR_NOT_FOUND, "USB interface was not found");
    vkgs_usb_close(result);
    return nullptr;
  }

  result->interface_number = usb_interface.number;
  result->alternate_setting = usb_interface.alternate_setting;
  result->endpoint_in = usb_interface.endpoint_in;
  result->endpoint_out = usb_interface.endpoint_out;

  bool interface_ready = false;
  {
    std::lock_guard<std::mutex> interface_lock(result->owner->interface_mutex);
    if (result->owner->claimed_interfaces.count(result->interface_number) !=
        0) {
      SetLibusbError(error, "libusb_claim_interface", LIBUSB_ERROR_BUSY);
    } else {
      bool can_claim = true;
      const int kernel_active =
          libusb_kernel_driver_active(result->handle, result->interface_number);
      const int auto_detach =
          libusb_set_auto_detach_kernel_driver(result->handle, 1);
      if (kernel_active == 1 && auto_detach != LIBUSB_SUCCESS) {
        const int detach_status = libusb_detach_kernel_driver(
            result->handle, result->interface_number);
        if (detach_status != LIBUSB_SUCCESS) {
          SetLibusbError(error, "libusb_detach_kernel_driver", detach_status);
          can_claim = false;
        } else {
          result->manually_detached = true;
        }
      }

      if (can_claim) {
        const int claim_status =
            libusb_claim_interface(result->handle, result->interface_number);
        if (claim_status != LIBUSB_SUCCESS) {
          SetLibusbError(error, "libusb_claim_interface", claim_status);
        } else {
          result->claimed = true;
          result->owner->claimed_interfaces.insert(result->interface_number);
          if (result->alternate_setting != 0) {
            const int alternate_status = libusb_set_interface_alt_setting(
                result->handle, result->interface_number,
                result->alternate_setting);
            if (alternate_status != LIBUSB_SUCCESS) {
              SetLibusbError(error, "libusb_set_interface_alt_setting",
                             alternate_status);
            } else {
              interface_ready = true;
            }
          } else {
            interface_ready = true;
          }
        }
      }
    }
  }

  if (!interface_ready) {
    vkgs_usb_close(result);
    return nullptr;
  }
  libusb_clear_halt(result->handle, result->endpoint_in);
  libusb_clear_halt(result->handle, result->endpoint_out);
  return result;
}

uint8_t vkgs_usb_interface_number(const vkgs_usb_device_t *device) {
  return device != nullptr ? device->interface_number : 0;
}

bool vkgs_usb_control_in(vkgs_usb_device_t *device, uint8_t request_type,
                         uint8_t request, uint16_t value, uint16_t index,
                         uint8_t *data, uint16_t length, uint32_t timeout_ms,
                         vkgs_usb_error_t *error) {
  if ((request_type & LIBUSB_ENDPOINT_IN) == 0 ||
      (length > 0 && data == nullptr)) {
    SetError(error, VKGS_USB_STATUS_INVALID_ARGUMENT, "vkgs_usb_control_in",
             LIBUSB_ERROR_INVALID_PARAM, "invalid control IN arguments");
    return false;
  }
  vkgs_usb_error_clear(error);
  return ControlTransfer(device, request_type, request, value, index, data,
                         length, timeout_ms, error);
}

bool vkgs_usb_control_out(vkgs_usb_device_t *device, uint8_t request_type,
                          uint8_t request, uint16_t value, uint16_t index,
                          const uint8_t *data, uint16_t length,
                          uint32_t timeout_ms, vkgs_usb_error_t *error) {
  if ((request_type & LIBUSB_ENDPOINT_IN) != 0 ||
      (length > 0 && data == nullptr)) {
    SetError(error, VKGS_USB_STATUS_INVALID_ARGUMENT, "vkgs_usb_control_out",
             LIBUSB_ERROR_INVALID_PARAM, "invalid control OUT arguments");
    return false;
  }
  vkgs_usb_error_clear(error);
  return ControlTransfer(device, request_type, request, value, index,
                         const_cast<uint8_t *>(data), length, timeout_ms,
                         error);
}

bool vkgs_usb_bulk_read(vkgs_usb_device_t *device, uint8_t *data,
                        size_t capacity, size_t *transferred,
                        uint32_t poll_timeout_ms, vkgs_usb_error_t *error) {
  if (transferred != nullptr)
    *transferred = 0;
  if (data == nullptr || capacity == 0 || capacity > INT_MAX ||
      transferred == nullptr) {
    SetError(error, VKGS_USB_STATUS_INVALID_ARGUMENT, "vkgs_usb_bulk_read",
             LIBUSB_ERROR_INVALID_PARAM, "invalid bulk read arguments");
    return false;
  }
  if (!ValidateOpen(device, error, "libusb_bulk_transfer(IN)"))
    return false;
  vkgs_usb_error_clear(error);
  const unsigned int poll =
      poll_timeout_ms == 0 ? kDefaultPollMs : poll_timeout_ms;
  bool retried_stall = false;
  while (!device->cancelled.load()) {
    int count = 0;
    const int status =
        libusb_bulk_transfer(device->handle, device->endpoint_in, data,
                             static_cast<int>(capacity), &count, poll);
    if (count > 0) {
      *transferred = static_cast<size_t>(count);
      return true;
    }
    if (status == LIBUSB_SUCCESS)
      return true;
    if (status == LIBUSB_ERROR_TIMEOUT ||
        (status == LIBUSB_ERROR_INTERRUPTED && !device->cancelled.load())) {
      retried_stall = false;
      continue;
    }
    if (status == LIBUSB_ERROR_PIPE && !retried_stall) {
      retried_stall = true;
      if (libusb_clear_halt(device->handle, device->endpoint_in) ==
          LIBUSB_SUCCESS) {
        continue;
      }
    }
    SetLibusbError(error, "libusb_bulk_transfer(IN)", status,
                   device->cancelled.load());
    return false;
  }
  SetLibusbError(error, "libusb_bulk_transfer(IN)", LIBUSB_ERROR_INTERRUPTED,
                 true);
  return false;
}

bool vkgs_usb_bulk_write(vkgs_usb_device_t *device, const uint8_t *data,
                         size_t length, size_t *transferred,
                         uint32_t timeout_ms, vkgs_usb_error_t *error) {
  if (transferred != nullptr)
    *transferred = 0;
  if (data == nullptr || length == 0 || length > INT_MAX ||
      transferred == nullptr) {
    SetError(error, VKGS_USB_STATUS_INVALID_ARGUMENT, "vkgs_usb_bulk_write",
             LIBUSB_ERROR_INVALID_PARAM, "invalid bulk write arguments");
    return false;
  }
  if (!ValidateOpen(device, error, "libusb_bulk_transfer(OUT)"))
    return false;
  if (device->cancelled.load()) {
    SetLibusbError(error, "libusb_bulk_transfer(OUT)", LIBUSB_ERROR_INTERRUPTED,
                   true);
    return false;
  }
  vkgs_usb_error_clear(error);
  bool retried_stall = false;
  while (true) {
    int count = 0;
    const int status = libusb_bulk_transfer(
        device->handle, device->endpoint_out, const_cast<uint8_t *>(data),
        static_cast<int>(length), &count,
        timeout_ms == 0 ? kDefaultTimeoutMs : timeout_ms);
    if (status == LIBUSB_ERROR_PIPE && count == 0 && !retried_stall) {
      retried_stall = true;
      if (libusb_clear_halt(device->handle, device->endpoint_out) ==
          LIBUSB_SUCCESS) {
        continue;
      }
    }
    if (status != LIBUSB_SUCCESS) {
      SetLibusbError(error, "libusb_bulk_transfer(OUT)", status,
                     device->cancelled.load());
      return false;
    }
    *transferred = static_cast<size_t>(count);
    if (static_cast<size_t>(count) != length) {
      char detail[96]{};
      std::snprintf(detail, sizeof(detail), "short bulk write: %d/%zu", count,
                    length);
      SetError(error, VKGS_USB_STATUS_SHORT_TRANSFER,
               "libusb_bulk_transfer(OUT)", LIBUSB_ERROR_IO, detail);
      return false;
    }
    return true;
  }
}

void vkgs_usb_cancel(vkgs_usb_device_t *device) {
  if (device != nullptr)
    device->cancelled.store(true);
}

void vkgs_usb_close(vkgs_usb_device_t *device) {
  if (device == nullptr)
    return;
  vkgs_usb_cancel(device);
  if (device->owner) {
    {
      std::lock_guard<std::mutex> interface_lock(
          device->owner->interface_mutex);
      if (device->claimed) {
        libusb_release_interface(device->handle, device->interface_number);
        device->owner->claimed_interfaces.erase(device->interface_number);
        device->claimed = false;
      }
      if (device->manually_detached) {
        libusb_attach_kernel_driver(device->handle, device->interface_number);
        device->manually_detached = false;
      }
    }
    device->handle = nullptr;
    device->context = nullptr;
    device->owner.reset();
  }
  delete device;
}

namespace {

uint32_t ReadLe32(const uint8_t *data) {
  return static_cast<uint32_t>(data[0]) |
         (static_cast<uint32_t>(data[1]) << 8U) |
         (static_cast<uint32_t>(data[2]) << 16U) |
         (static_cast<uint32_t>(data[3]) << 24U);
}

uint64_t ReadLe64(const uint8_t *data) {
  return static_cast<uint64_t>(ReadLe32(data)) |
         (static_cast<uint64_t>(ReadLe32(data + 4)) << 32U);
}

void WriteLe32(uint8_t *data, uint32_t value) {
  data[0] = static_cast<uint8_t>(value);
  data[1] = static_cast<uint8_t>(value >> 8U);
  data[2] = static_cast<uint8_t>(value >> 16U);
  data[3] = static_cast<uint8_t>(value >> 24U);
}

bool ProtocolError(vkgs_usb_error_t *error, const char *operation,
                   const std::string &message, vkgs_usb_status_t status) {
  SetError(error, status, operation, 0, message);
  return false;
}

bool ControlGet(vkgs_usb_device_t *device, uint8_t request, size_t length,
                std::vector<uint8_t> *payload, vkgs_usb_error_t *error) {
  if (payload == nullptr || length > UINT16_MAX)
    return ProtocolError(error, "VKGS protocol control read",
                         "invalid response length",
                         VKGS_USB_STATUS_INVALID_ARGUMENT);
  payload->assign(length, 0);
  return vkgs_usb_control_in(device, 0xc1, request, 0, device->interface_number,
                             payload->data(), static_cast<uint16_t>(length),
                             kDefaultTimeoutMs, error);
}

bool ControlSet(vkgs_usb_device_t *device, uint8_t request,
                const uint8_t *payload, size_t length,
                vkgs_usb_error_t *error) {
  if ((length > 0 && payload == nullptr) || length > UINT16_MAX)
    return ProtocolError(error, "VKGS protocol control write",
                         "invalid control payload",
                         VKGS_USB_STATUS_INVALID_ARGUMENT);
  const bool result = vkgs_usb_control_out(
      device, 0x41, request, device->interface_number, device->interface_number,
      payload, static_cast<uint16_t>(length), kDefaultTimeoutMs, error);
  if (result)
    std::this_thread::sleep_for(std::chrono::milliseconds(5));
  return result;
}

bool LimitsValid(const vkgs_usb_timing_limits_t &limits) {
  return limits.clock_hz > 0 && limits.tseg1_min > 0 &&
         limits.tseg1_min <= limits.tseg1_max && limits.tseg2_min > 0 &&
         limits.tseg2_min <= limits.tseg2_max && limits.sjw_max > 0 &&
         limits.brp_min > 0 && limits.brp_min <= limits.brp_max &&
         limits.brp_inc > 0;
}

void ConstrainToHardware(vkgs_usb_timing_limits_t *limits, bool data_phase) {
  if (limits == nullptr)
    return;
  if (data_phase) {
    limits->tseg1_min = std::max(limits->tseg1_min, kDataTseg1Min);
    limits->tseg1_max = std::min(limits->tseg1_max, kDataTseg1Max);
    limits->tseg2_min = std::max(limits->tseg2_min, kDataTseg2Min);
    limits->tseg2_max = std::min(limits->tseg2_max, kDataTseg2Max);
    limits->sjw_max = std::min(limits->sjw_max, kDataSjwMax);
    limits->brp_max = std::min(limits->brp_max, kDataBrpMax);
  } else {
    limits->tseg1_min = std::max(limits->tseg1_min, kNominalTseg1Min);
    limits->tseg1_max = std::min(limits->tseg1_max, kNominalTseg1Max);
    limits->tseg2_min = std::max(limits->tseg2_min, kNominalTseg2Min);
    limits->tseg2_max = std::min(limits->tseg2_max, kNominalTseg2Max);
    limits->sjw_max = std::min(limits->sjw_max, kNominalSjwMax);
    limits->brp_max = std::min(limits->brp_max, kNominalBrpMax);
  }
}

bool DecodeLimits(const std::vector<uint8_t> &payload, size_t offset,
                  uint32_t feature, uint32_t clock_hz,
                  vkgs_usb_timing_limits_t *limits, vkgs_usb_error_t *error) {
  if (limits == nullptr || offset + 32 > payload.size())
    return ProtocolError(error, "VKGS capabilities",
                         "capability response is too short");
  std::memset(limits, 0, sizeof(*limits));
  limits->feature = feature;
  limits->clock_hz = clock_hz != 0 ? clock_hz : 80000000U;
  limits->tseg1_min = ReadLe32(payload.data() + offset);
  limits->tseg1_max = ReadLe32(payload.data() + offset + 4);
  limits->tseg2_min = ReadLe32(payload.data() + offset + 8);
  limits->tseg2_max = ReadLe32(payload.data() + offset + 12);
  limits->sjw_max = ReadLe32(payload.data() + offset + 16);
  limits->brp_min = ReadLe32(payload.data() + offset + 20);
  limits->brp_max = ReadLe32(payload.data() + offset + 24);
  limits->brp_inc = ReadLe32(payload.data() + offset + 28);
  if (!LimitsValid(*limits))
    return ProtocolError(error, "VKGS capabilities",
                         "capability response contains invalid timing limits");
  return true;
}

void FillFallback(vkgs_usb_capabilities_t *capabilities) {
  if (capabilities == nullptr)
    return;
  std::memset(capabilities, 0, sizeof(*capabilities));
  auto &limits = capabilities->nominal;
  limits.feature = kFeatureListenOnly | kFeatureHardwareTimestamp | kFeatureFd |
                   kFeatureBtConstExt;
  limits.clock_hz = 80000000U;
  limits.tseg1_min = kNominalTseg1Min;
  limits.tseg1_max = kNominalTseg1Max;
  limits.tseg2_min = kNominalTseg2Min;
  limits.tseg2_max = kNominalTseg2Max;
  limits.sjw_max = kNominalSjwMax;
  limits.brp_min = 1;
  limits.brp_max = kNominalBrpMax;
  limits.brp_inc = 1;
  capabilities->data = limits;
  capabilities->data.tseg1_min = kDataTseg1Min;
  capabilities->data.tseg1_max = kDataTseg1Max;
  capabilities->data.tseg2_min = kDataTseg2Min;
  capabilities->data.tseg2_max = kDataTseg2Max;
  capabilities->data.sjw_max = kDataSjwMax;
  capabilities->data.brp_max = kDataBrpMax;
  capabilities->has_data_timing = true;
  capabilities->fd_supported = true;
  capabilities->listen_only_supported = true;
}

bool GetCapabilitiesUnlocked(vkgs_usb_device_t *device,
                             vkgs_usb_capabilities_t *capabilities,
                             vkgs_usb_error_t *error) {
  if (device->capabilities_cached) {
    *capabilities = device->capabilities;
    return true;
  }
  std::vector<uint8_t> base;
  if (!ControlGet(device, kRequestBtConst, 40, &base, error))
    return false;
  const uint32_t feature = ReadLe32(base.data());
  const uint32_t clock_hz = ReadLe32(base.data() + 4);
  vkgs_usb_capabilities_t result{};
  if (!DecodeLimits(base, 8, feature, clock_hz, &result.nominal, error))
    return false;
  ConstrainToHardware(&result.nominal, false);
  if (!LimitsValid(result.nominal))
    return ProtocolError(error, "VKGS capabilities",
                         "nominal limits do not match HPM MCAN");
  result.fd_supported = (feature & kFeatureFd) != 0;
  result.listen_only_supported = (feature & kFeatureListenOnly) != 0;
  result.termination_supported = (feature & kFeatureTermination) != 0;
  if ((feature & kFeatureFd) != 0 && (feature & kFeatureBtConstExt) != 0) {
    std::vector<uint8_t> extended;
    if (!ControlGet(device, kRequestBtConstExt, 72, &extended, error) ||
        !DecodeLimits(extended, 40, ReadLe32(extended.data()),
                      ReadLe32(extended.data() + 4), &result.data, error))
      return false;
    ConstrainToHardware(&result.data, true);
    if (!LimitsValid(result.data))
      return ProtocolError(error, "VKGS capabilities",
                           "data limits do not match HPM MCAN");
    result.has_data_timing = true;
  }
  device->capabilities = result;
  device->capabilities_cached = true;
  *capabilities = result;
  return true;
}

bool ValidateTiming(const vkgs_usb_timing_t &timing,
                    const vkgs_usb_timing_limits_t &limits,
                    vkgs_usb_applied_timing_t *applied, vkgs_usb_error_t *error,
                    const char *phase) {
  if (timing.clock_hz == 0 || timing.bitrate_hz == 0 || timing.prescaler == 0 ||
      timing.tseg1 == 0 || timing.tseg2 == 0 || timing.sjw == 0)
    return ProtocolError(error, phase, "timing values must be positive",
                         VKGS_USB_STATUS_INVALID_ARGUMENT);
  if (timing.clock_hz != limits.clock_hz)
    return ProtocolError(error, phase, "configured clock does not match device",
                         VKGS_USB_STATUS_INVALID_ARGUMENT);
  if (timing.tseg1 < limits.tseg1_min || timing.tseg1 > limits.tseg1_max ||
      timing.tseg2 < limits.tseg2_min || timing.tseg2 > limits.tseg2_max ||
      timing.sjw > limits.sjw_max || timing.sjw > timing.tseg2 ||
      timing.prescaler < limits.brp_min || timing.prescaler > limits.brp_max ||
      ((timing.prescaler - limits.brp_min) % limits.brp_inc) != 0)
    return ProtocolError(error, phase,
                         "timing values are outside device limits",
                         VKGS_USB_STATUS_INVALID_ARGUMENT);
  const uint64_t total_quanta = 1ULL + timing.tseg1 + timing.tseg2;
  const uint64_t divisor =
      static_cast<uint64_t>(timing.prescaler) * total_quanta;
  const uint32_t actual = static_cast<uint32_t>(timing.clock_hz / divisor);
  const uint64_t difference = actual > timing.bitrate_hz
                                  ? actual - timing.bitrate_hz
                                  : timing.bitrate_hz - actual;
  if (actual == 0 || difference * 100ULL > timing.bitrate_hz)
    return ProtocolError(error, phase,
                         "timing calculates a bitrate outside 1% tolerance",
                         VKGS_USB_STATUS_INVALID_ARGUMENT);
  std::memset(applied, 0, sizeof(*applied));
  applied->requested_bitrate_hz = timing.bitrate_hz;
  applied->actual_bitrate_hz = actual;
  applied->sample_point_permille =
      static_cast<uint32_t>(((1ULL + timing.tseg1) * 1000ULL) / total_quanta);
  applied->prescaler = timing.prescaler;
  applied->tseg1 = timing.tseg1;
  applied->tseg2 = timing.tseg2;
  applied->sjw = timing.sjw;
  applied->wire_prescaler = EncodeTimingRegister(timing.prescaler);
  applied->wire_tseg1 = EncodeTimingRegister(timing.tseg1);
  applied->wire_tseg2 = EncodeTimingRegister(timing.tseg2);
  applied->wire_sjw = EncodeTimingRegister(timing.sjw);
  return true;
}

bool SetTiming(vkgs_usb_device_t *device, uint8_t request,
               const vkgs_usb_applied_timing_t &timing,
               vkgs_usb_error_t *error) {
  uint8_t payload[20]{};
  /* prop_seg stays zero; the firmware uses phase_seg1 as the complete TSEG1. */
  WriteLe32(payload + 4, timing.wire_tseg1);
  WriteLe32(payload + 8, timing.wire_tseg2);
  WriteLe32(payload + 12, timing.wire_sjw);
  WriteLe32(payload + 16, timing.wire_prescaler);
  return ControlSet(device, request, payload, sizeof(payload), error);
}

bool SetMode(vkgs_usb_device_t *device, uint32_t mode, uint32_t flags,
             vkgs_usb_error_t *error) {
  uint8_t payload[8]{};
  WriteLe32(payload, mode);
  WriteLe32(payload + 4, flags);
  if (!ControlSet(device, kRequestMode, payload, sizeof(payload), error))
    return false;
  std::this_thread::sleep_for(std::chrono::milliseconds(150));
  return true;
}

bool SetHostFormat(vkgs_usb_device_t *device, vkgs_usb_error_t *error) {
  uint8_t payload[4]{};
  WriteLe32(payload, 0x0000beefU);
  return ControlSet(device, kRequestHostFormat, payload, sizeof(payload),
                    error);
}

bool SetBusLoad(vkgs_usb_device_t *device, bool enabled,
                vkgs_usb_error_t *error) {
  uint8_t payload[4]{};
  WriteLe32(payload, enabled ? 1U : 0U);
  return ControlSet(device, kRequestBusLoad, payload, sizeof(payload), error);
}

bool SetTermination(vkgs_usb_device_t *device, bool enabled,
                    vkgs_usb_error_t *error) {
  uint8_t payload[4]{};
  WriteLe32(payload, enabled ? 1U : 0U);
  vkgs_usb_error_t primary_error{};
  if (ControlSet(device, kRequestTermination, payload, sizeof(payload),
                 &primary_error))
    return true;
  return ControlSet(device, kRequestFallbackSetTermination, payload,
                    sizeof(payload), error);
}

uint8_t LengthToDlc(uint8_t length, bool fd) {
  if (!fd)
    return length;
  for (uint8_t dlc = 0; dlc < 16; ++dlc) {
    if (kDlcLengths[dlc] >= length)
      return dlc;
  }
  return 0xff;
}

uint8_t DlcToLength(uint8_t dlc, bool fd) {
  const uint8_t value = static_cast<uint8_t>(dlc & 0x0fU);
  return fd ? kDlcLengths[value] : std::min<uint8_t>(value, 8);
}

bool AppendRecord(vkgs_usb_rx_batch_t *batch, vkgs_usb_rx_record_t **record,
                  vkgs_usb_error_t *error) {
  if (batch->count >= VKGS_USB_MAX_RX_RECORDS)
    return ProtocolError(error, "VKGS decode", "receive batch is too large");
  *record = &batch->records[batch->count++];
  std::memset(*record, 0, sizeof(**record));
  return true;
}

} // namespace

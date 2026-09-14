#include "vcan_usb.h"

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
constexpr uint16_t kDevicePid = 0x6080;
constexpr uint32_t kDefaultTimeoutMs = 2000;
constexpr uint32_t kDefaultPollMs = 100;
constexpr uint32_t kModeSettleMs = 150;
constexpr size_t kMaxPortDepth = 16;
constexpr const char *kPathPrefix = "libusb://1d50:6080/";

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

/* VCAN firmware consumes zero-based register fields, unlike Candle's
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
  std::set<uint8_t> active_interfaces;
  std::set<uint8_t> manually_detached_interfaces;

  ~SharedUsbDevice() {
    if (handle != nullptr) {
      for (const uint8_t interface_number : claimed_interfaces)
        libusb_release_interface(handle, interface_number);
      for (const uint8_t interface_number : manually_detached_interfaces)
        libusb_attach_kernel_driver(handle, interface_number);
      libusb_close(handle);
    }
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

vcan_usb_status_t StatusFromLibusb(int code, bool cancelled) {
  if (cancelled) {
    return VCAN_USB_STATUS_CANCELLED;
  }
  if (code == LIBUSB_ERROR_INVALID_PARAM) {
    return VCAN_USB_STATUS_INVALID_ARGUMENT;
  }
  if (code == LIBUSB_ERROR_TIMEOUT)
    return VCAN_USB_STATUS_TIMEOUT;
  if (code == LIBUSB_ERROR_NOT_FOUND) {
    return VCAN_USB_STATUS_ENDPOINT_NOT_FOUND;
  }
  return VCAN_USB_STATUS_SYSTEM_ERROR;
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

void SetError(vcan_usb_error_t *error, vcan_usb_status_t status,
              const char *operation, int32_t native_code,
              const std::string &detail) {
  if (error == nullptr)
    return;
  vcan_usb_error_clear(error);
  error->status = status;
  error->native_code = native_code;
  CopyText(error->operation, sizeof(error->operation),
           operation != nullptr ? operation : "libusb");
  CopyText(error->message, sizeof(error->message),
           detail.empty() ? "operation failed" : detail);
}

void SetLibusbError(vcan_usb_error_t *error, const char *operation, int code,
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
                                               vcan_usb_error_t *error) {
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
    SetError(error, VCAN_USB_STATUS_SYSTEM_ERROR, "libusb_open",
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
    return "VCAN USB";
  unsigned char value[VCAN_USB_LABEL_CAPACITY]{};
  const int length = libusb_get_string_descriptor_ascii(
      handle, descriptor.iProduct, value, static_cast<int>(sizeof(value) - 1));
  return length > 0 ? std::string(reinterpret_cast<char *>(value), length)
                    : "VCAN USB";
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
    return shared->active_interfaces.count(interface_number) != 0;
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

bool ClaimInterface(SharedUsbDevice *shared, const InterfaceInfo &usb_interface,
                    vcan_usb_error_t *error) {
  if (shared->claimed_interfaces.count(usb_interface.number) != 0)
    return true;

  bool manually_detached = false;
  const int kernel_active =
      libusb_kernel_driver_active(shared->handle, usb_interface.number);
  const int auto_detach =
      libusb_set_auto_detach_kernel_driver(shared->handle, 1);
  if (kernel_active == 1 && auto_detach != LIBUSB_SUCCESS) {
    const int detach_status =
        libusb_detach_kernel_driver(shared->handle, usb_interface.number);
    if (detach_status != LIBUSB_SUCCESS) {
      SetLibusbError(error, "libusb_detach_kernel_driver", detach_status);
      return false;
    }
    manually_detached = true;
  }

  const int claim_status =
      libusb_claim_interface(shared->handle, usb_interface.number);
  if (claim_status != LIBUSB_SUCCESS) {
    if (manually_detached)
      libusb_attach_kernel_driver(shared->handle, usb_interface.number);
    SetLibusbError(error, "libusb_claim_interface", claim_status);
    return false;
  }

  if (usb_interface.alternate_setting != 0) {
    const int alternate_status = libusb_set_interface_alt_setting(
        shared->handle, usb_interface.number, usb_interface.alternate_setting);
    if (alternate_status != LIBUSB_SUCCESS) {
      libusb_release_interface(shared->handle, usb_interface.number);
      if (manually_detached)
        libusb_attach_kernel_driver(shared->handle, usb_interface.number);
      SetLibusbError(error, "libusb_set_interface_alt_setting",
                     alternate_status);
      return false;
    }
  }

  shared->claimed_interfaces.insert(usb_interface.number);
  if (manually_detached)
    shared->manually_detached_interfaces.insert(usb_interface.number);
  return true;
}

bool ValidateOpen(vcan_usb_device_t *device, vcan_usb_error_t *error,
                  const char *operation);

} // namespace

struct vcan_usb_device {
  std::shared_ptr<SharedUsbDevice> owner;
  libusb_context *context = nullptr;
  libusb_device_handle *handle = nullptr;
  uint8_t interface_number = 0;
  uint8_t alternate_setting = 0;
  uint8_t endpoint_in = 0;
  uint8_t endpoint_out = 0;
  bool claimed = false;
  std::atomic<bool> cancelled{false};
  std::atomic<bool> fd_mode{false};
  std::mutex protocol_mutex;
  std::mutex decoder_mutex;
  bool capabilities_cached = false;
  vcan_usb_capabilities_t capabilities{};
  std::vector<uint8_t> decoder_tail;
};

namespace {

bool ValidateOpen(vcan_usb_device_t *device, vcan_usb_error_t *error,
                  const char *operation) {
  if (device != nullptr && device->owner && device->handle != nullptr &&
      device->claimed) {
    return true;
  }
  SetError(error, VCAN_USB_STATUS_NOT_OPEN, operation, LIBUSB_ERROR_NO_DEVICE,
           "VCAN USB device is not open");
  return false;
}

bool ControlTransfer(vcan_usb_device_t *device, uint8_t request_type,
                     uint8_t request, uint16_t value, uint16_t index,
                     uint8_t *data, uint16_t length, uint32_t timeout_ms,
                     vcan_usb_error_t *error) {
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
    SetError(error, VCAN_USB_STATUS_SHORT_TRANSFER, "libusb_control_transfer",
             LIBUSB_ERROR_IO, detail);
    return false;
  }
  return true;
}

} // namespace

void vcan_usb_error_clear(vcan_usb_error_t *error) {
  if (error == nullptr)
    return;
  std::memset(error, 0, sizeof(*error));
  error->status = VCAN_USB_STATUS_OK;
}

bool vcan_usb_list_scan(vcan_usb_device_list_t *list, vcan_usb_error_t *error) {
  if (list == nullptr) {
    SetError(error, VCAN_USB_STATUS_INVALID_ARGUMENT, "vcan_usb_list_scan",
             LIBUSB_ERROR_INVALID_PARAM, "device list is null");
    return false;
  }
  std::memset(list, 0, sizeof(*list));
  vcan_usb_error_clear(error);
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
      item.label = "VCAN USB";
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
      std::min(found.size(), static_cast<size_t>(VCAN_USB_MAX_DEVICES));
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

vcan_usb_device_t *vcan_usb_open(const char *path, vcan_usb_error_t *error) {
  vcan_usb_error_clear(error);
  DeviceKey key;
  if (!ParsePath(path, &key)) {
    SetError(error, VCAN_USB_STATUS_INVALID_ARGUMENT, "vcan_usb_open",
             LIBUSB_ERROR_INVALID_PARAM, "invalid libusb device path");
    return nullptr;
  }
  auto *result = new (std::nothrow) vcan_usb_device_t();
  if (result == nullptr) {
    SetError(error, VCAN_USB_STATUS_SYSTEM_ERROR, "vcan_usb_open",
             LIBUSB_ERROR_NO_MEM, "unable to allocate the USB device");
    return nullptr;
  }
  result->owner = AcquireDevice(key, error);
  if (!result->owner) {
    vcan_usb_close(result);
    return nullptr;
  }
  result->context = result->owner->context;
  result->handle = result->owner->handle;

  InterfaceInfo usb_interface{};
  libusb_device *usb_device = libusb_get_device(result->handle);
  if (usb_device == nullptr ||
      !FindInterface(usb_device, key.interface_number, &usb_interface)) {
    SetError(error, VCAN_USB_STATUS_ENDPOINT_NOT_FOUND, "vcan_usb_open",
             LIBUSB_ERROR_NOT_FOUND, "USB interface was not found");
    vcan_usb_close(result);
    return nullptr;
  }

  result->interface_number = usb_interface.number;
  result->alternate_setting = usb_interface.alternate_setting;
  result->endpoint_in = usb_interface.endpoint_in;
  result->endpoint_out = usb_interface.endpoint_out;

  bool interface_ready = false;
  {
    std::lock_guard<std::mutex> interface_lock(result->owner->interface_mutex);
    if (result->owner->active_interfaces.count(result->interface_number) != 0) {
      char detail[96]{};
      std::snprintf(detail, sizeof(detail),
                    "USB interface %u is already open in this process",
                    static_cast<unsigned>(result->interface_number));
      SetError(error, VCAN_USB_STATUS_SYSTEM_ERROR, "vcan_usb_open",
               LIBUSB_ERROR_BUSY, detail);
    } else if (ClaimInterface(result->owner.get(), usb_interface, error)) {
      result->owner->active_interfaces.insert(result->interface_number);
      result->claimed = true;
      interface_ready = true;

#ifdef _WIN32
      // WinUSB can reject a sibling interface claim once another endpoint has
      // an in-flight transfer. Reserve the remaining CAN interfaces before RX.
      // Other platforms claim only the requested interface so an EcuBus channel
      // does not unnecessarily detach a SocketCAN interface.
      for (const auto &candidate : FindInterfaces(usb_device))
        ClaimInterface(result->owner.get(), candidate, nullptr);
#endif
    }
  }

  if (!interface_ready) {
    vcan_usb_close(result);
    return nullptr;
  }
  libusb_clear_halt(result->handle, result->endpoint_in);
  libusb_clear_halt(result->handle, result->endpoint_out);
  return result;
}

uint8_t vcan_usb_interface_number(const vcan_usb_device_t *device) {
  return device != nullptr ? device->interface_number : 0;
}

bool vcan_usb_control_in(vcan_usb_device_t *device, uint8_t request_type,
                         uint8_t request, uint16_t value, uint16_t index,
                         uint8_t *data, uint16_t length, uint32_t timeout_ms,
                         vcan_usb_error_t *error) {
  if ((request_type & LIBUSB_ENDPOINT_IN) == 0 ||
      (length > 0 && data == nullptr)) {
    SetError(error, VCAN_USB_STATUS_INVALID_ARGUMENT, "vcan_usb_control_in",
             LIBUSB_ERROR_INVALID_PARAM, "invalid control IN arguments");
    return false;
  }
  vcan_usb_error_clear(error);
  return ControlTransfer(device, request_type, request, value, index, data,
                         length, timeout_ms, error);
}

bool vcan_usb_control_out(vcan_usb_device_t *device, uint8_t request_type,
                          uint8_t request, uint16_t value, uint16_t index,
                          const uint8_t *data, uint16_t length,
                          uint32_t timeout_ms, vcan_usb_error_t *error) {
  if ((request_type & LIBUSB_ENDPOINT_IN) != 0 ||
      (length > 0 && data == nullptr)) {
    SetError(error, VCAN_USB_STATUS_INVALID_ARGUMENT, "vcan_usb_control_out",
             LIBUSB_ERROR_INVALID_PARAM, "invalid control OUT arguments");
    return false;
  }
  vcan_usb_error_clear(error);
  return ControlTransfer(device, request_type, request, value, index,
                         const_cast<uint8_t *>(data), length, timeout_ms,
                         error);
}

bool vcan_usb_bulk_read(vcan_usb_device_t *device, uint8_t *data,
                        size_t capacity, size_t *transferred,
                        uint32_t poll_timeout_ms, vcan_usb_error_t *error) {
  if (transferred != nullptr)
    *transferred = 0;
  if (data == nullptr || capacity == 0 || capacity > INT_MAX ||
      transferred == nullptr) {
    SetError(error, VCAN_USB_STATUS_INVALID_ARGUMENT, "vcan_usb_bulk_read",
             LIBUSB_ERROR_INVALID_PARAM, "invalid bulk read arguments");
    return false;
  }
  if (!ValidateOpen(device, error, "libusb_bulk_transfer(IN)"))
    return false;
  vcan_usb_error_clear(error);
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

bool vcan_usb_bulk_write(vcan_usb_device_t *device, const uint8_t *data,
                         size_t length, size_t *transferred,
                         uint32_t timeout_ms, vcan_usb_error_t *error) {
  if (transferred != nullptr)
    *transferred = 0;
  if (data == nullptr || length == 0 || length > INT_MAX ||
      transferred == nullptr) {
    SetError(error, VCAN_USB_STATUS_INVALID_ARGUMENT, "vcan_usb_bulk_write",
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
  vcan_usb_error_clear(error);
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
      SetError(error, VCAN_USB_STATUS_SHORT_TRANSFER,
               "libusb_bulk_transfer(OUT)", LIBUSB_ERROR_IO, detail);
      return false;
    }
    return true;
  }
}

void vcan_usb_cancel(vcan_usb_device_t *device) {
  if (device != nullptr)
    device->cancelled.store(true);
}

void vcan_usb_close(vcan_usb_device_t *device) {
  if (device == nullptr)
    return;
  vcan_usb_cancel(device);
  if (device->owner) {
    {
      std::lock_guard<std::mutex> interface_lock(
          device->owner->interface_mutex);
      if (device->claimed) {
        device->owner->active_interfaces.erase(device->interface_number);
#ifndef _WIN32
        if (device->owner->claimed_interfaces.erase(device->interface_number) !=
            0) {
          libusb_release_interface(device->handle, device->interface_number);
        }
        if (device->owner->manually_detached_interfaces.erase(
                device->interface_number) != 0) {
          libusb_attach_kernel_driver(device->handle, device->interface_number);
        }
#endif
        device->claimed = false;
      }
    }
    device->handle = nullptr;
    device->context = nullptr;
    device->owner.reset();
  }
  delete device;
}

namespace {

constexpr uint32_t kFeatureListenOnly = 1U << 0;
constexpr uint32_t kFeatureFd = 1U << 8;
constexpr uint32_t kFeatureBtConstExt = 1U << 10;
constexpr uint32_t kFeatureTermination = 1U << 11;
constexpr uint32_t kFeatureBerrReporting = 1U << 12;

constexpr uint32_t kModeListenOnly = 1U << 0;
constexpr uint32_t kModeFd = 1U << 8;
constexpr uint32_t kModeBerrReporting = 1U << 12;

constexpr uint8_t kRequestHostFormat = 0;
constexpr uint8_t kRequestMode = 1;
constexpr uint8_t kRequestBtConst = 16;
constexpr uint8_t kRequestBtConstExt = 17;
constexpr uint8_t kRequestBitTiming = 24;
constexpr uint8_t kRequestDataBitTiming = 25;
constexpr uint8_t kRequestDeviceInfo = 33;
constexpr uint8_t kRequestBusLoad = 36;
constexpr uint8_t kRequestTermination = 37;

constexpr uint32_t kEchoTx = 0xa1c95e3dU;
constexpr uint32_t kEchoRx = 0xa2c95e3dU;
constexpr uint32_t kEchoState = 0xa4c95e3dU;
constexpr uint32_t kEchoControl = 0xa5c95e3dU;
constexpr uint16_t kHeaderSize = 8;
constexpr uint16_t kFrameDataOffset = 24;
constexpr uint16_t kOpcodeSizeMask = 0x0fff;
constexpr uint16_t kOpcodeChannelShift = 12;
constexpr uint16_t kStateRequest = 3;
constexpr uint16_t kBerrRequest = 2;

constexpr uint16_t kFlagOverflow = 1U << 0;
constexpr uint16_t kFlagFd = 1U << 1;
constexpr uint16_t kFlagBrs = 1U << 2;
constexpr uint16_t kFlagEsi = 1U << 3;
constexpr uint16_t kFlagEff = 1U << 4;
constexpr uint16_t kFlagRtr = 1U << 5;
constexpr uint16_t kFlagError = 1U << 6;

constexpr uint32_t kCanSffMask = 0x7ffU;
constexpr uint32_t kCanIdMask = 0x1fffffffU;
constexpr uint8_t kDlcLengths[16] = {0, 1,  2,  3,  4,  5,  6,  7,
                                     8, 12, 16, 20, 24, 32, 48, 64};

uint16_t ReadLe16(const uint8_t *data) {
  return static_cast<uint16_t>(data[0]) |
         (static_cast<uint16_t>(data[1]) << 8U);
}

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

void WriteLe16(uint8_t *data, uint16_t value) {
  data[0] = static_cast<uint8_t>(value);
  data[1] = static_cast<uint8_t>(value >> 8U);
}

void WriteLe32(uint8_t *data, uint32_t value) {
  data[0] = static_cast<uint8_t>(value);
  data[1] = static_cast<uint8_t>(value >> 8U);
  data[2] = static_cast<uint8_t>(value >> 16U);
  data[3] = static_cast<uint8_t>(value >> 24U);
}

uint16_t Opcode(uint8_t channel, uint16_t size) {
  return static_cast<uint16_t>(
      (static_cast<uint16_t>(channel & 0x0fU) << kOpcodeChannelShift) |
      (size & kOpcodeSizeMask));
}

bool ProtocolError(vcan_usb_error_t *error, const char *operation,
                   const std::string &message,
                   vcan_usb_status_t status = VCAN_USB_STATUS_PROTOCOL_ERROR) {
  SetError(error, status, operation, 0, message);
  return false;
}

bool ControlGet(vcan_usb_device_t *device, uint8_t request,
                size_t payload_length, std::vector<uint8_t> *payload,
                vcan_usb_error_t *error) {
  if (payload == nullptr || payload_length + kHeaderSize > UINT16_MAX)
    return ProtocolError(error, "VCAN protocol control read",
                         "invalid response length",
                         VCAN_USB_STATUS_INVALID_ARGUMENT);
  std::vector<uint8_t> response(payload_length + kHeaderSize);
  if (!vcan_usb_control_in(device, 0xc1, static_cast<uint8_t>(request | 0x80U),
                           0, device->interface_number, response.data(),
                           static_cast<uint16_t>(response.size()),
                           kDefaultTimeoutMs, error)) {
    return false;
  }
  const uint16_t opcode = ReadLe16(response.data() + 4);
  if (ReadLe32(response.data()) != kEchoControl ||
      (opcode & kOpcodeSizeMask) != response.size() ||
      ((opcode >> kOpcodeChannelShift) & 0x0fU) != device->interface_number ||
      (ReadLe16(response.data() + 6) & 0x7fU) != request) {
    return ProtocolError(error, "VCAN protocol control read",
                         "invalid control response header");
  }
  payload->assign(response.begin() + kHeaderSize, response.end());
  return true;
}

bool ControlSet(vcan_usb_device_t *device, uint8_t request,
                const uint8_t *payload, size_t payload_length,
                vcan_usb_error_t *error) {
  if ((payload_length > 0 && payload == nullptr) ||
      payload_length + kHeaderSize > kOpcodeSizeMask) {
    return ProtocolError(error, "VCAN protocol control write",
                         "invalid control payload",
                         VCAN_USB_STATUS_INVALID_ARGUMENT);
  }
  std::vector<uint8_t> request_data(kHeaderSize + payload_length, 0);
  WriteLe32(request_data.data(), kEchoControl);
  WriteLe16(request_data.data() + 4,
            Opcode(device->interface_number,
                   static_cast<uint16_t>(request_data.size())));
  WriteLe16(request_data.data() + 6, request);
  if (payload_length > 0)
    std::memcpy(request_data.data() + kHeaderSize, payload, payload_length);
  return vcan_usb_control_out(
      device, 0x41, request, 0, device->interface_number, request_data.data(),
      static_cast<uint16_t>(request_data.size()), kDefaultTimeoutMs, error);
}

bool LimitsValid(const vcan_usb_timing_limits_t &limits) {
  return limits.clock_hz > 0 && limits.tseg1_min > 0 &&
         limits.tseg1_min <= limits.tseg1_max && limits.tseg2_min > 0 &&
         limits.tseg2_min <= limits.tseg2_max && limits.sjw_max > 0 &&
         limits.brp_min > 0 && limits.brp_min <= limits.brp_max &&
         limits.brp_inc > 0;
}

void ConstrainToHardware(vcan_usb_timing_limits_t *limits, bool data_phase) {
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
                  vcan_usb_timing_limits_t *limits, vcan_usb_error_t *error) {
  if (limits == nullptr || offset + 32 > payload.size())
    return ProtocolError(error, "VCAN capabilities",
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
    return ProtocolError(error, "VCAN capabilities",
                         "capability response contains invalid timing limits");
  return true;
}

void FillFallback(vcan_usb_capabilities_t *capabilities) {
  if (capabilities == nullptr)
    return;
  std::memset(capabilities, 0, sizeof(*capabilities));
  auto &limits = capabilities->nominal;
  limits.feature = kFeatureListenOnly | kFeatureFd | kFeatureBtConstExt;
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

bool GetCapabilitiesUnlocked(vcan_usb_device_t *device,
                             vcan_usb_capabilities_t *capabilities,
                             vcan_usb_error_t *error) {
  if (device->capabilities_cached) {
    *capabilities = device->capabilities;
    return true;
  }
  std::vector<uint8_t> base;
  if (!ControlGet(device, kRequestBtConst, 40, &base, error))
    return false;
  const uint32_t feature = ReadLe32(base.data());
  const uint32_t clock_hz = ReadLe32(base.data() + 4);
  vcan_usb_capabilities_t result{};
  if (!DecodeLimits(base, 8, feature, clock_hz, &result.nominal, error))
    return false;
  ConstrainToHardware(&result.nominal, false);
  if (!LimitsValid(result.nominal))
    return ProtocolError(error, "VCAN capabilities",
                         "nominal limits do not match HPM MCAN");
  result.fd_supported = (feature & kFeatureFd) != 0;
  result.listen_only_supported = (feature & kFeatureListenOnly) != 0;
  result.termination_supported = (feature & kFeatureTermination) != 0;
  if ((feature & kFeatureFd) != 0 && (feature & kFeatureBtConstExt) != 0) {
    std::vector<uint8_t> extended;
    if (!ControlGet(device, kRequestBtConstExt, 72, &extended, error) ||
        !DecodeLimits(extended, 40, ReadLe32(extended.data()),
                      ReadLe32(extended.data() + 4), &result.data, error)) {
      return false;
    }
    ConstrainToHardware(&result.data, true);
    if (!LimitsValid(result.data))
      return ProtocolError(error, "VCAN capabilities",
                           "data limits do not match HPM MCAN");
    result.has_data_timing = true;
  }
  device->capabilities = result;
  device->capabilities_cached = true;
  *capabilities = result;
  return true;
}

bool ValidateTiming(const vcan_usb_timing_t &timing,
                    const vcan_usb_timing_limits_t &limits,
                    vcan_usb_applied_timing_t *applied, vcan_usb_error_t *error,
                    const char *phase) {
  if (timing.clock_hz == 0 || timing.bitrate_hz == 0 || timing.prescaler == 0 ||
      timing.tseg1 == 0 || timing.tseg2 == 0 || timing.sjw == 0) {
    return ProtocolError(error, phase, "timing values must be positive",
                         VCAN_USB_STATUS_INVALID_ARGUMENT);
  }
  if (timing.clock_hz != limits.clock_hz)
    return ProtocolError(error, phase, "configured clock does not match device",
                         VCAN_USB_STATUS_INVALID_ARGUMENT);
  if (timing.tseg1 < limits.tseg1_min || timing.tseg1 > limits.tseg1_max ||
      timing.tseg2 < limits.tseg2_min || timing.tseg2 > limits.tseg2_max ||
      timing.sjw > limits.sjw_max || timing.sjw > timing.tseg2 ||
      timing.prescaler < limits.brp_min || timing.prescaler > limits.brp_max ||
      ((timing.prescaler - limits.brp_min) % limits.brp_inc) != 0) {
    return ProtocolError(error, phase,
                         "timing values are outside device limits",
                         VCAN_USB_STATUS_INVALID_ARGUMENT);
  }
  const uint64_t total_quanta = 1ULL + timing.tseg1 + timing.tseg2;
  const uint64_t divisor =
      static_cast<uint64_t>(timing.prescaler) * total_quanta;
  const uint32_t actual = static_cast<uint32_t>(timing.clock_hz / divisor);
  const uint64_t difference = actual > timing.bitrate_hz
                                  ? actual - timing.bitrate_hz
                                  : timing.bitrate_hz - actual;
  if (actual == 0 || difference * 100ULL > timing.bitrate_hz) {
    return ProtocolError(error, phase,
                         "timing calculates a bitrate outside 1% tolerance",
                         VCAN_USB_STATUS_INVALID_ARGUMENT);
  }
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

bool SetTiming(vcan_usb_device_t *device, uint8_t request,
               const vcan_usb_applied_timing_t &timing,
               vcan_usb_error_t *error) {
  uint8_t payload[20]{};
  /* prop_seg stays zero; the firmware uses phase_seg1 as the complete TSEG1. */
  WriteLe32(payload + 4, timing.wire_tseg1);
  WriteLe32(payload + 8, timing.wire_tseg2);
  WriteLe32(payload + 12, timing.wire_sjw);
  WriteLe32(payload + 16, timing.wire_prescaler);
  return ControlSet(device, request, payload, sizeof(payload), error);
}

bool SetMode(vcan_usb_device_t *device, uint32_t mode, uint32_t flags,
             vcan_usb_error_t *error) {
  uint8_t payload[8]{};
  WriteLe32(payload, mode);
  WriteLe32(payload + 4, flags);
  return ControlSet(device, kRequestMode, payload, sizeof(payload), error);
}

bool SetHostFormat(vcan_usb_device_t *device, vcan_usb_error_t *error) {
  uint8_t payload[4]{};
  WriteLe32(payload, 0x0000beefU);
  return ControlSet(device, kRequestHostFormat, payload, sizeof(payload),
                    error);
}

bool SetBusLoad(vcan_usb_device_t *device, bool enabled,
                vcan_usb_error_t *error) {
  uint8_t payload[4]{};
  WriteLe32(payload, enabled ? 1U : 0U);
  return ControlSet(device, kRequestBusLoad, payload, sizeof(payload), error);
}

bool SetTermination(vcan_usb_device_t *device, bool enabled,
                    vcan_usb_error_t *error) {
  uint8_t payload[4]{};
  WriteLe32(payload, enabled ? 1U : 0U);
  return ControlSet(device, kRequestTermination, payload, sizeof(payload),
                    error);
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

bool AppendRecord(vcan_usb_rx_batch_t *batch, vcan_usb_rx_record_t **record,
                  vcan_usb_error_t *error) {
  if (batch->count >= VCAN_USB_MAX_RX_RECORDS)
    return ProtocolError(error, "VCAN decode", "receive batch is too large");
  *record = &batch->records[batch->count++];
  std::memset(*record, 0, sizeof(**record));
  return true;
}

} // namespace

void vcan_usb_fallback_capabilities(vcan_usb_capabilities_t *capabilities) {
  FillFallback(capabilities);
}

bool vcan_usb_get_capabilities(vcan_usb_device_t *device,
                               vcan_usb_capabilities_t *capabilities,
                               vcan_usb_error_t *error) {
  if (!ValidateOpen(device, error, "vcan_usb_get_capabilities") ||
      capabilities == nullptr) {
    if (capabilities == nullptr)
      ProtocolError(error, "vcan_usb_get_capabilities",
                    "capabilities output is null",
                    VCAN_USB_STATUS_INVALID_ARGUMENT);
    return false;
  }
  std::lock_guard<std::mutex> lock(device->protocol_mutex);
  vcan_usb_error_clear(error);
  return GetCapabilitiesUnlocked(device, capabilities, error);
}

bool vcan_usb_get_device_info(vcan_usb_device_t *device,
                              vcan_usb_device_info_t *info,
                              vcan_usb_error_t *error) {
  if (!ValidateOpen(device, error, "vcan_usb_get_device_info") ||
      info == nullptr) {
    if (info == nullptr)
      ProtocolError(error, "vcan_usb_get_device_info", "info output is null",
                    VCAN_USB_STATUS_INVALID_ARGUMENT);
    return false;
  }
  std::lock_guard<std::mutex> lock(device->protocol_mutex);
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

bool vcan_usb_get_termination(vcan_usb_device_t *device, bool *enabled,
                              vcan_usb_error_t *error) {
  if (!ValidateOpen(device, error, "vcan_usb_get_termination") ||
      enabled == nullptr) {
    if (enabled == nullptr)
      ProtocolError(error, "vcan_usb_get_termination", "state output is null",
                    VCAN_USB_STATUS_INVALID_ARGUMENT);
    return false;
  }
  std::lock_guard<std::mutex> lock(device->protocol_mutex);
  std::vector<uint8_t> payload;
  if (!ControlGet(device, kRequestTermination, 4, &payload, error))
    return false;
  *enabled = ReadLe32(payload.data()) != 0;
  return true;
}

bool vcan_usb_configure(vcan_usb_device_t *device,
                        const vcan_usb_config_t *config,
                        vcan_usb_applied_config_t *applied,
                        vcan_usb_error_t *error) {
  if (!ValidateOpen(device, error, "vcan_usb_configure") || config == nullptr ||
      applied == nullptr) {
    if (config == nullptr || applied == nullptr)
      ProtocolError(error, "vcan_usb_configure", "configuration is null",
                    VCAN_USB_STATUS_INVALID_ARGUMENT);
    return false;
  }
  std::lock_guard<std::mutex> lock(device->protocol_mutex);
  vcan_usb_error_clear(error);
  vcan_usb_capabilities_t capabilities{};
  if (!GetCapabilitiesUnlocked(device, &capabilities, error))
    return false;
  if (config->fd && !capabilities.fd_supported)
    return ProtocolError(error, "vcan_usb_configure", "CAN FD is not supported",
                         VCAN_USB_STATUS_UNSUPPORTED);
  if (config->listen_only && !capabilities.listen_only_supported)
    return ProtocolError(error, "vcan_usb_configure",
                         "listen-only mode is not supported",
                         VCAN_USB_STATUS_UNSUPPORTED);

  vcan_usb_applied_config_t result{};
  if (!ValidateTiming(config->nominal, capabilities.nominal, &result.nominal,
                      error, "VCAN nominal timing"))
    return false;
  if (config->fd) {
    const auto &limits =
        capabilities.has_data_timing ? capabilities.data : capabilities.nominal;
    if (!ValidateTiming(config->data, limits, &result.data, error,
                        "VCAN data timing"))
      return false;
    result.has_data_timing = true;
  }

  device->fd_mode.store(false);
  if (!SetMode(device, 0, 0, error))
    return false;
  std::this_thread::sleep_for(std::chrono::milliseconds(kModeSettleMs));
  if (!SetHostFormat(device, error) ||
      !SetTiming(device, kRequestBitTiming, result.nominal, error) ||
      (config->fd &&
       !SetTiming(device, kRequestDataBitTiming, result.data, error)) ||
      !SetBusLoad(device, false, error)) {
    return false;
  }
  vcan_usb_error_t termination_error{};
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
  vcan_usb_decoder_reset(device);
  if (!SetMode(device, 1, flags, error))
    return false;
  device->fd_mode.store(config->fd);
  result.hardware_timestamps = false;
  *applied = result;
  return true;
}

bool vcan_usb_stop(vcan_usb_device_t *device, vcan_usb_error_t *error) {
  if (!ValidateOpen(device, error, "vcan_usb_stop"))
    return false;
  std::lock_guard<std::mutex> lock(device->protocol_mutex);
  bool result = SetMode(device, 0, 0, error);
  if (result)
    result = SetHostFormat(device, error);
  device->fd_mode.store(false);
  return result;
}

bool vcan_usb_encode_frame(vcan_usb_device_t *device,
                           const vcan_usb_frame_t *frame, uint8_t *wire,
                           size_t capacity, size_t *wire_length,
                           uint8_t *normalized_length,
                           vcan_usb_error_t *error) {
  if (!ValidateOpen(device, error, "vcan_usb_encode_frame") ||
      frame == nullptr || wire == nullptr || wire_length == nullptr ||
      normalized_length == nullptr) {
    if (frame == nullptr || wire == nullptr || wire_length == nullptr ||
        normalized_length == nullptr)
      ProtocolError(error, "vcan_usb_encode_frame", "invalid frame output",
                    VCAN_USB_STATUS_INVALID_ARGUMENT);
    return false;
  }
  const uint32_t maximum_id = frame->extended ? kCanIdMask : kCanSffMask;
  if (frame->id > maximum_id || frame->length > (frame->fd ? 64 : 8) ||
      (frame->fd && frame->remote) || (frame->fd && !device->fd_mode.load())) {
    return ProtocolError(error, "vcan_usb_encode_frame",
                         "invalid CAN frame for the configured mode",
                         VCAN_USB_STATUS_INVALID_ARGUMENT);
  }
  const uint8_t dlc = LengthToDlc(frame->length, frame->fd);
  if (dlc == 0xff)
    return ProtocolError(error, "vcan_usb_encode_frame",
                         "CAN payload exceeds protocol limits",
                         VCAN_USB_STATUS_INVALID_ARGUMENT);
  const uint8_t data_length = DlcToLength(dlc, frame->fd);
  const size_t size = kFrameDataOffset + (frame->fd ? 64U : 8U);
  if (capacity < size)
    return ProtocolError(error, "vcan_usb_encode_frame",
                         "wire buffer is too small",
                         VCAN_USB_STATUS_INVALID_ARGUMENT);
  std::memset(wire, 0, size);
  uint16_t flags = frame->fd ? kFlagFd : 0;
  if (frame->fd && frame->brs)
    flags |= kFlagBrs;
  if (frame->extended)
    flags |= kFlagEff;
  if (frame->remote)
    flags |= kFlagRtr;
  WriteLe32(wire, kEchoTx);
  WriteLe16(wire + 4,
            Opcode(device->interface_number, static_cast<uint16_t>(size)));
  WriteLe16(wire + 6, flags);
  WriteLe32(wire + 8, frame->id & kCanIdMask);
  wire[12] = dlc;
  if (frame->length > 0)
    std::memcpy(wire + kFrameDataOffset, frame->data, frame->length);
  *wire_length = size;
  *normalized_length = data_length;
  return true;
}

bool vcan_usb_decode(vcan_usb_device_t *device, const uint8_t *wire,
                     size_t wire_length, vcan_usb_rx_batch_t *batch,
                     vcan_usb_error_t *error) {
  if (!ValidateOpen(device, error, "vcan_usb_decode") ||
      (wire_length > 0 && wire == nullptr) || batch == nullptr) {
    if ((wire_length > 0 && wire == nullptr) || batch == nullptr)
      ProtocolError(error, "vcan_usb_decode", "invalid decoder input",
                    VCAN_USB_STATUS_INVALID_ARGUMENT);
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
  while (offset + kHeaderSize <= buffer.size()) {
    const uint8_t *item = buffer.data() + offset;
    const uint32_t echo = ReadLe32(item);
    if (echo == 0) {
      offset = buffer.size();
      break;
    }
    const uint16_t opcode = ReadLe16(item + 4);
    const uint16_t flags = ReadLe16(item + 6);
    const size_t size = opcode & kOpcodeSizeMask;
    if (size < kHeaderSize || size > 512) {
      device->decoder_tail.clear();
      return ProtocolError(error, "VCAN decode", "invalid bulk frame size");
    }
    const uint8_t channel =
        static_cast<uint8_t>((opcode >> kOpcodeChannelShift) & 0x0fU);
    if (channel != device->interface_number) {
      device->decoder_tail.clear();
      return ProtocolError(error, "VCAN decode",
                           "bulk frame channel does not match interface");
    }
    if (offset + size > buffer.size()) {
      device->decoder_tail.assign(buffer.begin() + offset, buffer.end());
      break;
    }
    vcan_usb_rx_record_t *record = nullptr;
    if (echo == kEchoRx && size >= kFrameDataOffset) {
      const bool fd = (flags & kFlagFd) != 0;
      const bool extended = (flags & kFlagEff) != 0;
      const uint8_t length = DlcToLength(item[12], fd);
      if (kFrameDataOffset + length > size)
        return ProtocolError(error, "VCAN decode",
                             "frame payload exceeds declared size");
      if (!AppendRecord(batch, &record, error))
        return false;
      record->kind = VCAN_USB_RX_FRAME;
      record->frame.id =
          ReadLe32(item + 8) & (extended ? kCanIdMask : kCanSffMask);
      record->frame.length = length;
      if (length > 0)
        std::memcpy(record->frame.data, item + kFrameDataOffset, length);
      record->frame.fd = fd;
      record->frame.brs = fd && (flags & kFlagBrs) != 0;
      record->frame.extended = extended;
      record->frame.remote = !fd && (flags & kFlagRtr) != 0;
      record->frame.timestamp_us = ReadLe64(item + 16);
      record->frame.overflow = (flags & kFlagOverflow) != 0;
      record->frame.esi = fd && (flags & kFlagEsi) != 0;
      record->frame.error = (flags & kFlagError) != 0;
    } else if (echo == kEchoState && flags == kStateRequest && size >= 28) {
      if (!AppendRecord(batch, &record, error))
        return false;
      record->kind = VCAN_USB_RX_STATE;
      record->timestamp_us = ReadLe64(item + 8);
      record->state = ReadLe32(item + 16);
      record->rx_error_count = ReadLe32(item + 20);
      record->tx_error_count = ReadLe32(item + 24);
    } else if (echo == kEchoState && flags == kBerrRequest && size >= 16) {
      if (!AppendRecord(batch, &record, error))
        return false;
      record->kind = VCAN_USB_RX_BUS_ERROR;
      record->error_flag = item[8];
      record->error_code = item[9];
      record->rx_error_count = item[10];
      record->tx_error_count = item[11];
      record->error_logging_count = item[12];
    }
    offset += size;
  }
  if (device->decoder_tail.empty() && offset < buffer.size()) {
    const auto begin = buffer.begin() + offset;
    const bool non_zero = std::any_of(begin, buffer.end(),
                                      [](uint8_t value) { return value != 0; });
    if (non_zero)
      device->decoder_tail.assign(begin, buffer.end());
  }
  return true;
}

void vcan_usb_decoder_reset(vcan_usb_device_t *device) {
  if (device == nullptr)
    return;
  std::lock_guard<std::mutex> lock(device->decoder_mutex);
  device->decoder_tail.clear();
}

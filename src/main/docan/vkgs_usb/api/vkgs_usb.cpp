#include "vkgs_usb.h"

#include <libusb.h>

#include <algorithm>
#include <atomic>
#include <cerrno>
#include <climits>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <new>
#include <sstream>
#include <string>
#include <utility>
#include <vector>

namespace {

constexpr uint16_t kDeviceVid = 0x1d50;
constexpr uint16_t kDevicePid = 0x606f;
constexpr uint32_t kDefaultTimeoutMs = 2000;
constexpr uint32_t kDefaultPollMs = 100;
constexpr size_t kMaxPortDepth = 16;
constexpr const char *kPathPrefix = "libusb://1d50:606f/";

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
  libusb_context *context = nullptr;
  libusb_device_handle *handle = nullptr;
  uint8_t interface_number = 0;
  uint8_t alternate_setting = 0;
  uint8_t endpoint_in = 0;
  uint8_t endpoint_out = 0;
  bool claimed = false;
  bool manually_detached = false;
  std::atomic<bool> cancelled{false};
};

namespace {

bool ValidateOpen(vkgs_usb_device_t *device, vkgs_usb_error_t *error,
                  const char *operation) {
  if (device != nullptr && device->handle != nullptr && device->claimed) {
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
  int status = libusb_init(&result->context);
  if (status != LIBUSB_SUCCESS) {
    SetLibusbError(error, "libusb_init", status);
    vkgs_usb_close(result);
    return nullptr;
  }
  libusb_device **devices = nullptr;
  const ssize_t count = libusb_get_device_list(result->context, &devices);
  if (count < 0) {
    SetLibusbError(error, "libusb_get_device_list", static_cast<int>(count));
    vkgs_usb_close(result);
    return nullptr;
  }

  InterfaceInfo usb_interface{};
  for (ssize_t index = 0; index < count; ++index) {
    libusb_device_descriptor descriptor{};
    if (libusb_get_device_descriptor(devices[index], &descriptor) !=
            LIBUSB_SUCCESS ||
        descriptor.idVendor != kDeviceVid ||
        descriptor.idProduct != kDevicePid || !Matches(devices[index], key) ||
        !FindInterface(devices[index], key.interface_number, &usb_interface)) {
      continue;
    }
    status = libusb_open(devices[index], &result->handle);
    break;
  }
  libusb_free_device_list(devices, 1);
  if (result->handle == nullptr || status != LIBUSB_SUCCESS) {
    if (status == LIBUSB_SUCCESS)
      status = LIBUSB_ERROR_NO_DEVICE;
    SetLibusbError(error, "libusb_open", status);
    vkgs_usb_close(result);
    return nullptr;
  }

  result->interface_number = usb_interface.number;
  result->alternate_setting = usb_interface.alternate_setting;
  result->endpoint_in = usb_interface.endpoint_in;
  result->endpoint_out = usb_interface.endpoint_out;
  const int kernel_active =
      libusb_kernel_driver_active(result->handle, result->interface_number);
  const int auto_detach =
      libusb_set_auto_detach_kernel_driver(result->handle, 1);
  if (kernel_active == 1 && auto_detach != LIBUSB_SUCCESS) {
    status =
        libusb_detach_kernel_driver(result->handle, result->interface_number);
    if (status != LIBUSB_SUCCESS) {
      SetLibusbError(error, "libusb_detach_kernel_driver", status);
      vkgs_usb_close(result);
      return nullptr;
    }
    result->manually_detached = true;
  }
  status = libusb_claim_interface(result->handle, result->interface_number);
  if (status != LIBUSB_SUCCESS) {
    SetLibusbError(error, "libusb_claim_interface", status);
    vkgs_usb_close(result);
    return nullptr;
  }
  result->claimed = true;
  if (result->alternate_setting != 0) {
    status = libusb_set_interface_alt_setting(
        result->handle, result->interface_number, result->alternate_setting);
    if (status != LIBUSB_SUCCESS) {
      SetLibusbError(error, "libusb_set_interface_alt_setting", status);
      vkgs_usb_close(result);
      return nullptr;
    }
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
  if (device->handle != nullptr) {
    if (device->claimed) {
      libusb_release_interface(device->handle, device->interface_number);
      device->claimed = false;
    }
    if (device->manually_detached) {
      libusb_attach_kernel_driver(device->handle, device->interface_number);
      device->manually_detached = false;
    }
    libusb_close(device->handle);
    device->handle = nullptr;
  }
  if (device->context != nullptr) {
    libusb_exit(device->context);
    device->context = nullptr;
  }
  delete device;
}

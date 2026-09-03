#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define VKGS_USB_MAX_DEVICES 64
#define VKGS_USB_PATH_CAPACITY 1024
#define VKGS_USB_LABEL_CAPACITY 256
#define VKGS_USB_OPERATION_CAPACITY 64
#define VKGS_USB_MESSAGE_CAPACITY 512

typedef enum {
  VKGS_USB_STATUS_OK = 0,
  VKGS_USB_STATUS_INVALID_ARGUMENT,
  VKGS_USB_STATUS_SYSTEM_ERROR,
  VKGS_USB_STATUS_NOT_OPEN,
  VKGS_USB_STATUS_ENDPOINT_NOT_FOUND,
  VKGS_USB_STATUS_SHORT_TRANSFER,
  VKGS_USB_STATUS_TIMEOUT,
  VKGS_USB_STATUS_CANCELLED
} vkgs_usb_status_t;

typedef struct {
  vkgs_usb_status_t status;
  int32_t native_code;
  char operation[VKGS_USB_OPERATION_CAPACITY];
  char message[VKGS_USB_MESSAGE_CAPACITY];
} vkgs_usb_error_t;

typedef struct {
  char path[VKGS_USB_PATH_CAPACITY];
  char label[VKGS_USB_LABEL_CAPACITY];
  uint8_t interface_number;
  uint8_t endpoint_in;
  uint8_t endpoint_out;
  bool busy;
} vkgs_usb_interface_t;

typedef struct {
  size_t count;
  vkgs_usb_interface_t devices[VKGS_USB_MAX_DEVICES];
} vkgs_usb_device_list_t;

typedef struct vkgs_usb_device vkgs_usb_device_t;

void vkgs_usb_error_clear(vkgs_usb_error_t *error);

bool vkgs_usb_list_scan(vkgs_usb_device_list_t *list, vkgs_usb_error_t *error);

vkgs_usb_device_t *vkgs_usb_open(const char *path, vkgs_usb_error_t *error);

uint8_t vkgs_usb_interface_number(const vkgs_usb_device_t *device);

bool vkgs_usb_control_in(vkgs_usb_device_t *device, uint8_t request_type,
                         uint8_t request, uint16_t value, uint16_t index,
                         uint8_t *data, uint16_t length, uint32_t timeout_ms,
                         vkgs_usb_error_t *error);

bool vkgs_usb_control_out(vkgs_usb_device_t *device, uint8_t request_type,
                          uint8_t request, uint16_t value, uint16_t index,
                          const uint8_t *data, uint16_t length,
                          uint32_t timeout_ms, vkgs_usb_error_t *error);

bool vkgs_usb_bulk_read(vkgs_usb_device_t *device, uint8_t *data,
                        size_t capacity, size_t *transferred,
                        uint32_t poll_timeout_ms, vkgs_usb_error_t *error);

bool vkgs_usb_bulk_write(vkgs_usb_device_t *device, const uint8_t *data,
                         size_t length, size_t *transferred,
                         uint32_t timeout_ms, vkgs_usb_error_t *error);

void vkgs_usb_cancel(vkgs_usb_device_t *device);

void vkgs_usb_close(vkgs_usb_device_t *device);

#ifdef __cplusplus
}
#endif

#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define VCAN_USB_MAX_DEVICES 64
#define VCAN_USB_PATH_CAPACITY 1024
#define VCAN_USB_LABEL_CAPACITY 256
#define VCAN_USB_OPERATION_CAPACITY 64
#define VCAN_USB_MESSAGE_CAPACITY 512

typedef enum {
  VCAN_USB_STATUS_OK = 0,
  VCAN_USB_STATUS_INVALID_ARGUMENT,
  VCAN_USB_STATUS_SYSTEM_ERROR,
  VCAN_USB_STATUS_NOT_OPEN,
  VCAN_USB_STATUS_ENDPOINT_NOT_FOUND,
  VCAN_USB_STATUS_SHORT_TRANSFER,
  VCAN_USB_STATUS_TIMEOUT,
  VCAN_USB_STATUS_CANCELLED
} vcan_usb_status_t;

typedef struct {
  vcan_usb_status_t status;
  int32_t native_code;
  char operation[VCAN_USB_OPERATION_CAPACITY];
  char message[VCAN_USB_MESSAGE_CAPACITY];
} vcan_usb_error_t;

typedef struct {
  char path[VCAN_USB_PATH_CAPACITY];
  char label[VCAN_USB_LABEL_CAPACITY];
  uint8_t interface_number;
  uint8_t endpoint_in;
  uint8_t endpoint_out;
  bool busy;
} vcan_usb_interface_t;

typedef struct {
  size_t count;
  vcan_usb_interface_t devices[VCAN_USB_MAX_DEVICES];
} vcan_usb_device_list_t;

typedef struct vcan_usb_device vcan_usb_device_t;

void vcan_usb_error_clear(vcan_usb_error_t *error);

bool vcan_usb_list_scan(vcan_usb_device_list_t *list, vcan_usb_error_t *error);

vcan_usb_device_t *vcan_usb_open(const char *path, vcan_usb_error_t *error);

uint8_t vcan_usb_interface_number(const vcan_usb_device_t *device);

bool vcan_usb_control_in(vcan_usb_device_t *device, uint8_t request_type,
                         uint8_t request, uint16_t value, uint16_t index,
                         uint8_t *data, uint16_t length, uint32_t timeout_ms,
                         vcan_usb_error_t *error);

bool vcan_usb_control_out(vcan_usb_device_t *device, uint8_t request_type,
                          uint8_t request, uint16_t value, uint16_t index,
                          const uint8_t *data, uint16_t length,
                          uint32_t timeout_ms, vcan_usb_error_t *error);

bool vcan_usb_bulk_read(vcan_usb_device_t *device, uint8_t *data,
                        size_t capacity, size_t *transferred,
                        uint32_t poll_timeout_ms, vcan_usb_error_t *error);

bool vcan_usb_bulk_write(vcan_usb_device_t *device, const uint8_t *data,
                         size_t length, size_t *transferred,
                         uint32_t timeout_ms, vcan_usb_error_t *error);

void vcan_usb_cancel(vcan_usb_device_t *device);

void vcan_usb_close(vcan_usb_device_t *device);

#ifdef __cplusplus
}
#endif

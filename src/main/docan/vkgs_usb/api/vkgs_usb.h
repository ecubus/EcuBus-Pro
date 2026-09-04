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
  VKGS_USB_STATUS_CANCELLED,
  VKGS_USB_STATUS_PROTOCOL_ERROR,
  VKGS_USB_STATUS_UNSUPPORTED
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

typedef struct {
  uint32_t feature;
  uint32_t clock_hz;
  uint32_t tseg1_min;
  uint32_t tseg1_max;
  uint32_t tseg2_min;
  uint32_t tseg2_max;
  uint32_t sjw_max;
  uint32_t brp_min;
  uint32_t brp_max;
  uint32_t brp_inc;
} vkgs_usb_timing_limits_t;

typedef struct {
  vkgs_usb_timing_limits_t nominal;
  vkgs_usb_timing_limits_t data;
  bool has_data_timing;
  bool fd_supported;
  bool listen_only_supported;
  bool termination_supported;
} vkgs_usb_capabilities_t;

typedef struct {
  uint32_t software_version;
  uint32_t hardware_version;
  uint32_t uid[4];
  uint32_t uuid[4];
} vkgs_usb_device_info_t;

/* All timing fields use human/EcuBus semantics. Unlike Candle/standard
 * gs_usb, this hardware protocol ignores prop_seg and expects BRP, TSEG1,
 * TSEG2 and SJW as zero-based register values. This API performs that single
 * conversion; callers must never pre-decrement the values. */
typedef struct {
  uint32_t clock_hz;
  uint32_t bitrate_hz;
  uint32_t prescaler;
  uint32_t tseg1;
  uint32_t tseg2;
  uint32_t sjw;
} vkgs_usb_timing_t;

typedef struct {
  uint32_t requested_bitrate_hz;
  /* Calculated from the validated semantic values. The current firmware
   * protocol does not provide an applied-timing register readback. */
  uint32_t actual_bitrate_hz;
  uint32_t sample_point_permille;
  uint32_t prescaler;
  uint32_t tseg1;
  uint32_t tseg2;
  uint32_t sjw;
  uint32_t wire_prescaler;
  uint32_t wire_tseg1;
  uint32_t wire_tseg2;
  uint32_t wire_sjw;
} vkgs_usb_applied_timing_t;

typedef struct {
  vkgs_usb_timing_t nominal;
  vkgs_usb_timing_t data;
  bool fd;
  bool listen_only;
  bool termination;
} vkgs_usb_config_t;

typedef struct {
  vkgs_usb_applied_timing_t nominal;
  vkgs_usb_applied_timing_t data;
  bool has_data_timing;
  bool hardware_timestamps;
} vkgs_usb_applied_config_t;

#define VKGS_USB_MAX_FRAME_DATA 64
#define VKGS_USB_MAX_WIRE_FRAME 84
#define VKGS_USB_MAX_RX_RECORDS 64

typedef struct {
  uint32_t id;
  uint8_t data[VKGS_USB_MAX_FRAME_DATA];
  uint8_t length;
  bool fd;
  bool brs;
  bool extended;
  bool remote;
  bool overflow;
  bool esi;
  bool error;
  uint64_t timestamp_us;
} vkgs_usb_frame_t;

typedef enum {
  VKGS_USB_RX_FRAME = 1,
  VKGS_USB_RX_STATE,
  VKGS_USB_RX_BUS_ERROR
} vkgs_usb_rx_kind_t;

typedef struct {
  vkgs_usb_rx_kind_t kind;
  vkgs_usb_frame_t frame;
  uint32_t state;
  uint32_t rx_error_count;
  uint32_t tx_error_count;
  uint64_t timestamp_us;
  uint8_t error_flag;
  uint8_t error_code;
  uint8_t error_logging_count;
} vkgs_usb_rx_record_t;

typedef struct {
  size_t count;
  vkgs_usb_rx_record_t records[VKGS_USB_MAX_RX_RECORDS];
} vkgs_usb_rx_batch_t;

void vkgs_usb_error_clear(vkgs_usb_error_t *error);

bool vkgs_usb_list_scan(vkgs_usb_device_list_t *list, vkgs_usb_error_t *error);

void vkgs_usb_fallback_capabilities(vkgs_usb_capabilities_t *capabilities);

vkgs_usb_device_t *vkgs_usb_open(const char *path, vkgs_usb_error_t *error);

uint8_t vkgs_usb_interface_number(const vkgs_usb_device_t *device);

bool vkgs_usb_get_capabilities(vkgs_usb_device_t *device,
                               vkgs_usb_capabilities_t *capabilities,
                               vkgs_usb_error_t *error);

bool vkgs_usb_get_device_info(vkgs_usb_device_t *device,
                              vkgs_usb_device_info_t *info,
                              vkgs_usb_error_t *error);

bool vkgs_usb_get_termination(vkgs_usb_device_t *device, bool *enabled,
                              vkgs_usb_error_t *error);

bool vkgs_usb_configure(vkgs_usb_device_t *device,
                        const vkgs_usb_config_t *config,
                        vkgs_usb_applied_config_t *applied,
                        vkgs_usb_error_t *error);

bool vkgs_usb_stop(vkgs_usb_device_t *device, vkgs_usb_error_t *error);

bool vkgs_usb_encode_frame(vkgs_usb_device_t *device,
                           const vkgs_usb_frame_t *frame, uint8_t *wire,
                           size_t capacity, size_t *wire_length,
                           uint8_t *normalized_length, vkgs_usb_error_t *error);

bool vkgs_usb_decode(vkgs_usb_device_t *device, const uint8_t *wire,
                     size_t wire_length, vkgs_usb_rx_batch_t *batch,
                     vkgs_usb_error_t *error);

void vkgs_usb_decoder_reset(vkgs_usb_device_t *device);

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

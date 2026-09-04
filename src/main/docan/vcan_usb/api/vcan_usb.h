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
  VCAN_USB_STATUS_CANCELLED,
  VCAN_USB_STATUS_PROTOCOL_ERROR,
  VCAN_USB_STATUS_UNSUPPORTED
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
} vcan_usb_timing_limits_t;

typedef struct {
  vcan_usb_timing_limits_t nominal;
  vcan_usb_timing_limits_t data;
  bool has_data_timing;
  bool fd_supported;
  bool listen_only_supported;
  bool termination_supported;
} vcan_usb_capabilities_t;

typedef struct {
  uint32_t software_version;
  uint32_t hardware_version;
  uint32_t uid[4];
  uint32_t uuid[4];
} vcan_usb_device_info_t;

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
} vcan_usb_timing_t;

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
} vcan_usb_applied_timing_t;

typedef struct {
  vcan_usb_timing_t nominal;
  vcan_usb_timing_t data;
  bool fd;
  bool listen_only;
  bool termination;
} vcan_usb_config_t;

typedef struct {
  vcan_usb_applied_timing_t nominal;
  vcan_usb_applied_timing_t data;
  bool has_data_timing;
  bool hardware_timestamps;
} vcan_usb_applied_config_t;

#define VCAN_USB_MAX_FRAME_DATA 64
#define VCAN_USB_MAX_WIRE_FRAME 88
#define VCAN_USB_MAX_RX_RECORDS 64

typedef struct {
  uint32_t id;
  uint8_t data[VCAN_USB_MAX_FRAME_DATA];
  uint8_t length;
  bool fd;
  bool brs;
  bool extended;
  bool remote;
  bool overflow;
  bool esi;
  bool error;
  uint64_t timestamp_us;
} vcan_usb_frame_t;

typedef enum {
  VCAN_USB_RX_FRAME = 1,
  VCAN_USB_RX_STATE,
  VCAN_USB_RX_BUS_ERROR
} vcan_usb_rx_kind_t;

typedef struct {
  vcan_usb_rx_kind_t kind;
  vcan_usb_frame_t frame;
  uint32_t state;
  uint32_t rx_error_count;
  uint32_t tx_error_count;
  uint64_t timestamp_us;
  uint8_t error_flag;
  uint8_t error_code;
  uint8_t error_logging_count;
} vcan_usb_rx_record_t;

typedef struct {
  size_t count;
  vcan_usb_rx_record_t records[VCAN_USB_MAX_RX_RECORDS];
} vcan_usb_rx_batch_t;

void vcan_usb_error_clear(vcan_usb_error_t *error);

bool vcan_usb_list_scan(vcan_usb_device_list_t *list, vcan_usb_error_t *error);

void vcan_usb_fallback_capabilities(vcan_usb_capabilities_t *capabilities);

vcan_usb_device_t *vcan_usb_open(const char *path, vcan_usb_error_t *error);

uint8_t vcan_usb_interface_number(const vcan_usb_device_t *device);

bool vcan_usb_get_capabilities(vcan_usb_device_t *device,
                               vcan_usb_capabilities_t *capabilities,
                               vcan_usb_error_t *error);

bool vcan_usb_get_device_info(vcan_usb_device_t *device,
                              vcan_usb_device_info_t *info,
                              vcan_usb_error_t *error);

bool vcan_usb_get_termination(vcan_usb_device_t *device, bool *enabled,
                              vcan_usb_error_t *error);

bool vcan_usb_configure(vcan_usb_device_t *device,
                        const vcan_usb_config_t *config,
                        vcan_usb_applied_config_t *applied,
                        vcan_usb_error_t *error);

bool vcan_usb_stop(vcan_usb_device_t *device, vcan_usb_error_t *error);

bool vcan_usb_encode_frame(vcan_usb_device_t *device,
                           const vcan_usb_frame_t *frame, uint8_t *wire,
                           size_t capacity, size_t *wire_length,
                           uint8_t *normalized_length, vcan_usb_error_t *error);

bool vcan_usb_decode(vcan_usb_device_t *device, const uint8_t *wire,
                     size_t wire_length, vcan_usb_rx_batch_t *batch,
                     vcan_usb_error_t *error);

void vcan_usb_decoder_reset(vcan_usb_device_t *device);

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

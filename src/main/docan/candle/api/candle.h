/*

  Copyright (c) 2016 Hubert Denkmair <hubert@denkmair.de>

  This file is part of the candle windows API.
  
  This library is free software: you can redistribute it and/or
  modify it under the terms of the GNU Lesser General Public
  License as published by the Free Software Foundation, either
  version 3 of the License, or (at your option) any later version.
 
  This library is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
  Lesser General Public License for more details.
 
  You should have received a copy of the GNU Lesser General Public
  License along with this library.  If not, see <http://www.gnu.org/licenses/>.

*/

#pragma once
#include <stdint.h>
#include <stdbool.h>


#ifdef __cplusplus
extern "C" {
#endif



typedef void* candle_list_handle;
typedef void* candle_handle;

typedef enum {
    CANDLE_DEVSTATE_AVAIL,
    CANDLE_DEVSTATE_INUSE
} candle_devstate_t;

typedef enum {
    CANDLE_FRAMETYPE_UNKNOWN=0,
    CANDLE_FRAMETYPE_RECEIVE,
    CANDLE_FRAMETYPE_ECHO,
    CANDLE_FRAMETYPE_ERROR,
    CANDLE_FRAMETYPE_TIMESTAMP_OVFL
} candle_frametype_t;

enum {
    CANDLE_ID_EXTENDED = 0x80000000,
    CANDLE_ID_RTR      = 0x40000000,
    CANDLE_ID_ERR      = 0x20000000
};

enum {
    CANDLE_FLAG_OVERFLOW = (1<<0),
    CANDLE_FLAG_FD       = (1<<1),  /* is a CAN-FD frame */
    CANDLE_FLAG_BRS      = (1<<2),  /* bit rate switch (for CAN-FD frames) */
    CANDLE_FLAG_ESI      = (1<<3)   /* error state indicator (for CAN-FD frames) */
};

typedef enum {
    CANDLE_MODE_NORMAL        = 0x00,
    CANDLE_MODE_LISTEN_ONLY   = 0x01,
    CANDLE_MODE_LOOP_BACK     = 0x02,
    CANDLE_MODE_TRIPLE_SAMPLE = 0x04,
    CANDLE_MODE_ONE_SHOT      = 0x08,
    CANDLE_MODE_HW_TIMESTAMP  = 0x10,
    CANDLE_MODE_IDENTIFY      = 0x20,
    CANDLE_MODE_USER_ID       = 0x40,
    CANDLE_MODE_PAD_PKTS_TO_MAX_PKT_SIZE = 0x80,
    CANDLE_MODE_FD            = 0x100,
} candle_mode_t;

typedef enum {
    CANDLE_ERR_OK                  =  0,
    CANDLE_ERR_CREATE_FILE         =  1,
    CANDLE_ERR_WINUSB_INITIALIZE   =  2,
    CANDLE_ERR_QUERY_INTERFACE     =  3,
    CANDLE_ERR_QUERY_PIPE          =  4,
    CANDLE_ERR_PARSE_IF_DESCR      =  5,
    CANDLE_ERR_SET_HOST_FORMAT     =  6,
    CANDLE_ERR_GET_DEVICE_INFO     =  7,
    CANDLE_ERR_GET_BITTIMING_CONST =  8,
    CANDLE_ERR_PREPARE_READ        =  9,
    CANDLE_ERR_SET_DEVICE_MODE     = 10,
    CANDLE_ERR_SET_BITTIMING       = 11,
    CANDLE_ERR_BITRATE_FCLK        = 12,
    CANDLE_ERR_BITRATE_UNSUPPORTED = 13,
    CANDLE_ERR_SEND_FRAME          = 14,
    CANDLE_ERR_READ_TIMEOUT        = 15,
    CANDLE_ERR_READ_WAIT           = 16,
    CANDLE_ERR_READ_RESULT         = 17,
    CANDLE_ERR_READ_SIZE           = 18,
    CANDLE_ERR_SETUPDI_IF_DETAILS  = 19,
    CANDLE_ERR_SETUPDI_IF_DETAILS2 = 20,
    CANDLE_ERR_MALLOC              = 21,
    CANDLE_ERR_PATH_LEN            = 22,
    CANDLE_ERR_CLSID               = 23,
    CANDLE_ERR_GET_DEVICES         = 24,
    CANDLE_ERR_SETUPDI_IF_ENUM     = 25,
    CANDLE_ERR_SET_TIMESTAMP_MODE  = 26,
    CANDLE_ERR_DEV_OUT_OF_RANGE    = 27,
	CANDLE_ERR_GET_TIMESTAMP       = 28,
    CANDLE_ERR_SET_PIPE_RAW_IO     = 29,
    CANDLE_ERR_GET_DATA_BITTIMING_CONST = 30,
} candle_err_t;




#define DECLARE_FLEX_ARRAY(_t, _n) \
        struct { \
            struct { } __dummy_ ## _n; \
            _t _n[0]; \
        }

#pragma pack(push,1)

typedef struct classic_can {
    uint8_t data[8];
    uint32_t timestamp_us;
    uint8_t dummy[56];
} classic_can_t;

typedef struct canfd {
    uint8_t data[64];
    uint32_t timestamp_us;
}canfd_t;

typedef union {
    classic_can_t classic_can;
    canfd_t canfd;
}msg_t; 

typedef struct {
    uint32_t echo_id;
    uint32_t can_id;
    uint8_t can_dlc;
    uint8_t channel;
    uint8_t flags;
    uint8_t reserved;
    msg_t msg;
} candle_frame_t;

typedef struct {
    uint32_t feature;
    uint32_t fclk_can;
    uint32_t tseg1_min;
    uint32_t tseg1_max;
    uint32_t tseg2_min;
    uint32_t tseg2_max;
    uint32_t sjw_max;
    uint32_t brp_min;
    uint32_t brp_max;
    uint32_t brp_inc;
} candle_capability_t;

typedef struct {
    uint32_t feature;
    uint32_t fclk_can;
    uint32_t tseg1_min;
    uint32_t tseg1_max;
    uint32_t tseg2_min;
    uint32_t tseg2_max;
    uint32_t sjw_max;
    uint32_t brp_min;
    uint32_t brp_max;
    uint32_t brp_inc;
    uint32_t dttseg1_min;
    uint32_t dttseg1_max;
    uint32_t dttseg2_min;
    uint32_t dttseg2_max;
    uint32_t dtsjw_max;
    uint32_t dtbrp_min;
    uint32_t dtbrp_max;
    uint32_t dtbrp_inc;
} candle_capability_extended_t;


typedef struct {
    uint32_t prop_seg;
    uint32_t phase_seg1;
    uint32_t phase_seg2;
    uint32_t sjw;
    uint32_t brp;
} candle_bittiming_t;

#pragma pack(pop)

#define DLL

bool __stdcall DLL candle_list_scan(candle_list_handle list);
// bool __stdcall DLL candle_list_free(candle_list_handle list);
bool __stdcall DLL candle_list_length(candle_list_handle list, uint8_t *len);

bool __stdcall DLL candle_dev_get(candle_list_handle list, uint8_t dev_num, candle_handle hdev);
bool __stdcall DLL candle_dev_get_state(candle_handle hdev, candle_devstate_t *state);
wchar_t* __stdcall DLL candle_dev_get_path(candle_handle hdev);
char* __stdcall DLL candle_dev_get_friendly_name(candle_handle hdev);
bool __stdcall DLL candle_dev_open(candle_handle hdev);
bool __stdcall DLL candle_dev_get_timestamp_us(candle_handle hdev, uint32_t *timestamp_us);
bool __stdcall DLL candle_dev_close(candle_handle hdev);
bool __stdcall DLL candle_dev_free(candle_handle hdev);

bool __stdcall DLL candle_channel_count(candle_handle hdev, uint8_t *num_channels);
bool __stdcall DLL candle_channel_get_capabilities(candle_handle hdev, uint8_t ch, candle_capability_t *cap);
bool __stdcall DLL candle_channel_set_timing(candle_handle hdev, uint8_t ch, candle_bittiming_t *data);
bool __stdcall DLL candle_channel_set_bitrate(candle_handle hdev, uint8_t ch, uint32_t bitrate);
bool __stdcall DLL candle_channel_set_data_timing(candle_handle hdev, uint8_t ch, candle_bittiming_t *data);
bool __stdcall DLL candle_channel_get_data_capabilities(candle_handle hdev, uint8_t ch, candle_capability_t *cap);
bool __stdcall DLL candle_channel_start(candle_handle hdev, uint8_t ch, uint32_t flags);
bool __stdcall DLL candle_channel_stop(candle_handle hdev, uint8_t ch);

bool __stdcall DLL candle_frame_send(candle_handle hdev, uint8_t ch, candle_frame_t *frame);
bool __stdcall DLL candle_frame_read(candle_handle hdev, candle_frame_t *frame, uint32_t timeout_ms);

candle_frametype_t __stdcall DLL candle_frame_type(candle_frame_t *frame);
uint32_t __stdcall DLL candle_frame_id(candle_frame_t *frame);
bool __stdcall DLL candle_frame_is_extended_id(candle_frame_t *frame);
bool __stdcall DLL candle_frame_is_rtr(candle_frame_t *frame);
uint8_t __stdcall DLL candle_frame_dlc(candle_frame_t *frame);
uint8_t* __stdcall DLL candle_frame_data(candle_frame_t *frame);
uint32_t __stdcall DLL candle_frame_timestamp_us(candle_frame_t *frame);

candle_err_t __stdcall DLL candle_dev_last_error(candle_handle hdev);

bool __stdcall DLL candle_channel_get_can_resister_enable_state(candle_handle hdev, uint8_t ch, uint8_t *enable);
bool __stdcall DLL candle_channel_set_can_resister_enable_state(candle_handle hdev, uint8_t ch, uint8_t *enable);
bool __stdcall DLL candle_channel_set_interfacenumber_endpoints(candle_handle hdev, uint8_t ch);

#ifdef __cplusplus
}
#endif

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
#include <windows.h>
#include <winbase.h>
#include <winusb.h>
#include <setupapi.h>
#include <devguid.h>
#include <regstr.h>

#undef __CRT__NO_INLINE
#include <strsafe.h>
#define __CRT__NO_INLINE

#include "candle.h"

#define CANDLE_MAX_DEVICES 32
#define CANDLE_URB_COUNT 30

/* defined rx_buf_size, USB2.0 480Mbps MPS is 512 */
#define CANDLE_RX_BUF_SIZE 512 

#pragma pack(push,1)

typedef struct {
    uint32_t byte_order;
} candle_host_config_t;

typedef struct {
    uint8_t reserved1;
    uint8_t reserved2;
    uint8_t reserved3;
    uint8_t icount;
    uint32_t sw_version;
    uint32_t hw_version;
} candle_device_config_t;

typedef struct {
    uint32_t mode;
    uint32_t flags;
} candle_device_mode_t;

#pragma pack(pop)


typedef struct {
    OVERLAPPED ovl;
    uint8_t buf[CANDLE_RX_BUF_SIZE];
} canlde_rx_urb;

typedef struct {
    uint16_t path[256];
    candle_devstate_t state;
    candle_err_t last_error;
    DWORD error;

    HANDLE deviceHandle;
    WINUSB_INTERFACE_HANDLE winUSBHandle;
    UCHAR interfaceNumber;
    UCHAR bulkInPipe;
    UCHAR bulkOutPipe;

    candle_device_config_t dconf;
    candle_capability_t bt_const;
    candle_capability_t data_bt_const;
    canlde_rx_urb rxurbs[CANDLE_URB_COUNT];
    HANDLE rxevents[CANDLE_URB_COUNT];
} candle_device_t;

typedef struct {
    uint8_t num_devices;
    candle_err_t last_error;
    candle_device_t dev[CANDLE_MAX_DEVICES];
} candle_list_t;


typedef candle_list_t* candle_list_ptr_t;
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

#include "candle.h"
#include <stdlib.h>
#include "candle_defs.h"
#include "candle_ctrl_req.h"
#include "ch_9.h"

static bool candle_dev_interal_open(candle_handle hdev);

static bool candle_read_di(HDEVINFO hdi, SP_DEVICE_INTERFACE_DATA interfaceData, candle_device_t *dev)
{
    /* get required length first (this call always fails with an error) */
    ULONG requiredLength=0;
    SetupDiGetDeviceInterfaceDetail(hdi, &interfaceData, NULL, 0, &requiredLength, NULL);
    if (GetLastError() != ERROR_INSUFFICIENT_BUFFER) {
        dev->last_error = CANDLE_ERR_SETUPDI_IF_DETAILS;
        return false;
    }

    PSP_DEVICE_INTERFACE_DETAIL_DATA detail_data =
        (PSP_DEVICE_INTERFACE_DETAIL_DATA) LocalAlloc(LMEM_FIXED, requiredLength);

    if (detail_data != NULL) {
        detail_data->cbSize = sizeof(SP_DEVICE_INTERFACE_DETAIL_DATA);
    } else {
        dev->last_error = CANDLE_ERR_MALLOC;
        return false;
    }

    bool retval = true;
    ULONG length = requiredLength;
    if (!SetupDiGetDeviceInterfaceDetail(hdi, &interfaceData, detail_data, length, &requiredLength, NULL) ) {
        dev->last_error = CANDLE_ERR_SETUPDI_IF_DETAILS2;
        retval = false;
    } else if (FAILED(StringCchCopy(dev->path, sizeof(dev->path), detail_data->DevicePath))) {
        dev->last_error = CANDLE_ERR_PATH_LEN;
        retval = false;
    }

    LocalFree(detail_data);

    if (!retval) {
        return false;
    }

    /* try to open to read device infos and see if it is avail */
    if (candle_dev_interal_open(dev)) {
        dev->state = CANDLE_DEVSTATE_AVAIL;
        candle_dev_close(dev);
    } else {
        dev->state = CANDLE_DEVSTATE_INUSE;
    }

    dev->last_error = CANDLE_ERR_OK;
    return true;
}

bool __stdcall candle_list_scan(candle_list_handle list)
{
    if (list==NULL) {
        return false;
    }

    candle_list_t *l = (candle_list_t *)list;

    // Correctly initialize num_devices to 0
    l->num_devices = 0;
    l->last_error = CANDLE_ERR_OK;

   

   GUID guid;
    if (CLSIDFromString(L"{c15b4308-04d3-11e6-b3ea-6057189e6443}", &guid) != NOERROR) {
        l->last_error = CANDLE_ERR_CLSID;
        return false;
    }

    HDEVINFO hdi = SetupDiGetClassDevs(&guid, NULL, NULL, DIGCF_PRESENT | DIGCF_DEVICEINTERFACE);
    if (hdi == INVALID_HANDLE_VALUE) {
        l->last_error = CANDLE_ERR_GET_DEVICES;
        return false;
    }

    bool rv = false;
    for (unsigned i=0; i<CANDLE_MAX_DEVICES; i++) {

        SP_DEVICE_INTERFACE_DATA interfaceData;
        interfaceData.cbSize = sizeof(SP_DEVICE_INTERFACE_DATA);

        if (SetupDiEnumDeviceInterfaces(hdi, NULL, &guid, i, &interfaceData)) {

            if (!candle_read_di(hdi, interfaceData, &l->dev[i])) {
                l->last_error = l->dev[i].last_error;
                rv = false;
                break;
            }

        } else {

            DWORD err = GetLastError();
            if (err==ERROR_NO_MORE_ITEMS) {
                l->num_devices = i;
                l->last_error = CANDLE_ERR_OK;
                rv = true;
            } else {
                l->last_error = CANDLE_ERR_SETUPDI_IF_ENUM;
                rv = false;
            }
            break;

        }

    }

    SetupDiDestroyDeviceInfoList(hdi);

    return rv;

}

bool __stdcall DLL candle_list_length(candle_list_handle list, uint8_t *len)
{
    candle_list_t *l = (candle_list_t *)list;
    *len = l->num_devices;
    return true;
}

bool __stdcall DLL candle_dev_get(candle_list_handle list, uint8_t dev_num, candle_handle hdev)
{
    candle_list_t *l = (candle_list_t *)list;
    if (l==NULL) {
        return false;
    }

    if (dev_num >= CANDLE_MAX_DEVICES) {
        l->last_error = CANDLE_ERR_DEV_OUT_OF_RANGE;
        return false;
    }

    memcpy(hdev, &l->dev[dev_num], sizeof(candle_device_t));
    l->last_error = CANDLE_ERR_OK;
    ((candle_device_t*)hdev)->last_error = CANDLE_ERR_OK;
    return true;
}


bool __stdcall DLL candle_dev_get_state(candle_handle hdev, candle_devstate_t *state)
{
    if (hdev==NULL) {
        return false;
    } else {
        candle_device_t *dev = (candle_device_t*)hdev;
        *state = dev->state;
        return true;
    }
}

wchar_t* __stdcall DLL candle_dev_get_path(candle_handle hdev)
{
    if (hdev==NULL) {
        return NULL;
    } else {
        candle_device_t *dev = (candle_device_t*)hdev;
        return dev->path;
    }
}

static bool candle_dev_interal_open(candle_handle hdev)
{
    candle_device_t *dev = (candle_device_t*)hdev;

    memset(dev->rxevents, 0, sizeof(dev->rxevents));
    memset(dev->rxurbs, 0, sizeof(dev->rxurbs));

    dev->deviceHandle = CreateFile(
        dev->path,
        GENERIC_WRITE | GENERIC_READ,
        FILE_SHARE_WRITE | FILE_SHARE_READ,
        NULL,
        OPEN_EXISTING,
        FILE_ATTRIBUTE_NORMAL | FILE_FLAG_OVERLAPPED,
        NULL
    );

    if (dev->deviceHandle == INVALID_HANDLE_VALUE) {
        dev->last_error = CANDLE_ERR_CREATE_FILE;
        return false;
    }

    if (!WinUsb_Initialize(dev->deviceHandle, &dev->winUSBHandle)) {
        dev->last_error = CANDLE_ERR_WINUSB_INITIALIZE;
        goto close_handle;
    }

    USB_INTERFACE_DESCRIPTOR ifaceDescriptor;
    if (!WinUsb_QueryInterfaceSettings(dev->winUSBHandle, 0, &ifaceDescriptor)) {
        dev->last_error = CANDLE_ERR_QUERY_INTERFACE;
        goto winusb_free;
    }

    dev->interfaceNumber = ifaceDescriptor.bInterfaceNumber;
    unsigned pipes_found = 0;

    for (uint8_t i=0; i<ifaceDescriptor.bNumEndpoints; i++) {

        WINUSB_PIPE_INFORMATION pipeInfo;
        if (!WinUsb_QueryPipe(dev->winUSBHandle, 0, i, &pipeInfo)) {
            dev->last_error = CANDLE_ERR_QUERY_PIPE;
            goto winusb_free;
        }

        if (pipeInfo.PipeType == UsbdPipeTypeBulk && USB_ENDPOINT_DIRECTION_IN(pipeInfo.PipeId)) {
            dev->bulkInPipe = pipeInfo.PipeId;
            pipes_found++;
        } else if (pipeInfo.PipeType == UsbdPipeTypeBulk && USB_ENDPOINT_DIRECTION_OUT(pipeInfo.PipeId)) {
            dev->bulkOutPipe = pipeInfo.PipeId;
            pipes_found++;
        } else {
            dev->last_error = CANDLE_ERR_PARSE_IF_DESCR;
            goto winusb_free;
        }

    }

    if (pipes_found != 2) {
        dev->last_error = CANDLE_ERR_PARSE_IF_DESCR;
        goto winusb_free;
    }

    char use_raw_io = 1;
    if (!WinUsb_SetPipePolicy(dev->winUSBHandle, dev->bulkInPipe, RAW_IO, sizeof(use_raw_io), &use_raw_io)) {
        dev->last_error = CANDLE_ERR_SET_PIPE_RAW_IO;
        goto winusb_free;
    } 

    if (!candle_ctrl_set_host_format(dev)) {
        goto winusb_free;
    }

    if (!candle_ctrl_get_config(dev, &dev->dconf)) {
        goto winusb_free;
    }

    if (!candle_ctrl_get_capability(dev, 0, &dev->bt_const)) {
        dev->last_error = CANDLE_ERR_GET_BITTIMING_CONST;
        goto winusb_free;
    }
    candle_capability_extended_t cap_externd;
    if (dev->bt_const.feature & CANDLE_MODE_FD) {
        if (!candle_ctrl_get_capability_externd(dev, 0, &cap_externd)) {
            dev->last_error = CANDLE_ERR_GET_DATA_BITTIMING_CONST;
            goto winusb_free;
        }
        dev->data_bt_const.feature = cap_externd.feature;
        dev->data_bt_const.fclk_can = cap_externd.fclk_can;
        dev->data_bt_const.brp_inc = cap_externd.brp_inc;
        dev->data_bt_const.brp_max = cap_externd.brp_max;
        dev->data_bt_const.brp_min = cap_externd.brp_min;
        dev->data_bt_const.sjw_max = cap_externd.sjw_max;
        dev->data_bt_const.tseg1_max = cap_externd.tseg1_max;
        dev->data_bt_const.tseg1_min = cap_externd.tseg1_min;
        dev->data_bt_const.tseg2_max = cap_externd.tseg2_max;
        dev->data_bt_const.tseg2_min = cap_externd.tseg2_min;
    }

    dev->last_error = CANDLE_ERR_OK;
    return true;

winusb_free:
    WinUsb_Free(dev->winUSBHandle);

close_handle:
    CloseHandle(dev->deviceHandle);
    return false;

}

static bool candle_prepare_read(candle_device_t *dev, unsigned urb_num)
{
    bool rc = WinUsb_ReadPipe(
        dev->winUSBHandle,
        dev->bulkInPipe,
        dev->rxurbs[urb_num].buf,
        sizeof(dev->rxurbs[urb_num].buf),
        NULL,
        &dev->rxurbs[urb_num].ovl
    );

    if (rc || (GetLastError()!=ERROR_IO_PENDING)) {
        dev->last_error = CANDLE_ERR_PREPARE_READ;
        return false;
    } else {
        dev->last_error = CANDLE_ERR_OK;
        return true;
    }
}

static bool candle_close_rxurbs(candle_device_t *dev)
{
    for (unsigned i=0; i<CANDLE_URB_COUNT; i++) {
        if (dev->rxevents[i] != NULL) {
            CloseHandle(dev->rxevents[i]);
        }
    }
    return true;
}


bool __stdcall DLL candle_dev_open(candle_handle hdev)
{
    candle_device_t *dev = (candle_device_t*)hdev;

    if (candle_dev_interal_open(dev)) {
        for (unsigned i=0; i<CANDLE_URB_COUNT; i++) {
            HANDLE ev = CreateEvent(NULL, true, false, NULL);
            dev->rxevents[i] = ev;
            dev->rxurbs[i].ovl.hEvent = ev;
            if (!candle_prepare_read(dev, i)) {
                candle_close_rxurbs(dev);
                return false; // keep last_error from prepare_read call
            }
        }
        dev->last_error = CANDLE_ERR_OK;
        return true;
    } else {
        return false; // keep last_error from open_device call
    }

}

bool __stdcall DLL candle_dev_get_timestamp_us(candle_handle hdev, uint32_t *timestamp_us)
{
	return candle_ctrl_get_timestamp(hdev, timestamp_us);
}

bool __stdcall DLL candle_dev_close(candle_handle hdev)
{
    candle_device_t *dev = (candle_device_t*)hdev;

    candle_close_rxurbs(dev);

    WinUsb_Free(dev->winUSBHandle);
    dev->winUSBHandle = NULL;
    CloseHandle(dev->deviceHandle);
    dev->deviceHandle = NULL;

    dev->last_error = CANDLE_ERR_OK;
    return true;
}

bool __stdcall DLL candle_dev_free(candle_handle hdev)
{
    free(hdev);
    return true;
}

candle_err_t __stdcall DLL candle_dev_last_error(candle_handle hdev)
{
    candle_device_t *dev = (candle_device_t*)hdev;
    return dev->last_error;
}

bool __stdcall DLL candle_channel_count(candle_handle hdev, uint8_t *num_channels)
{
    // TODO check if info was already read from device; try to do so; throw error...
    candle_device_t *dev = (candle_device_t*)hdev;
    *num_channels = dev->dconf.icount+1;
    return true;
}

bool __stdcall DLL candle_channel_get_capabilities(candle_handle hdev, uint8_t ch, candle_capability_t *cap)
{
    // TODO check if info was already read from device; try to do so; throw error...
    candle_device_t *dev = (candle_device_t*)hdev;
    memcpy(cap, &dev->bt_const.feature, sizeof(candle_capability_t));
    return true;
}

bool __stdcall DLL candle_channel_set_timing(candle_handle hdev, uint8_t ch, candle_bittiming_t *data)
{
    // TODO ensure device is open, check channel count..
    candle_device_t *dev = (candle_device_t*)hdev;
    return candle_ctrl_set_bittiming(dev, ch, data);
}

bool __stdcall DLL candle_channel_set_bitrate(candle_handle hdev, uint8_t ch, uint32_t bitrate)
{
    // TODO ensure device is open, check channel count..
    candle_device_t *dev = (candle_device_t*)hdev;

    if (dev->bt_const.fclk_can != 48000000) {
        /* this function only works for the candleLight base clock of 48MHz */
        dev->last_error = CANDLE_ERR_BITRATE_FCLK;
        return false;
    }

    candle_bittiming_t t;
    t.prop_seg = 1;
    t.sjw = 1;
    t.phase_seg1 = 13 - t.prop_seg;
    t.phase_seg2 = 2;

    switch (bitrate) {
        case 10000:
            t.brp = 300;
            break;

        case 20000:
            t.brp = 150;
            break;

        case 50000:
            t.brp = 60;
            break;

        case 83333:
            t.brp = 36;
            break;

        case 100000:
            t.brp = 30;
            break;

        case 125000:
            t.brp = 24;
            break;

        case 250000:
            t.brp = 12;
            break;

        case 500000:
            t.brp = 6;
            break;

        case 800000:
            t.brp = 4;
            t.phase_seg1 = 12 - t.prop_seg;
            t.phase_seg2 = 2;
            break;

        case 1000000:
            t.brp = 3;
            break;

        default:
            dev->last_error = CANDLE_ERR_BITRATE_UNSUPPORTED;
            return false;
    }

    return candle_ctrl_set_bittiming(dev, ch, &t);
}

bool __stdcall DLL candle_channel_set_data_timing(candle_handle hdev, uint8_t ch, candle_bittiming_t *data)
{
    candle_device_t *dev = (candle_device_t*)hdev;
    return candle_ctrl_set_data_bittiming(dev, ch, data);
}

bool __stdcall DLL candle_channel_get_data_capabilities(candle_handle hdev, uint8_t ch, candle_capability_t *cap)
{
    candle_device_t *dev = (candle_device_t*)hdev;
    memcpy(cap, &dev->data_bt_const.feature, sizeof(candle_capability_t));
    return true;
}

bool __stdcall DLL candle_channel_start(candle_handle hdev, uint8_t ch, uint32_t flags)
{
    // TODO ensure device is open, check channel count..
    candle_device_t *dev = (candle_device_t*)hdev;
    flags |= CANDLE_MODE_HW_TIMESTAMP;
    return candle_ctrl_set_device_mode(dev, ch, CANDLE_DEVMODE_START, flags);
}

bool __stdcall DLL candle_channel_stop(candle_handle hdev, uint8_t ch)
{
    // TODO ensure device is open, check channel count..
    candle_device_t *dev = (candle_device_t*)hdev;
    return candle_ctrl_set_device_mode(dev, ch, CANDLE_DEVMODE_RESET, 0);
}

bool __stdcall DLL candle_frame_send(candle_handle hdev, uint8_t ch, candle_frame_t *frame)
{
    // TODO ensure device is open, check channel count..

    candle_device_t *dev = (candle_device_t*)hdev;

    unsigned long bytes_sent = 0;
    uint32_t size;

    frame->echo_id = 0;
    frame->channel = ch;

    if (frame->flags & CANDLE_FLAG_FD) {
        size = 12 + sizeof(struct canfd);
    } else {
        size = 12 + sizeof(struct classic_can);
    }

    bool rc = WinUsb_WritePipe(
        dev->winUSBHandle,
        dev->bulkOutPipe,
        (uint8_t*)frame,
        size,
        &bytes_sent,
        0
    );
     
    dev->last_error = rc ? CANDLE_ERR_OK : CANDLE_ERR_SEND_FRAME;
    return rc;

}

bool __stdcall DLL candle_frame_read(candle_handle hdev, candle_frame_t *frame, uint32_t timeout_ms)
{
    // TODO ensure device is open..
    candle_device_t *dev = (candle_device_t*)hdev;
    uint8_t  size;

    DWORD wait_result = WaitForMultipleObjects(CANDLE_URB_COUNT, dev->rxevents, false, timeout_ms);
    if (wait_result == WAIT_TIMEOUT) {
        // dev->last_error = CANDLE_ERR_READ_TIMEOUT;
        return false;
    }

    if ( (wait_result < WAIT_OBJECT_0) || (wait_result >= WAIT_OBJECT_0 + CANDLE_URB_COUNT) ) {
        dev->last_error = CANDLE_ERR_READ_WAIT;
        return false;
    }

    DWORD urb_num = wait_result - WAIT_OBJECT_0;
    DWORD bytes_transfered;

    if (!WinUsb_GetOverlappedResult(dev->winUSBHandle, &dev->rxurbs[urb_num].ovl, &bytes_transfered, false)) {
        candle_prepare_read(dev, urb_num);
        dev->last_error = CANDLE_ERR_READ_RESULT;
        return false;
    }

    if (bytes_transfered < (12 + 8)) {
        candle_prepare_read(dev, urb_num);
        dev->last_error = CANDLE_ERR_READ_SIZE;
        return false;
    }

    if (bytes_transfered < (12 + 8 + 4)) {
        frame->msg.classic_can.timestamp_us = 0;
    }

    memcpy(frame, dev->rxurbs[urb_num].buf, sizeof(*frame));

    if (frame->can_dlc > 8) {
        switch (frame->can_dlc) {
        case 0x09:
            size = 12;
            break;
        case 0x0A:
            size = 16;
            break;
        case 0x0B:
            size = 20;
            break;
        case 0x0C:
            size = 24;
            break;
        case 0x0D:
            size = 32;
            break;
        case 0x0E:
            size = 48;
            break;
        case 0x0F:
            size = 64;
            break;
        default:
            size = 0;
            break;
        }
    } else {
        size = frame->can_dlc;
    }
    if (bytes_transfered < (12 + size + 4)) {
        frame->msg.canfd.timestamp_us = 0;
    }
    return candle_prepare_read(dev, urb_num);
}

candle_frametype_t __stdcall DLL candle_frame_type(candle_frame_t *frame)
{
    if (frame->echo_id != 0xFFFFFFFF) {
        return CANDLE_FRAMETYPE_ECHO;
    };

    if (frame->can_id & CANDLE_ID_ERR) {
        return CANDLE_FRAMETYPE_ERROR;
    }

    return CANDLE_FRAMETYPE_RECEIVE;
}

uint32_t __stdcall DLL candle_frame_id(candle_frame_t *frame)
{
    return frame->can_id & 0x1FFFFFFF;
}

bool __stdcall DLL candle_frame_is_extended_id(candle_frame_t *frame)
{
    return (frame->can_id & CANDLE_ID_EXTENDED) != 0;
}

bool __stdcall DLL candle_frame_is_rtr(candle_frame_t *frame)
{
    return (frame->can_id & CANDLE_ID_RTR) != 0;
}

uint8_t __stdcall DLL candle_frame_dlc(candle_frame_t *frame)
{
    return frame->can_dlc;
}

uint8_t* __stdcall DLL candle_frame_data(candle_frame_t *frame)
{
    if (frame->flags & CANDLE_FLAG_FD) {
        return frame->msg.canfd.data;
    } else {
        return frame->msg.classic_can.data;
    }
}

uint32_t __stdcall DLL candle_frame_timestamp_us(candle_frame_t *frame)
{
    if (frame->flags & CANDLE_FLAG_FD) {
        return frame->msg.canfd.timestamp_us;
    } else {
        return frame->msg.classic_can.timestamp_us;
    }
}

bool __stdcall DLL candle_channel_get_can_resister_enable_state(candle_handle hdev, uint8_t ch, uint8_t *enable)
{
    candle_device_t *dev = (candle_device_t*)hdev;
    candle_ctrl_get_can_resister_enable_state(dev, ch, enable);
}

bool __stdcall DLL candle_channel_set_can_resister_enable_state(candle_handle hdev, uint8_t ch, uint8_t *enable)
{
    candle_device_t *dev = (candle_device_t*)hdev;
    return candle_ctrl_set_can_resister_enable_state(dev, ch, enable);
}

bool __stdcall DLL candle_channel_set_interfacenumber_endpoints(candle_handle hdev, uint8_t ch)
{
    candle_device_t *dev = (candle_device_t*)hdev;
    return candle_ctrl_get_can_interfacenumber_endpoint(dev, ch);
}

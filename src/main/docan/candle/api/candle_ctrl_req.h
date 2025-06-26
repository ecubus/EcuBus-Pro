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

#include "candle_defs.h"

enum {
    CANDLE_DEVMODE_RESET = 0,
    CANDLE_DEVMODE_START = 1
};

bool candle_ctrl_set_host_format(candle_device_t *dev);
bool candle_ctrl_set_device_mode(candle_device_t *dev, uint8_t channel, uint32_t mode, uint32_t flags);
bool candle_ctrl_get_config(candle_device_t *dev, candle_device_config_t *dconf);
bool candle_ctrl_get_capability(candle_device_t *dev, uint8_t channel, candle_capability_t *data);
bool candle_ctrl_set_bittiming(candle_device_t *dev, uint8_t channel, candle_bittiming_t *data);
bool candle_ctrl_set_data_bittiming(candle_device_t *dev, uint8_t channel, candle_bittiming_t *data);
bool candle_ctrl_get_timestamp(candle_device_t *dev, uint32_t *current_timestamp);
bool candle_ctrl_get_can_resister_enable_state(candle_device_t *dev, uint8_t channel, uint8_t *enable);
bool candle_ctrl_set_can_resister_enable_state(candle_device_t *dev, uint8_t channel, uint8_t *enable);
bool candle_ctrl_get_can_interfacenumber_endpoint(candle_device_t *dev, uint8_t channel);
bool candle_ctrl_get_capability_externd(candle_device_t *dev, uint8_t channel, candle_capability_extended_t *data);

/**
  ******************************************************************************
  * @file    ir_sniffer.h
  * $Author: wdluo $
  * $Revision: 447 $
  * $Date:: 2013-06-29 18:24:57 +0800 #$
  * @brief   ir sniffer相关函数和数据类型定义.
  ******************************************************************************
  * @attention
  *
  *<center><a href="http:\\www.toomoss.com">http://www.toomoss.com</a></center>
  *<center>All Rights Reserved</center></h3>
  * 
  ******************************************************************************
  */
#ifndef __IR_SNIFFER_H_
#define __IR_SNIFFER_H_

#include <stdint.h>
#ifndef OS_UNIX
#include <Windows.h>
#else
#include <unistd.h>
#ifndef WINAPI
#define WINAPI
#endif
#endif

#include "usb2ir.h"

typedef struct _IR_RESULTS{
    ir_type_t              decode_type;  // UNKNOWN, NEC, SONY, RC5, ...
    unsigned int           address;      // Used by Panasonic & Sharp [16-bits]
    unsigned int           value;        // Decoded value [max 32-bits]
    int                    bits;         // Number of bits in decoded value
    volatile unsigned int  *rawbuf;      // Raw intervals in 1uS ticks
    int                    rawlen;       // Number of records in rawbuf
    int                    overflow;     // true iff IR raw code too long
}IR_RESULTS,*PIR_RESULTS;

//解析到I2C数据后的回调函数
typedef  int (WINAPI IR_GET_DATA_HANDLE)(int DevHandle,int ChannelIndex,IR_RESULTS *pIRResults);

//定义函数返回错误代码
#define SUCCESS             (0)   //函数执行成功
#define ERR_NOT_SUPPORT     (-1)  //适配器不支持该函数
#define ERR_USB_WRITE_FAIL  (-2)  //USB写数据失败
#define ERR_USB_READ_FAIL   (-3)  //USB读数据失败
#define ERR_CMD_FAIL        (-4)  //命令执行失败

#ifdef __cplusplus
extern "C"
{
#endif
    int WINAPI IR_SnifferStart(int DevHandle,unsigned char Channel,IR_GET_DATA_HANDLE *pGetIRDataHandle);
    int WINAPI IR_SnifferStop(int DevHandle);
#ifdef __cplusplus
}
#endif

#endif


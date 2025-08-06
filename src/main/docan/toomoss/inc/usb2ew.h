/**
  ******************************************************************************
  * @file    usb2ew.h
  * $Author: wdluo $
  * $Revision: 447 $
  * $Date:: 2013-06-29 18:24:57 +0800 #$
  * @brief   usb2ew相关函数和数据类型定义.
  ******************************************************************************
  * @attention
  *
  *<center><a href="http:\\www.toomoss.com">http://www.toomoss.com</a></center>
  *<center>All Rights Reserved</center></h3>
  * 
  ******************************************************************************
  */
#ifndef __USB2EW_H_
#define __USB2EW_H_

#include <stdint.h>
#ifndef OS_UNIX
#include <Windows.h>
#else
#include <unistd.h>
#ifndef WINAPI
#define WINAPI
#endif
#endif


//定义函数返回错误代码
#define EW_SUCCESS             (0)   //函数执行成功
#define EW_ERR_NOT_SUPPORT     (-1)  //适配器不支持该函数
#define EW_ERR_USB_WRITE_FAIL  (-2)  //USB写数据失败
#define EW_ERR_USB_READ_FAIL   (-3)  //USB读数据失败
#define EW_ERR_CMD_FAIL        (-4)  //命令执行失败

//通道定义
#define EW_CH0             (0x01<<0)
#define EW_CH1             (0x01<<1)
#define EW_CH2             (0x01<<2)
#define EW_CH3             (0x01<<3)
#define EW_CH4             (0x01<<4)
#define EW_CH5             (0x01<<5)
#define EW_CH6             (0x01<<6)
#define EW_CH7             (0x01<<7)
#define EW_CH8             (0x01<<8)
#define EW_CH9             (0x01<<9)
#define EW_CH10            (0x01<<10)
#define EW_CH11            (0x01<<11)
#define EW_CH12            (0x01<<12)
#define EW_CH13            (0x01<<13)
#define EW_CH14            (0x01<<14)
#define EW_CH15            (0x01<<15)

//时序定义
typedef struct __EW_TIMING{
  int tDS;          //Data start time
  int tEOD_H;       //End of data high time 
  int tEOD_L;       //End of data low time
  int tH_LB;        //High time low bit(0)
  int tL_LB;        //Low time low bit(0)
  int tH_HB;        //High time high bit(1)
  int tL_HB;        //Low time high bit(1)
}EW_TIMING,*PEW_TIMING;

#ifdef __cplusplus
extern "C"
{
#endif

int WINAPI EW_Init(int DevHandle, unsigned int ChannelMask, EW_TIMING *pEWTiming);
int WINAPI EW_WriteBytes(int DevHandle, unsigned int ChannelMask,unsigned char Address,unsigned char WriteData);


#ifdef __cplusplus
}
#endif
#endif


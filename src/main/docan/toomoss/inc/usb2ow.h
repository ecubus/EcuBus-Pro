/**
  ******************************************************************************
  * @file    usb2ow.h
  * $Author: wdluo $
  * $Revision: 447 $
  * $Date:: 2013-06-29 18:24:57 +0800 #$
  * @brief   usb2ow相关函数和数据类型定义.
  ******************************************************************************
  * @attention
  *
  *<center><a href="http:\\www.toomoss.com">http://www.toomoss.com</a></center>
  *<center>All Rights Reserved</center></h3>
  * 
  ******************************************************************************
  */
#ifndef __USB2OW_H_
#define __USB2OW_H_

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
#define OW_SUCCESS             (0)   //函数执行成功
#define OW_ERR_NOT_SUPPORT     (-1)  //适配器不支持该函数
#define OW_ERR_USB_WRITE_FAIL  (-2)  //USB写数据失败
#define OW_ERR_USB_READ_FAIL   (-3)  //USB读数据失败
#define OW_ERR_CMD_FAIL        (-4)  //命令执行失败
#define OW_ERR_NO_ACK          (-5)  //无从设备应答

//通道定义
#define OW_CH0             (0x01<<0)
#define OW_CH1             (0x01<<1)
#define OW_CH2             (0x01<<2)
#define OW_CH3             (0x01<<3)
#define OW_CH4             (0x01<<4)
#define OW_CH5             (0x01<<5)
#define OW_CH6             (0x01<<6)
#define OW_CH7             (0x01<<7)
#define OW_CH8             (0x01<<8)
#define OW_CH9             (0x01<<9)
#define OW_CH10             (0x01<<10)
#define OW_CH11             (0x01<<11)
#define OW_CH12             (0x01<<12)
#define OW_CH13            (0x01<<13)
#define OW_CH14             (0x01<<14)
#define OW_CH15             (0x01<<15)
//内部上拉电阻定义
#define OW_INTERNAL_NOPULL        0x00    //没有上拉下拉
#define OW_INTERNAL_PULL          0x01    //使能上拉,芯片内部上拉很弱，可能会无法正常工作，建议使用外部上拉

#ifdef __cplusplus
extern "C"
{
#endif

int WINAPI OW_Init(int DevHandle, unsigned int ChannelMask, unsigned int ResetTimeUs,unsigned char EnInternalPull);
int WINAPI OW_Reset(int DevHandle, unsigned int ChannelMask);
int WINAPI OW_WriteBytes(int DevHandle, unsigned int ChannelMask,unsigned char *pWriteData,unsigned int WriteDataLen);
int WINAPI OW_ReadBytes(int DevHandle, unsigned int ChannelMask,unsigned char *pReadData,unsigned int ReadDataLen);
int WINAPI OW_WriteReadBytes(int DevHandle, unsigned int ChannelMask,unsigned char *pWriteData,unsigned int WriteDataLen,unsigned char *pReadData,unsigned int ReadDataLen,unsigned int IntervalTimeUs);


#ifdef __cplusplus
}
#endif
#endif


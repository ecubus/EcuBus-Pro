/**
  ******************************************************************************
  * @file    usb2lin_ex.h
  * $Author: wdluo $
  * $Revision: 447 $
  * $Date:: 2013-06-29 18:24:57 +0800 #$
  * @brief   usb2lin_ex相关函数和数据类型定义.
  ******************************************************************************
  * @attention
  *
  *<center><a href="http:\\www.toomoss.com">http://www.toomoss.com</a></center>
  *<center>All Rights Reserved</center></h3>
  * 
  ******************************************************************************
  */
#ifndef __USB2FAST_LIN_H_
#define __USB2FAST_LIN_H_

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
#define FLIN_SUCCESS             (0)   //函数执行成功
#define FLIN_ERR_NOT_SUPPORT     (-1)  //适配器不支持该函数
#define FLIN_ERR_USB_WRITE_FAIL  (-2)  //USB写数据失败
#define FLIN_ERR_USB_READ_FAIL   (-3)  //USB读数据失败
#define FLIN_ERR_CMD_FAIL        (-4)  //命令执行失败
#define FLIN_ERR_CH_NO_INIT      (-5)  //该通道未初始化
#define FLIN_ERR_READ_DATA       (-6)  //LIN读数据失败
#define FLIN_ERR_PARAMETER       (-7)  //函数参数传入有误

#define FLIN_RR_FLAG    0x80    //Response Requested (RR) flag
#define FLIN_EF_FLAG    0x40    //This bit is only used by the master to signal the exit from the Fast LIN protocol.

#ifdef __cplusplus
extern "C"
{
#endif

    int WINAPI FLIN_Init(int DevHandle,unsigned char LINIndex,int BaudRate);
    int WINAPI FLIN_WriteData(int DevHandle,unsigned char LINIndex,unsigned char Flags,unsigned char *pData,unsigned int Len);
    int WINAPI FLIN_ReadData(int DevHandle,unsigned char LINIndex,unsigned char *pData);

#ifdef __cplusplus
}
#endif


#endif



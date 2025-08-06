/**
  ******************************************************************************
  * @file    can_bootloader.h
  * $Author: wdluo $
  * $Revision: 447 $
  * $Date:: 2013-06-29 18:24:57 +0800 #$
  * @brief   can bootloader相关函数和数据类型定义.
  ******************************************************************************
  * @attention
  *
  *<center><a href="http:\\www.toomoss.com">http://www.toomoss.com</a></center>
  *<center>All Rights Reserved</center></h3>
  * 
  ******************************************************************************
  */
#ifndef __CAN_BOOTLOADER_H_
#define __CAN_BOOTLOADER_H_

#include <stdint.h>
#ifndef OS_UNIX
#include <Windows.h>
#else
#include <unistd.h>
#ifndef WINAPI
#define WINAPI
#endif
#endif


//函数返回错误代码定义
#define CAN_SUCCESS             (0)   //函数执行成功
#define CAN_ERR_NOT_SUPPORT     (-1)  //适配器不支持该函数
#define CAN_ERR_USB_WRITE_FAIL  (-2)  //USB写数据失败
#define CAN_ERR_USB_READ_FAIL   (-3)  //USB读数据失败
#define CAN_ERR_CMD_FAIL        (-4)  //命令执行失败

#define CAN_BOOT_ERR_CONFIG       (-30) //配置设备错误
#define CAN_BOOT_ERR_SEND         (-31) //发送数据出错
#define CAN_BOOT_ERR_TIME_OUT     (-32) //超时错误
#define CAN_BOOT_ERR_CMD          (-33) //执行命令失败
#define CAN_BOOT_ERR_BAUD         (-34) //波特率参数自动获取失败
#define CAN_BOOT_ERR_BUFFER       (-35) //从设备返回接收数据缓冲区大小为0
#define CAN_BOOT_ERR_DSIZE        (-36) //单次传输数据量大于了4093字节

#define CAN_BOOT_ERR_ERASE          1   //固件擦除出错
#define CAN_BOOT_ERR_ERASE_IN_APP   2   //当前模式为APP，不能擦除固件
#define CAN_BOOT_ERR_WRITE_OUTRANGE 3   //当前地址超出了正常的地址范围
#define CAN_BOOT_ERR_WRITE_IN_APP   4   //当前模式不能写入固件数据
#define CAN_BOOT_ERR_WRITE          5   //数据写入程序存储器出错
#define CAN_BOOT_ERR_WRITE_OUT_ADDR 6   //数据长度超出了程序存储器范围 
#define CAN_BOOT_ERR_WRITE_CRC      7   //数据CRC校验出错

//CAN Bootloader固件类型
#define FW_TYPE_BOOT     0x55
#define FW_TYPE_APP      0xAA

//CAN Bootloader数据收发ID类型
#define ID_TYPE_EXT     0x01
#define ID_TYPE_STD     0x00

#ifdef __cplusplus
extern "C"
{
#endif

int WINAPI CAN_BOOT_Init(int DevHandle,int CANIndex,unsigned int SendDataID,unsigned int ReceiveDataID,unsigned char IDType,int BaudRate);
int WINAPI CAN_BOOT_GetFWInfo(int DevHandle,int CANIndex,unsigned char NAD,unsigned char *pFWType,unsigned int *pFWVersion,unsigned int TimeOutOfMs);
int WINAPI CAN_BOOT_EnterBootMode(int DevHandle,int CANIndex,unsigned char NAD);
int WINAPI CAN_BOOT_EraseApp(int DevHandle,int CANIndex,unsigned char NAD,unsigned int AppSizeOfByte,unsigned int TimeOutOfMs);
int WINAPI CAN_BOOT_SetAddrOffset(int DevHandle,int CANIndex,unsigned char NAD,unsigned int AddrOffset,unsigned short *pBufferSize,unsigned int TimeOutOfMs);
int WINAPI CAN_BOOT_SendAppData(int DevHandle,int CANIndex,unsigned char NAD,unsigned char *pData,unsigned short DataLen,unsigned short *pCRC16);
int WINAPI CAN_BOOT_WriteAppData(int DevHandle,int CANIndex,unsigned char NAD,unsigned short CRC16,unsigned int TimeOutOfMs);
int WINAPI CAN_BOOT_ExecuteApp(int DevHandle,int CANIndex,unsigned char NAD);
int WINAPI CAN_BOOT_SetFrameTime(int DevHandle,int CANIndex,int TimeOfMs);
#ifdef __cplusplus
}
#endif
#endif


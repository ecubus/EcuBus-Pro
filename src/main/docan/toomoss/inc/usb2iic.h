/**
  ******************************************************************************
  * @file    usb2iic.h
  * $Author: wdluo $
  * $Revision: 447 $
  * $Date:: 2013-06-29 18:24:57 +0800 #$
  * @brief   usb2iic相关函数和数据类型定义.
  ******************************************************************************
  * @attention
  *
  *<center><a href="http:\\www.toomoss.com">http://www.toomoss.com</a></center>
  *<center>All Rights Reserved</center></h3>
  * 
  ******************************************************************************
  */
#ifndef __USB2IIC_H_
#define __USB2IIC_H_

#include <stdint.h>
#ifndef OS_UNIX
#include <Windows.h>
#else
#include <unistd.h>
#ifndef WINAPI
#define WINAPI
#endif
#endif

//定义初始化IIC的数据类型
typedef struct _IIC_CONFIG{
  unsigned int    ClockSpeedHz; //IIC时钟频率:单位为Hz
  unsigned short  OwnAddr;      //USB2XXX为从机时自己的地址
  unsigned char   Master;       //主从选择控制:0-从机，1-主机
  unsigned char   AddrBits;     //从机地址模式，7-7bit模式，10-10bit模式
  unsigned char   EnablePu;     //使能引脚芯片内部上拉电阻，若不使能，则I2C总线上必须接上拉电阻
  unsigned char   ByteIntervalUs;//发送数据字节间隔时间，单位为us
}IIC_CONFIG,*PIIC_CONFIG;

//定义函数返回错误代码
#define IIC_SUCCESS             (0)   //函数执行成功
#define IIC_ERR_NOT_SUPPORT     (-1)  //适配器不支持该函数
#define IIC_ERR_USB_WRITE_FAIL  (-2)  //USB写数据失败
#define IIC_ERR_USB_READ_FAIL   (-3)  //USB读数据失败
#define IIC_ERR_CMD_FAIL        (-4)  //命令执行失败
#define IIC_ERR_PARA_ERROR      (-5)  //参数传入错误
//定义IIC函数返回错误代码
#define IIC_ERROR_SUCCESS     0   //操作成功
#define IIC_ERROR_CHANNEL     1   //该通道不支持该函数
#define IIC_ERROR_BUSY        2   //总线忙
#define IIC_ERROR_START_FAILD 3   //启动总线失败
#define IIC_ERROR_TIMEOUT     4   //超时
#define IIC_ERROR_NACK        5   //从机无应答
#define IIC_ERROR_PEC         6   //PEC校验失败
#ifdef __cplusplus
extern "C"
{
#endif

int WINAPI IIC_Init(int DevHandle,int IICIndex, PIIC_CONFIG pConfig);
int WINAPI IIC_GetSlaveAddr(int DevHandle,int IICIndex,short *pSlaveAddr);
int WINAPI IIC_WriteBytes(int DevHandle,int IICIndex,short SlaveAddr,unsigned char *pWriteData,int WriteLen,int TimeOutMs);
int WINAPI IIC_ReadBytes(int DevHandle,int IICIndex,short SlaveAddr,unsigned char *pReadData,int ReadLen,int TimeOutMs);
int WINAPI IIC_WriteReadBytes(int DevHandle,int IICIndex,short SlaveAddr,unsigned char *pWriteData,int WriteLen,unsigned char *pReadData,int ReadLen,int TimeOutMs);
int WINAPI IIC_SetStretchClock(int DevHandle, int IICIndex, unsigned char Enable);

int WINAPI IIC_BlockWriteBytes(int DevHandle,int IICIndex,short SlaveAddr,unsigned char *pWriteData,int BlockSize,int BlockNum,int IntervalTimeUs);
int WINAPI IIC_BlockReadBytes(int DevHandle,int IICIndex,short SlaveAddr,unsigned char *pReadData,int BlockSize,int BlockNum,int IntervalTimeUs);

int WINAPI IIC_SlaveWriteBytes(int DevHandle,int IICIndex,unsigned char *pWriteData,int WriteLen,int TimeOutMs);
int WINAPI IIC_SlaveReadBytes(int DevHandle,int IICIndex,unsigned char *pReadData,int TimeOutMs);
int WINAPI IIC_SlaveWriteRemain(int DevHandle,int IICIndex);

int WINAPI IIC_WriteBytesOfEvent(int DevHandle,int IICIndex,short SlaveAddr,unsigned char *pWriteData,int WriteLen,int EventPin,unsigned char EventType,int TimeOutOfEventMs);
int WINAPI IIC_ReadBytesOfEvent(int DevHandle,int IICIndex,short SlaveAddr,unsigned char *pReadData,int ReadLen,int EventPin,unsigned char EventType,int TimeOutOfEventMs);
int WINAPI IIC_WriteReadBytesOfEvent(int DevHandle,int IICIndex,short SlaveAddr,unsigned char *pWriteData,int WriteLen,unsigned char *pReadData,int ReadLen,int EventPin,unsigned char EventType,int TimeOutOfEventMs);

int WINAPI SMBUS_Init(int DevHandle,int IICIndex,int ClockSpeedHz,unsigned char EnablePu);
int WINAPI SMBUS_QuickCommand(int DevHandle,int IICIndex,short SlaveAddr,unsigned char WriteReadFlag);
int WINAPI SMBUS_WriteByte(int DevHandle,int IICIndex,short SlaveAddr,unsigned char Data,unsigned char WithPEC);
int WINAPI SMBUS_ReadByte(int DevHandle,int IICIndex,short SlaveAddr,unsigned char *pData,unsigned char WithPEC);
int WINAPI SMBUS_WriteByteProtocol(int DevHandle,int IICIndex,short SlaveAddr,unsigned char CommandCode, unsigned char Data,unsigned char WithPEC);
int WINAPI SMBUS_WriteWordProtocol(int DevHandle,int IICIndex,short SlaveAddr,unsigned char CommandCode, unsigned short Data,unsigned char WithPEC);
int WINAPI SMBUS_ReadByteProtocol(int DevHandle,int IICIndex,short SlaveAddr,unsigned char CommandCode, unsigned char *pData,unsigned char WithPEC);
int WINAPI SMBUS_ReadWordProtocol(int DevHandle,int IICIndex,short SlaveAddr,unsigned char CommandCode, unsigned short *pData,unsigned char WithPEC);
int WINAPI SMBUS_ProcessCall(int DevHandle,int IICIndex,short SlaveAddr,unsigned char CommandCode, unsigned short WriteData, unsigned short *pReadData,unsigned char WithPEC);
int WINAPI SMBUS_BlockWrite(int DevHandle,int IICIndex,short SlaveAddr,unsigned char CommandCode, unsigned char *pWriteData,int WriteCount,unsigned char WithPEC);
int WINAPI SMBUS_BlockRead(int DevHandle,int IICIndex,short SlaveAddr,unsigned char CommandCode, unsigned char *pReadData,int *pReadCount,unsigned char WithPEC);
int WINAPI SMBUS_BlockProcessCall(int DevHandle,int IICIndex,short SlaveAddr,unsigned char CommandCode, unsigned char *pWriteData,int WriteCount, unsigned char *pReadData,int *pReadCount,unsigned char WithPEC);

#ifdef __cplusplus
}
#endif
#endif


/**
  ******************************************************************************
  * @file    usb2lin.h
  * $Author: wdluo $
  * $Revision: 447 $
  * $Date:: 2013-06-29 18:24:57 +0800 #$
  * @brief   usb2lin相关函数和数据类型定义.
  ******************************************************************************
  * @attention
  *
  *<center><a href="http:\\www.toomoss.com">http://www.toomoss.com</a></center>
  *<center>All Rights Reserved</center></h3>
  * 
  ******************************************************************************
  */
#ifndef __USB2LIN_H_
#define __USB2LIN_H_

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
#define LIN_SUCCESS             (0)   //函数执行成功
#define LIN_ERR_NOT_SUPPORT     (-1)  //适配器不支持该函数
#define LIN_ERR_USB_WRITE_FAIL  (-2)  //USB写数据失败
#define LIN_ERR_USB_READ_FAIL   (-3)  //USB读数据失败
#define LIN_ERR_CMD_FAIL        (-4)  //命令执行失败
#define LIN_ERR_CH_NO_INIT      (-5)  //该通道未初始化
#define LIN_ERR_READ_DATA       (-6)  //LIN读数据失败
//LIN和校验模式
#define LIN_CHECK_MODE_STD     0
#define LIN_CHECK_MODE_EXT     1
#define LIN_CHECK_MODE_NONE    2
//BREAK位数定义
#define LIN_BREAK_BITS_10    0x00
#define LIN_BREAK_BITS_11    0x20
//定义主从模式
#define LIN_MASTER          1
#define LIN_SLAVE           0
//定义从机操作模式
#define LIN_SLAVE_WRITE     0
#define LIN_SLAVE_READ      1

//定义初始化LIN初始化数据类型
typedef struct _LIN_CONFIG{
  unsigned int  BaudRate;     //波特率,最大20K
  unsigned char CheckMode;    //校验模式，0-标准校验模式，1-增强校验模式（包含PID）
  unsigned char MasterMode;   //主从模式，0-从模式，1-主模式
  unsigned char BreakBits;    //Break长度，0x00-10bit,0x20-11bit
}LIN_CONFIG,*PLIN_CONFIG;

//LIN数据收发帧格式定义
typedef struct _LIN_MSG{
    unsigned char ID;       //ID，取值范围0~0x3F
    unsigned char DataLen;  //发送数据时，代表发送数据的长度，不含校验数据，接收数据时，数据的长度，包含校验数据
    unsigned char Data[9];  //数据存储区
}LIN_MSG,*PLIN_MSG;

#ifdef __cplusplus
extern "C"
{
#endif

int WINAPI LIN_Init(int DevHandle,unsigned char LINIndex,LIN_CONFIG *pConfig);
int WINAPI LIN_SendBreak(int DevHandle,unsigned char LINIndex);
int WINAPI LIN_Write(int DevHandle,unsigned char LINIndex,LIN_MSG *pLINMsg,unsigned int Len);
int WINAPI LIN_Read(int DevHandle,unsigned char LINIndex,LIN_MSG *pLINMsg,unsigned int Len);
int WINAPI LIN_SlaveSetIDMode(int DevHandle,unsigned char LINIndex,unsigned char IDMode,LIN_MSG *pLINMsg,unsigned int Len);
int WINAPI LIN_SlaveGetData(int DevHandle,unsigned char LINIndex,LIN_MSG *pLINMsg);

#ifdef __cplusplus
}
#endif
#endif



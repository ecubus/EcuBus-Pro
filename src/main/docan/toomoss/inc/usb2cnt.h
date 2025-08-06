/**
  ******************************************************************************
  * @file    usb2cnt.h
  * $Author: wdluo $
  * $Revision: 447 $
  * $Date:: 2013-06-29 18:24:57 +0800 #$
  * @brief   usb2cnt相关函数和数据类型定义.
  ******************************************************************************
  * @attention
  *
  *<center><a href="http:\\www.toomoss.com">http://www.toomoss.com</a></center>
  *<center>All Rights Reserved</center></h3>
  * 
  ******************************************************************************
  */
#ifndef __USB2CNT_H_
#define __USB2CNT_H_

#include <stdint.h>
#ifndef OS_UNIX
#include <Windows.h>
#else
#include <unistd.h>
#ifndef WINAPI
#define WINAPI
#endif
#endif

//定义初始化Counter的数据类型
typedef struct _CNT_CONFIG{
  unsigned char   CounterMode;      //计数模式，0-Up,1-Down
  unsigned char   CounterPolarity;  //计数极性，0-Rising，1-Falling，2-BothEdge
  unsigned char   CounterBitWide;   //计数位宽，16-16bit位宽，32-32bit位宽
  unsigned char   CounterPinMode;   //计数器输入引脚模式，0-浮空输入，1-上拉输入，2-下拉输入
}CNT_CONFIG,*PCNT_CONFIG;

//定义函数返回错误代码
#define CNT_SUCCESS             (0)   //函数执行成功
#define CNT_ERR_NOT_SUPPORT     (-1)  //适配器不支持该函数
#define CNT_ERR_USB_WRITE_FAIL  (-2)  //USB写数据失败
#define CNT_ERR_USB_READ_FAIL   (-3)  //USB读数据失败
#define CNT_ERR_CMD_FAIL        (-4)  //命令执行失败
//计数器模式
#define COUNTER_MODE_UP     0
#define COUNTER_MODE_DOWN   1
//计数器触发条件
#define COUNTER_POL_RISING     0
#define COUNTER_POL_FALLING    1
#define COUNTER_POL_BOTHEDGE   2
//计数器宽度
#define COUNTER_BITS16        16
#define COUNTER_BITS32        32
//计数器输入引脚模式
#define  COUNTER_PIN_NOPULL     0x00
#define  COUNTER_PIN_UP         0x01
#define  COUNTER_PIN_DOWN       0x02
//计数器通道定义
#define COUNTER_CH0             0x01
#define COUNTER_CH1             0x02
#define COUNTER_CH2             0x04
#define COUNTER_CH3             0x08

#ifdef __cplusplus
extern "C"
{
#endif

int WINAPI CNT_Init(int DevHandle, unsigned char ChannelMask, PCNT_CONFIG pConfig);
int WINAPI CNT_Start(int DevHandle, unsigned char ChannelMask);
int WINAPI CNT_Stop(int DevHandle, unsigned char ChannelMask);
int WINAPI CNT_SetValue(int DevHandle, unsigned char ChannelMask,unsigned int *pCntValues);
int WINAPI CNT_GetValue(int DevHandle, unsigned char ChannelMask,unsigned int *pCntValues);

#ifdef __cplusplus
}
#endif
#endif


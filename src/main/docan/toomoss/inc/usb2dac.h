/**
  ******************************************************************************
  * @file    usb2dac.h
  * $Author: wdluo $
  * $Revision: 447 $
  * $Date:: 2013-06-29 18:24:57 +0800 #$
  * @brief   usb2dac相关函数和数据类型定义.
  ******************************************************************************
  * @attention
  *
  *<center><a href="http:\\www.toomoss.com">http://www.toomoss.com</a></center>
  *<center>All Rights Reserved</center></h3>
  * 
  ******************************************************************************
  */
#ifndef __USB2DAC_H_
#define __USB2DAC_H_

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
#define DAC_SUCCESS             (0)   //函数执行成功
#define DAC_ERR_NOT_SUPPORT     (-1)  //适配器不支持该函数
#define DAC_ERR_USB_WRITE_FAIL  (-2)  //USB写数据失败
#define DAC_ERR_USB_READ_FAIL   (-3)  //USB读数据失败
#define DAC_ERR_CMD_FAIL        (-4)  //命令执行失败
#define DAC_ERR_CH_NO_INIT      (-5)  //该通道未初始化

#ifdef __cplusplus
extern "C"
{
#endif
/**
  * @brief  初始化配置DAC并输出信号
  * @param  DevHandle 设备索引号
  * @param  CycleUs 数据输出时间间隔，单位为0.25us，数据输出总时间=0.25*CycleUs*WaveDataNum us
  * @param  pWaveData 待输出的数据缓冲区指针，数据最大值为0xFFF,对应电压为3.3V
  * @param  WaveDataNum 输出的数据点数
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI DAC_Init(int DevHandle,unsigned short CycleUs,unsigned short *pWaveData,unsigned short WaveDataNum);
/**
  * @brief  启动DAC并输出信号
  * @param  DevHandle 设备索引号
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI DAC_Start(int DevHandle);
/**
  * @brief  停止DAC输出信号
  * @param  DevHandle 设备索引号
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI DAC_Stop(int DevHandle);

#ifdef __cplusplus
}
#endif

#endif



/**
  ******************************************************************************
  * @file    power_analyzer.h
  * $Author: wdluo $
  * $Revision: 447 $
  * $Date:: 2021-03-31 18:24:57 +0800 #$
  * @brief   功耗分析仪相关函数和数据类型定义.
  ******************************************************************************
  * @attention
  *
  *<center><a href="http:\\www.toomoss.com">http://www.toomoss.com</a></center>
  *<center>All Rights Reserved</center></h3>
  * 
  ******************************************************************************
  */
#ifndef __POWER_ANALYZER_H_
#define __POWER_ANALYZER_H_

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
#define PA_SUCCESS             (0)   //函数执行成功
#define PA_ERR_NOT_SUPPORT     (-1)  //适配器不支持该函数
#define PA_ERR_USB_WRITE_FAIL  (-2)  //USB写数据失败
#define PA_ERR_USB_READ_FAIL   (-3)  //USB读数据失败
#define PA_ERR_CMD_FAIL        (-4)  //命令执行失败



#ifdef __cplusplus
extern "C"
{
#endif
/**
  * @brief  功耗分析仪初始化配置
  * @param  DevHandle 设备索引号
  * @param  Channel 电压电流采集通道号，传入0即可
  * @param  SamplingRate 电压电流采样率，取值范围为1~500000
  * @param  AutoZeroSet 调零设置，0-不调零，1-初始化的时候会自动调零，自动调零需要接入输入电源，断开输出电源（电源输出不接），只针对电流数据调零
  * @param  UseZeroSet 使用调零参数，0-不使用调零参数，读到的数据会有一个固定的偏移量，1-使用调零参数，读到的数据是减去调零参数后的数据
  * @param  FilterLevel 滤波级别，取值范围为0到2000，数值越大数据越平滑，0表示不滤波
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI  PA_Init(int DevHandle,int Channel,int SamplingRate,unsigned char AutoZeroSet,unsigned char UseZeroSet,int FilterLevel);
/**
  * @brief  开始采集数据
  * @param  DevHandle 设备索引号
  * @param  Channel 电压电流采集通道号，传入0即可
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI  PA_StartGetData(int DevHandle,int Channel);
/**
  * @brief  停止采集数据
  * @param  DevHandle 设备索引号
  * @param  Channel 电压电流采集通道号，传入0即可
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI  PA_StopGetData(int DevHandle,int Channel);
/**
  * @brief  获取电压数据
  * @param  DevHandle 设备索引号
  * @param  Channel 电压电流采集通道号，传入0即可
  * @param  pVoltage 电压值存储缓冲区首地址，单位为V
  * @param  BufferSize 数据缓冲区长度
  * @retval 实际获取到的数据个数，小于0函数执行出错
  */
int WINAPI  PA_GetVoltageData(int DevHandle,int Channel,double *pVoltage,int BufferSize);
/**
  * @brief  获取电流数据
  * @param  DevHandle 设备索引号
  * @param  Channel 电压电流采集通道号，传入0即可
  * @param  pCurrent 电流值存储缓冲区首地址，单位为mA
  * @param  BufferSize 数据缓冲区长度
  * @retval 实际获取到的数据个数，小于0函数执行出错
  */
int WINAPI  PA_GetCurrentData(int DevHandle,int Channel,double *pCurrent,int BufferSize);
/**
  * @brief  获取功率数据
  * @param  DevHandle 设备索引号
  * @param  Channel 电压电流采集通道号，传入0即可
  * @param  pPower 功率值存储缓冲区首地址，单位为mW
  * @param  BufferSize 数据缓冲区长度
  * @retval 实际获取到的数据个数，小于0函数执行出错
  */
int WINAPI  PA_GetPowerData(int DevHandle,int Channel,double *pPower,int BufferSize);
#ifdef __cplusplus
}
#endif


#endif



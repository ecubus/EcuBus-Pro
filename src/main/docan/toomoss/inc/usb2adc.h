/**
  ******************************************************************************
  * @file    usb2adc.h
  * $Author: wdluo $
  * $Revision: 447 $
  * $Date:: 2013-06-29 18:24:57 +0800 #$
  * @brief   usb2adc相关函数和数据类型定义.
  ******************************************************************************
  * @attention
  *
  *<center><a href="http:\\www.toomoss.com">http://www.toomoss.com</a></center>
  *<center>All Rights Reserved</center></h3>
  * 
  ******************************************************************************
  */
#ifndef __USB2ADC_H_
#define __USB2ADC_H_

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
#define ADC_SUCCESS             (0)   //函数执行成功
#define ADC_ERR_NOT_SUPPORT     (-1)  //适配器不支持该函数
#define ADC_ERR_USB_WRITE_FAIL  (-2)  //USB写数据失败
#define ADC_ERR_USB_READ_FAIL   (-3)  //USB读数据失败
#define ADC_ERR_CMD_FAIL        (-4)  //命令执行失败
#define ADC_ERR_CH_NO_INIT      (-5)  //该通道未初始化

//定义连续采集数据模式下的回调函数
typedef  int (WINAPI *PADC_GET_DATA_HANDLE)(int DevHandle,unsigned short *pData,int DataNum);//接收数据回掉函数

#ifdef __cplusplus
extern "C"
{
#endif
/**
  * @brief  初始化配置ADC
  * @param  DevHandle 设备索引号
  * @param  Channel 需要配置的ADC通道，每个bit为对应一个通道，为1时则需要配置该通道，最低位代表通道0
  * @param  SampleRateHz ADC采样率，单通道最大2.5MHz，单位为Hz
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI ADC_Init(int DevHandle,char Channel,int SampleRateHz);
/**
  * @brief  启动并驱动ADC转换值
  * @param  DevHandle 设备索引号
  * @param  pData 数据存储缓冲区首地址
  * @param  DataNum 获取转换的数据数，每个数据之间的时间间隔为初始化配置时候的采样频率决定
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI ADC_Read(int DevHandle,short *pData,int DataNum);
/**
  * @brief  启动ADC连续转换模式
  * @param  DevHandle 设备索引号
  * @param  Channel 需要配置的ADC通道，每个bit为对应一个通道，为1时则需要配置该通道，最低位代表通道0
  * @param  SampleRateHz ADC采样率，单通道最大2.5MHz，单位为Hz
  * @param  FrameSize 连续采样时每次传输数据个数SampleRateHz*1000/FrameSize最好大于或者等于20
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI ADC_StartContinueRead(int DevHandle,char Channel,int SampleRateHz,int FrameSize,PADC_GET_DATA_HANDLE pGetDataHandle);
/**
  * @brief  停止ADC连续转换模式
  * @param  DevHandle 设备索引号
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI ADC_StopContinueRead(int DevHandle);
/**
  * @brief  获取ADC连续转换模式下存储在数据缓冲区中的数据值
  * @param  DevHandle 设备索引号
  * @param  pDataBuffer 数据存储缓冲区首地址
  * @param  BufferSize 数据存储缓冲区大下，注意单位为短整型，不是字节，缓冲区最小为10240，否则获取不到数据
  * @retval 成功获取到的数据数（单位为短整型）
  */
int WINAPI ADC_GetData(int DevHandle,unsigned short *pDataBuffer,int BufferSize);

#ifdef __cplusplus
}
#endif

#endif



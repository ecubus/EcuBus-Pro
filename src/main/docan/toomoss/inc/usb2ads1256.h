/**
  ******************************************************************************
  * @file    usb2ads1256.h
  * $Author: wdluo $
  * $Revision: 447 $
  * $Date:: 2013-06-29 18:24:57 +0800 #$
  * @brief   usb2ads1256相关函数和数据类型定义.
  ******************************************************************************
  * @attention
  *
  *<center><a href="http:\\www.toomoss.com">http://www.toomoss.com</a></center>
  *<center>All Rights Reserved</center></h3>
  * 
  ******************************************************************************
  */
#ifndef __USB2ADS1256_H_
#define __USB2ADS1256_H_

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
#define ADS1256_SUCCESS             (0)   //函数执行成功
#define ADS1256_ERR_NOT_SUPPORT     (-1)  //适配器不支持该函数
#define ADS1256_ERR_USB_WRITE_FAIL  (-2)  //USB写数据失败
#define ADS1256_ERR_USB_READ_FAIL   (-3)  //USB读数据失败
#define ADS1256_ERR_CMD_FAIL        (-4)  //命令执行失败
#define ADS1256_ERR_CH_NO_INIT      (-5)  //该通道未初始化

//定义ADS采样率
#define ADS1256_DRATE_30000SPS   0xF0 
#define ADS1256_DRATE_15000SPS   0xE0 
#define ADS1256_DRATE_7500SPS   0xD0 
#define ADS1256_DRATE_3750SPS   0xC0 
#define ADS1256_DRATE_2000SPS   0xB0 
#define ADS1256_DRATE_1000SPS   0xA1 
#define ADS1256_DRATE_500SPS    0x92 
#define ADS1256_DRATE_100SPS    0x82 
#define ADS1256_DRATE_60SPS     0x72 
#define ADS1256_DRATE_50SPS     0x63 
#define ADS1256_DRATE_30SPS     0x53 
#define ADS1256_DRATE_25SPS     0x43 
#define ADS1256_DRATE_15SPS     0x33 
#define ADS1256_DRATE_10SPS     0x23 
#define ADS1256_DRATE_5SPS      0x13 
#define ADS1256_DRATE_2_5SPS    0x03

//定义初始化ADS1256的数据类型
typedef struct _ADS1256_CONFIG{
  unsigned short  SampleRate;   //采样率
  unsigned char   PGA;          //内部增益，2^n
  unsigned char   BufferEn;     //1：使能Buffer,0：禁止Buffer
  unsigned int    SampleMode;   //两个bit控制一个通道，00：不使用该通道，01：该通道为单端模式，10：该通道为差分负极，11：该通道为差分正极
}ADS1256_CONFIG,*PADS1256_CONFIG;

#ifdef __cplusplus
extern "C"
{
#endif
/**
  * @brief  初始化配置ADS1256
  * @param  DevHandle 设备索引号
  * @param  Channel 需要配置的ADS通道号，取值0或者1
  * @param  pConfig ADS1256配置参数指针
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI ADS1256_Init(int DevHandle,char Channel,ADS1256_CONFIG *pConfig);
/**
  * @brief  启动ADS转换，调用该函数后，适配器会自动读取ADS转换数据
  * @param  DevHandle 设备索引号
  * @param  Channel 需要启动的ADS通道号，取值0或者1
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI ADS1256_Start(int DevHandle,char Channel);
/**
  * @brief  启动ADC连续转换模式
  * @param  DevHandle 设备索引号
  * @param  Channel 需要读取数据的ADS通道号，取值0或者1
  * @param  pData 数据存储缓冲区首地址
  * @retval 函数执行状态，小于0函数执行出错，大于0为实际采集到的ADC数据
  */
int WINAPI ADS1256_Read(int DevHandle,char Channel,int *pData);
/**
  * @brief  停止ADS转换，调用该函数后，适配器会自动停止ADS转换数据
  * @param  DevHandle 设备索引号
  * @param  Channel 需要启动的ADS通道号，取值0或者1
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI ADS1256_Stop(int DevHandle,char Channel);


#ifdef __cplusplus
}
#endif

#endif



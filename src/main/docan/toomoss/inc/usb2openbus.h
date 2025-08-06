/**
  ******************************************************************************
  * @file    usb2openbus.h
  * $Author: wdluo $
  * $Revision: 447 $
  * $Date:: 2013-06-29 18:24:57 +0800 #$
  * @brief   usb2openbus相关函数和数据类型定义.
  ******************************************************************************
  * @attention
  *
  *<center><a href="http:\\www.toomoss.com">http://www.toomoss.com</a></center>
  *<center>All Rights Reserved</center></h3>
  * 
  ******************************************************************************
  */
#ifndef __USB2OPENBUS_H_
#define __USB2OPENBUS_H_

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
#define OB_SUCCESS             (0)   //函数执行成功
#define OB_ERR_NOT_SUPPORT     (-1)  //适配器不支持该函数
#define OB_ERR_USB_WRITE_FAIL  (-2)  //USB写数据失败
#define OB_ERR_USB_READ_FAIL   (-3)  //USB读数据失败
#define OB_ERR_CMD_FAIL        (-4)  //命令执行失败

//通道定义
#define OB_CH0             (0)
#define OB_CH1             (1)
#define OB_CH2             (2)
#define OB_CH3             (3)
#define OB_CH4             (4)
#define OB_CH5             (5)
#define OB_CH6             (6)
#define OB_CH7             (7)
#define OB_CH8             (8)
#define OB_CH9             (9)
#define OB_CH10            (10)
#define OB_CH11            (11)
#define OB_CH12            (12)
#define OB_CH13            (13)
#define OB_CH14            (14)
#define OB_CH15            (15)
//内部上拉电阻定义
#define OB_INTERNAL_NOPULL        0x00    //没有上拉下拉
#define OB_INTERNAL_PULL          0x01    //使能上拉,芯片内部上拉很弱，可能会无法正常工作，建议使用外部上拉

//定义数据类型
typedef struct _OB_DATA{
    char   Id;          //ID,低3bit有效
    unsigned int Data;  //32bit
}OB_DATA,*POB_DATA;

#ifdef __cplusplus
extern "C"
{
#endif
/**
  * @brief  初始化配置Openbus
  * @param  DevHandle 设备索引号,通过调用USB_ScanDevice函数获得
  * @param  Channel 总线通道号，取值0~7,P0对应通道0的Data引脚，P1对应通道0的Clk引脚，以此类推
  * @param  EnInternalPull 是否使能引脚内部上拉电阻，总线引脚为开漏模式，需要外接上拉电阻才能输出高电平，若没有外接上拉电阻，可以使用内部上拉电阻，1-使用内部上拉，0-不使用内部上拉
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI OB_Init(int DevHandle, unsigned char Channel,unsigned char EnInternalPull);

/**
  * @brief  Openbus写数据
  * @param  DevHandle 设备索引号,通过调用USB_ScanDevice函数获得
  * @param  Channel 总线通道号，取值0~7,P0对应通道0的Data引脚，P1对应通道0的Clk引脚，以此类推
  * @param  pWriteData 写数据结构体指针
  * @param  WriteDataLen 写数据长度
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI OB_Write(int DevHandle, unsigned char Channel,OB_DATA *pWriteData,unsigned int WriteDataLen);

/**
  * @brief  Openbus读数据
  * @param  DevHandle 设备索引号,通过调用USB_ScanDevice函数获得
  * @param  Channel 总线通道号，取值0~7,P0对应通道0的Data引脚，P1对应通道0的Clk引脚，以此类推
  * @param  pReadData 读数据结构体指针，读数据的时候需要先发送ID，所以在调用该函数的时候需要传入带ID信息的数据，然后才能依次获取每个ID对应的数据
  * @param  ReadDataLen 读数据长度
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI OB_Read(int DevHandle, unsigned char Channel,OB_DATA *pReadData,unsigned int ReadDataLen);


#ifdef __cplusplus
}
#endif
#endif


/**
  ******************************************************************************
  * @file    i2c_sniffer.h
  * $Author: wdluo $
  * $Revision: 447 $
  * $Date:: 2013-06-29 18:24:57 +0800 #$
  * @brief   i2c sniffer相关函数和数据类型定义.
  ******************************************************************************
  * @attention
  *
  *<center><a href="http:\\www.toomoss.com">http://www.toomoss.com</a></center>
  *<center>All Rights Reserved</center></h3>
  * 
  ******************************************************************************
  */
#ifndef __I2C_SNIFFER_H_
#define __I2C_SNIFFER_H_

#include <stdint.h>
#ifndef OS_UNIX
#include <Windows.h>
#else
#include <unistd.h>
#ifndef WINAPI
#define WINAPI
#endif
#endif

//I2C数据类型定义
typedef enum
{ 
    UNKNOWN = 0x00,
    START,
    ADDR,
    DATA,
    STOP
}I2C_DATA_TYPE;
//I2C数据结构定义
typedef struct
{
    unsigned char DataType; //当前数据类型
    unsigned char ACK;      //0-当前ACK为低电平，1-当前ACK为高电平
    unsigned char WriteRead;//1-读操作，0-写操作
    unsigned char Data;     //当DataType为DATA时对应的数据
    unsigned short Addr;    //数据对应的从机地址
    long long Timestamp;    //时间戳，单位为ns
}I2C_DATA;

//解析到I2C数据后的回调函数
typedef  int (WINAPI I2C_GET_DATA_HANDLE)(int DevHandle,int Channel,I2C_DATA *pI2CData,int I2CDataNum);

//定义函数返回错误代码
#define SUCCESS             (0)   //函数执行成功
#define ERR_NOT_SUPPORT     (-1)  //适配器不支持该函数
#define ERR_USB_WRITE_FAIL  (-2)  //USB写数据失败
#define ERR_USB_READ_FAIL   (-3)  //USB读数据失败
#define ERR_CMD_FAIL        (-4)  //命令执行失败

#ifdef __cplusplus
extern "C"
{
#endif
    int WINAPI I2C_SnifferStart(int DevHandle,int Channel,unsigned int SampleRateHz,I2C_GET_DATA_HANDLE *pGetI2CDataHandle);
    int WINAPI I2C_SnifferStop(int DevHandle);
#ifdef __cplusplus
}
#endif

#endif


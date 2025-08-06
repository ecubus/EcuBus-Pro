/**
  ******************************************************************************
  * @file    usb2ir.h
  * $Author: wdluo $
  * $Revision: 447 $
  * $Date:: 2013-06-29 18:24:57 +0800 #$
  * @brief   usb2ir相关函数和数据类型定义.
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

//自定义波形输出时序参数
struct IRTimeSeries{
  unsigned int  DataTime;//输出DataType的时间，单位为0.25us
  unsigned char DataType;//1-输出高电平或者调制波，0-输出低电平或者不输出调制波
};

typedef enum {
    UNKNOWN      = -1,
    UNUSED       =  0,
    RC5,
    RC6,
    NEC,
    SONY,
    PANASONIC,
    JVC,
    SAMSUNG,
    WHYNTER,
    AIWA_RC_T501,
    LG,
    SANYO,
    MITSUBISHI,
    DISH,
    SHARP,
    DENON,
    PRONTO,
    LEGO_PF,
}ir_type_t;

typedef struct
{
  ir_type_t       Type;     // UNKNOWN, NEC, SONY, RC5, ...
  unsigned char   Repeat;
  unsigned short  Address;  // Used by Panasonic & Sharp [16-bits]
  unsigned int    Value;    // Decoded value [max 32-bits]
  unsigned int    Bits;     // Number of bits in decoded value
}ir_data_t;

//定义函数返回错误代码
#define IR_SUCCESS             (0)   //函数执行成功
#define IR_ERR_NOT_SUPPORT     (-1)  //适配器不支持该函数
#define IR_ERR_USB_WRITE_FAIL  (-2)  //USB写数据失败
#define IR_ERR_USB_READ_FAIL   (-3)  //USB读数据失败
#define IR_ERR_CMD_FAIL        (-4)  //命令执行失败

//IR通道定义
#define IR_CH0             0x0001
#define IR_CH1             0x0002
#define IR_CH2             0x0004
#define IR_CH3             0x0008
#define IR_CH4             0x0010
#define IR_CH5             0x0020
#define IR_CH6             0x0040
#define IR_CH7             0x0080
#define IR_CH8             0x0100
#define IR_CH9             0x0200
#define IR_CH10             0x0400
#define IR_CH11             0x0800
#define IR_CH12             0x1000
#define IR_CH13             0x2000
#define IR_CH14             0x4000
#define IR_CH15             0x8000
#define IR_CHALL            0xFFFF

#ifdef __cplusplus
extern "C"
{
#endif

int WINAPI IR_NEC_Send(int DevHandle, unsigned int ChannelMask,unsigned char Adress,unsigned char Command,unsigned char HaveNot);
int WINAPI IR_NEC_SendRepeat(int DevHandle, unsigned int ChannelMask);
int WINAPI IR_ITT_Send(int DevHandle, unsigned int ChannelMask,unsigned char Adress,unsigned char Command);
int WINAPI IR_JVC_Send(int DevHandle, unsigned int ChannelMask,unsigned char PrePulse,unsigned char Adress,unsigned char Command);
int WINAPI IR_NRC17_Send(int DevHandle, unsigned int ChannelMask,unsigned char Adress,unsigned char Command,unsigned char SubCode);
int WINAPI IR_RCA_Send(int DevHandle, unsigned int ChannelMask,unsigned char Adress,unsigned char Command);
int WINAPI IR_USER_Send(int DevHandle, unsigned int ChannelMask,unsigned short ModulateHigh,unsigned short ModulateLow,struct IRTimeSeries *pIRTimeSeries,unsigned short TimeSeriesNum);

int WINAPI IR_Send(int DevHandle, unsigned int ChannelMask,unsigned int MODFreqKHz,ir_data_t IRData);
int WINAPI IR_SendRaw(int DevHandle, unsigned int ChannelMask,unsigned int MODFreqKHz,unsigned int *pIRRawData,unsigned int RawDataLen);

#ifdef __cplusplus
}
#endif
#endif


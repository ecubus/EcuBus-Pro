/**
  ******************************************************************************
  * @file    usb2gpio.h
  * $Author: wdluo $
  * $Revision: 447 $
  * $Date:: 2013-06-29 18:24:57 +0800 #$
  * @brief   usb2gpio相关函数和数据类型定义.
  ******************************************************************************
  * @attention
  *
  *<center><a href="http:\\www.toomoss.com">http://www.toomoss.com</a></center>
  *<center>All Rights Reserved</center></h3>
  * 
  ******************************************************************************
  */
#ifndef __USB2GPIO_H_
#define __USB2GPIO_H_

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
#define GPIO_SUCCESS             (0)   //函数执行成功
#define GPIO_ERR_NOT_SUPPORT     (-1)  //适配器不支持该函数
#define GPIO_ERR_USB_WRITE_FAIL  (-2)  //USB写数据失败
#define GPIO_ERR_USB_READ_FAIL   (-3)  //USB读数据失败
#define GPIO_ERR_CMD_FAIL        (-4)  //命令执行失败

//上下拉电阻配置
#define GPIO_PUPD_NOPULL        0x00    //没有上拉下拉
#define GPIO_PUPD_UP            0x01    //使能上拉
#define GPIO_PUPD_DOWN          0x02    //使能下拉

#ifdef __cplusplus
extern "C"
{
#endif
/**
  * @brief  将GPIO引脚设置为输入模式
  * @param  DevHandle 设备索引号
  * @param  PinMask 需要设置为输入模式的引脚，每个bit位代表一个引脚，对应bit位为1时改引脚对设置有效，最低位为P0
  * @param  PuPd 0-浮空输入，无上拉或者下拉，1-上拉输入，2-下拉输入
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI GPIO_SetInput(int DevHandle,unsigned int PinMask, unsigned char PuPd);
/**
  * @brief  将GPIO引脚设置为输出模式
  * @param  DevHandle 设备索引号
  * @param  PinMask 需要设置为输出模式的引脚，每个bit位代表一个引脚，对应bit位为1时改引脚对设置有效，最低位对应P0
  * @param  PuPd 0-推挽输出，无上拉或者下拉，1-上拉输出，2-下拉输出
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI GPIO_SetOutput(int DevHandle,unsigned int PinMask, unsigned char PuPd);
/**
  * @brief  将GPIO引脚设置为开漏模式，该模式下可作为双向引脚
  * @param  DevHandle 设备索引号
  * @param  PinMask 需要设置为开漏模式的引脚，每个bit位代表一个引脚，对应bit位为1时改引脚对设置有效，最低位对应P0
  * @param  PuPd 0-内部无上拉或者下拉，1-使能上拉，2-使能下拉
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI GPIO_SetOpenDrain(int DevHandle,unsigned int PinMask, unsigned char PuPd);
/**
  * @brief  设置GPIO引脚的输出状态
  * @param  DevHandle 设备索引号
  * @param  PinMask 需要输出状态的引脚，每个bit位代表一个引脚，对应bit位为1时改引脚对设置有效，最低位对应P0
  * @param  PinValue 对应引脚的状态，每个bit位代表一个引脚，对应bit位为1输出高电平，为0输出低电平，最低位对应P0
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI GPIO_Write(int DevHandle,unsigned int PinMask, unsigned int PinValue);
/**
  * @brief  获取GPIO引脚的输入状态
  * @param  DevHandle 设备索引号
  * @param  PinMask 需要获取状态的引脚，每个bit位代表一个引脚，对应bit位为1时改引脚对设置有效，最低位对应P0
  * @param  pPinValue 对应引脚的状态，每个bit位代表一个引脚，对应bit位为1引脚为高电平，为0引脚为低电平，最低位对应P0
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI GPIO_Read(int DevHandle,unsigned int PinMask, unsigned int *pPinValue);
/**
  * @brief  控制GPIO输出高脉冲
  * @param  DevHandle 设备索引号
  * @param  PinMask 需要获取状态的引脚，每个bit位代表一个引脚，对应bit位为1时改引脚对设置有效，最低位对应P0
  * @param  PulseWidthUs 高脉冲宽度，单位为微秒
  * @param  PulsePeriodUs 脉冲输出周期，单位为为微秒，必须大于等于PulseWidthUs
  * @param  PulseNum 脉冲输出个数
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI GPIO_SendPulses(int DevHandle,unsigned int PinMask,unsigned int PulseWidthUs,unsigned int PulsePeriodUs,unsigned int PulseNum);

#ifdef __cplusplus
}
#endif

#endif



/**
 * @file   usb2dio.h
 * @brief  USB转DIO接口函数和相关数据类型定义，也包含PWM监控相关函数和数据类型定义
 * @author wdluo(wdluo@toomoss.com)
 * @version 1.0
 * @date 2022-10-05
 * @copyright Copyright (c) 2022 重庆图莫斯电子科技有限公司
 */
#ifndef __USB2DIO_H_
#define __USB2DIO_H_

#include <stdint.h>
#ifdef _WIN32
#include <Windows.h>
#else
#include <unistd.h>
#ifndef WINAPI
#define WINAPI
#endif
#endif
 /**
  *@defgroup USB转DIO
  * @{
  * @brief USB转DIO接口函数和数据类型定义
 */

/**
 *@name 函数返回错误值宏定义
 *@brief 函数调用出错后返回值定义
 *@{
*/
#define DIO_SUCCESS             (0)   ///<函数执行成功
#define DIO_ERR_NOT_SUPPORT     (-1)  ///<适配器不支持该函数
#define DIO_ERR_USB_WRITE_FAIL  (-2)  ///<USB写数据失败
#define DIO_ERR_USB_READ_FAIL   (-3)  ///<USB读数据失败
#define DIO_ERR_CMD_FAIL        (-4)  ///<命令执行失败
#define DIO_ERR_ARG				(-5)  ///<传入函数参数异常
/** @} */

/**
 *@name DIO引脚宏定义
 *@brief DIO引脚对应值的宏定义
 *@{
*/
#define DIO_PIN_LIN1		0x0001
#define DIO_PIN_LIN2		0x0002
#define DIO_PIN_LIN3		0x0004
#define DIO_PIN_LIN4		0x0008
#define DIO_PIN_DI0			0x0010
#define DIO_PIN_DI1			0x0020
#define DIO_PIN_DI2			0x0040
#define DIO_PIN_DI3			0x0080
#define DIO_PIN_DO0			0x0100
#define DIO_PIN_DO1			0x0200
#define DIO_PIN_DO2			0x0400
#define DIO_PIN_DO3			0x0800
/** @} */
#ifdef __cplusplus
extern "C"
{
#endif
	/**
	 * @brief  初始化DIO,将对应引脚初始化为DIO功能
	 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
	 * @param[in]  PinMask 需要初始化的DIO引脚，可以参考 @ref DIO引脚宏定义
	 * @return 函数执行状态
	 * @retval =0 函数执行成功
	 * @retval <0 函数调用失败
	 */
	int WINAPI DIO_Init(int DevHandle, unsigned int PinMask);

	/**
	 * @brief  控制DIO引脚输出高电平
	 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
	 * @param[in]  PinMask 需要初始化的DIO引脚，可以参考 @ref DIO引脚宏定义
	 * @return 函数执行状态
	 * @retval =0 函数执行成功
	 * @retval <0 函数调用失败
	 */
	int WINAPI DIO_SetPins(int DevHandle, unsigned int PinMask);

	/**
	 * @brief  控制DIO引脚输出低电平
	 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
	 * @param[in]  PinMask 需要初始化的DIO引脚，可以参考 @ref DIO引脚宏定义
	 * @return 函数执行状态
	 * @retval =0 函数执行成功
	 * @retval <0 函数调用失败
	 */
	int WINAPI DIO_ResetPins(int DevHandle, unsigned int PinMask);

	/**
	 * @brief  设置PWM相位参数值
	 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
	 * @param[in]  PinMask 需要初始化的DIO引脚，可以参考 @ref DIO引脚宏定义
	 * @return 函数执行状态
	 * @retval >=0 读到的引脚状态
	 * @retval <0 函数调用失败
	 */
	int WINAPI DIO_ReadPins(int DevHandle, unsigned int PinMask);

	
#ifdef __cplusplus
}
#endif

/** @} USB转PWM*/
#endif



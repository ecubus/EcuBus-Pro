/**
 * @file   tinychip_programer.h
 * @brief  泰矽微(tinychip)氛围灯芯片编程接口函数
 * @author wdluo(wdluo@toomoss.com)
 * @version 1.0
 * @date 2024-1-30
 * @copyright Copyright (c) 2022 重庆图莫斯电子科技有限公司
 */
#ifndef __TINYCHIP_PROGRAMER_H_
#define __TINYCHIP_PROGRAMER_H_

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
  *@defgroup 泰矽微芯片编程
  * @{
  * @brief 包含泰矽微(tinychip)氛围灯芯片编程接口函数
 */

 /**
  *@name 函数返回错误值宏定义
  *@brief 函数调用出错后返回值定义
  *@{
 */
#define TINYCHIP_SUCCESS             (0)     ///<函数执行成功
#define TINYCHIP_ERR_OPEN_DEV        (-1)    ///<打开设备失败
#define TINYCHIP_ERR_INIT_DEV        (-2)    ///<初始化设备失败
#define TINYCHIP_ERR_FILE_FORMAT     (-3)    ///<传入文件格式错误
#define TINYCHIP_ERR_BEGIN_PROG      (-4)    ///<开始编程出错
#define TINYCHIP_ERR_CMD_FAIL        (-5)    ///<命令执行失败
#define TINYCHIP_ERR_PRG_FAILD       (-6)    ///<编程失败
#define TINYCHIP_ERR_FIND_CHIP       (-7)    ///<寻找芯片失败
#define TINYCHIP_ERR_SET_BAUD        (-8)    ///<设置波特率失败 
#define TINYCHIP_ERR_SA				 (-9)    ///<安全访问出错 
 /** @} */


#ifdef __cplusplus
extern "C"
{
#endif
	/**
	 * @brief  开始对芯片进行编程下载，芯片需要使用适配器电源供电才能正常下载程序数据
	 * @param  DeviceHandle DeviceHandle 设备号，通过调用 @ref USB_ScanDevice 获取
	 * @param  LINChannel LIN通道号，0-LIN1，1-LIN2，2-LIN3，3-LIN4
	 * @param  NAD 节点地址，0-自动识别节点地址，0x7F-广播地址，其他为正常的节点地址
	 * @param  SpeedValue 烧写速度，可以传入9600,19200,115200
	 * @param  AppFileName 芯片程序文件
	 * @return 函数执行状态
	 * @retval =0 函数执行成功
	 * @retval <0 函数调用失败
	 */
	int WINAPI Tinychip_StartProg(int DevHandle, unsigned char LINChannel, unsigned char NAD, int SpeedValue, const char* AppFileName);

#ifdef __cplusplus
}
#endif

/** @} */
#endif




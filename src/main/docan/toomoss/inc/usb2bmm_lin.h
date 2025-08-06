/**
 * @file   usb2bmm_lin.h
 * @brief  USB转自定义LIN接口函数和数据类型定义
 * @author wdluo(wdluo@toomoss.com)
 * @version 1.0
 * @date 2022-10-06
 * @copyright Copyright (c) 2022 重庆图莫斯电子科技有限公司
 */
#ifndef __USB2BMM_LIN_H_
#define __USB2BMM_LIN_H_

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
 *@defgroup USB2BMM_LIN
 * @{
 * @brief USB转自定义LIN协议接口函数和相关数据结构定义
*/

/**
 *@name 函数返回错误值宏定义
 *@brief 函数调用出错后返回值定义
 *@{
*/
#define BMM_LIN_SUCCESS             (0)   ///<函数执行成功
#define BMM_LIN_ERR_NOT_SUPPORT     (-1)  ///<设备不支持该函数
#define BMM_LIN_ERR_USB_WRITE_FAIL  (-2)  ///<USB发送数据错误
#define BMM_LIN_ERR_USB_READ_FAIL   (-3)  ///<USB读取数据错误
#define BMM_LIN_ERR_CMD_FAIL        (-4)  ///<命令执行失败
#define BMM_LIN_ERR_CH_NO_INIT      (-5)  ///<当前通道未初始化
#define BMM_LIN_ERR_READ_DATA       (-6)  ///<LIN读数据错误
#define BMM_LIN_ERR_PARAMETER       (-7)  ///<函数传入参数错误
#define BMM_LIN_ERR_WRITE           (-8)  ///<LIN发送数据错误
#define BMM_LIN_ERR_READ            (-9)  ///<LIN读数据错误
#define BMM_LIN_ERR_RESP            (-10) ///<数据响应错误
#define BMM_LIN_ERR_CHECK           (-11) ///<数据校验错误
/** @} */

#ifdef __cplusplus
extern "C"
{
#endif
/**
 * @brief  自定义LIN协议初始化，使用该功能必须调用此函数
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  LINIndex LIN通道号，0-LIN1，1-LIN2，2-LIN3，3-LIN4
 * @param  BaudRate 波特率值，单位bps
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI BMM_LIN_Init(int DevHandle,unsigned char LINIndex,int BaudRate);

/**
 * @brief  设置自定义LIN发送数据时序相关参数
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  LINIndex LIN通道号，0-LIN1，1-LIN2，2-LIN3，3-LIN4
 * @param  BreakBits 发送同步间隔宽度，默认是13bit
 * @param  InterByteSpaceUs 发送数据字节间间隔时间，单位为微秒
 * @param  BreakSpaceUs 同步间隔和发送数据之间的间隔时间，单位为微秒
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI BMM_LIN_SetPara(int DevHandle, unsigned char LINIndex, unsigned char BreakBits, int InterByteSpaceUs, int BreakSpaceUs);

/**
 * @brief  发送自定义LIN数据
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  LINIndex  
 * @param[in]  pData 待发送的数据缓冲区指针，这里传入什么数据，LIN总线上就发送什么数据
 * @param  Len 待发送的数据有效字节数
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI BMM_LIN_WriteData(int DevHandle,unsigned char LINIndex,unsigned char *pData,unsigned int Len);

/**
 * @brief  读取LIN总线上收到的数据，调用 @ref BMM_LIN_WriteData 函数后，调用此函数会返回成功发送到总线上的数据
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  LINIndex LIN通道号，0-LIN1，1-LIN2，2-LIN3，3-LIN4
 * @param  pData 存储接收数据的数据缓冲区指针
 * @return 函数执行状态
 * @retval >0 读取到的有效数据字节数
 * @retval =0 没有读到数据
 * @retval <0 函数调用失败
 */
int WINAPI BMM_LIN_ReadData(int DevHandle,unsigned char LINIndex,unsigned char *pData);

/**
 * @brief  等待LIN总线接收到指定字节数，若在超时时间内收到了指定字节数数据则直接返回，否则会等待超时时间到
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  LINIndex LIN通道号，0-LIN1，1-LIN2，2-LIN3，3-LIN4
 * @param  DataNum 等待收到的数据字节数
 * @param  TimeOutMs 超时时间，单位为毫秒
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI BMM_LIN_WaitDataNum(int DevHandle,unsigned char LINIndex,unsigned int DataNum,int TimeOutMs);

#ifdef __cplusplus
}
#endif

/** @} */
#endif



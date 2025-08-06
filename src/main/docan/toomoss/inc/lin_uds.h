/**
 * @file   lin_uds.h
 * @brief  LIN UDS协议接口函数和相关数据结构定义
 * @author wdluo(wdluo@toomoss.com)
 * @version 1.0
 * @date 2022-10-05
 * @copyright Copyright (c) 2022 重庆图莫斯电子科技有限公司
 */
#ifndef __LIN_UDS_H_
#define __LIN_UDS_H_

#include <stdint.h>
#include "usb2lin_ex.h"
#ifdef _WIN32
#include <Windows.h>
#else
#include <unistd.h>
#ifndef WINAPI
#define WINAPI
#endif
#endif
/**
 *@defgroup LIN_UDS
 * @{
 * @brief LIN UDS协议接口函数和相关数据结构定义
*/

/**
 *@name 函数返回错误值宏定义
 *@brief 函数调用出错后返回值定义
 *@{
*/
#define LIN_UDS_OK            0     ///<函数执行成功
#define LIN_UDS_TRAN_USB      -98   ///<USB数据传输错误
#define LIN_UDS_TRAN_LIN      -99   ///<LIN总线数据传输错误，一般是LIN总线异常
#define LIN_UDS_TIMEOUT_A     -100  ///<超时错误
#define LIN_UDS_TIMEOUT_Bs    -101  ///<超时错误
#define LIN_UDS_TIMEOUT_Cr    -102  ///<超时错误
#define LIN_UDS_WRONG_SN      -103  ///<错误的SN
#define LIN_UDS_INVALID_FS    -104  ///<首帧数据错误
#define LIN_UDS_UNEXP_PDU     -105  ///<数据不符合UDS协议
#define LIN_UDS_WFT_OVRN      -106  ///<数据格式错误
#define LIN_UDS_BUFFER_OVFLW  -107  ///<缓冲区溢出错误
#define LIN_UDS_ERROR         -108  ///<其他错误
/** @} */

/**
 * @brief  UDS地址结构体定义
 */
typedef  struct  _LIN_UDS_ADDR
{
    unsigned char   ReqID; ///<请求报文ID，一般为0x3C
    unsigned char   ResID; ///<应答报文ID，一般为0x3D
    unsigned char   NAD;   ///<节点地址，0x7F为广播地址
    unsigned char   CheckType;///<0-标准，1-增强，一般为标准校验
    unsigned char   STmin;  ///<连续帧时间间隔，单位为毫秒
}LIN_UDS_ADDR;

#ifdef __cplusplus
extern "C"
{
#endif
/**
 * @brief  发送UDS请求数据
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  LINIndex LIN通道号，0-LIN1，1-LIN2，2-LIN3，3-LIN4
 * @param[in]  pUDSAddr UDS地址结构体指针
 * @param[in]  pReqData 请求数据指针，一般为服务ID，子服务ID，参数
 * @param  DataLen 请求数据字节数，若数据字节数大于单帧能发送的最大字节数，则底层自动分为多帧传输
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI LIN_UDS_Request(int DevHandle,unsigned char LINIndex,LIN_UDS_ADDR *pUDSAddr,unsigned char *pReqData,int DataLen);

/**
 * @brief  获取UDS响应数据
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  LINIndex LIN通道号，0-LIN1，1-LIN2，2-LIN3，3-LIN4
 * @param[in]  pUDSAddr UDS地址结构体指针
 * @param[out]  pResData 存储响应数据的缓冲区指针
 * @param  TimeOutMs 等待数据超时时间，单位为毫秒
 * @return 函数执行状态
 * @retval >0 读取到的响应数据字节数
 * @retval =0 没有读取到响应数据
 * @retval <0 函数调用失败
 */
int WINAPI LIN_UDS_Response(int DevHandle,unsigned char LINIndex,LIN_UDS_ADDR *pUDSAddr,unsigned char *pResData,int TimeOutMs);

/**
 * @brief  获取LIN UDS收发原始帧
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  LINIndex LIN通道号，0-LIN1，1-LIN2，2-LIN3，3-LIN4
 * @param  pLINMsg 存储LIN消息的数据缓冲区指针
 * @param  BufferSize 缓冲区大小
 * @return 函数执行状态
 * @retval >0 读取到的LIN消息帧数
 * @retval =0 没有读取到LIN消息
 * @retval <0 函数调用失败
 */
int WINAPI LIN_UDS_GetMsgFromUDSBuffer(int DevHandle,unsigned char LINIndex,LIN_EX_MSG *pLINMsg,int BufferSize);

#ifdef __cplusplus
}
#endif

/** @} */
#endif




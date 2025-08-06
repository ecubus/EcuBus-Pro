/**
 * @file   can_uds.h
 * @brief  CAN UDS相关函数和数据类型定义
 * @author wdluo(wdluo@toomoss.com)
 * @version 1.0
 * @date 2022-10-06
 * @copyright Copyright (c) 2022 重庆图莫斯电子科技有限公司
 */
#ifndef __CAN_UDS_H_
#define __CAN_UDS_H_

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
 *@defgroup CAN_UDS
 * @{
 * @brief CAN UDS协议接口函数和相关数据结构定义
*/

/**
 *@name 函数返回错误值宏定义
 *@brief 函数调用出错后返回值定义
 *@{
*/
#define CAN_UDS_OK            0     ///<函数执行成功
#define CAN_UDS_TRAN_USB      -98   ///<USB数据传输出错
#define CAN_UDS_TRAN_CAN      -99   ///<CAN数据传输失败
#define CAN_UDS_TIMEOUT_A     -100  ///<超时错误
#define CAN_UDS_TIMEOUT_Bs    -101  ///<超时错误
#define CAN_UDS_TIMEOUT_Cr    -102  ///<超时错误
#define CAN_UDS_WRONG_SN      -103  ///<检测到数据不符合UDS协议
#define CAN_UDS_INVALID_FS    -104  ///<检测到数据不符合UDS协议
#define CAN_UDS_UNEXP_PDU     -105  ///<检测到数据不符合UDS协议
#define CAN_UDS_WFT_OVRN      -106  ///<检测到数据不符合UDS协议
#define CAN_UDS_BUFFER_OVFLW  -107  ///<缓冲区溢出
#define CAN_UDS_ERROR         -108  ///<其他错误
/** @} */

/**
 *@name UDS标志定义
 *@brief UDS收发帧类型标志宏定义
 *@{
*/
#define CAN_UDS_EXT            0x01     ///<帧类型为扩展帧
#define CAN_UDS_FDF            0x02     ///<使用CANFD帧发送数据
#define CAN_UDS_BRS            0x04     ///<使用CANFD加速帧发送数据
#define CAN_UDS_ADLC           0x80     ///<根据发送数据长度自适应DLC长度，仅用于CANFD帧或者CANFD加速帧
/** @} */

/**
 * @brief  CAN UDS数据收发信息定义
 */
typedef  struct  _CAN_UDS_ADDR
{
    unsigned int    ReqID;        ///<请求报文ID
    unsigned int    ResID;        ///<应答报文ID
    unsigned char   Flag;         ///<bit[0]-帧类型(0-标准帧，1-扩展帧),bit[1]-FDF(0-普通CAN帧，1-CANFD帧),bit[2]-BRS(0-CANFD帧不加速，1-CANFD帧加速),bit[7]-自动根据发送数据长度选择最合适的DLC值
    unsigned char   AddrFormats;  ///<0-normal, 1-extended ,2-mixed
    unsigned char   AddrExt;      ///<当AddrFormats不为normal时，该数据放到CAN数据域第1字节
    unsigned char   MaxDLC;       ///<普通CAN设置为8，CANFD帧可以最大设置为64
}CAN_UDS_ADDR;

#ifdef __cplusplus
extern "C"
{
#endif
/**
 * @brief  UDS发送请求数据，调用该函数之前要调用CAN初始化函数，否则无法正常的收发CAN数据
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @param[in]  pUDSAddr UDS数据收发控制信息结构体指针，详细可以参考 @ref CAN_UDS_ADDR
 * @param[in]  pReqData 发送的请求数据指针，包含服务SID，子服务ID，参数
 * @param  DataLen 请求的数据有效字节数
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI CAN_UDS_Request(int DevHandle,unsigned char CANIndex,CAN_UDS_ADDR *pUDSAddr,unsigned char *pReqData,int DataLen);

/**
 * @brief  获取UDS响应数据，该函数一般是在调用 @ref CAN_UDS_Request 函数之后调用
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @param[in]  pUDSAddr UDS数据收发控制信息结构体指针，详细可以参考 @ref CAN_UDS_ADDR
 * @param[out]  pResData 存储响应数据的缓冲区指针，里面包含RSID和对应的参数数据
 * @param  TimeOutMs 等待响应的超时时间，单位为ms
 * @return 函数执行状态
 * @retval >0 获取到的响应数据字节数
 * @retval =0 没有获取到响应数据
 * @retval <0 函数调用失败
 */
int WINAPI CAN_UDS_Response(int DevHandle,unsigned char CANIndex,CAN_UDS_ADDR *pUDSAddr,unsigned char *pResData,int TimeOutMs);

#ifdef __cplusplus
}
#endif
/** @} */
#endif



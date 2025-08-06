/**
 * @file   dbc_parser.h
 * @brief  DBC文件解析相关函数定义
 * @author wdluo(wdluo@toomoss.com)
 * @version 1.0
 * @date 2022-10-06
 * @copyright Copyright (c) 2022 重庆图莫斯电子科技有限公司
 */
#ifndef __DBC_PARSER_H_
#define __DBC_PARSER_H_

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
 *@defgroup DBC文件解析
 * @{
 * @brief DBC文件解析相关函数定义
*/

/**
 *@name 函数返回错误值宏定义
 *@brief 函数调用出错后返回值定义
 *@{
*/
#define DBC_PARSER_OK                   0///<函数执行成功
#define DBC_PARSER_FILE_OPEN         (-1)///<打开文件失败
#define DBC_PARSER_FILE_FORMAT       (-2)///<文件格式错误
#define DBC_PARSER_DEV_DISCONNECT    (-3)///<设备未连接
#define DBC_PARSER_HANDLE_ERROR      (-4)///<文件解析句柄错误
#define DBC_PARSER_GET_INFO_ERROR    (-5)///<读取信息错误
#define DBC_PARSER_DATA_ERROR        (-6)///<数据错误
/** @} */

#ifdef __cplusplus
extern "C"
{
#endif
/**
 * @brief  解析DBC文件
 * @param  DevHandle 通过调用 @ref USB_ScanDevice 获取
 * @param[in]  pDBCFileName DBC文件名称
 * @return 文件解析结果
 * @retval >0 DBC解析句柄，后续函数需要该值
 * @retval =0 文件解析失败
 */
long long WINAPI DBC_ParserFile(int DevHandle, char* pDBCFileName);

/**
 * @brief  获取DBC文件里面包含的消息帧数
 * @param  DBCHandle DBC解析句柄，通过调用 @ref DBC_ParserFile 函数获取
 * @return DBC文件包含消息帧数
 */
int WINAPI DBC_GetMsgQuantity(long long DBCHandle);

/**
 * @brief  获取消息名称
 * @param  DBCHandle DBC解析句柄，通过调用 @ref DBC_ParserFile 函数获取
 * @param  index 待获取消息名称的索引号，该值不能大于 @ref DBC_GetMsgQuantity 函数返回值
 * @param[out]  pMsgName 消息名称字符串
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI DBC_GetMsgName(long long DBCHandle, int index, char* pMsgName);

/**
 * @brief  通过ID获取消息名称
 * @param  DBCHandle DBC解析句柄，通过调用 @ref DBC_ParserFile 函数获取
 * @param  ID 需要获取名称的ID值
 * @param[out]  pMsgName 消息名称字符串
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI DBC_GetMsgNameByID(long long DBCHandle, uint32_t ID, char* pMsgName);

/**
 * @brief  获取帧里面包含的信号数量
 * @param  DBCHandle DBC解析句柄，通过调用 @ref DBC_ParserFile 函数获取 
 * @param[in]  pMsgName 消息名称
 * @return 消息里面包含的信号数量
 */
int WINAPI DBC_GetMsgSignalQuantity(long long DBCHandle, char* pMsgName);

/**
 * @brief  获取消息里面的信号名称
 * @param  DBCHandle DBC解析句柄，通过调用 @ref DBC_ParserFile 函数获取
 * @param[in]  pMsgName 消息名称字符串
 * @param  index 待获取信号名称的索引号值，该值不能大于 @ref DBC_GetMsgSignalQuantity 函数返回值
 * @param[out]  pSignalName 获取到的信号名称
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI DBC_GetMsgSignalName(long long DBCHandle, char* pMsgName, int index, char* pSignalName);

/**
 * @brief  获取指定消息的发布者，也就是发送该消息的节点名称
 * @param  DBCHandle DBC解析句柄，通过调用 @ref DBC_ParserFile 函数获取
 * @param[in]  pMsgName 消息名称字符串
 * @param[out]  pPublisher 消息发布者名称
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI DBC_GetMsgPublisher(long long DBCHandle, char* pMsgName, char* pPublisher);

/**
 * @brief  设置信号物理值
 * @param  DBCHandle DBC解析句柄，通过调用 @ref DBC_ParserFile 函数获取
 * @param[in]  pMsgName 消息名称字符串
 * @param[in]  pSignalName 信号名称字符串
 * @param  Value 信号物理值
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI DBC_SetSignalValue(long long DBCHandle, char* pMsgName, char* pSignalName, double Value);

/**
 * @brief  获取信号物理值
 * @param  DBCHandle DBC解析句柄，通过调用 @ref DBC_ParserFile 函数获取
 * @param[in]  pMsgName 消息名称字符串
 * @param[in]  pSignalName 信号名称字符串
 * @param[out]  pValue 信号物理值指针
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI DBC_GetSignalValue(long long DBCHandle, char* pMsgName, char* pSignalName, double* pValue);

/**
 * @brief  获取信号值字符串
 * @param  DBCHandle DBC解析句柄，通过调用 @ref DBC_ParserFile 函数获取
 * @param[in]  pMsgName 消息名称字符串
 * @param[in]  pSignalName 信号名称字符串
 * @param[out]  pValueStr 信号值字符串
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI DBC_GetSignalValueStr(long long DBCHandle, char* pMsgName, char* pSignalName, char* pValueStr);

/**
 * @brief  同步CAN消息到DBC解析库里面，同步后可以获取到信号值
 * @param  DBCHandle DBC解析句柄，通过调用 @ref DBC_ParserFile 函数获取
 * @param[in]  pCANMsg CAN消息指针，消息定义可以参考 @ref CAN_MSG
 * @param  MsgLen 待同步的消息帧数
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI DBC_SyncCANMsgToValue(long long DBCHandle, void* pCANMsg,int MsgLen);

/**
 * @brief  同步CANFD消息到DBC解析库里面，同步后可以获取到信号值
 * @param  DBCHandle DBC解析句柄，通过调用 @ref DBC_ParserFile 函数获取
 * @param[in]  pCANFDMsg CAN FD消息指针，消息定义可以参考 @ref CANFD_MSG
 * @param  MsgLen 待同步的消息帧数
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI DBC_SyncCANFDMsgToValue(long long DBCHandle, void* pCANFDMsg, int MsgLen);

/**
 * @brief  同步DBC解析库里面的数据到CAN消息里面
 * @param  DBCHandle DBC解析句柄，通过调用 @ref DBC_ParserFile 函数获取
 * @param[in]  pMsgName 消息名称字符串
 * @param[out]  pCANMsg CAN消息指针，调用该函数后，该消息里面会包含有效CAN数据，消息定义可以参考 @ref CAN_MSG
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI DBC_SyncValueToCANMsg(long long DBCHandle, char* pMsgName, void* pCANMsg);

/**
 * @brief  同步DBC解析库里面的数据到CANFD消息里面
 * @param  DBCHandle DBC解析句柄，通过调用 @ref DBC_ParserFile 函数获取
 * @param[in]  pMsgName 消息名称字符串
 * @param[out]  pCANFDMsg CANFD消息指针，调用该函数后，该消息里面会包含有效CANFD数据，消息定义可以参考 @ref CANFD_MSG
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI DBC_SyncValueToCANFDMsg(long long DBCHandle, char* pMsgName, void* pCANFDMsg);
#ifdef __cplusplus
}
#endif
/** @} */
#endif




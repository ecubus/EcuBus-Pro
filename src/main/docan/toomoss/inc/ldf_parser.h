/**
 * @file   ldf_parser.h
 * @brief  LDF文件解析相关函数
 * @author wdluo(wdluo@toomoss.com)
 * @version 1.0
 * @date 2022-10-06
 * @copyright Copyright (c) 2022 重庆图莫斯电子科技有限公司
 */
#ifndef __LDF_PARSER_H_
#define __LDF_PARSER_H_

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
 *@defgroup LDF文件解析
 * @{
 * @brief LDF文件解析相关函数定义
*/

/**
 *@name 函数返回错误值宏定义
 *@brief 函数调用出错后返回值定义
 *@{
*/
#define LDF_PARSER_OK                   0///<函数执行成功
#define LDF_PARSER_FILE_OPEN         (-1)///<打开文件失败
#define LDF_PARSER_FILE_FORMAT       (-2)///<文件格式错误
#define LDF_PARSER_DEV_DISCONNECT    (-3)///<设备未连接
#define LDF_PARSER_HANDLE_ERROR      (-4)///<文件解析句柄错误
#define LDF_PARSER_GET_INFO_ERROR    (-5)///<读取信息错误
#define LDF_PARSER_DATA_ERROR        (-6)///<数据错误
#define LDF_PARSER_SLAVE_NACK        (-7)///<从机无应答数据
/** @} */

#ifdef __cplusplus
extern "C"
{
#endif
/**
 * @brief  解析LDF文件，使用LDF文件解析功能必须先调用该函数
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  LINIndex LIN通道号，0-LIN1，1-LIN2，2-LIN3，3-LIN4
 * @param  isMaster 当前适配器配置为主机还是从机，0-从机，1-主机
 * @param  pLDFFileName LDF文件名称
 * @return 文件解析结果
 * @retval >0 LDF解析句柄，后续函数需要该值
 * @retval =0 文件解析失败
 */
long long WINAPI LDF_ParserFile(int DevHandle, int LINIndex, unsigned char isMaster, char* pLDFFileName);

/**
 * @brief  获取LDF文件版本号
 * @param  LDFHandle LDF解析句柄，通过调用 @ref LDF_ParserFile 函数获取
 * @return LDF文件版本号
 */
int WINAPI LDF_GetProtocolVersion(long long LDFHandle);

/**
 * @brief  获取文件里面的波特率值
 * @param  LDFHandle LDF解析句柄，通过调用 @ref LDF_ParserFile 函数获取
 * @return 文件里面定义的波特率值，单位为bps
 */
int WINAPI LDF_GetLINSpeed(long long LDFHandle);

/**
 * @brief  获取文件里面定义的帧数量
 * @param  LDFHandle LDF解析句柄，通过调用 @ref LDF_ParserFile 函数获取
 * @return 解析到文件里面包含的帧数量
 */
int WINAPI LDF_GetFrameQuantity(long long LDFHandle);

/**
 * @brief  获取帧名称
 * @param  LDFHandle LDF解析句柄，通过调用 @ref LDF_ParserFile 函数获取
 * @param  index 需要获取帧名称的帧索引，该值不能大于 @ref LDF_GetFrameQuantity 函数返回值
 * @param[out]  pFrameName 帧名称字符串
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI LDF_GetFrameName(long long LDFHandle, int index, char* pFrameName);

/**
 * @brief  通过ID获取帧名称
 * @param  LDFHandle LDF解析句柄，通过调用 @ref LDF_ParserFile 函数获取
 * @param  ID 需要获取名称的ID值
 * @param[out]  pFrameName 帧名称字符串
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI LDF_GetFrameNameByID(long long LDFHandle, uint8_t ID, char* pFrameName);

/**
 * @brief  获取帧里面包含的信号数量
 * @param  LDFHandle LDF解析句柄，通过调用 @ref LDF_ParserFile 函数获取
 * @param[in]  pFrameName 帧名称字符串
 * @return 帧里面包含的信号数量
 */
int WINAPI LDF_GetFrameSignalQuantity(long long LDFHandle, char* pFrameName);

/**
 * @brief  获取帧里面的信号名称
 * @param  LDFHandle LDF解析句柄，通过调用 @ref LDF_ParserFile 函数获取
 * @param[in]  pFrameName 帧名称字符串
 * @param  index 需要获取信号名称的信号索引，该值不能大于 @ref LDF_GetFrameSignalQuantity 函数返回值
 * @param[out]  pSignalName 信号名称字符串
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI LDF_GetFrameSignalName(long long LDFHandle, char* pFrameName, int index, char* pSignalName);

/**
 * @brief  设置信号物理值
 * @param  LDFHandle LDF解析句柄，通过调用 @ref LDF_ParserFile 函数获取
 * @param[in]  pFrameName 帧名称字符串
 * @param[in]  pSignalName 信号名称字符串
 * @param  Value 信号物理值
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 * @attention 设置的信号必须是对应帧里面的信号，否则设置值会失败
 */
int WINAPI LDF_SetSignalValue(long long LDFHandle, char* pFrameName, char* pSignalName, double Value);

/**
 * @brief  获取信号值
 * @param  LDFHandle LDF解析句柄，通过调用 @ref LDF_ParserFile 函数获取
 * @param[in]  pFrameName 帧名称字符串
 * @param[in]  pSignalName 信号名称字符串
 * @param[out]  pValue 输出信号值指针
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI LDF_GetSignalValue(long long LDFHandle, char* pFrameName, char* pSignalName, double *pValue);

/**
 * @brief  获取信号值字符串
 * @param  LDFHandle LDF解析句柄，通过调用 @ref LDF_ParserFile 函数获取
 * @param[in]  pFrameName 帧名称字符串
 * @param[in]  pSignalName 信号名称字符串
 * @param[out]  pValueStr 信号值字符串
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI LDF_GetSignalValueStr(long long LDFHandle, char* pFrameName, char* pSignalName, char* pValueStr);

/**
 * @brief  设置帧原始数据，将原始数据传入后就能获取到解析之后的数据
 * @param  LDFHandle LDF解析句柄，通过调用 @ref LDF_ParserFile 函数获取
 * @param[in]  pFrameName 帧名称字符串
 * @param[in]  pRawData 待传入的原始数据指针
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI LDF_SetFrameRawValue(long long LDFHandle, char* pFrameName, unsigned char* pRawData);

/**
 * @brief  将原始LIN帧数据更新到LDF解析器，更新后可以通过调用 @ref LDF_GetSignalValue 函数获取信号值
 * @param  LDFHandle LDF解析句柄，通过调用 @ref LDF_ParserFile 函数获取
 * @param[in]  pLINMsg LIN帧数组首地址
 * @param[in]  MsgLen 传入的帧数
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI LDF_SyncMsgToValue(long long LDFHandle, LIN_EX_MSG* pLINMsg,int MsgLen);

/**
 * @brief  获取帧原始数据，设置帧里面信号值之后，调用该函数可以获取到原始数据值
 * @param  LDFHandle LDF解析句柄，通过调用 @ref LDF_ParserFile 函数获取
 * @param[in]  pFrameName 帧名称字符串
 * @param[out]  pRawData 存储输出原始数据值指针
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI LDF_GetFrameRawValue(long long LDFHandle, char* pFrameName, unsigned char* pRawData);

/**
 * @brief  获取帧发布者，若当前适配器配置为主机模式，发布者名称若跟主机名称一致，说明该帧是主机发送给从机的
 * @param  LDFHandle LDF解析句柄，通过调用 @ref LDF_ParserFile 函数获取
 * @param[in]  pFrameName 帧名称字符串
 * @param[out]  pPublisher 帧发布者名称字符串
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI LDF_GetFramePublisher(long long LDFHandle, char* pFrameName, char* pPublisher);

/**
 * @brief  获取主机名称
 * @param  LDFHandle LDF解析句柄，通过调用 @ref LDF_ParserFile 函数获取
 * @param  pMasterName 输出主机名称指针
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI LDF_GetMasterName(long long LDFHandle,  char* pMasterName);

/**
 * @brief  获取调度表数量
 * @param  LDFHandle LDF解析句柄，通过调用 @ref LDF_ParserFile 函数获取
 * @return LDF文件里面包含的调度表数量
 */
int WINAPI LDF_GetSchQuantity(long long LDFHandle);

/**
 * @brief  获取调度表名称
 * @param  LDFHandle LDF解析句柄，通过调用 @ref LDF_ParserFile 函数获取
 * @param  index 获取调度表名称的索引号，该值不能大于 @ref LDF_GetSchQuantity 函数返回值
 * @param[out]  pSchName 调度表名称字符串
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI LDF_GetSchName(long long LDFHandle, int index, char* pSchName);

/**
 * @brief  获取调度表里面包含的帧数量
 * @param  LDFHandle LDF解析句柄，通过调用 @ref LDF_ParserFile 函数获取
 * @param[in]  pSchName 调度表名称
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI LDF_GetSchFrameQuantity(long long LDFHandle, char* pSchName);

/**
 * @brief  获取调度表里面的帧名称
 * @param  LDFHandle LDF解析句柄，通过调用 @ref LDF_ParserFile 函数获取
 * @param[in]  pSchName 调度表名称字符串
 * @param  index 待获取帧名称索引号
 * @param[out]  pFrameName 帧名称字符串
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI LDF_GetSchFrameName(long long LDFHandle, char* pSchName, int index, char* pFrameName);

/**
 * @brief  执行帧到总线，若该帧的发布者是主机，那么就是主机写数据，否则就是主机读数据
 * @param  LDFHandle LDF解析句柄，通过调用 @ref LDF_ParserFile 函数获取
 * @param[in]  pFrameName 帧名称字符串
 * @param  FillBitValue 未使用的位填充值，可以设置为0或者1
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI LDF_ExeFrameToBus(long long LDFHandle, char* pFrameName, unsigned char FillBitValue);

/**
 * @brief  执行调度表到总线，若调度表里面包含多个帧，那么每个帧都会执行到总线
 * @param  LDFHandle LDF解析句柄，通过调用 @ref LDF_ParserFile 函数获取
 * @param[in]  pSchName 调度表名称
 * @param  FillBitValue 未使用的位填充值，可以设置为0或者1
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI LDF_ExeSchToBus(long long LDFHandle, char* pSchName, unsigned char FillBitValue);

/**
 * @brief  将LDF里面的调度表配置到适配器内部自动执行
 * @param  LDFHandle LDF解析句柄，通过调用 @ref LDF_ParserFile 函数获取
 * @param[in]  pSchName 调度表名称
 * @param  FillBitValue 未使用的位填充值，可以设置为0或者1
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI LDF_SetSchToTable(long long LDFHandle, char* pSchName, unsigned char FillBitValue);

/**
 * @brief  执行帧或者执行调度表后在总线上发送的原始帧数据
 * @param  LDFHandle LDF解析句柄，通过调用 @ref LDF_ParserFile 函数获取
 * @param[out]  pLINMsg 存储帧数据缓冲区
 * @param  BufferSize 存储帧数据缓冲区大小
 * @return 函数执行状态
 * @retval >=0 成功获取到的帧数
 * @retval <0 函数调用失败
 */
int WINAPI LDF_GetRawMsg(long long LDFHandle, LIN_EX_MSG* pLINMsg, int BufferSize);

/**
 * @brief  释放ldf解析相关资源，释放后LDFHandle不能再被使用了
 * @param  LDFHandle LDF解析句柄，通过调用 @ref LDF_ParserFile 函数获取
 * @return 函数执行状态
 * @retval >=0 成功获取到的帧数
 * @retval <0 函数调用失败
 */
int WINAPI LDF_Release(long long LDFHandle);
#ifdef __cplusplus
}
#endif
/** @} */
#endif




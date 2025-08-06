/**
 * @file usb2lin_ex.h
 * @brief  USB转LIN相关函数
 * @author wdluo(wdluo@toomoss.com)
 * @version 1.0
 * @date 2022-10-04
 * @copyright Copyright (c) 2022 重庆图莫斯电子科技有限公司
 */
#ifndef __USB2LIN_EX_H_
#define __USB2LIN_EX_H_

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
 *@defgroup USB转LIN
 * @{
 * @brief USB转LIN接口函数和数据类型定义
*/

/**
 *@name 函数返回错误值宏定义
 *@brief 函数调用出错后返回值定义
 *@{
*/
#define LIN_EX_SUCCESS             (0)   ///<函数执行成功
#define LIN_EX_ERR_NOT_SUPPORT     (-1)  ///<适配器不支持该函数
#define LIN_EX_ERR_USB_WRITE_FAIL  (-2)  ///<USB写数据失败
#define LIN_EX_ERR_USB_READ_FAIL   (-3)  ///<USB读数据失败
#define LIN_EX_ERR_CMD_FAIL        (-4)  ///<命令执行失败
#define LIN_EX_ERR_CH_NO_INIT      (-5)  ///<该通道未初始化
#define LIN_EX_ERR_READ_DATA       (-6)  ///<LIN读数据失败
#define LIN_EX_ERR_PARAMETER       (-7)  ///<函数参数传入有误
/** @} */

/**
 *@name 校验类型宏定义
 *@brief LIN总线校验类型定义
 *@{
*/
#define LIN_EX_CHECK_STD     0  ///<标准校验，校验数据不含PID
#define LIN_EX_CHECK_EXT     1  ///<增强校验，校验数据包含PID
#define LIN_EX_CHECK_USER    2  ///<自定义校验类型，需要用户自己计算并传入Check，不进行自动校验
#define LIN_EX_CHECK_NONE    3  ///<不计算校验数据
#define LIN_EX_CHECK_ERROR   4  ///<接收数据校验错误
/** @} */

/**
 *@name 主从宏定义
 *@brief LIN主从宏定义
 *@{
*/
#define LIN_EX_MASTER        1  ///<主机
#define LIN_EX_SLAVE         0  ///<从机
/** @} */

/**
 *@name VBAT引脚电压定义
 *@brief VBAT引脚输出电压值定义
 *@{
*/
#define LIN_EX_VBAT_0V      0///<VBAT输出0V
#define LIN_EX_VBAT_12V     1///<VBAT输出12V
#define LIN_EX_VBAT_5V      2///<VBAT输出5V
/** @} */

/**
 *@name 帧类型宏定义
 *@brief 定义数据收发帧类型
 *@{
*/
#define LIN_EX_MSG_TYPE_UN      0  ///<未知类型
#define LIN_EX_MSG_TYPE_MW      1  ///<主机向从机发送数据
#define LIN_EX_MSG_TYPE_MR      2  ///<主机向从机读取数据
#define LIN_EX_MSG_TYPE_SW      3  ///<从机发送数据
#define LIN_EX_MSG_TYPE_SR      4  ///<从机接收数据
#define LIN_EX_MSG_TYPE_BK      5  ///<只发送BREAK信号，若是反馈回来的数据，表明只检测到BREAK信号
#define LIN_EX_MSG_TYPE_SY      6  ///<表明检测到了BREAK，SYNC信号
#define LIN_EX_MSG_TYPE_ID      7  ///<表明检测到了BREAK，SYNC，PID信号
#define LIN_EX_MSG_TYPE_DT      8  ///<表明检测到了BREAK，SYNC，PID,DATA信号
#define LIN_EX_MSG_TYPE_CK      9  ///<表明检测到了BREAK，SYNC，PID,DATA,CHECK信号
/** @} */

/**
 *@brief LIN帧数据类型定义
 */
typedef struct _LIN_EX_MSG{
    unsigned int  Timestamp;    ///<从机接收数据时代表时间戳，单位为ms;主机读写数据时，表示数据读写后的延时时间，单位为ms
    unsigned char MsgType;      ///<帧类型
    unsigned char CheckType;    ///<校验类型
    unsigned char DataLen;      ///<LIN数据段有效数据字节数
    unsigned char Sync;         ///<固定值，0x55
    unsigned char PID;          ///<帧ID，发送数据填入ID即可，接收数据时为PID，ID=PID&0x3F
    unsigned char Data[8];      ///<数据，有效数据通过DataLen来获取
    unsigned char Check;        ///<校验,只有校验数据类型为LIN_EX_CHECK_USER的时候才需要用户传入数据
    unsigned char BreakBits;    ///<该帧的BRAK信号位数，有效值为10到26，若设置为其他值则默认为13位
    unsigned char Reserve1;     ///<保留
}LIN_EX_MSG,*PLIN_EX_MSG;

#ifdef __cplusplus
extern "C"
{
#endif
/**
 * @brief  LIN总线初始化，在使用LIN相关函数之前必须先调用该函数
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  LINIndex LIN通道号，0-LIN1，1-LIN2，2-LIN3，3-LIN4
 * @param  BaudRate LIN总线波特率值，单位为bps，最小值为2000，最大值为100000
 * @param  MasterMode LIN工作模式，0-从机，1-主机
 * @return 函数执行状态
 * @retval 0 函数调用成功
 * @retval <0 函数调用失败
 */
int WINAPI  LIN_EX_Init(int DevHandle,unsigned char LINIndex,unsigned int BaudRate,unsigned char MasterMode);

/**
 * @brief  LIN总线初始化，在使用LIN相关函数之前必须先调用该函数
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  LINIndex LIN通道号，0-LIN1，1-LIN2，2-LIN3，3-LIN4
 * @param  BaudRateBps LIN总线波特率值，单位为bps，最小值为2000，最大值为100000
 * @param  MasterMode LIN工作模式，0-从机，1-主机
 * @param  ByteSpaceUs 主机发送数据时，字节间隔时间，单位为微秒
 * @param  ResponseSpaceUs 帧头与数据之间的时间间隔，单位为微秒
 * @param  TimeOutMs 主机读或者从机接收数据时，数据不满8字节时的超时时间，设置为0底层根据波特率自适应
 * @return 函数执行状态
 * @retval 0 函数调用成功
 * @retval <0 函数调用失败
 */
int WINAPI  LIN_EX_Init2(int DevHandle, unsigned char LINIndex, unsigned int BaudRateBps, unsigned char MasterMode, int ByteSpaceUs, int ResponseSpaceUs, int TimeOutMs);
/**
 * @brief  主机模式下，阻塞模式收发LIN数据
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  LINIndex LIN通道号，0-LIN1，1-LIN2，2-LIN3，3-LIN4
 * @param[in]  pInMsg 输入帧指针
 * @param[out]  pOutMsg 输出帧指针
 * @param  MsgLen 输入帧数
 * @return 函数执行状态
 * @retval >0 pOutMsg里面存储的有效帧数
 * @retval =0 数据收发失败
 * @retval <0 函数调用失败
 */
int WINAPI  LIN_EX_MasterSync(int DevHandle,unsigned char LINIndex,LIN_EX_MSG *pInMsg,LIN_EX_MSG *pOutMsg,unsigned int MsgLen);

/**
 * @brief  主机模式发送同步间隔信号，一般用于唤醒总线上睡眠的从设备
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  LINIndex LIN通道号，0-LIN1，1-LIN2，2-LIN3，3-LIN4
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI  LIN_EX_MasterBreak(int DevHandle,unsigned char LINIndex);

/**
 * @brief  主机模式写数据
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  LINIndex LIN通道号，0-LIN1，1-LIN2，2-LIN3，3-LIN4
 * @param  PID 帧ID
 * @param[in]  pData 待发送数据缓冲区指针
 * @param  DataLen 待发送数据有效数据字节数
 * @param  CheckType 发送数据校验类型，0-标准校验，校验数据不包含ID，1-增强校验，校验数据包含ID
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI  LIN_EX_MasterWrite(int DevHandle,unsigned char LINIndex,unsigned char PID,unsigned char *pData,unsigned char DataLen,unsigned char CheckType);

/**
 * @brief  主机模式读数据
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  LINIndex LIN通道号，0-LIN1，1-LIN2，2-LIN3，3-LIN4
 * @param  PID 帧ID
 * @param[out]  pData 读取数据存储缓冲区指针
 * @return 函数执行状态
 * @retval >0 成功读取到从机返回数据字节数
 * @retval =0 没有读到从机返回的数据，有可能是因为从机没有响应数据
 * @retval <0 函数调用失败
 */
int WINAPI  LIN_EX_MasterRead(int DevHandle,unsigned char LINIndex,unsigned char PID,unsigned char *pData);

/**
 * @brief  设置从机ID模式为发送或者接收数据模式
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  LINIndex LIN通道号，0-LIN1，1-LIN2，2-LIN3，3-LIN4
 * @param[in]  pLINMsg 帧指针，帧里面的MsgType来决定该ID是发送数据还是接收数据
 * @param  MsgLen 有效帧数
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI  LIN_EX_SlaveSetIDMode(int DevHandle,unsigned char LINIndex,LIN_EX_MSG *pLINMsg,unsigned int MsgLen);

/**
 * @brief  读取从机ID模式帧
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  LINIndex LIN通道号，0-LIN1，1-LIN2，2-LIN3，3-LIN4
 * @param[out]  pLINMsg 存储从机ID模式帧指针
 * @return 函数执行状态
 * @retval >=0 成功读取到的帧数
 * @retval <0 函数调用失败
 */
int WINAPI  LIN_EX_SlaveGetIDMode(int DevHandle,unsigned char LINIndex,LIN_EX_MSG *pLINMsg);

/**
 * @brief  读取从机模式下接收到的帧
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  LINIndex LIN通道号，0-LIN1，1-LIN2，2-LIN3，3-LIN4
 * @param[out]  pLINMsg 存储帧指针
 * @return 函数执行状态
 * @retval >=0 成功读取到的帧数
 * @retval <0 函数调用失败
 */
int WINAPI  LIN_EX_SlaveGetData(int DevHandle,unsigned char LINIndex,LIN_EX_MSG *pLINMsg);

/**
 * @brief  控制VBAT引脚输出指定电压值
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  LINIndex LIN通道号，0-LIN1，1-LIN2，2-LIN3，3-LIN4
 * @param  VbatValue VBAT输出电压值\n
 * @ref LIN_EX_VBAT_0V 关闭VBAT引脚电压输出，关闭输出后，VBAT引脚需要外接电压LIN才能正常工作\n
 * @ref LIN_EX_VBAT_12V VBAT引脚输出12V\n
 * @ref LIN_EX_VBAT_5V VBAT引脚输出5V
 * @return 函数执行状态
 * @retval 0 控制电压成功
 * @retval <0 函数调用失败
 */
int WINAPI  LIN_EX_CtrlPowerOut(int DevHandle,unsigned char LINIndex,unsigned char VbatValue);

/**
 * @brief  获取VBAT引脚电压，该函数已经弃用
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param[out]  pBatValue 引脚电压值输出指针
 * @return 函数执行状态
 * @retval 0 读取电压值成功
 * @retval <0 函数调用失败
 * @attention 该函数已经被弃用，调用该函数无法正确获取到VBAT引脚电压，不建议调用
 */
int WINAPI  LIN_EX_GetVbatValue(int DevHandle,unsigned short *pBatValue);

/**
 * @brief  主机调度表模式收发数据，使用该模式收发数据可以精确控制帧间隔时间，函数调用也是非阻塞的
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  LINIndex LIN通道号，0-LIN1，1-LIN2，2-LIN3，3-LIN4
 * @param[in]  pLINMsg 调度表模式收发数据帧指针
 * @param  MsgLen 有效帧数
 * @return 函数执行状态
 * @retval 0 函数调用成功
 * @retval <0 函数调用失败
 */
int WINAPI  LIN_EX_MasterStartSch(int DevHandle,unsigned char LINIndex,LIN_EX_MSG *pLINMsg,unsigned int MsgLen);

/**
 * @brief  停止执行调度表
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  LINIndex LIN通道号，0-LIN1，1-LIN2，2-LIN3，3-LIN4
 * @return 函数执行状态
 * @retval 0 函数调用成功
 * @retval <0 函数调用失败
 */
int WINAPI  LIN_EX_MasterStopSch(int DevHandle,unsigned char LINIndex);

/**
 * @brief  获取调度表执行状态
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  LINIndex LIN通道号，0-LIN1，1-LIN2，2-LIN3，3-LIN4
 * @return 调度表执行状态
 * @retval 0 调度表未执行
 * @retval 1 调度表正在执行
 * @retval <0 函数调用失败
 */
int WINAPI  LIN_EX_MasterGetSchState(int DevHandle, unsigned char LINIndex);

/**
 * @brief  读取主机模式调度表
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  LINIndex LIN通道号，0-LIN1，1-LIN2，2-LIN3，3-LIN4
 * @param  pLINMsg 调度表存储指针
 * @return 函数执行状态
 * @retval 0 函数调用成功
 * @retval <0 函数调用失败
 */
int WINAPI  LIN_EX_MasterGetSch(int DevHandle,unsigned char LINIndex,LIN_EX_MSG *pLINMsg);

/**
 * @brief  设置调度表运行次数，必须在启动调度表之前调用，否则调度表会根据最后一帧的帧周期决定是发送一次还是循环发送
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  LINIndex LIN通道号，0-LIN1，1-LIN2，2-LIN3，3-LIN4
 * @param  RunTimes 调度表运行次数，若设置为0xFFFFFFFF则一直发送，直到调用停止运行函数
 * @return 函数执行状态
 * @retval 0 函数调用成功
 * @retval <0 函数调用失败
 */
int WINAPI  LIN_EX_MasterSetSchRunTimes(int DevHandle, unsigned char LINIndex, unsigned int RunTimes);

/**
 * @brief  控制总线输出高电平或者是低电平，注意输出低电平后，无法正常输出LIN数据，需要重新控制输出高电平才能继续输出LIN数据
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  LINIndex LIN通道号，0-LIN1，1-LIN2，2-LIN3，3-LIN4
 * @param  BusState 总线状态，0-总线输出低电平，1-总线输出高电平
 * @return 函数执行状态
 * @retval 0 函数调用成功
 * @retval <0 函数调用失败
 */
int WINAPI  LIN_EX_SetBusState(int DevHandle, unsigned char LINIndex, unsigned char BusState);

/**
 * @brief  解析LIN列表文件
 * @param[in]  pFileName LIN列表文件名称
 * @param  CheckType 校验类型，0-标准校验，1-增强校验
 * @param  BaudRate 波特率值，单位为bps
 * @param[in]  pReadDataList 数据类型为主机读的ID列表指针
 * @param  ReadDataListLen 数据类型为主机读的ID列表有效长度
 * @param[in]  pCheckTypeList 校验类型列表指针
 * @param  CheckTypeListLen 校验类型列表长度
 * @return 函数执行状态
 * @retval 0 函数调用成功
 * @retval <0 函数调用失败
 */
int WINAPI  LIN_EX_DecodeListFile(char *pFileName,char CheckType,int BaudRate,char *pReadDataList,char ReadDataListLen,char *pCheckTypeList,char CheckTypeListLen);

/**
 * @brief  获取解析后的列表数据
 * @param  MsgIndex 帧索引
 * @param  MsgLen 帧长度
 * @param[out]  pLINMsg 存储帧指针
 * @return 函数执行状态
 * @retval 0 函数调用成功
 * @retval <0 函数调用失败
 */
int WINAPI  LIN_EX_GetListFileMsg(int MsgIndex,int MsgLen,LIN_EX_MSG *pLINMsg);

/**
 * @brief  获取LIN起始时间戳，该时间戳可以转换成实际的时间
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  LINIndex LIN通道号，0-LIN1，1-LIN2，2-LIN3，3-LIN4
 * @return LIN起始时间戳
 * @retval <0 函数调用失败
 */
long long WINAPI LIN_EX_GetStartTime(int DevHandle, unsigned char LINIndex);

/**
 * @brief  复位时间戳，复位后起始时间戳为当前时间
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  LINIndex LIN通道号，0-LIN1，1-LIN2，2-LIN3，3-LIN4
 * @return 函数执行状态
 * @retval <0 函数调用失败
 */
int WINAPI LIN_EX_ResetStartTime(int DevHandle, unsigned char LINIndex);

/**
 * @brief  停止LIN总线，调用后将关闭LIN总线的任何操作，比如数据读写，从机响应等
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  LINIndex LIN通道号，0-LIN1，1-LIN2，2-LIN3，3-LIN4
 * @return 函数执行状态
 * @retval <0 函数调用失败
 */
int WINAPI LIN_EX_Stop(int DevHandle, unsigned char LINIndex);
#ifdef __cplusplus
}
#endif

/** @} USB转LIN*/
#endif



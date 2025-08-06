/**
 * @file   usb2canfd.h
 * @brief  USB转CANFD相关函数和数据类型定义
 * @author wdluo(wdluo@toomoss.com)
 * @version 1.0
 * @date 2022-10-05
 * @copyright Copyright (c) 2022 重庆图莫斯电子科技有限公司
 */
#ifndef __USB2CANFD_H_
#define __USB2CANFD_H_

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
 *@defgroup USB转CANFD
 * @{
 * @brief USB转CANFD接口函数和数据类型定义
*/

/**
 *@name 函数返回错误值宏定义
 *@brief 函数调用出错后返回值定义
 *@{
*/
#define CANFD_SUCCESS             (0)   ///<函数执行成功
#define CANFD_ERR_NOT_SUPPORT     (-1)  ///<适配器不支持该函数
#define CANFD_ERR_USB_WRITE_FAIL  (-2)  ///<USB写数据失败
#define CANFD_ERR_USB_READ_FAIL   (-3)  ///<USB读数据失败
#define CANFD_ERR_CMD_FAIL        (-4)  ///<命令执行失败
/** @} */

/**
 *@name CAN帧类型和数据类型定义
 *@brief 在CANFD_MSG.ID中使用
 *@{
*/
#define CANFD_MSG_FLAG_RTR      (0x40000000)
#define CANFD_MSG_FLAG_IDE      (0x80000000)
#define CANFD_MSG_FLAG_ID_MASK  (0x1FFFFFFF)
/** @} */

/**
 *@name CANFD标志定义
 *@brief 在CANFD_MSG.Flags中使用
 *@{
*/
#define CANFD_MSG_FLAG_BRS      (0x01)  ///<CANFD加速帧标志
#define CANFD_MSG_FLAG_ESI      (0x02)
#define CANFD_MSG_FLAG_FDF      (0x04)  ///<CANFD帧标志
#define CANFD_MSG_FLAG_TXD      (0x80)  ///<发送帧标志
/** @} */

/**
 *@name CAN总线状态定义
 *@brief CANFD_DIAGNOSTIC.Flags中使用
 *@{
*/
#define CANFD_DIAGNOSTIC_FLAG_NBIT0_ERR     (0x0001)///<在发送报文（或应答位、主动错误标志或过载标志）期间，器件要发送显性电平（逻辑值为0的数据或标识符位），但监视的总线值为隐性。
#define CANFD_DIAGNOSTIC_FLAG_NBIT1_ERR     (0x0002)///<在发送报文（仲裁字段除外）期间，器件要发送隐性电平（逻辑值为1的位），但监视到的总线值为显性。
#define CANFD_DIAGNOSTIC_FLAG_NACK_ERR      (0x0004)///<发送报文未应答。
#define CANFD_DIAGNOSTIC_FLAG_NFORM_ERR     (0x0008)///<接收报文的固定格式部分格式错误。
#define CANFD_DIAGNOSTIC_FLAG_NSTUFF_ERR    (0x0010)///<在接收报文的一部分中，序列中包含了5个以上相等位，而报文中不允许出现这种序列。
#define CANFD_DIAGNOSTIC_FLAG_NCRC_ERR      (0x0020)///<接收的报文的CRC校验和不正确。输入报文的CRC与通过接收到的数据计算得到的CRC不匹配。
#define CANFD_DIAGNOSTIC_FLAG_TXBO_ERR      (0x0080)///<器件进入离线状态（且自动恢复）。
#define CANFD_DIAGNOSTIC_FLAG_DBIT0_ERR     (0x0100)///<见NBIT0_ERR
#define CANFD_DIAGNOSTIC_FLAG_DBIT1_ERR     (0x0200)///<见NBIT1_ERR
#define CANFD_DIAGNOSTIC_FLAG_DFORM_ERR     (0x0800)///<见NFORM_ERR
#define CANFD_DIAGNOSTIC_FLAG_DSTUFF_ERR    (0x1000)///<见NSTUFF_ERR
#define CANFD_DIAGNOSTIC_FLAG_DCRC_ERR      (0x2000)///<见NCRC_ERR
#define CANFD_DIAGNOSTIC_FLAG_ESI_ERR       (0x4000)///<接收的CAN FD报文的ESI标志置1
#define CANFD_DIAGNOSTIC_FLAG_DLC_MISMATCH  (0x8000)///<DLC不匹配,在发送或接收期间，指定的DLC大于FIFO元素的PLSIZE
/** @} */

/**
 *@name CAN总线错误定义
 *@brief CANFD_BUS_ERROR.Flags中使用
 *@{
*/
#define CANFD_BUS_ERROR_FLAG_TX_RX_WARNING   (0x01)
#define CANFD_BUS_ERROR_FLAG_RX_WARNING      (0x02)
#define CANFD_BUS_ERROR_FLAG_TX_WARNING      (0x04)
#define CANFD_BUS_ERROR_FLAG_RX_BUS_PASSIVE  (0x08)
#define CANFD_BUS_ERROR_FLAG_TX_BUS_PASSIVE  (0x10)
#define CANFD_BUS_ERROR_FLAG_TX_BUS_OFF      (0x20)
/** @} */

/**
 * @brief  CANFD帧类型定义
 */
typedef  struct  _CANFD_MSG
{
    unsigned int    ID;           ///<报文ID,bit[30]-RTR,bit[31]-IDE,bit[28..0]-ID
    unsigned char   DLC;          ///<数据字节长度，可设置为-0,1,2,3,4,5,6,7,8,12,16,20,24,32,48,64
    unsigned char   Flags;        ///<bit[0]-BRS,bit[1]-ESI,bit[2]-FDF,bit[6..5]-通道号,bit[7]-发送标志
    unsigned char   __Res0;       ///<保留
    unsigned char   TimeStampHigh;///<时间戳高位
    unsigned int    TimeStamp;    ///<帧接收或者发送时的时间戳，单位为10us
    unsigned char   Data[64];     ///<报文的数据，有效数据字节数通过DLC决定
}CANFD_MSG;

/**
 * @brief  CANFD初始化结构体
 */
typedef  struct  _CANFD_INIT_CONFIG
{
    unsigned char Mode; ///<0-正常模式，1-自发自收模式
    unsigned char ISOCRCEnable;///<0-禁止ISO CRC,1-使能ISO CRC
    unsigned char RetrySend;///<0-禁止重发，1-无限制重发
    unsigned char ResEnable;///<0-不接入内部120欧终端电阻，1-接入内部120欧终端电阻
    unsigned char NBT_BRP;///<仲裁段波特率参数,波特率=40M/NBT_BRP*(1+NBT_SEG1+NBT_SEG2)
    unsigned char NBT_SEG1;
    unsigned char NBT_SEG2;
    unsigned char NBT_SJW;
    unsigned char DBT_BRP;///<数据段波特率参数,波特率=40M/DBT_BRP*(1+DBT_SEG1+DBT_SEG2)
    unsigned char DBT_SEG1;
    unsigned char DBT_SEG2;
    unsigned char DBT_SJW;
    unsigned char TDC;  ///<如果数据域波特率大于等于8M，则建议将该参数设置为3，其他波特率设置为0即可
    unsigned char __Res0[7];
}CANFD_INIT_CONFIG;

/**
 * @brief  CANFD诊断帧信息结构体定义
 */
typedef struct _CANFD_DIAGNOSTIC {
    unsigned char NREC;///<标称比特率接收错误计数
    unsigned char NTEC;///<标称比特率发送错误计数
    unsigned char DREC;///<数据比特率接收错误计数
    unsigned char DTEC;///<数据比特率发送错误计数
    unsigned short ErrorFreeMsgCount;///<无错误帧计数
    unsigned short Flags;///<参考诊断标志定义
}CANFD_DIAGNOSTIC;

/**
 * @brief  CANFD总线错误信息结构体定义
 */
typedef struct _CANFD_BUS_ERROR {
    unsigned char TEC;///<发送错误计数
    unsigned char REC;///<接收错误计数
    unsigned char Flags;///<参考总线错误标志定义
    unsigned char __Res0;///<保留，不用
}CANFD_BUS_ERROR;

/**
 * @brief  CANFD过滤器结构体定义
 */
typedef struct _CANFD_FILTER_CONFIG{
    unsigned char   Enable;   ///<使能该过滤器，1-使能，0-禁止
    unsigned char   Index;    ///<过滤器索引号，取值范围为0到31
    unsigned char __Res0;     ///<保留，不用
    unsigned char __Res1;     ///<保留，不用
    unsigned int    ID_Accept;///<验收码ID,bit[28..0]为有效ID位，bit[31]为IDE
    unsigned int    ID_Mask;  ///<屏蔽码，对应bit位若为1，则需要对比对应验收码bit位，相同才接收
}CANFD_FILTER_CONFIG;

#ifdef __cplusplus
extern "C"
{
#endif
/**
 * @brief  通过波特率值获取具体的波特率参数，调用该函数后还需要调用 @ref CANFD_Init 函数才能设置设备波特率值
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param[out]  pCanConfig CANFD初始化结构体，用于存储波特率参数
 * @param  SpeedBpsNBT CANFD仲裁域波特率，单位为bps，比如500K波特率，则传入500000
 * @param  SpeedBpsDBT CANFD数据域波特率，CANFD加速帧使用该波特率传输数据
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI CANFD_GetCANSpeedArg(int DevHandle, CANFD_INIT_CONFIG* pCanConfig, unsigned int SpeedBpsNBT, unsigned int SpeedBpsDBT);

/**
 * @brief  初始化CAN总线，使用CAN功能时必须调用
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @param[in]  pCanConfig CAN初始化相关参数，具体可以参考 @ref CAN_INIT_CONFIG
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI CANFD_Init(int DevHandle, unsigned char CANIndex, CANFD_INIT_CONFIG *pCanConfig);

/**
 * @brief  简易方式初始化CAN总线，若需要自定义波特率参数，需要调用 @ref CANFD_Init 实现
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @param  BaudRateNBTBps CANFD仲裁域波特率，单位为bps，比如500K波特率，则传入500000
 * @param  BaudRateDBTBps CANFD数据域波特率，CANFD加速帧使用该波特率传输数据
 * @param  EnResistor 是否接入内部终端电阻，0-不接入，1-接入
 * @param  ISOCRCEnable CRC校验模式
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI CANFD_Init2(int DevHandle, unsigned char CANIndex, int BaudRateNBTBps, int BaudRateDBTBps, unsigned char EnResistor, unsigned char ISOCRCEnable);
/**
 * @brief  启动CAN消息自动读取功能，调用后会在后台自动读取CAN消息并将消息存储在上位机数据缓冲区中，调用该函数可以防止数据丢失
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI CANFD_StartGetMsg(int DevHandle, unsigned char CANIndex);

/**
 * @brief  停止自动接收CAN消息，停止后适配器收到CAN消息后会将消息缓存到适配器内部数据缓冲区，若长时间不去读取数据，则先接收到的数据会被丢失
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI CANFD_StopGetMsg(int DevHandle, unsigned char CANIndex);

/**
 * @brief  发送CAN消息，消息发送完毕后该函数才会返回
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @param[in]  pCanSendMsg CAN消息指针
 * @param  SendMsgNum 待发送的消息帧数
 * @return 函数执行状态
 * @retval =0 CAN消息未发送成功
 * @retval >0 成功发送消息帧数
 * @retval <0 函数调用失败
 */
int WINAPI CANFD_SendMsg(int DevHandle, unsigned char CANIndex, CANFD_MSG *pCanSendMsg,unsigned int SendMsgNum);

/**
 * @brief  以特定帧间隔时间发送CAN消息，消息发送完毕后该函数才会返回
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @param[in]  pCanSendMsg CAN消息指针
 * @param  SendMsgNum 待发送的消息帧数
 * @return 函数执行状态
 * @retval =0 CAN消息未发送成功
 * @retval >0 成功发送消息帧数
 * @retval <0 函数调用失败
 */
int WINAPI CANFD_SendMsgWithTime(int DevHandle, unsigned char CANIndex, CANFD_MSG* pCanSendMsg, unsigned int SendMsgNum);
/**
 * @brief  发送CAN消息，消息发送完毕或者超时后该函数才会返回
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @param[in]  pCanSendMsg CAN消息指针
 * @param  SendMsgNum 待发送的消息帧数
 * @param  TimeoutMs 等待超时时间，单位为ms
 * @return 函数执行状态
 * @retval =0 CAN消息未发送成功
 * @retval >0 成功发送消息帧数
 * @retval <0 函数调用失败
 */
int WINAPI CANFD_SendMsgTimeout(int DevHandle, unsigned char CANIndex, CANFD_MSG* pCanSendMsg, unsigned int SendMsgNum, unsigned int TimeoutMs);
/**
 * @brief  读取接收到的CAN消息
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @param[out]  pCanGetMsg 存储CAN消息数据缓冲区指针
 * @param  BufferSize 数据缓冲区能存储CAN消息帧数，也就是数据缓冲区容量大小
 * @return 函数执行状态
 * @retval =0 未读取到CAN消息
 * @retval >0 成功读取到的消息帧数
 * @retval <0 函数调用失败
 */
int WINAPI CANFD_GetMsg(int DevHandle, unsigned char CANIndex, CANFD_MSG *pCanGetMsg,int BufferSize);

/**
 * @brief  清空CAN接收数据缓冲区
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI CANFD_ClearMsg(int DevHandle, unsigned char CANIndex);

/**
 * @brief  配置CAN过滤器，通过配置过滤器可以只接收特定ID帧，或者指定ID范围内的帧
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @param[in]  pFilterConfig CAN过滤器参数，具体可以参考 @ref CANFD_FILTER_CONFIG
 * @param  Len 待配置的过滤器数
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI CANFD_SetFilter(int DevHandle, unsigned char CANIndex, CANFD_FILTER_CONFIG *pCanFilter,unsigned char Len);

/**
 * @brief  配置CAN过滤器，通过配置过滤器设置只接收某些帧ID数据
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @param[in]  pIDList 需要接收的ID列表，ID的bit[31]位为扩展帧标志，ID的bit[30]位为远程帧标志
 * @param  IDListLen 需要接收的ID数量，最大值为32
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI CANFD_FilterList_Init(int DevHandle, unsigned char CANIndex, unsigned int* pIDList, unsigned char IDListLen);

/**
 * @brief  获取CAN总线错误帧信息
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @param  pCanDiagnostic CAN错误信息存储结构体指针，可以参考 @ref CANFD_DIAGNOSTIC
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI CANFD_GetDiagnostic(int DevHandle, unsigned char CANIndex, CANFD_DIAGNOSTIC *pCanDiagnostic);

/**
 * @brief  获取CAN总线错误帧信息
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @param  pCanBusError CAN错误信息存储结构体指针，可以参考 @ref CANFD_BUS_ERROR
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI CANFD_GetBusError(int DevHandle, unsigned char CANIndex, CANFD_BUS_ERROR *pCanBusError);

/**
 * @brief  停止CAN总线，调用该函数后，适配器CAN节点将从CAN总线上断开，且无法正常应答其他节点发送的数据
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI CANFD_Stop(int DevHandle, unsigned char CANIndex);

/**
 * @brief  设置CAN调度表数据，调度表模式发送数据可以精确控制帧之间的间隔时间，启动调度表后适配器可以自动发送调度表里面数据
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @param[in]  pCanMsgTab CAN调度表列表指针
 * @param[in]  pMsgNum 调度表列表中每个调度表包含消息帧数
 * @param[in]  pSendTimes 每个调度表里面帧发送次数，若为0xFFFF，则循环发送，通过调用 @ref CANFD_StopSchedule 函数停止发送
 * @param  MsgTabNum 调度表数
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI CANFD_SetSchedule(int DevHandle, unsigned char CANIndex, CANFD_MSG *pCanMsgTab,unsigned char *pMsgNum,unsigned short *pSendTimes,unsigned char MsgTabNum);
 
 /**
  * @brief  启动CAN调度表
  * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
  * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
  * @param  MsgTabIndex CAN调度表索引号
  * @param  TimePrecMs 调度表时间精度，比如调度表里面最小帧周期为10ms，那么就建议设置为10
  * @param  OrderSend 该调度表里面帧发送模式，0-并行发送，1-顺序发送
  * @return 函数执行状态
  * @retval =0 函数执行成功
  * @retval <0 函数调用失败
  */
int WINAPI CANFD_StartSchedule(int DevHandle, unsigned char CANIndex, unsigned char MsgTabIndex,unsigned char TimePrecMs,unsigned char OrderSend);

/**
 * @brief  更新调度表
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @param  MsgTabIndex CAN调度表索引号
 * @param  MsgIndex 开始更新帧起始索引，若起始索引大于调度表帧数，则将帧添加到调度表后面
 * @param[in]  pCanMsg 需要更新的CAN帧指针
 * @param  MsgNum pCanMsgTab里面包含的有效帧数
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI CANFD_UpdateSchedule(int DevHandle, unsigned char CANIndex, unsigned char MsgTabIndex, unsigned char MsgIndex, CANFD_MSG* pCanMsg, unsigned char MsgNum);

/**
 * @brief  停止执行CAN调度表
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI CANFD_StopSchedule(int DevHandle, unsigned char CANIndex);

/**
 * @brief  设置CAN中继状态
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  RelayState CAN中继状态\n 
 * @ref CAN_RELAY_NONE 关闭中继功能\n
 * @ref CAN_RELAY_CAN1TO2 CAN1-->CAN2 CAN1收到数据后通过CAN2转发出去\n
 * @ref CAN_RELAY_CAN2TO1 CAN2-->CAN1 CAN2收到数据后通过CAN1转发出去\n
 * @ref CAN_RELAY_CANALL CAN1<->CAN2 CAN1收到数据后通过CAN2转发出去,CAN2收到数据后通过CAN1转发出去\n
 * @ref CAN_RELAY_ONLINE 根据中继数据进行在线转换，需要调用 @ref CANFD_SetRelayData 函数设置中继数据
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI CANFD_SetRelay(int DevHandle, unsigned char RelayState);

/**
 * @brief  设置CAN中继规则数据，调用该函数之前得确保两通道CAN都已经成功初始化
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param[in]  pCANRelayHead 中继规则头指针
 * @param[in]  pCANRelayData 中继规则数据指针
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI CANFD_SetRelayData(int DevHandle, CAN_RELAY_HEAD *pCANRelayHead, CAN_RELAY_DATA *pCANRelayData);

/**
 * @brief  读取CAN中继数据
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param[out]  pCANRelayHead 中继数据头指针
 * @param[out]  pCANRelayData 中继数据指针
 * @return 函数执行状态
 * @retval >=0 获取到的CAN中继数据帧数
 * @retval <0 函数调用失败
 */
int WINAPI CANFD_GetRelayData(int DevHandle, CAN_RELAY_HEAD *pCANRelayHead, CAN_RELAY_DATA *pCANRelayData);

/**
 * @brief  获取消息发送耗时时间，该值为理论值，实际值可能会大一些
 * @param[in]  pMsg CANFD消息指针
 * @param  SpeedBpsNBT 仲裁域波特率，单位为Hz
 * @param  SpeedBpsDBT 数据域波特率，单位为Hz
 * @param  CANFDISO CANFD校验标准，0-non-ISO标准，1-CANFD标准
 * @return 该帧发送耗时时间
 * @retval 发送该帧耗时时间，单位为us
 */
int WINAPI CANFD_GetMsgSendTimeUs(CANFD_MSG* pMsg, int SpeedBpsNBT, int SpeedBpsDBT, unsigned char CANFDISO);

/**
 * @brief  获取CAN起始时间戳，该时间戳可以转换成实际的时间
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @return CAN起始时间戳
 * @retval <0 函数调用失败
 */
long long WINAPI CANFD_GetStartTime(int DevHandle, unsigned char CANIndex);

/**
 * @brief  复位时间戳，复位后起始时间戳为当前时间
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @return 函数执行状态
 * @retval <0 函数调用失败
 */
int WINAPI CANFD_ResetStartTime(int DevHandle, unsigned char CANIndex);

#ifdef __cplusplus
}
#endif

/** @} USB转CANFD*/
#endif



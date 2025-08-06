/**
 * @file   usb2can.h
 * @brief  USB转CAN相关函数和数据类型定义
 * @author wdluo(wdluo@toomoss.com)
 * @version 1.0
 * @date 2022-10-05
 * @copyright Copyright (c) 2022 重庆图莫斯电子科技有限公司
 */
#ifndef __USB2CAN_H_
#define __USB2CAN_H_

#include <stdint.h>
#include "offline_type.h"
#ifdef _WIN32
#include <Windows.h>
#else
#include <unistd.h>
#ifndef WINAPI
#define WINAPI
#endif
#endif
/**
 *@defgroup USB转CAN
 * @{
 * @brief USB转CAN接口函数和数据类型定义
*/

/**
 * @brief  CAN帧类型定义
 */
typedef  struct  _CAN_MSG
{
    unsigned int    ID;           ///<报文ID。
    unsigned int    TimeStamp;    ///<接收到信息帧时的时间标识，从CAN 控制器初始化开始计时。单位为100us
    unsigned char   RemoteFlag;   ///<bit[0]-是否是远程帧,bit[6..5]-当前帧通道号，bit[7]-发送帧标志
    unsigned char   ExternFlag;   ///<bit[0]-是否是扩展帧,bit[7]-当前帧为错误帧
    unsigned char   DataLen;      ///<数据长度(<=8)，即Data中有效数据长度。
    unsigned char   Data[8];      ///<报文数据。
    unsigned char   TimeStampHigh;///<时间戳高位
}CAN_MSG,*PCAN_MSG;

/**
 * @brief  CAN初始化结构体
 */
typedef struct _CAN_INIT_CONFIG
{
    //CAN波特率 = 主频时钟/(CAN_BRP)/(CAN_SJW+CAN_BS1+CAN_BS2)
    unsigned int    CAN_BRP;    ///<取值范围1~1024
    unsigned char   CAN_SJW;    ///<取值范围1~4
    unsigned char   CAN_BS1;    ///<取值范围1~16
    unsigned char   CAN_BS2;    ///<取值范围1~8
    unsigned char   CAN_Mode;   ///<CAN工作模式，0-正常模式，1-环回模式，2-静默模式，3-静默环回模式，bit7为1则接入适配器内部终端电阻，否则不接入
    unsigned char   CAN_ABOM;   ///<自动离线管理，0-禁止，1-使能
    unsigned char   CAN_NART;   ///<报文重发管理，0-使能报文重传，1-禁止报文重传
    unsigned char   CAN_RFLM;   ///<FIFO锁定管理，0-新报文覆盖旧报文，1-丢弃新报文
    unsigned char   CAN_TXFP;   ///<发送优先级管理，0-标识符决定，1-发送请求顺序决定
}CAN_INIT_CONFIG,*PCAN_INIT_CONFIG;

/**
 * @brief  CAN过滤器结构体
 */
typedef struct _CAN_FILTER_CONFIG{
    unsigned char   Enable;         ///<使能该过滤器，1-使能，0-禁止
    unsigned char   FilterIndex;    ///<过滤器索引号，取值范围为0到13
    unsigned char   FilterMode;     ///<过滤器模式，0-屏蔽位模式，1-标识符列表模式
    unsigned char   ExtFrame;       ///<过滤的帧类型标志，扩展帧设置为1，标准帧设置为0。
    unsigned int    ID_Std_Ext;     ///<验收码ID
    unsigned int    ID_IDE;         ///<验收码IDE，ID为扩展帧设置为1，标准帧设置为0
    unsigned int    ID_RTR;         ///<验收码RTR，ID为远程帧设置为0，数据帧设置为1
    unsigned int    MASK_Std_Ext;   ///<屏蔽码ID，该项只有在过滤器模式为屏蔽位模式时有用
    unsigned int    MASK_IDE;       ///<屏蔽码IDE，该项只有在过滤器模式为屏蔽位模式时有用
    unsigned int    MASK_RTR;       ///<屏蔽码RTR，该项只有在过滤器模式为屏蔽位模式时有用
} CAN_FILTER_CONFIG,*PCAN_FILTER_CONFIG;

/**
 * @brief  CAN总线状态定义
 */
typedef struct _CAN_STATUS{
    unsigned int    TSR;        ///<TSR定义
    unsigned int    ESR;        ///<ESR定义
    unsigned char   RECounter;  ///<CAN控制器接收错误计数器。
    unsigned char   TECounter;  ///<CAN控制器发送错误计数器。
    unsigned char   LECode;     ///<最后的错误代码
    unsigned char   ErrFlag;    ///<bit[0]-EWGF：错误警告标志 (Error warning flag),bit[1]-EPVF：错误被动标志 (Error passive flag),bit[2]-BOFF：总线关闭标志 (Bus-off flag)
}CAN_STATUS,*PCAN_STATUS;

/**
 * @brief  自定义CAN Bootloader命令列表
 */
typedef  struct  _CBL_CMD_LIST{
    unsigned char   Erase;          ///<擦出APP储存扇区数据
    unsigned char   WriteInfo;      ///<设置多字节写数据相关参数（写起始地址，数据量）
    unsigned char   Write;          ///<以多字节形式写数据
    unsigned char   Check;          ///<检测节点是否在线，同时返回固件信息
    unsigned char   SetBaudRate;    ///<设置节点波特率
    unsigned char   Excute;         ///<执行固件
    unsigned char    CmdSuccess;      ///<命令执行成功
    unsigned char    CmdFaild;        ///<命令执行失败
} CBL_CMD_LIST,*PCBL_CMD_LIST; 

/**
 *@name 函数返回错误值宏定义
 *@brief 函数调用出错后返回值定义
 *@{
*/
#define CAN_SUCCESS             (0)   ///<函数执行成功
#define CAN_ERR_NOT_SUPPORT     (-1)  ///<适配器不支持该函数
#define CAN_ERR_USB_WRITE_FAIL  (-2)  ///<USB写数据失败
#define CAN_ERR_USB_READ_FAIL   (-3)  ///<USB读数据失败
#define CAN_ERR_CMD_FAIL        (-4)  ///<命令执行失败
#define CAN_BL_ERR_CONFIG       (-20) ///<配置设备错误
#define CAN_BL_ERR_SEND         (-21) ///<发送数据出错
#define CAN_BL_ERR_TIME_OUT     (-22) ///<超时错误
#define CAN_BL_ERR_CMD          (-23) ///<执行命令失败
/** @} */

/**
 *@name CAN BOOT错误定义
 *@brief CAN Bootloader返回错误代码定义
 *@{
*/
#define CAN_BOOT_ERR_CONFIG       (-30) ///<配置设备错误
#define CAN_BOOT_ERR_SEND         (-31) ///<发送数据出错
#define CAN_BOOT_ERR_TIME_OUT     (-32) ///<超时错误
#define CAN_BOOT_ERR_CMD          (-33) ///<执行命令失败
#define CAN_BOOT_ERR_BAUD         (-34) ///<波特率参数自动获取失败
#define CAN_BOOT_ERR_BUFFER       (-35) ///<从设备返回接收数据缓冲区大小为0
/** @} */

/**
 *@name CAN BOOT固件类型定义
 *@brief CAN Bootloader当前固件类型定义
 *@{
*/
#define CAN_BL_BOOT     0x55555555 ///<当前固件类型为Bootloader
#define CAN_BL_APP      0xAAAAAAAA ///<当前固件类型为App
/** @} */

/**
 *@name CAN中继模式定义
 *@{
*/
#define CAN_RELAY_NONE      0x00    ///<关闭中继功能
#define CAN_RELAY_CAN1TO2   0x01    ///<CAN1 --> CAN2 CAN1收到数据后通过CAN2转发出去
#define CAN_RELAY_CAN2TO1   0x10    ///<CAN2 --> CAN1 CAN2收到数据后通过CAN1转发出去
#define CAN_RELAY_CANALL    0x11    ///<CAN1 <-> CAN2 CAN1收到数据后通过CAN2转发出去,CAN2收到数据后通过CAN1转发出去
#define CAN_RELAY_ONLINE    0x88	///<根据中继数据进行在线转换，需要调用CAN_SetOnlineRelayData函数设置中继数据
/** @} */

/**
 *@name CAN总线错误定义
 *@{
*/
#define CAN_BUS_ERROR_FLAG_TX_RX_WARNING   (0x01)
#define CAN_BUS_ERROR_FLAG_BUS_PASSIVE     (0x02)
#define CAN_BUS_ERROR_FLAG_TX_BUS_OFF      (0x04)
/** @} */

/**
 *@name CAN总线模式定义
 *@{
*/
#define CAN_NORMAL          0       ///<正常模式，需要外接CAN节点才能正常收发数据
#define CAN_LOOP_BACK       1       ///<回环模式，无需外接CAN节点就可以实现自发自收
#define CAN_EN_RESISTOR     0x80    ///<使能120Ω终端电阻
/** @} */

#ifdef __cplusplus
extern "C"
{
#endif
/**
 * @brief  通过波特率值获取具体的波特率参数，调用该函数后还需要调用 @ref CAN_Init 函数才能设置设备波特率值
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param[out]  pCanConfig CAN初始化结构体，用于存储波特率参数
 * @param  BaudRateBps CAN波特率值，单位为bps，比如500K波特率，则传入500000
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI CAN_GetCANSpeedArg(int DevHandle,CAN_INIT_CONFIG* pCanConfig, unsigned int BaudRateBps);

/**
 * @brief  初始化CAN总线，使用CAN功能时必须调用
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @param[in]  pCanConfig CAN初始化相关参数，具体可以参考 @ref CAN_INIT_CONFIG
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI CAN_Init(int DevHandle, unsigned char CANIndex, CAN_INIT_CONFIG *pCanConfig);

/**
 * @brief  简易方式初始化CAN总线，若需要自定义波特率参数，可以调用 @ref CAN_Init 方式进行初始化
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @param  BaudRateBps 波特率，单位为bps，比如500K的波特率需要传入500000
 * @param  EnResistor 是否开启内部终端电阻，0-关闭，1-开启
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI CAN_Init2(int DevHandle, unsigned char CANIndex, int BaudRateBps, unsigned char EnResistor);

/**
 * @brief  配置CAN过滤器，通过配置过滤器可以只接收特定ID帧，或者指定ID范围内的帧
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @param[in]  pFilterConfig CAN过滤器参数，具体可以参考 @ref CAN_FILTER_CONFIG
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI CAN_Filter_Init(int DevHandle, unsigned char CANIndex, CAN_FILTER_CONFIG *pFilterConfig);

/**
 * @brief  配置CAN过滤器，通过配置过滤器设置只接收某些帧ID数据
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @param[in]  pIDList 需要接收的ID列表，ID的bit[31]位为扩展帧标志，ID的bit[30]位为远程帧标志
 * @param  IDListLen 需要接收的ID数量，最大值为14
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI CAN_FilterList_Init(int DevHandle, unsigned char CANIndex, unsigned int *pIDList, unsigned char IDListLen);

/**
 * @brief  启动CAN消息自动读取功能，调用后会在后台自动读取CAN消息并将消息存储在上位机数据缓冲区中，调用该函数可以防止数据丢失
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI CAN_StartGetMsg(int DevHandle, unsigned char CANIndex);

/**
 * @brief  停止自动接收CAN消息，停止后适配器收到CAN消息后会将消息缓存到适配器内部数据缓冲区，若长时间不去读取数据，则先接收到的数据会被丢失
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI CAN_StopGetMsg(int DevHandle, unsigned char CANIndex);

/**
 * @brief  发送CAN消息，消息发送完毕后该函数才会返回，发送期间会完全占用USB总线
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @param[in]  pCanSendMsg CAN消息指针
 * @param  SendMsgNum 待发送的消息帧数
 * @return 函数执行状态
 * @retval =0 CAN消息未发送成功
 * @retval >0 成功发送消息帧数
 * @retval <0 函数调用失败
 */
int WINAPI CAN_SendMsg(int DevHandle, unsigned char CANIndex, CAN_MSG *pCanSendMsg,unsigned int SendMsgNum);

/**
 * @brief  同步模式发送CAN消息，发送消息的时候不会完全占用USB总线
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @param[in]  pCanSendMsg CAN消息指针
 * @param  SendMsgNum 待发送的消息帧数
 * @return 函数执行状态
 * @retval =0 CAN消息未发送成功
 * @retval >0 成功发送消息帧数
 * @retval <0 函数调用失败
 */
int WINAPI CAN_SendMsgSynch(int DevHandle, unsigned char CANIndex, CAN_MSG* pCanSendMsg, unsigned int SendMsgNum);

/**
 * @brief  定时间隔模式发送CAN消息，发送消息的时候会完全占用USB总线，函数是阻塞的，同时会把发送帧放到接收数据缓冲区里面
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @param[in]  pCanSendMsg CAN消息指针
 * @param  SendMsgNum 待发送的消息帧数
 * @return 函数执行状态
 * @retval =0 CAN消息未发送成功
 * @retval >0 成功发送消息帧数
 * @retval <0 函数调用失败
 */
int WINAPI CAN_SendMsgWithTime(int DevHandle, unsigned char CANIndex, CAN_MSG* pCanSendMsg, unsigned int SendMsgNum);
/**
 * @brief  读取接收到的CAN消息，若调用了 @ref CAN_StartGetMsg 函数，则从上位机缓冲区获取数据，否则从适配器内部获取数据
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @param[out]  pCanGetMsg 存储CAN消息数据缓冲区指针，调用该函数会返回缓冲区中所有数据，所以该缓冲区要设置大一点，以免缓冲区溢出，导致程序异常
 * @return 函数执行状态
 * @retval =0 未读取到CAN消息
 * @retval >0 成功读取到的消息帧数
 * @retval <0 函数调用失败
 */
int WINAPI CAN_GetMsg(int DevHandle, unsigned char CANIndex, CAN_MSG *pCanGetMsg);

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
int WINAPI CAN_GetMsgWithSize(int DevHandle, unsigned char CANIndex, CAN_MSG *pCanGetMsg,int BufferSize);

/**
 * @brief  清空CAN接收数据缓冲区
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI CAN_ClearMsg(int DevHandle, unsigned char CANIndex);

/**
 * @brief  获取CAN总线状态信息
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @param[out]  pCANStatus CAN总线状态结构体指针，具体参考 @ref CAN_STATUS
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI CAN_GetStatus(int DevHandle, unsigned char CANIndex, CAN_STATUS *pCANStatus);

/**
 * @brief  设置CAN调度表数据，调度表模式发送数据可以精确控制帧之间的间隔时间，启动调度表后适配器可以自动发送调度表里面数据
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @param[in]  pCanMsgTab CAN调度表列表指针
 * @param[in]  pMsgNum 调度表列表中每个调度表包含消息帧数
 * @param[in]  pSendTimes 每个调度表里面帧发送次数，若为0xFFFF，则循环发送，通过调用 @ref CAN_StopSchedule 函数停止发送
 * @param  MsgTabNum 调度表数
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI CAN_SetSchedule(int DevHandle, unsigned char CANIndex, CAN_MSG *pCanMsgTab,unsigned char *pMsgNum,unsigned short *pSendTimes,unsigned char MsgTabNum);

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
int WINAPI CAN_StartSchedule(int DevHandle, unsigned char CANIndex, unsigned char MsgTabIndex,unsigned char TimePrecMs,unsigned char OrderSend);

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
int WINAPI CAN_UpdateSchedule(int DevHandle, unsigned char CANIndex, unsigned char MsgTabIndex, unsigned char MsgIndex, CAN_MSG* pCanMsg, unsigned char MsgNum);

/**
 * @brief  停止执行CAN调度表
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI CAN_StopSchedule(int DevHandle, unsigned char CANIndex);

/**
 * @brief  设置CAN中继规则数据，调用该函数之前得确保两通道CAN都已经成功初始化
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param[in]  pCANRelayHead 中继规则头指针
 * @param[in]  pCANRelayData 中继规则数据指针
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI CAN_SetRelayData(int DevHandle, CAN_RELAY_HEAD *pCANRelayHead, CAN_RELAY_DATA *pCANRelayData);

/**
 * @brief  读取CAN中继数据
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param[out]  pCANRelayHead 中继数据头指针
 * @param[out]  pCANRelayData 中继数据指针
 * @return 函数执行状态
 * @retval >=0 获取到的CAN中继数据帧数
 * @retval <0 函数调用失败
 */
int WINAPI CAN_GetRelayData(int DevHandle, CAN_RELAY_HEAD *pCANRelayHead, CAN_RELAY_DATA *pCANRelayData);

/**
 * @brief  设置CAN中继状态
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  RelayState CAN中继状态\n 
 * @ref CAN_RELAY_NONE 关闭中继功能\n
 * @ref CAN_RELAY_CAN1TO2 CAN1-->CAN2 CAN1收到数据后通过CAN2转发出去\n
 * @ref CAN_RELAY_CAN2TO1 CAN2-->CAN1 CAN2收到数据后通过CAN1转发出去\n
 * @ref CAN_RELAY_CANALL CAN1<->CAN2 CAN1收到数据后通过CAN2转发出去,CAN2收到数据后通过CAN1转发出去\n
 * @ref CAN_RELAY_ONLINE 根据中继数据进行在线转换，需要调用 @ref CAN_SetRelayData 函数设置中继数据
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI CAN_SetRelay(int DevHandle, unsigned char RelayState);

/**
 * @brief  停止CAN总线，调用该函数后，适配器CAN节点将从CAN总线上断开，且无法正常应答其他节点发送的数据
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI CAN_Stop(int DevHandle, unsigned char CANIndex);

/**
 * @brief  获取消息发送耗时时间，该值为理论值，实际值可能会大一些
 * @param[in]  pMsg CAN消息指针
 * @param  SpeedBps 总线波特率，单位为Hz
 * @return 该帧发送耗时时间
 * @retval 发送该帧耗时时间，单位为us
 */
int WINAPI CAN_GetMsgSendTimeUs(CAN_MSG* pMsg, int SpeedBps);

/**
 * @brief  CAN BOOT初始化
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @param[in]  pInitConfig 初始化结构体指针
 * @param[in]  pCmdList 命令列表指针
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI CAN_BL_Init(int DevHandle,int CANIndex,CAN_INIT_CONFIG *pInitConfig,CBL_CMD_LIST *pCmdList);

/**
 * @brief  节点在线状态检测
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @param  NodeAddr 节点地址
 * @param[out]  pVersion 固件版本号输出
 * @param[out]  pType 固件类型输出
 * @param  TimeOut 超时时间，单位为毫秒
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI CAN_BL_NodeCheck(int DevHandle,int CANIndex,unsigned short NodeAddr,unsigned int *pVersion,unsigned int *pType,unsigned int TimeOut);

/**
 * @brief  擦出用户区数据
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @param  NodeAddr 节点地址
 * @param  FlashSize 待擦出的数据长度，单位为字节
 * @param  TimeOut 超时时间，单位为毫秒
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI CAN_BL_Erase(int DevHandle,int CANIndex,unsigned short NodeAddr,unsigned int FlashSize,unsigned int TimeOut);

/**
 * @brief  写数据到应用程序存储区
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @param  NodeAddr 节点地址
 * @param  AddrOffset 数据写入起始地址
 * @param[in]  pData 待写入的数据指针
 * @param  DataNum 待写入数据字节数
 * @param  TimeOut 超时时间，单位为毫秒
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI CAN_BL_Write(int DevHandle,int CANIndex,unsigned short NodeAddr,unsigned int AddrOffset,unsigned char *pData,unsigned int DataNum,unsigned int TimeOut);

/**
 * @brief  执行程序
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @param  NodeAddr 节点地址
 * @param  Type 固件类型
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败 
 */
int WINAPI CAN_BL_Excute(int DevHandle,int CANIndex,unsigned short NodeAddr,unsigned int Type);

/**
 * @brief  设置节点波特率
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @param  NodeAddr 节点地址
 * @param[in]  pInitConfig 初始化结构体指针
 * @param  NewBaudRate 新波特率值，单位为bps
 * @param  TimeOut 超时时间，单位为毫秒
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI CAN_BL_SetNewBaudRate(int DevHandle,int CANIndex,unsigned short NodeAddr,CAN_INIT_CONFIG *pInitConfig,unsigned int NewBaudRate,unsigned int TimeOut);

/**
 * @brief  解析列表文件
 * @param  pFileName 文件名称
 * @param  pIgnoreIDList 需要忽略的ID列表指针
 * @param  IgnoreIDListLen 需要忽略的ID列表长度
 * @return 函数执行状态
 * @retval >=0 解析到的CAN帧数
 * @retval <0 函数调用失败
 */
int WINAPI  CAN_DecodeListFile(char *pFileName,unsigned int *pIgnoreIDList,int IgnoreIDListLen);

/**
 * @brief  从列表文件里面获取已经解析到的帧
 * @param  MsgIndex 消息起始位置
 * @param  MsgLen 消息长度
 * @param  pCANMsg 消息数据存储指针
 * @return 函数执行状态
 * @retval >=0 成功获取到的消息帧数
 * @retval <0 函数调用失败
 */
int WINAPI  CAN_GetListFileMsg(int MsgIndex,int MsgLen,CAN_MSG *pCANMsg);

/**
 * @brief  获取CAN起始时间戳，该时间戳可以转换成实际的时间
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @return CAN起始时间戳
 * @retval <0 函数调用失败
 */
long long WINAPI CAN_GetStartTime(int DevHandle, unsigned char CANIndex);

/**
 * @brief  复位时间戳，复位后起始时间戳为当前时间
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  CANIndex CAN通道号，0-CAN1，1-CAN2
 * @return CAN起始时间戳
 * @retval <0 函数调用失败
 */
int WINAPI CAN_ResetStartTime(int DevHandle, unsigned char CANIndex);

#ifdef __cplusplus
}
#endif

/** @} USB转CAN*/
#endif


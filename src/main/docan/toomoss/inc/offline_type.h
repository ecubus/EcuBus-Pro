/**
  ******************************************************************************
  * @file    offline_type.h
  * $Author: wdluo $
  * $Revision: 447 $
  * $Date:: 2013-06-29 18:24:57 +0800 #$
  * @brief   连线操作相关函数和数据类型定义.
  ******************************************************************************
  * @attention
  *
  *<center><a href="http:\\www.toomoss.com">http://www.toomoss.com</a></center>
  *<center>All Rights Reserved</center></h3>
  * 
  ******************************************************************************
  */
#ifndef __OFFLINE_TYPE_H_
#define __OFFLINE_TYPE_H_

#include <stdint.h>

#define OFFLINE_MARK    0x7BB0F5C0
#define CAN_SCH_MARK    0x9A21538B

#define OFFLINE_ERROR_NONE      0x00
#define OFFLINE_ERROR_ERASE     0x01
#define OFFLINE_ERROR_WRITE     0x02
#define OFFLINE_ERROR_READ      0x03
#define OFFLINE_ERROR_VERIFY    0x04

#define OFFLINE_TYPE_LIN_SCH            0x00010001//LIN主机模式离线发送数据
#define OFFLINE_TYPE_CAN2LIN            0x00020001//CAN和LIN总线相互转换
#define OFFLINE_TYPE_CAN_SCH            0x00030001//CAN离线发送数据
#define OFFLINE_TYPE_CAN_REAY           0x00030002//CAN离线中继
#define OFFLINE_TYPE_CAN_REAY_ONLINE    0x00030003//CAN在线中继
#define OFFLINE_TYPE_CAN2PWM            0x00040001//CAN转PWM
#define OFFLINE_TYPE_PWM_SCH            0x00050001//PWM离线发送
#define OFFLINE_TYPE_CAN_LIN_KEY        0x00060001//通过KEY发送CAN LIN数据

#define CAN2LIN_TYPE_CAN2MLINW  0x00  //CAN转LIN主机写数据
#define CAN2LIN_TYPE_MLINR2CAN  0x01  //主机LIN读数据转CAN
#define CAN2LIN_TYPE_SLINR2CAN  0x02  //从机LIN接收数据转CAN
#define CAN2LIN_TYPE_CAN2SLINW  0x03  //CAN转LIN从机发送数据

#define CAN2LIN_DATA_TYPE_DIRECT  0x00  //直接转发接收到的数据
#define CAN2LIN_DATA_TYPE_SPECIAL 0x01  //转发制定的数据

#define CAN_RELAY_TYPE_CAN1_2_CAN2      0x00//CAN1->CAN2
#define CAN_RELAY_TYPE_CAN2_2_CAN1      0x01//CAN2->CAN1
#define CAN_RELAY_TYPE_CAN12_2_CAN21    0x02//CAN1<->CAN2

#define CAN_RELAY_DATA_TYPE_DIRECT  0x00  //直接转发接收到的数据
#define CAN_RELAY_DATA_TYPE_SPECIAL 0x01  //转发制定的数据
#define CAN_RELAY_DATA_TYPE_DISCARD 0x02  //丢弃该帧
/*******************************离线数据头相关定义*******************************/
typedef struct {
    uint32_t Mark;      //离线功能标识符，固件通过检测该标识符认为后面是有效的离线功能数据
    uint32_t Type;      //离线功能类型定义，参考CAN2LIN_TYPE_定义
    uint32_t DataLen;   //离线功能有效数据字节数
}OFFLINE_TYPE_HEAD;
/*******************************LIN离线发送相关定义*******************************/
//离线发送LIN初始化结构体
typedef struct {
    uint32_t BaudRate;
    uint8_t MasterMode;
    uint8_t ChannelEnable;//0-不初始化该通道，1-初始化该通道
}OFFLINE_LIN_INIT;
//离线发送LIN帧头
typedef struct {
    OFFLINE_LIN_INIT LINInit[4];
    struct {
        uint8_t Key:2;      //1-LIN1作为按键，LIN2发送数据，2-LIN2作为按键，LIN1发送数据，其他值-不判断按键，直接发送
        uint8_t KeyType:2;  //0-低电平发送，1-上升沿发送，2-下降沿发送，3-高电平发送
    }SendType;
    uint32_t MsgLen;
}OFFLINE_LIN_HEAD;
//离线发送LIN数据定义
typedef struct{
    uint32_t  Timestamp;    //时间戳,单位为100us
    uint32_t  SendTimes;    //该帧发送次数
    struct {
        uint16_t MsgType:3;      //帧类型
        uint16_t CheckType:1;    //校验类型
        uint16_t DataLen:4;      //LIN数据段有效数据字节数
        uint16_t Ch:4;
    }Head;
    uint8_t Sync;         //固定值，0x55
    uint8_t PID;          //帧ID
    uint8_t Data[8];      //数据
    uint8_t Check;        //校验,只有校验数据类型为LIN_EX_CHECK_USER的时候才需要用户传入数据
}OFFLINE_LIN_DATA;
/*******************************CAN离线发送相关定义*******************************/
//定义CAN波特率参数表
typedef struct {
    uint16_t  SJW;
    uint16_t  BS1;
    uint16_t  BS2;
    uint16_t  BRP;
}OFFLINE_CAN_BAUD;
//离线发送CAN初始化结构体
typedef struct {
    OFFLINE_CAN_BAUD  NBT;
    OFFLINE_CAN_BAUD  DBT;
    uint8_t ISOCRCEnable;//0-禁止ISO CRC,1-使能ISO CRC
    uint8_t ResEnable;//0-不接入内部120欧终端电阻，1-接入内部120欧终端电阻
    uint8_t ChannelEnable;//0-不初始化该通道，1-初始化该通道
    uint8_t __Res;
}OFFLINE_CAN_INIT;
typedef struct {
    OFFLINE_CAN_INIT CANInit[2];
    struct {
        uint8_t Key:4;      //1-LIN1作为按键，LIN2发送数据，2-LIN2作为按键，LIN1发送数据，其他值-不判断按键，直接发送
        uint8_t KeyType:2;  //0-低电平发送，1-上升沿发送，2-下降沿发送，3-高电平发送
    }SendType;
    uint32_t MsgLen;
}OFFLINE_CAN_HEAD;
//离线发送CAN数据定义
typedef struct{
    union {
        struct{
            uint32_t ID : 29;
            uint32_t : 1;
            uint32_t RTR : 1;
            uint32_t IDE : 1;
        }Head;
        uint32_t HeadData;
    }HeadUnion;
    uint32_t TimeStamp;
    uint32_t SendTimes;    //该帧发送次数
    union {
        struct{
            uint8_t BRS : 1;//1-数据域加速
            uint8_t ESI : 1;
            uint8_t FDF : 1;//1-CANFD帧
            uint8_t Ch : 2;
            uint8_t RXD:1;
        }Flag;
        uint8_t FlagData;
    }FlagUnion;
    uint8_t _Res0;
    uint8_t _Res1;
    uint8_t DLC;
    uint8_t Data[64];
}OFFLINE_CAN_DATA;
//CAN中继头
typedef struct {
    OFFLINE_CAN_INIT CANInit[2];
    uint32_t OtherMsgFilterOut;//不在中继消息表中的消息处理方式，0-原始转发；1-过滤掉，不转发
    uint32_t MsgLen;//CAN_RELAY_DATA消息帧数
}CAN_RELAY_HEAD;
typedef struct {
    OFFLINE_CAN_DATA CANData[2];
    uint32_t PeriodMs;  //数据转换周期，单位为毫秒
    uint8_t ConvertType;//参考CAN_RELAY_TYPE开头的宏定义
    uint8_t DataType;   //数据转发类型，参考CAN_RELAY_DATA_TYPE开头宏定义
}CAN_RELAY_DATA;
/*******************************CAN&LIN互转相关定义*******************************/
//离线实现CAN&LIN互转
typedef struct {
  OFFLINE_LIN_INIT LINInit[4];
  OFFLINE_CAN_INIT CANInit[2];
  uint32_t MsgLen;
}OFFLINE_CAN2LIN_HEAD;
//CAN&LIN互转数据
typedef struct {
  uint8_t ConvertType;
  uint8_t DataType;
  uint32_t PeriodMs;
  OFFLINE_CAN_DATA CANMsg;
  OFFLINE_LIN_DATA LINMsg;
}OFFLINE_CAN2LIN_DATA;

/*******************************CAN2PWM互转相关定义*******************************/
typedef struct {
  OFFLINE_CAN_INIT CANInit[2];
  uint32_t ID;
  uint8_t IDE;
}OFFLINE_CAN2PWM_HEAD;

/*******************************离线PWM相关定义*******************************/
typedef struct {
    uint16_t Prescaler;  //预分频器
    uint16_t Precision;  //占空比调节精度,实际频率 = 200MHz/(Prescaler*Precision)
    uint16_t Pulse;      //占空比，实际占空比=(Pulse/Precision)*100%
    uint16_t Phase;      //波形相位，取值0到Precision-1
    uint8_t  Polarity;   //波形极性，取值0或者1
    uint8_t  ChannelMask;//通道号，若要使能某个通道，则对应位为1，最低位对应通道0
    uint8_t  EN12VOut;
    uint8_t __Res;
}OFFLINE_PWM_DATA;

/*******************************通过按键发送CAN&LIN数据*******************************/
typedef struct {
  OFFLINE_CAN_INIT CANInit[2];
  OFFLINE_LIN_INIT LINInit[4];
  uint16_t Keys;        //1个bit位代表一个KEY，为1代表使能该KEY
  uint32_t KeyType;     //2个bit控制按键类型，0-低电平发送，1-上升沿发送，2-下降沿发送，3-高电平发送
  uint32_t MsgType;     //2个bit控制发送消息类型，0-发送CAN总线数据，1-发送LIN数据
  uint32_t MsgSendCh;   //消息发送通道，1-通过通道0发送，2-通过通道1发送，3-同时2通道发送
  uint32_t MsgLen[16];  //消息帧数
  uint32_t MsgAddr[16]; //消息存储地址
}OFFLINE_KEY_CAN_LIN;

typedef struct {
    uint32_t SchMark;     //调度表标识
    uint32_t SchNum;      //调度表数，调度表数不能大于256
    uint8_t  SchFrames[256]; //每个调度表里面包含帧数，帧数不能大于CAN_SCH_TAB_SIZE
    uint16_t SchSendTimes[256];//每个调度表发送次数，若是并行发送，则每帧发送指定次数后停止，否则每次发送指定帧数之后再发送下一帧
    void *pMsg;           //调度表帧指针
}CAN_SCH_DATA;

#endif



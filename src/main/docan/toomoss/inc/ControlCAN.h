/**
  ******************************************************************************
  * @file    ControlCAN.h
  * $Author: wdluo $
  * $Revision: 447 $
  * $Date:: 2013-06-29 18:24:57 +0800 #$
  * @brief   Ginkgo USB-CAN适配器底层控制相关API函数定义.
  ******************************************************************************
  * @attention
  *
  *<h3><center>&copy; Copyright 2009-2012, ViewTool</center>
  *<center><a href="http:\\www.toomoss.com">http://www.toomoss.com</a></center>
  *<center>All Rights Reserved</center></h3>
  *
  ******************************************************************************
  */
#ifndef _CONTROLCAN_H_
#define _CONTROLCAN_H_

#include <stdint.h>
#ifndef OS_UNIX
#include <Windows.h>
#else
#ifndef WINAPI
#define WINAPI
#endif
#endif

//适配器类型定义
#define VCI_USBCAN1     3
#define VCI_USBCAN2     4

//CAN错误码
#define ERR_CAN_OVERFLOW        0x0001  //CAN 控制器内部FIFO溢出
#define ERR_CAN_ERRALARM        0x0002  //CAN 控制器错误报警
#define ERR_CAN_PASSIVE         0x0004  //CAN 控制器消极错误
#define ERR_CAN_LOSE            0x0008  //CAN 控制器仲裁丢失
#define ERR_CAN_BUSERR          0x0010  //CAN 控制器总线错误
#define ERR_CAN_BUSOFF          0x0020  //CAN 控制器总线关闭

//通用错误码
#define ERR_DEVICEOPENED        0x0100  //设备已经打开
#define ERR_DEVICEOPEN          0x0200  //打开设备错误
#define ERR_DEVICENOTOPEN       0x0400  //设备没有打开
#define ERR_BUFFEROVERFLOW      0x0800  //缓冲区溢出
#define ERR_DEVICENOTEXIST      0x1000  //此设备不存在
#define ERR_LOADKERNELDLL       0x2000  //装载动态库失败
#define ERR_CMDFAILED           0x4000  //执行命令失败错误码
#define ERR_BUFFERCREATE        0x8000  //内存不足

//函数调用返回状态值
#define STATUS_OK   1
#define STATUS_ERR  0

//1.兼容ZLGCAN系列接口卡信息的数据类型。
typedef  struct  _VCI_BOARD_INFO{
    unsigned short  hw_Version;         //硬件版本号，用16 进制表示。比如0x0100 表示V1.00。
    unsigned short  fw_Version;         //固件版本号，用16 进制表示。
    unsigned short  dr_Version;         //驱动程序版本号，用16 进制表示。
    unsigned short  in_Version;         //接口库版本号，用16 进制表示。
    unsigned short  irq_Num;            //板卡所使用的中断号。
    unsigned char   can_Num;            //表示有几路CAN 通道。
    unsigned char   str_Serial_Num[20]; //此板卡的序列号。
    unsigned char   str_hw_Type[40];    //硬件类型，比如“USBCAN V1.00”（注意：包括字符串结束符‘\0’）。
    unsigned short  Reserved[4];        //系统保留。
} VCI_BOARD_INFO,*PVCI_BOARD_INFO;

//1.Ginkgo系列接口卡信息的数据类型。
typedef  struct  _VCI_BOARD_INFO_EX{
    unsigned char   ProductName[32];    //硬件名称（注意：包括字符串结束符‘\0’）
    unsigned char   FirmwareVersion[4]; //固件版本
    unsigned char   HardwareVersion[4]; //硬件版本
    unsigned char   SerialNumber[12];   //适配器序列号
} VCI_BOARD_INFO_EX,*PVCI_BOARD_INFO_EX;

//2.定义CAN信息帧的数据类型。
typedef  struct  _VCI_CAN_OBJ{
    unsigned int    ID;         //报文ID。
    unsigned int    TimeStamp;  //接收到信息帧时的时间标识，从CAN 控制器初始化开始计时。
    unsigned char   TimeFlag;   //是否使用时间标识，为1 时TimeStamp 有效，TimeFlag 和TimeStamp 只在此帧为接收帧时有意义。
    unsigned char   SendType;   //发送帧类型，=0 时为正常发送，=1 时为单次发送，=2 时为自发自收，=3 时为单次自发自收，只在此
                                //帧为发送帧时有意义。（当设备类型为EG20T-CAN 时，发送方式在VCI_InitCan 中通过设置，此处的
                                //设置无效，设置为自发自收模式后EG20T-CAN 不能从总线上接收数据，只能收到自己发出的数据）
    unsigned char   RemoteFlag; //是否是远程帧
    unsigned char   ExternFlag; //是否是扩展帧
    unsigned char   DataLen;    //数据长度(<=8)，即Data 的长度。
    unsigned char   Data[8];    //报文的数据。
    unsigned char   Reserved[3];//系统保留。
}VCI_CAN_OBJ,*PVCI_CAN_OBJ;

//3.定义CAN控制器状态的数据类型。
typedef struct _VCI_CAN_STATUS{
    unsigned char   ErrInterrupt;   //中断记录，读操作会清除。
    unsigned char   regMode;        //CAN 控制器模式寄存器。
    unsigned char   regStatus;      //CAN 控制器状态寄存器。
    unsigned char   regALCapture;   //CAN 控制器仲裁丢失寄存器。
    unsigned char   regECCapture;   //CAN 控制器错误寄存器。
    unsigned char   regEWLimit;     //CAN 控制器错误警告限制寄存器。
    unsigned char   regRECounter;   //CAN 控制器接收错误寄存器。
    unsigned char   regTECounter;   //CAN 控制器发送错误寄存器。
    unsigned int    regESR;         //CAN 控制器错误状态寄存器。
    unsigned int    regTSR;         //CAN 控制器发送状态寄存器
    unsigned int    BufferSize;     //CAN 控制器接收缓冲区大小
    unsigned int    Reserved;
}VCI_CAN_STATUS,*PVCI_CAN_STATUS;

//4.定义错误信息的数据类型。
typedef struct _ERR_INFO{
    unsigned int    ErrCode;            //错误码
    unsigned char   Passive_ErrData[3]; //当产生的错误中有消极错误时表示为消极错误的错误标识数据。
    unsigned char   ArLost_ErrData;     //当产生的错误中有仲裁丢失错误时表示为仲裁丢失错误的错误标识数据。
} VCI_ERR_INFO,*PVCI_ERR_INFO;

//5.定义初始化CAN的数据类型
typedef struct _INIT_CONFIG{
    unsigned int    AccCode;    //验收码
    unsigned int    AccMask;    //屏蔽码
    unsigned int    Reserved;   //保留
    unsigned char   Filter;     //滤波方式,0-双滤波，接收所有的帧，1-单滤波，根据AccCode和AccMask来设置过滤器 
    unsigned char   Timing0;    //定时器0（BTR0）。
    unsigned char   Timing1;    //定时器1（BTR1）。
    unsigned char   Mode;       //模式，0-正常模式，1-监听模式，2-自发自收默认，若最高位设置为1，比如按位或上0x80，则表示接入120欧的终端电阻到CAN总线，否则不接入。
}VCI_INIT_CONFIG,*PVCI_INIT_CONFIG;

//6.定义了CAN 滤波器的设置
typedef struct _VCI_FILTER_CONFIG{
    unsigned char   Enable;         //使能该过滤器，1-使能，0-禁止
    unsigned char   FilterIndex;    //过滤器索引号，取值范围为0到13
    unsigned char   FilterMode;     //过滤器模式，0-屏蔽位模式，1-标识符列表模式
    unsigned char   ExtFrame;       //过滤的帧类型标志，为1 代表要过滤的为扩展帧，为0 代表要过滤的为标准帧。
    unsigned int    ID_Std_Ext;     //验收码ID
    unsigned int    ID_IDE;         //验收码IDE
    unsigned int    ID_RTR;         //验收码RTR
    unsigned int    MASK_Std_Ext;   //屏蔽码ID，该项只有在过滤器模式为屏蔽位模式时有用
    unsigned int    MASK_IDE;       //屏蔽码IDE，该项只有在过滤器模式为屏蔽位模式时有用
    unsigned int    MASK_RTR;       //屏蔽码RTR，该项只有在过滤器模式为屏蔽位模式时有用
    unsigned int    Reserved;       //系统保留
} VCI_FILTER_CONFIG,*PVCI_FILTER_CONFIG;

#ifdef __cplusplus
extern "C"
{
#endif
#ifdef __OS_ANDROID_BACK
unsigned int WINAPI VCI_ScanDevice(int *fd,int devNum);
#else
unsigned int WINAPI VCI_ScanDevice(unsigned char NeedInit);
#endif
#ifdef __OS_ANDROID_BACK
unsigned int WINAPI VCI_OpenDevice(unsigned int DevType, unsigned int DevIndex,int *pFd,int DevNum);
#else
unsigned int WINAPI VCI_OpenDevice(unsigned int DevType, unsigned int DevIndex,unsigned int Reserved);
#endif
unsigned int WINAPI VCI_CloseDevice(unsigned int DevType,unsigned int DevIndex);
unsigned int WINAPI VCI_InitCAN(unsigned int DevType, unsigned int DevIndex, unsigned int CANIndex, PVCI_INIT_CONFIG pInitConfig);

unsigned int WINAPI VCI_ReadBoardInfo(unsigned int DevType,unsigned int DevIndex,PVCI_BOARD_INFO pInfo);
unsigned int WINAPI VCI_ReadErrInfo(unsigned int DevType,unsigned int DevIndex,unsigned int CANIndex,PVCI_ERR_INFO pErrInfo);
unsigned int WINAPI VCI_ReadCANStatus(unsigned int DevType,unsigned int DevIndex,unsigned int CANIndex,PVCI_CAN_STATUS pCANStatus);

unsigned int WINAPI VCI_GetReference(unsigned int DevType,unsigned int DevIndex,unsigned int CANIndex,unsigned int RefType,void *pData);
unsigned int WINAPI VCI_SetReference(unsigned int DevType,unsigned int DevIndex,unsigned int CANIndex,unsigned int RefType,void *pData);
unsigned int WINAPI VCI_SetFilter(unsigned int DevType,unsigned int DevIndex,unsigned int CANIndex,PVCI_FILTER_CONFIG pFilter);

unsigned int WINAPI VCI_GetReceiveNum(unsigned int DevType,unsigned int DevIndex,unsigned int CANIndex);
unsigned int WINAPI VCI_ClearBuffer(unsigned int DevType,unsigned int DevIndex,unsigned int CANIndex);

unsigned int WINAPI VCI_StartCAN(unsigned int DevType,unsigned int DevIndex,unsigned int CANIndex);
unsigned int WINAPI VCI_ResetCAN(unsigned int DevType,unsigned int DevIndex,unsigned int CANIndex);

unsigned int WINAPI VCI_Transmit(unsigned int DevType,unsigned int DevIndex,unsigned int CANIndex,PVCI_CAN_OBJ pSend,unsigned int Len);
unsigned int WINAPI VCI_Receive(unsigned int DevType,unsigned int DevIndex,unsigned int CANIndex,PVCI_CAN_OBJ pReceive,unsigned int Len,int WaitTime=-1);


#ifdef __cplusplus
}
#endif

#endif



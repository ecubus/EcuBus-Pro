/*******************************************************************************
  * @file    LDFDecoder.h
  * $Author: wdluo $
  * $Revision: 447 $
  * $Date:: 2013-06-29 18:24:57 +0800 #$
  * @brief   LDF文件解析相关函数和数据类型定义.
  ******************************************************************************
  * @attention
  *
  *<center><a href="http:\\www.toomoss.com">http://www.toomoss.com</a></center>
  *<center>All Rights Reserved</center></h3>
  * 
  ******************************************************************************
  */
#ifndef __LDFDECODER_H_
#define __LDFDECODER_H_

#include <stdint.h>
#ifndef OS_UNIX
#include <Windows.h>
#else
#include <unistd.h>
#ifndef WINAPI
#define WINAPI
#endif
#endif

#define LDF_SUCCESS                 0   //操作成功
#define LDF_ERROR_FILE_OPEN         (-1)//打开文件出错
#define LDF_ERROR_FILE_FORMAT       (-2)//文件格式错误
#define LDF_ERROR_DEV_DISCONNECT    (-3)//设备未连接
#define LDF_ERROR_MEM_MALLOC        (-4)//内存分配失败
//逻辑类型编码值
typedef struct _LDF_CODING_LOGICAL{
    int RawValue;       //实际值
    char *pDescription; //逻辑值编码字符串
}LDF_CODING_LOGICAL;

//物理类型编码值，信号物理值=信号实际值*Factor+Offset
typedef struct _LDF_CODING_PHYSICAL{
    double Offset;   //信号物理值偏移量
    double Factor;   //信号缩放因子
    long long Minimum;    //信号实际最小值，注意不是物理值
    long long Maximum;    //信号实际最大值，注意不是物理值
    char *pUnit;    //信号物理值单位
}LDF_CODING_PHYSICAL;

//信号中的值类型
enum LDF_SIGNAL_VALUE_TYPE{
    LDF_SIGNAL_VALUE_TYPE_SCALAR,   //标量值
    LDF_SIGNAL_VALUE_TYPE_ARRAY     //数组值
};

//信号值编码类型
enum LDF_SIGNAL_CODING_TYPE{
    LDF_SIGNAL_CODING_TYPE_NONE,
    LDF_SIGNAL_CODING_TYPE_PHYSICAL,//物理值
    LDF_SIGNAL_CODING_TYPE_LOGICAL  //逻辑值
};

//信号类型
enum LDF_SIGNAL_TYPE{
    LDF_SIGNAL_TYPE_NORMAL,
    LDF_SIGNAL_TYPE_DIAGNOSTIC
};

//帧类型
enum LDF_FRAME_TYPE{
    LDF_FRAME_TYPE_NORMAL,
    LDF_FRAME_TYPE_DIAGNOSTIC
};

//信号编码
typedef struct _LDF_SIGNAL_CODING{
    char *pName;                            //信号编码名称
    int LogicalValueLen;                    //逻辑值长度
    int PhysicalValueLen;                   //物理值长度
    LDF_CODING_LOGICAL *pLogicalValues;     //逻辑值列表指针
    LDF_CODING_PHYSICAL *pPhysicalValues;   //物理值列表指针
}LDF_SIGNAL_CODING;

//信号和信号编码对应值
typedef struct _LDF_SIGNAL_REPRESENTATION{
    char *pSignalName;  //信号名称
    char *pCodingName;  //编码名称
}LDF_SIGNAL_REPRESENTATION;

//信号值结构体，结构体里面的值二取一，并不是同时存在
typedef struct _LDF_SIGNAL_VALUE{
    long long ScalarValue;      //物理值
    unsigned char ArrayValue[8];//数组
}LDF_SIGNAL_VALUE;

//信号编码
typedef struct _LDF_LIN_SIGNAL{
    char *pName;                    //信号名称
    int Size;                       //信号大小，单位为bit
    LDF_SIGNAL_TYPE Type;           //普通信号或者诊断信号
    LDF_SIGNAL_VALUE_TYPE ValueType;//数值或者数组
    LDF_SIGNAL_VALUE Value;         //信号值
    char *pPublisher;               //信号发布者名称，可能为主机或者从机
    int SubscriberLen;              //接收该信号节点长度
    char *pSubscribers[16];         //接收该信号的节点名称数组
    int Offset;                     //该信号在8字节数据中的偏移量
    LDF_SIGNAL_CODING SignalCodings;//信号编码
    double minimum;
    double maximum;
}LDF_LIN_SIGNAL;

//帧，每帧数据包含多个信号
typedef struct _LDF_LIN_FRAME{
    char *pName;                //帧名称
    unsigned char ID;           //帧ID
    char *pPublisher;           //发布者名称
    unsigned char Size;         //帧长度，单位为字节
    LDF_FRAME_TYPE Type;        //帧类型
    int SignalListLen;          //信号长度
    LDF_LIN_SIGNAL *pSignalList;//信号指针
}LDF_LIN_FRAME;
//节点结构体
typedef struct _LDF_LIN_NODE{
    char *pMasterName;      //主机名称
    float time_base;
    float jitter;
    int SlaveLen;           //从机数量
    char *pSlaveNames[16];  //从机名称数组
}LDF_LIN_NODE;

//调度表命令
typedef struct _LDF_LIN_SCH_CMD{
    LDF_LIN_FRAME Frame;    //LIN帧
    float DelayOfMs;        //延时时间，单位为毫秒
}LDF_LIN_SCH_CMD;

//调度表
typedef struct _LDF_LIN_SCH{
    char *pName;                        //调度表名称
    int ScheduleCmdLen;                 //该表下面包含的帧数
    LDF_LIN_SCH_CMD *pScheduleCmdList;  //改表下面的帧列表
}LDF_LIN_SCH;

//节点属性
typedef struct _LDF_NODE_ATTR{
    char *pName;
    unsigned short LIN_protocol;
    unsigned char configured_NAD;
    unsigned char initial_NAD;
    struct {
        unsigned int supplier_id;
        unsigned int function_id;
        unsigned int variant;
    }product_id;
    char *response_error;//signal_name
    char *fault_state_signals[64];
    int fault_state_signal_len;
    float P2_min;
    float ST_min;
    float N_As_timeout;
    float N_Cr_timeout;
    char *configurable_frames[64];
    int configurable_frame_len;
}LDF_NODE_ATTR;

//解析后的LDF文件内容
typedef struct _LDF_CODING{
    int ProtocolVersion;        //LIN protocol version,实际版本号的一百倍值，比如当前值为210，那么实际版本为2.1
    int LanguageVersion;        //LIN language version,实际版本号的一百倍值，比如当前值为210，那么实际版本为2.1
    int DevHandle;
    int LINSpeed;               //LIN总线波特率，单位为bps
    int LINIndex;               //LIN通道号
    bool isMaster;              //当前节点为主节点还是从节点
    bool HaveInit;              //已经成功初始化
    LDF_LIN_NODE *pNode;        //节点指针
    int FrameLen;               //帧长度
    LDF_LIN_FRAME *pFrames;     //帧指针
    int NodeAttrLen;            //节点属性长度
    LDF_NODE_ATTR *pNodeAttrs;  //节点属性指针
    int LINSchLen;              //调度表长度
    LDF_LIN_SCH *pLINSch;       //调度表指针
}LDF_CODING;

#ifdef __cplusplus
extern "C"
{
#endif
    int WINAPI LDF_Decode(int DevHandle,char *pLDFFileName,LDF_CODING *pLDFCoding);
    int WINAPI LDF_DataRawToFrame(LDF_LIN_FRAME *pFrame,unsigned char *pRawData);
    int WINAPI LDF_DataFrameToRaw(LDF_LIN_FRAME* pFrame, unsigned char* pRawData, unsigned char FillBitValue);
#ifdef __cplusplus
}
#endif

#endif




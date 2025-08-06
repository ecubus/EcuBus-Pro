#ifndef ZLGCAN_H_
#define ZLGCAN_H_

#include <time.h>

#include "canframe.h"
#include "config.h"

#define ZCAN_PCI5121              1
#define ZCAN_PCI9810              2
#define ZCAN_USBCAN1              3
#define ZCAN_USBCAN2              4
#define ZCAN_PCI9820              5
#define ZCAN_CAN232               6
#define ZCAN_PCI5110              7
#define ZCAN_CANLITE              8
#define ZCAN_ISA9620              9
#define ZCAN_ISA5420              10
#define ZCAN_PC104CAN             11
#define ZCAN_CANETUDP             12
#define ZCAN_CANETE               12
#define ZCAN_DNP9810              13
#define ZCAN_PCI9840              14
#define ZCAN_PC104CAN2            15
#define ZCAN_PCI9820I             16
#define ZCAN_CANETTCP             17
#define ZCAN_PCIE_9220            18
#define ZCAN_PCI5010U             19
#define ZCAN_USBCAN_E_U           20
#define ZCAN_USBCAN_2E_U          21
#define ZCAN_PCI5020U             22
#define ZCAN_EG20T_CAN            23
#define ZCAN_PCIE9221             24
#define ZCAN_WIFICAN_TCP          25
#define ZCAN_WIFICAN_UDP          26
#define ZCAN_PCIe9120             27
#define ZCAN_PCIe9110             28
#define ZCAN_PCIe9140             29
#define ZCAN_USBCAN_4E_U          31
#define ZCAN_CANDTU_200UR         32
#define ZCAN_CANDTU_MINI          33
#define ZCAN_USBCAN_8E_U          34
#define ZCAN_CANREPLAY            35
#define ZCAN_CANDTU_NET           36
#define ZCAN_CANDTU_100UR         37
#define ZCAN_PCIE_CANFD_100U      38
#define ZCAN_PCIE_CANFD_200U      39
#define ZCAN_PCIE_CANFD_400U      40
#define ZCAN_USBCANFD_200U        41
#define ZCAN_USBCANFD_100U        42
#define ZCAN_USBCANFD_MINI        43
#define ZCAN_CANFDCOM_100IE       44
#define ZCAN_CANSCOPE             45
#define ZCAN_CLOUD                46
#define ZCAN_CANDTU_NET_400       47
#define ZCAN_CANFDNET_TCP         48
#define ZCAN_CANFDNET_200U_TCP    48
#define ZCAN_CANFDNET_UDP         49
#define ZCAN_CANFDNET_200U_UDP    49
#define ZCAN_CANFDWIFI_TCP        50
#define ZCAN_CANFDWIFI_100U_TCP   50
#define ZCAN_CANFDWIFI_UDP        51
#define ZCAN_CANFDWIFI_100U_UDP   51
#define ZCAN_CANFDNET_400U_TCP    52
#define ZCAN_CANFDNET_400U_UDP    53
#define ZCAN_CANFDBLUE_200U       54
#define ZCAN_CANFDNET_100U_TCP    55
#define ZCAN_CANFDNET_100U_UDP    56
#define ZCAN_CANFDNET_800U_TCP    57
#define ZCAN_CANFDNET_800U_UDP    58
#define ZCAN_USBCANFD_800U        59
#define ZCAN_PCIE_CANFD_100U_EX   60
#define ZCAN_PCIE_CANFD_400U_EX   61
#define ZCAN_PCIE_CANFD_200U_MINI 62
#define ZCAN_PCIE_CANFD_200U_M2   63
#define ZCAN_CANFDDTU_400_TCP     64
#define ZCAN_CANFDDTU_400_UDP     65
#define ZCAN_CANFDWIFI_200U_TCP   66
#define ZCAN_CANFDWIFI_200U_UDP   67
#define ZCAN_CANFDDTU_800ER_TCP   68
#define ZCAN_CANFDDTU_800ER_UDP   69
#define ZCAN_CANFDDTU_800EWGR_TCP 70
#define ZCAN_CANFDDTU_800EWGR_UDP 71
#define ZCAN_CANFDDTU_600EWGR_TCP 72
#define ZCAN_CANFDDTU_600EWGR_UDP 73
#define ZCAN_CANFDDTU_CASCADE_TCP 74
#define ZCAN_CANFDDTU_CASCADE_UDP 75
#define ZCAN_USBCANFD_400U        76
#define ZCAN_CANFDDTU_200U        77
#define ZCAN_ZPSCANFD_TCP         78
#define ZCAN_ZPSCANFD_USB         79
#define ZCAN_CANFDBRIDGE_PLUS     80

#define ZCAN_OFFLINE_DEVICE 98
#define ZCAN_VIRTUAL_DEVICE 99

#define ZCAN_ERROR_CAN_OVERFLOW        0x0001
#define ZCAN_ERROR_CAN_ERRALARM        0x0002
#define ZCAN_ERROR_CAN_PASSIVE         0x0004
#define ZCAN_ERROR_CAN_LOSE            0x0008
#define ZCAN_ERROR_CAN_BUSERR          0x0010
#define ZCAN_ERROR_CAN_BUSOFF          0x0020
#define ZCAN_ERROR_CAN_BUFFER_OVERFLOW 0x0040

#define ZCAN_ERROR_DEVICEOPENED   0x0100
#define ZCAN_ERROR_DEVICEOPEN     0x0200
#define ZCAN_ERROR_DEVICENOTOPEN  0x0400
#define ZCAN_ERROR_BUFFEROVERFLOW 0x0800
#define ZCAN_ERROR_DEVICENOTEXIST 0x1000
#define ZCAN_ERROR_LOADKERNELDLL  0x2000
#define ZCAN_ERROR_CMDFAILED      0x4000
#define ZCAN_ERROR_BUFFERCREATE   0x8000

#define ZCAN_ERROR_CANETE_PORTOPENED 0x00010000
#define ZCAN_ERROR_CANETE_INDEXUSED  0x00020000
#define ZCAN_ERROR_REF_TYPE_ID       0x00030001
#define ZCAN_ERROR_CREATE_SOCKET     0x00030002
#define ZCAN_ERROR_OPEN_CONNECT      0x00030003
#define ZCAN_ERROR_NO_STARTUP        0x00030004
#define ZCAN_ERROR_NO_CONNECTED      0x00030005
#define ZCAN_ERROR_SEND_PARTIAL      0x00030006
#define ZCAN_ERROR_SEND_TOO_FAST     0x00030007

typedef UINT ZCAN_RET_STATUS;
#define STATUS_ERR              0
#define STATUS_OK               1
#define STATUS_ONLINE           2
#define STATUS_OFFLINE          3
#define STATUS_UNSUPPORTED      4
#define STATUS_BUFFER_TOO_SMALL 5

typedef UINT ZCAN_LAST_ERROR_STATUS;
//#define STATUS_NO_ERR                       0
//#define STATUS_NO_ERR                       1

typedef UINT ZCAN_UDS_DATA_DEF;
#define DEF_CAN_UDS_DATA  1  // CAN/CANFD UDS����
#define DEF_LIN_UDS_DATA  2  // LIN UDS����
#define DEF_DOIP_UDS_DATA 3  // DOIP UDS����

#define CMD_DESIP           0
#define CMD_DESPORT         1
#define CMD_CHGDESIPANDPORT 2
#define CMD_SRCPORT         2
#define CMD_TCP_TYPE        4
#define TCP_CLIENT          0
#define TCP_SERVER          1

#define CMD_CLIENT_COUNT       5
#define CMD_CLIENT             6
#define CMD_DISCONN_CLINET     7
#define CMD_SET_RECONNECT_TIME 8

#define TYPE_CAN      0
#define TYPE_CANFD    1
#define TYPE_ALL_DATA 2

// ��̬���� �־����� BEGIN
#define ZCAN_DYNAMIC_CONFIG_DEVNAME \
    "DYNAMIC_CONFIG_DEVNAME"  // �豸�����Ϊ32�ֽڣ�������\0������CANFDNET -
                              // 200UĬ��ֵΪ��CANFDNET - 200U����CANFDNET -
                              // 100MINIĬ��ֵΪ��CANFDNET - 100MINI��
// CAN��ͨ��������Ϣ(CAN%d����и�ʽ�������?�� ��Χ��0-7)
#define ZCAN_DYNAMIC_CONFIG_CAN_ENABLE \
    "DYNAMIC_CONFIG_CAN%d_ENABLE"  // ͨ��ʹ�ܣ�1��ʹ�ܣ�0��ʧ�ܣ�CANFDNETϵ�в�Ʒͨ��Ĭ��ʹ�ܡ�
#define ZCAN_DYNAMIC_CONFIG_CAN_MODE "DYNAMIC_CONFIG_CAN%d_MODE"  // ����ģʽ��Ĭ������ģʽ��0������ģʽ��1��ֻ��ģʽ��
#define ZCAN_DYNAMIC_CONFIG_CAN_TXATTEMPTS \
    "DYNAMIC_CONFIG_CAN%d_TXATTEMPTS"  // ����ʧ���Ƿ��ش���0������ʧ�ܲ��ش�1������ʧ���ش���ֱ�����߹رգ�CANFDNET
                                       // - 100 / 200�޴������ã�
#define ZCAN_DYNAMIC_CONFIG_CAN_NOMINALBAUD     "DYNAMIC_CONFIG_CAN%d_NOMINALBAUD"  // CAN�����ʻ�CANFD�ٲ������ʣ�
#define ZCAN_DYNAMIC_CONFIG_CAN_DATABAUD        "DYNAMIC_CONFIG_CAN%d_DATABAUD"     // CANFD���������ʣ�
#define ZCAN_DYNAMIC_CONFIG_CAN_USERES          "DYNAMIC_CONFIG_CAN%d_USERES"       // �ն˵��迪�أ�0���رգ�1���򿪡�
#define ZCAN_DYNAMIC_CONFIG_CAN_SNDCFG_INTERVAL "DYNAMIC_CONFIG_CAN%d_SNDCFG_INTERVAL"  // ���ķ��ͼ���ￄ1�7?0~255ms
#define ZCAN_DYNAMIC_CONFIG_CAN_BUSRATIO_ENABLE \
    "DYNAMIC_CONFIG_CAN%d_BUSRATIO_ENABLE"  // ����������ʹ�ܣ�ʹ�ܺ󣬽����ڷ������������ʵ��趨��TCP/UDP���ӡ�1:ʹ�ܣ�0��ʧ��
#define ZCAN_DYNAMIC_CONFIG_CAN_BUSRATIO_PERIOD \
    "DYNAMIC_CONFIG_CAN%d_BUSRATIO_PERIOD"  // ���������ʲɼ����ڣ�ȡֵ200~2000ms

typedef struct tagZCAN_DYNAMIC_CONFIG_DATA {
    char key[64];
    char value[64];
} ZCAN_DYNAMIC_CONFIG_DATA;

#define CANFD_FILTER_COUNT_MAX 16
#define CANFD_DATA_LEN_MAX     64

typedef UINT DynamicConfigDataType;
#define DYNAMIC_CONFIG_CAN    0  // CANͨ������
#define DYNAMIC_CONFIG_FILTER 1  // �˲�����

union unionCANFDFilterRulePresent {
    struct {
        unsigned int bChnl       : 1;   // ͨ������ �Ƿ���ￄ1�7?
        unsigned int bFD         : 1;   // CANFD��ʶ �Ƿ���ￄ1�7?
        unsigned int bEXT        : 1;   // ��׼֡/��չ֡��ʶ �Ƿ���ￄ1�7?
        unsigned int bRTR        : 1;   // ����֡/Զ��֡��ʶ �Ƿ���ￄ1�7?
        unsigned int bLen        : 1;   // ����  �Ƿ���ￄ1�7?
        unsigned int bID         : 1;   // ��ʼID/����ID �Ƿ���ￄ1�7?
        unsigned int bTime       : 1;   // ��ʼʱ��/����ʱ�� �Ƿ���ￄ1�7?
        unsigned int bFilterMask : 1;   // �������ݹ���/���� �Ƿ���ￄ1�7?
        unsigned int bErr        : 1;   // ������ CAN/CANFD��־ �Ƿ���ￄ1�7?
        unsigned int nReserved   : 23;  // ����
    } unionValue;
    unsigned int rawValue;
};

// �������˹���
struct CANFD_FILTER_RULE {
    unionCANFDFilterRulePresent presentFlag;  // ��ʶ��Ӧ�������Ƿ���ￄ1�7?
    int                         nErr;  // �Ƿ�����ģ�������һ�����ڣ���ʾ��������������֡���Ǵ���֡�ￄ1�7?0:�����˴���֡
                                       // 1:���˴���֡
    int  nChnl;                        // ͨ��
    int  nFD;                          // CANFD��ʶ��0��CAN; 1:CANFD
    int  nExt;                         // ��չ֡��ʶ��0:��׼֡ 1:��չ֡
    int  nRtr;                         // Զ��֡��ʶ��0:����֡ 1:Զ��֡
    int  nLen;                         // ���ĳ��ȣ�0-64
    int  nBeginID;                     // ��ʼID
    int  nEndID;                       // ����ID����ʼIDֵ����<=����ID������ʼID�ɶԴ���
    int  nBeginTime;                   // ������ʼʱ�䣬��λs��ȡֵ0-(24*60*60-1)
    int  nEndTime;                     // ���˽���ʱ�䣬��λs��ȡֵ0-(24*60*60-1)������ʼʱ��ɶԴ��ￄ1�7?
    int  nFilterDataLen;
    int  nMaskDataLen;
    BYTE nFilterData[CANFD_DATA_LEN_MAX];  // ���Ĺ������ݣ�uint8���飬�64
    BYTE nMaskData[CANFD_DATA_LEN_MAX];    // �����������ݣ�uint8���飬�64����������ݳɶԴ��ￄ1�7?
};

typedef UINT enumCANFDFilterBlackWhiteList;
#define CANFD_FILTER_BLACK_LIST 0  // ������
#define CANFD_FILTER_WHITE_LIST 1  // ������

struct CANFD_FILTER_CFG {
    int                           bEnable;
    enumCANFDFilterBlackWhiteList enBlackWhiteList;
    CANFD_FILTER_RULE             vecFilters[CANFD_FILTER_COUNT_MAX];
};

// Ŀǰֻ���˲�ʹ�á������ɼ�������ģ��
typedef struct tagZCAN_DYNAMIC_CONFIG {
    DynamicConfigDataType dynamicConfigDataType;
    UINT                  isPersist;  // �Ƿ��ǳ־����ã����豸���籣�����ã���TRUE-�־�����
                                      // FALSE-��̬����
    union {
        CANFD_FILTER_CFG
        filterCfg;                 // dynamicConfigDataType = DYNAMIC_CONFIG_FILTERʱ��Ч
        BYTE reserved[10 * 1024];  // ����
    } data;
} ZCAN_DYNAMIC_CONFIG;
// ��̬���� �־����� END

typedef void *DEVICE_HANDLE;
typedef void *CHANNEL_HANDLE;

typedef struct tagZCAN_DEVICE_INFO {
    USHORT hw_Version;  // Ӳ���汾
    USHORT fw_Version;  // �̼��汾
    USHORT dr_Version;  // �����汾
    USHORT in_Version;  // ��̬��ￄ1�7?
    USHORT irq_Num;
    BYTE   can_Num;
    UCHAR  str_Serial_Num[20];
    UCHAR  str_hw_Type[40];
    USHORT reserved[4];
} ZCAN_DEVICE_INFO;

typedef struct {
    UINT acc_code;
    UINT acc_mask;
    UINT reserved;
    BYTE filter;
    BYTE timing0;
    BYTE timing1;
    BYTE mode;
} ZCAN_CHANNEL_INIT_CONFIG_INFO_CAN;

typedef struct {
    UINT   acc_code;
    UINT   acc_mask;
    UINT   abit_timing;
    UINT   dbit_timing;
    UINT   brp;
    BYTE   filter;
    BYTE   mode;
    USHORT pad;
    UINT   reserved;
} ZCAN_CHANNEL_INIT_CONFIG_INFO_CANFD;


typedef union {
   ZCAN_CHANNEL_INIT_CONFIG_INFO_CAN  can;
   ZCAN_CHANNEL_INIT_CONFIG_INFO_CANFD canfd;
}ZCAN_CHANNEL_INIT_CONFIG_INFO;

typedef struct tagZCAN_CHANNEL_INIT_CONFIG {
    UINT can_type;  // type:TYPE_CAN
                    // TYPE_CANFD��can_type���豸����ֻȡ���ڲ�ƷӲ�������ͣ�CANFDϵ�еĲ�Ʒ��������Ϊ1����ʾCANFD�豸��
    ZCAN_CHANNEL_INIT_CONFIG_INFO info;
} ZCAN_CHANNEL_INIT_CONFIG;

typedef struct tagZCAN_CHANNEL_ERR_INFO {
    UINT error_code;
    BYTE passive_ErrData[3];
    BYTE arLost_ErrData;
} ZCAN_CHANNEL_ERR_INFO;

typedef struct tagZCAN_CHANNEL_STATUS {
    BYTE errInterrupt;
    BYTE regMode;
    BYTE regStatus;
    BYTE regALCapture;
    BYTE regECCapture;
    BYTE regEWLimit;
    BYTE regRECounter;
    BYTE regTECounter;
    UINT Reserved;
} ZCAN_CHANNEL_STATUS;

typedef struct tagZCAN_Transmit_Data {
    can_frame frame;
    UINT      transmit_type;
} ZCAN_Transmit_Data;

typedef struct tagZCAN_Receive_Data {
    can_frame frame;
    UINT64    timestamp;  // us
} ZCAN_Receive_Data;

typedef struct tagZCAN_TransmitFD_Data {
    canfd_frame frame;
    UINT        transmit_type;
} ZCAN_TransmitFD_Data;

typedef struct tagZCAN_ReceiveFD_Data {
    canfd_frame frame;
    UINT64      timestamp;  // us
} ZCAN_ReceiveFD_Data;

typedef struct tagZCAN_AUTO_TRANSMIT_OBJ {
    USHORT             enable;
    USHORT             index;     // 0...n
    UINT               interval;  // ms
    ZCAN_Transmit_Data obj;
} ZCAN_AUTO_TRANSMIT_OBJ, *PZCAN_AUTO_TRANSMIT_OBJ;

typedef struct tagZCANFD_AUTO_TRANSMIT_OBJ {
    USHORT               enable;
    USHORT               index;     // 0...n
    UINT                 interval;  // ms
    ZCAN_TransmitFD_Data obj;
} ZCANFD_AUTO_TRANSMIT_OBJ, *PZCANFD_AUTO_TRANSMIT_OBJ;

// �������ö�ʱ���Ͷ���Ĳ�����Ŀǰֻ֧��USBCANFD-X00Uϵ���豸
typedef struct tagZCAN_AUTO_TRANSMIT_OBJ_PARAM {
    USHORT index;  // ��ʱ����֡������
    USHORT type;   // �������ͣ�Ŀǰ����ֻ��1����ʾ������ʱ
    UINT   value;  // ������ֵ
} ZCAN_AUTO_TRANSMIT_OBJ_PARAM, *PZCAN_AUTO_TRANSMIT_OBJ_PARAM;

// for zlg cloud
#define ZCLOUD_MAX_DEVICES 100
#define ZCLOUD_MAX_CHANNEL 16

typedef struct tagZCLOUD_CHNINFO {
    BYTE enable;  // 0:disable��1:enable
    BYTE type;    // 0:CAN��1:ISO CANFD��2:Non-ISO CANFD
    BYTE isUpload;
    BYTE isDownload;
} ZCLOUD_CHNINFO;

typedef struct tagZCLOUD_DEVINFO {
    int            devIndex;
    char           type[64];
    char           id[64];
    char           name[64];
    char           owner[64];
    char           model[64];
    char           fwVer[16];
    char           hwVer[16];
    char           serial[64];
    int            status;  // 0:online��1:offline
    BYTE           bGpsUpload;
    BYTE           channelCnt;
    ZCLOUD_CHNINFO channels[ZCLOUD_MAX_CHANNEL];
} ZCLOUD_DEVINFO;

typedef struct tagZCLOUD_USER_DATA {
    char           username[64];
    char           mobile[64];
    char           dllVer[16];  // cloud dll version
    size_t         devCnt;
    ZCLOUD_DEVINFO devices[ZCLOUD_MAX_DEVICES];
} ZCLOUD_USER_DATA;

// GPS
typedef struct tagZCLOUD_GPS_FRAME {
    float latitude;   // + north latitude��- south latitude
    float longitude;  // + east longitude��- west longitude
    float speed;      // km/h
    struct __gps_time {
        USHORT year;
        USHORT mon;
        USHORT day;
        USHORT hour;
        USHORT min;
        USHORT sec;
    } tm;
} ZCLOUD_GPS_FRAME;
// for zlg cloud

// TX timestamp
typedef struct tagUSBCANFDTxTimeStamp {
    UINT *pTxTimeStampBuffer;    // allocated by user, size:nBufferTimeStampCount *
                                 // 4,unit:100us
    UINT nBufferTimeStampCount;  // buffer size
} USBCANFDTxTimeStamp;

typedef struct tagTxTimeStamp {
    UINT64 *pTxTimeStampBuffer;  // allocated by user, size:nBufferTimeStampCount *
                                 // 8,unit:1us
    UINT nBufferTimeStampCount;  // buffer timestamp count
    int  nWaitTime;              // Wait Time ms, -1��ʾ�ȵ������ݲŷ���
} TxTimeStamp;

// Bus usage
typedef struct tagBusUsage {
    UINT64 nTimeStampBegin;  // ������ʼʱ�������λus
    UINT64 nTimeStampEnd;    // ��������ʱ�������λus
    BYTE   nChnl;            // ͨ��
    BYTE   nReserved;        // ����
    USHORT
    nBusUsage;         // ����������(%)������������*100չʾ��ȡֵ0~10000����8050��ʾ80.50%
    UINT nFrameCount;  // ֡����
} BusUsage;

enum eZCANErrorDEF {
    // ���ߴ�������
    ZCAN_ERR_TYPE_NO_ERR         = 0,  // �޴���
    ZCAN_ERR_TYPE_BUS_ERR        = 1,  // ���ߴ���
    ZCAN_ERR_TYPE_CONTROLLER_ERR = 2,  // ����������
    ZCAN_ERR_TYPE_DEVICE_ERR     = 3,  // �ն��豸����

    // �ڵ�״̬
    ZCAN_NODE_STATE_ACTIVE   = 1,  // ���߻���
    ZCAN_NODE_STATE_WARNNING = 2,  // ���߸澯
    ZCAN_NODE_STATE_PASSIVE  = 3,  // ��������
    ZCAN_NODE_STATE_BUSOFF   = 4,  // ���߹ر�

    // ���ߴ���������, errType = ZCAN_ERR_TYPE_BUS_ERR
    ZCAN_BUS_ERR_NO_ERR           = 0,  // �޴���
    ZCAN_BUS_ERR_BIT_ERR          = 1,  // λ����
    ZCAN_BUS_ERR_ACK_ERR          = 2,  // Ӧ����ￄ1�7?
    ZCAN_BUS_ERR_CRC_ERR          = 3,  // CRC����
    ZCAN_BUS_ERR_FORM_ERR         = 4,  // ��ʽ����
    ZCAN_BUS_ERR_STUFF_ERR        = 5,  // ������
    ZCAN_BUS_ERR_OVERLOAD_ERR     = 6,  // ���ش���
    ZCAN_BUS_ERR_ARBITRATION_LOST = 7,  // �ٲö�ʧ
    ZCAN_BUS_ERR_NODE_STATE_CHAGE = 8,  // ���߽ڵ�ￄ1�7?

    // ����������, errType = ZCAN_ERR_TYPE_CONTROLLER_ERR
    ZCAN_CONTROLLER_RX_FIFO_OVERFLOW          = 1,  // ����������FIFO��ￄ1�7?
    ZCAN_CONTROLLER_DRIVER_RX_BUFFER_OVERFLOW = 2,  // �������ջ�����ￄ1�7?
    ZCAN_CONTROLLER_DRIVER_TX_BUFFER_OVERFLOW = 3,  // �������ͻ�����ￄ1�7?
    ZCAN_CONTROLLER_INTERNAL_ERROR            = 4,  // �������ڲ�����

    // �ն��豸����, errType = ZCAN_ERR_TYPE_DEVICE_ERR
    ZCAN_DEVICE_APP_RX_BUFFER_OVERFLOW = 1,  // �ն�Ӧ�ý��ջ�����ￄ1�7?
    ZCAN_DEVICE_APP_TX_BUFFER_OVERFLOW = 2,  // �ն�Ӧ�÷��ͻ�����ￄ1�7?
    ZCAN_DEVICE_APP_AUTO_SEND_FAILED   = 3,  // ��ʱ����ʧ��
    ZCAN_CONTROLLER_TX_FRAME_INVALID   = 4,  // ���ͱ�����Ч
};

enum eZCANDataDEF {
    // ��������
    ZCAN_DT_ZCAN_CAN_CANFD_DATA = 1,  // CAN/CANFD����
    ZCAN_DT_ZCAN_ERROR_DATA     = 2,  // ��������
    ZCAN_DT_ZCAN_GPS_DATA       = 3,  // GPS����
    ZCAN_DT_ZCAN_LIN_DATA       = 4,  // LIN����
    ZCAN_DT_ZCAN_BUSUSAGE_DATA  = 5,  // BusUsage����
    ZCAN_DT_ZCAN_LIN_ERROR_DATA = 6,  // LIN��������
    ZCAN_DT_ZCAN_LIN_EX_DATA    = 7,  // LIN��չ����
    ZCAN_DT_ZCAN_LIN_EVENT_DATA = 8,  // LIN�¼�����

    // ������ʱ��λ
    ZCAN_TX_DELAY_NO_DELAY   = 0,  // �޷�����ʱ
    ZCAN_TX_DELAY_UNIT_MS    = 1,  // ������ʱ��λ����
    ZCAN_TX_DELAY_UNIT_100US = 2,  // ������ʱ��λ100΢��(0.1����)
};

#pragma pack(push, 1)

// CAN/CANFD����
typedef struct tagZCANCANFDData {
    UINT64
    timeStamp;  // ʱ��������ݽ���ʱ��λ�?��(us)��������ʱ����ʱ�����ݵ�λȡ����flag.unionVal.txDelay
    union {
        struct {
            UINT frameType : 2;     // ֡���ͣ�0:CAN֡��1:CANFD֡
            UINT txDelay   : 2;     // ���з�����ʱ��������Ч.
                                    // 0:�޷�����ʱ��1:������ʱ��λms��2:������ʱ��λ100us.
                                    // ���ö��з�����ʱ����ʱʱ������timeStamp�ֶ�
            UINT transmitType : 4;  // �������ͣ�������Ч.
                                    // 0:�������ͣ�1:���η��ͣ�2:�Է����գ�3:�����Է�����.
                                    // �����豸֧���������ͣ�����������ο�����ʹ���ֲￄ1�7?
            UINT
                txEchoRequest : 1;  // ���ͻ������󣬷�����Ч.
                                    // ֧�ַ��ͻ��Ե��豸����������ʱ����λ��1���豸����ͨ�����սӿڽ����ͳ�ȥ������֡���أ����յ��ķ�������ʹ��txEchoedλ��ￄ1�7?
            UINT txEchoed : 1;      // �����Ƿ��ǻ��Ա��ģ�������Ч.
                                    // 0:�������߽��ձ��ģ�1:���豸���ͻ��Ա���.
            UINT reserved : 22;     // ����
        } unionVal;
        UINT rawVal;           // ֡��־λraw����
    } flag;                    // CAN/CANFD֡��־λ
    BYTE        extraData[4];  // ��������,��δʹ��
    canfd_frame frame;         // CAN/CANFD֡ID+����
} ZCANCANFDData;

// ��������
typedef struct tagZCANErrorData {
    UINT64 timeStamp;   // ʱ�������λ�?��(us)
    BYTE   errType;     // �������ͣ��ο�eZCANErrorDEF�� ���ߴ������� ����ֵ����
    BYTE   errSubType;  // ���������ͣ��ο�eZCANErrorDEF�� ���ߴ��������� ����ֵ����
    BYTE   nodeState;   // �ڵ�״̬���ο�eZCANErrorDEF�� �ڵ�״̬ ����ֵ����
    BYTE   rxErrCount;  // ���մ�����ￄ1�7?
    BYTE   txErrCount;  // ���ʹ�����ￄ1�7?
    BYTE   errData;     // �������ݣ��͵�ǰ���������Լ����������Ͷ���ľ��������ￄ1�7?,
                        // ������ο�ʹ���ֲￄ1�7?
    BYTE reserved[2];   // ����
} ZCANErrorData;

// GPS����
typedef struct tagZCANGPSData {
    struct {
        USHORT year;    // ��
        USHORT mon;     // ��
        USHORT day;     // ��
        USHORT hour;    // ʱ
        USHORT min;     // ��
        USHORT sec;     // ��
        USHORT milsec;  // ����
    } time;             // UTCʱ��
    union {
        struct {
            USHORT timeValid        : 1;   // ʱ�������Ƿ���Ч
            USHORT latlongValid     : 1;   // ��γ�������Ƿ���Ч
            USHORT altitudeValid    : 1;   // ���������Ƿ���Ч
            USHORT speedValid       : 1;   // �ٶ������Ƿ���Ч
            USHORT courseAngleValid : 1;   // ����������Ƿ����?
            USHORT reserved         : 13;  // ����
        } unionVal;
        USHORT rawVal;
    } flag;              // ��־��Ϣ
    double latitude;     // γ�� ������ʾ��γ��������ʾ��γ
    double longitude;    // ���� ������ʾ������������ʾ����
    double altitude;     // ���� ��λ: ��
    double speed;        // �ٶ� ��λ: km/h
    double courseAngle;  // ����ￄ1�7?
} ZCANGPSData;

// LIN����
typedef struct tagZCANLINData {
    union {
        struct {
            BYTE ID     : 6;  // ֡ID
            BYTE Parity : 2;  // ֡IDУ��
        } unionVal;
        BYTE rawVal;  // �ܱ�����IDԭʼֵ
    } PID;            // �ܱ�����ID
    struct {
        UINT64 timeStamp;     // ʱ�������λ�?��(us)
        BYTE   dataLen;       // ���ݳ���
        BYTE   dir;           // ���䷽��0-���� 1-����
        BYTE   chkSum;        // ����У�飬�����豸��֧��У�����ݵĻ�ȡ
        BYTE   reserved[13];  // ����
        BYTE   data[8];       // ����
    } RxData;                 // ����������ʱ��Ч
    BYTE reserved[7];         // ����
} ZCANLINData;

// ��������
typedef struct tagZCANLINErrData {
    UINT64 timeStamp;  // ʱ�������λ�?��(us)
    union {
        struct {
            BYTE ID     : 6;  // ֡ID
            BYTE Parity : 2;  // ֡IDУ��
        } unionVal;
        BYTE rawVal;  // �ܱ�����IDԭʼֵ
    } PID;            // �ܱ�����ID
    BYTE dataLen;
    BYTE data[8];
    union {
        struct {
            USHORT errStage  : 4;  // ����׶ￄ1�7?
            USHORT errReason : 4;  // ����ԭ��
            USHORT reserved  : 8;  // ����
        };
        USHORT unionErrData;
    } errData;
    BYTE dir;           // ���䷽��
    BYTE chkSum;        // ����У�飬�����豸��֧��У�����ݵĻ�ȡ
    BYTE reserved[10];  // ����
} ZCANLINErrData;

typedef BYTE ZCAN_LIN_EVENT_TYPE;
#define ZCAN_LIN_WAKE_UP            1
#define ZCAN_LIN_ENTERED_SLEEP_MODE 2
#define ZCAN_LIN_EXITED_SLEEP_MODE  3

typedef struct tagZCANLINEventData {
    UINT64              timeStamp;  // ʱ�������λ�?��(us)
    ZCAN_LIN_EVENT_TYPE type;
    BYTE                reserved[7];
} ZCANLINEventData;

// LIN��չ����
typedef struct tagZCANLINExData {
    union {
        struct {
            BYTE ID     : 6;  // ֡ID
            BYTE Parity : 2;  // ֡IDУ��
        } unionVal;
        BYTE rawVal;   // �ܱ�����IDԭʼֵ
    } PID;             // �ܱ�����ID
    BYTE reserved[7];  // ����
    struct {
        UINT64 timeStamp;    // ʱ�������λ�?��(us)
        BYTE   dataLen;      // ���ݳ���
        BYTE   dir;          // ���䷽��0-���� 1-����
        BYTE   chkSum;       // ����У�飬�����豸��֧��У�����ݵĻ�ȡ
        BYTE   reserved[5];  // ����
        BYTE   data[64];     // ����
    } RxData;                // ����������ʱ��Ч
} ZCANLINExData;

// �ϲ������������ݽṹ��֧��CAN/CANFD/LIN/GPS/����Ȳ��?��������
typedef struct tagZCANDataObj {
    BYTE dataType;  // �������ͣ��ο�eZCANDataDEF�� �������� ���ֶ���
    BYTE chnl;      // ����ͨ��
    union {
        struct {
            USHORT reserved : 16;  // ����
        } unionVal;
        USHORT rawVal;
    } flag;             // ��־��Ϣ����δʹ��
    BYTE extraData[4];  // �������ݣ���δʹ��
    union {
        ZCANCANFDData    zcanCANFDData;     // CAN/CANFD����
        ZCANErrorData    zcanErrData;       // ��������
        ZCANGPSData      zcanGPSData;       // GPS����
        ZCANLINData      zcanLINData;       // LIN����
        ZCANLINErrData   zcanLINErrData;    // LIN��������
        ZCANLINExData    zcanLINExData;     // LIN��չ����
        ZCANLINEventData zcanLINEventData;  // LIN�¼�����
        BusUsage         busUsage;          // BusUsage����
        BYTE             raw[92];           // RAW����
    } data;                                 // ʵ�����ݣ������壬��Ч��Ա���� dataType �ֶζ���
} ZCANDataObj;

// LIN
typedef struct _VCI_LIN_MSG {
    BYTE chnl;      // ����ͨ��
    BYTE dataType;  // �������ͣ�0-LIN���� 1-LIN�������� 2-LIN�¼�����
    union {
        ZCANLINData      zcanLINData;       // LIN����
        ZCANLINErrData   zcanLINErrData;    // LIN��������
        ZCANLINEventData zcanLINEventData;  // LIN�¼�����
        BYTE             raw[46];           // RAW����
    } data;                                 // ʵ�����ݣ������壬��Ч��Ա���� dataType �ֶζ���
} ZCAN_LIN_MSG, *PZCAN_LIN_MSG;

enum eZLINChkSumMode {
    DEFAULT = 0,     // Ĭ�ϣ�����ʱ����
    CLASSIC_CHKSUM,  // ����У��
    ENHANCE_CHKSUM,  // ��ǿУ��
    AUTOMATIC,       // �Զ����豸�Զ�ʶ��У�鷽ʽ����ZCAN_SetLINSubscribeʱ��Ч��
};

typedef struct _VCI_LIN_INIT_CONFIG {
    BYTE linMode;     // �Ƿ���Ϊ������0-�ӻ���1-����
    BYTE chkSumMode;  // У�鷽ʽ��1-����У�� 2-��ǿУ�� 3-�Զ�(��ӦeZLINChkSumMode��ģʽ)
    BYTE maxLength;   // ������ݳ��ȣￄ1�7?8~64
    BYTE reserved;    // ����
    UINT linBaud;     // �����ʣ�ȡֵ1000~20000
} ZCAN_LIN_INIT_CONFIG, *PZCAN_LIN_INIT_CONFIG;

typedef struct _VCI_LIN_PUBLISH_CFG {
    BYTE ID;       // �ܱ�����ID��IDȡֵ��ΧΪ0-63��
    BYTE dataLen;  // dataLen��ΧΪ1-8
    BYTE data[8];
    BYTE chkSumMode;   // У�鷽ʽ��0-Ĭ�ϣ�����ʱ���� 1-����У��
                       // 2-��ǿУ��(��ӦeZLINChkSumMode��ģʽ)
    BYTE reserved[5];  // ����
} ZCAN_LIN_PUBLISH_CFG, *PZCAN_LIN_PUBLISH_CFG;

typedef struct _VCI_LIN_PUBLISH_CFG_EX {
    BYTE ID;       // �ܱ�����ID��IDȡֵ��ΧΪ0-63��
    BYTE dataLen;  // dataLen��ΧΪ1-64
    BYTE data[64];
    BYTE chkSumMode;   // У�鷽ʽ��0-Ĭ�ϣ�����ʱ���� 1-����У��
                       // 2-��ǿУ��(��ӦeZLINChkSumMode��ģʽ)
    BYTE reserved[5];  // ����
} ZCAN_LIN_PUBLISH_CFG_EX, *PZCAN_LIN_PUBLISH_CFG_EX;

typedef struct _VCI_LIN_SUBSCIBE_CFG {
    BYTE ID;           // �ܱ�����ID��IDȡֵ��ΧΪ0-63��
    BYTE dataLen;      // dataLen��ΧΪ1-8 ��Ϊ255��0xff�����ʾ�豸�Զ�ʶ���ĳ��ￄ1�7?
    BYTE chkSumMode;   // У�鷽ʽ��0-Ĭ�ϣ�����ʱ���� 1-����У�� 2-��ǿУ��
                       // 3-�Զ�(��ӦeZLINChkSumMode��ģʽ)
    BYTE reserved[5];  // ����
} ZCAN_LIN_SUBSCIBE_CFG, *PZCAN_LIN_SUBSCIBE_CFG;

// end LIN

// UDS����Э��ￄ1�7?
typedef BYTE ZCAN_UDS_TRANS_VER;
#define ZCAN_UDS_TRANS_VER_0 0  // ISO15765-2(2004�汾)
#define ZCAN_UDS_TRANS_VER_1 1  // ISO15765-2(2016�汾)

// ֡����
typedef BYTE ZCAN_UDS_FRAME_TYPE;
#define ZCAN_UDS_FRAME_CAN       0  // CAN֡
#define ZCAN_UDS_FRAME_CANFD     1  // CANFD֡
#define ZCAN_UDS_FRAME_CANFD_BRS 2  // CANFD����֡

// ���ݳ������ģ�?
typedef BYTE ZCAN_UDS_FILL_MODE;
#define ZCAN_UDS_FILL_MODE_SHORT 0  // С��8�ֽ�����ￄ1�7?8�ֽڣ�����8�ֽ�ʱ��DLC�ͽ���ￄ1�7?
#define ZCAN_UDS_FILL_MODE_NONE  1  // ����ￄ1�7?
#define ZCAN_UDS_FILL_MODE_MAX   2  // �����������ݳ���(������)

// CAN UDS��������
typedef struct _ZCAN_UDS_REQUEST {
    UINT                req_id;             // ��������ID����Χ0~65535�����������Ψһ���?
    BYTE                channel;            // �豸ͨ������ 0~255
    ZCAN_UDS_FRAME_TYPE frame_type;         // ֡����
    BYTE                reserved0[2];       // ����
    UINT                src_addr;           // ������?
    UINT                dst_addr;           // ��Ӧ��ַ
    BYTE                suppress_response;  // 1:������Ӧ
    BYTE                sid;                // �������id
    BYTE                reserved1[6];       // ����
    struct {
        UINT timeout;           // ��Ӧ��ʱʱ��(ms)����PC��ʱ����ￄ1�7?�������ò�С��200ms
        UINT enhanced_timeout;  // �յ�������Ӧ������Ϊ0x78��ĳ�ʱʱ�ￄ1�7?(ms)����PC��ʱ����ￄ1�7?�������ò�С��200ms
        BYTE check_any_negative_response : 1;  // ���յ��Ǳ�����������������Ӧʱ�Ƿ���Ҫ�ж�Ϊ��Ӧ����
        BYTE wait_if_suppress_response   : 1;  // ������Ӧʱ�Ƿ���Ҫ�ȴ�������Ӧ���ȴ�ʱ��Ϊ��Ӧ��ʱʱ��
        BYTE flag                        : 6;  // ����
        BYTE reserved0[7];                     // ����
    } session_param;                           // �Ự����ￄ1�7?
    struct {
        ZCAN_UDS_TRANS_VER version;       // ����Э��汾��VERSION_0��VERSION_1
        BYTE               max_data_len;  // ��֡������ݳ��ȣ�can:8��canfd:64
        BYTE local_st_min;  // ������������ʱ�ã�����֮֡�����С�����0x00-0x7F(0ms~127ms)��0xF1-0xF9(100us~900us)
        BYTE block_size;    // ����֡�Ŀ���?
        BYTE fill_byte;     // ��Ч�ֽڵ�������ￄ1�7?
        BYTE ext_frame;     // 0:��׼֡ 1:��չ֡
        BYTE is_modify_ecu_st_min;        // �Ƿ����ECU�������ص�STmin��ǿ��ʹ�ñ��������õ�
                                          // remote_st_min
        BYTE remote_st_min;               // ���Ͷ�֡ʱ�ã�is_ignore_ecu_st_min = 1
                                          // ʱ��Ч��0x00-0x7F(0ms~127ms)��0xF1-0xF9(100us~900us)
        UINT               fc_timeout;    // �������س�ʱʱ��(ms)���緢����֡����Ҫ�ȴ���Ӧ����֡
        ZCAN_UDS_FILL_MODE fill_mode;     // ���ݳ������ģ�?
        BYTE               reserved0[3];  // ����
    } trans_param;                        // ��������
    BYTE *data;                           // ��������(������SID)
    UINT  data_len;                       // ��������ĳ��ￄ1�7?
    UINT  reserved2;                      // ����
} ZCAN_UDS_REQUEST;

// LIN UDS��������
typedef struct _ZLIN_UDS_REQUEST {
    UINT req_id;             // ��������ID����Χ0~65535�����������Ψһ���?
    BYTE channel;            // �豸ͨ������ 0~255
    BYTE suppress_response;  // 1:������Ӧ 0:������
    BYTE sid;                // �������id
    BYTE Nad;                // �ڵ���?
    BYTE reserved1[8];       // ����
    struct {
        UINT p2_timeout;        // ��Ӧ��ʱʱ��(ms)����PC��ʱ����ￄ1�7?�������ò�С��200ms
        UINT enhanced_timeout;  // �յ�������Ӧ������Ϊ0x78��ĳ�ʱʱ�ￄ1�7?(ms)����PC��ʱ����ￄ1�7?�������ò�С��200ms
        BYTE check_any_negative_response : 1;  // ���յ��Ǳ�����������������Ӧʱ�Ƿ���Ҫ�ж�Ϊ��Ӧ����
        BYTE wait_if_suppress_response   : 1;  // ������Ӧʱ�Ƿ���Ҫ�ȴ�������Ӧ���ȴ�ʱ��Ϊ��Ӧ��ʱʱ��
        BYTE flag                        : 6;  // ����
        BYTE reserved0[7];                     // ����
    } session_param;                           // �Ự����ￄ1�7?
    struct {
        BYTE fill_byte;     // ��Ч�ֽڵ�������ￄ1�7?
        BYTE st_min;        // �ӽڵ�׼����������������һ֡���������Ӧ����һ֡�������Сʱ��
        BYTE reserved0[6];  // ����
    } trans_param;          // ��������
    BYTE *data;             // ��������(������SID)
    UINT  data_len;         // ��������ĳ��ￄ1�7?
    UINT  reserved2;        // ����
} ZLIN_UDS_REQUEST;

typedef BYTE ZCAN_DOIP_ROUTING_ACT_TYPE;
#define ZCAN_DOIP_ACTIVATION_DEFAULT          0x00
#define ZCAN_DOIP_ACTIVATION_WWH_OBD          0x01
#define ZCAN_DOIP_ACTIVATION_CENTRAL_SECURITY 0xE0

typedef BYTE ZCAN_DOIP_VERSION;
#define ZCAN_DOIP_ISO_13400_2_2010      0x01
#define ZCAN_DOIP_ISO_13400_2_2012      0x02
#define ZCAN_DOIP_ISO_13400_2_2019      0x03
#define ZCAN_DOIP_AUTO_DETECTED_VERSION 0xFF

// DoIP ��������
typedef struct _ZDOIP_REQUEST {
    UINT req_id;        // ��������ID����Χ0~65535�����������Ψһ���?
    BYTE reserved0[4];  // ����

    ZCAN_DOIP_VERSION          doipVersion;        // DoIPЭ��ￄ1�7?
    ZCAN_DOIP_ROUTING_ACT_TYPE rcType;             // ·�ɼ�������
    BYTE                       sourceAddress[2];   // Դ�߼���ַ
    char                       serverAddress[32];  // DoIPʵ���IP��ַ
    USHORT                     connectTimeoutMs;   // ���ӳ�ʱ
    USHORT                     routingTimeoutMs;   // ·�ɼ��ʱ

    BYTE  targetAddress[2];  // Ŀ���߼���ַ
    BYTE  sid;               // �����SID
    BYTE  suppressPosResp;   // �Ƿ����ƻ�����Ӧ
    BYTE  waitForNegResp;    // �Ƿ�ȴ�������Ӧ��suppressPosRespΪ��ʱ��Ч
    BYTE  reserved1[3];      // ����
    UINT  requestTimeoutMs;  // UDS����ʱ
    UINT  dataLength;        // ������ݳ��ￄ1�7?
    BYTE *data;              // ������ￄ1�7?
} ZDOIP_REQUEST;

// UDS������
typedef BYTE ZCAN_UDS_ERROR;
#define ZCAN_UDS_ERROR_OK                                            0x00  // û����
#define ZCAN_UDS_ERROR_TIMEOUT                                       0x01  // ��Ӧ��ʱ
#define ZCAN_UDS_ERROR_TRANSPORT                                     0x02  // ��������ʧ��
#define ZCAN_UDS_ERROR_CANCEL                                        0x03  // ȡ������
#define ZCAN_UDS_ERROR_SUPPRESS_RESPONSE                             0x04  // ������Ӧ
#define ZCAN_UDS_ERROR_BUSY                                          0x05  // æµ��
#define ZCAN_UDS_ERROR_REQ_PARAM                                     0x06  // ����������ￄ1�7?
#define ZCAN_UDS_ERROR_OTHTER                                        0x64  // ����δ֪����
#define ZCAN_UDS_ERROR_DOIP_FAILED_TO_CREATE_SOCKET                  0x20  // ����socketʧ��
#define ZCAN_UDS_ERROR_DOIP_FAILED_TO_CONNECT                        0x21  // ��������ʧ��
#define ZCAN_UDS_ERROR_DOIP_TIMEOUT                                  0x22  // ������ʱ
#define ZCAN_UDS_ERROR_DOIP_ROUTING_NOT_ACTIVE                       0x23  // ·��δ����
#define ZCAN_UDS_ERROR_DOIP_BUFFER_TOO_SMALL                         0x24  // ����������
#define ZCAN_UDS_ERROR_DOIP_ROUTING_ALREADY_ACTIVE                   0x25  // ·���ѱ�����
#define ZCAN_UDS_ERROR_DOIP_HEADER_NACK_INCORRECT_PATTERN_FORMAT     0x26  // �յ�DoIPͷ��NACK
#define ZCAN_UDS_ERROR_DOIP_HEADER_NACK_UNKNOWN_PAYLOAD_TYPE         0x27  // �յ�DoIPͷ��NACK
#define ZCAN_UDS_ERROR_DOIP_HEADER_NACK_MESSAGE_TOO_LARGE            0x28  // �յ�DoIPͷ��NACK
#define ZCAN_UDS_ERROR_DOIP_HEADER_NACK_OUT_OF_MEMORY                0x29  // �յ�DoIPͷ��NACK
#define ZCAN_UDS_ERROR_DOIP_HEADER_NACK_INVALID_PAYLOAD_LENGTH       0x2A  // �յ�DoIPͷ��NACK
#define ZCAN_UDS_ERROR_DOIP_HEADER_NACK_UNKNOWN                      0x2B  // �յ�DoIPͷ��NACK
#define ZCAN_UDS_ERROR_DOIP_DIAGNOSTIC_NACK_INVALID_SOURCE_ADDRESS   0x2C  // �յ��������NACK
#define ZCAN_UDS_ERROR_DOIP_DIAGNOSTIC_NACK_UNKNOWN_TARGET_ADDRESS   0x2D  // �յ��������NACK
#define ZCAN_UDS_ERROR_DOIP_DIAGNOSTIC_NACK_MESSAGE_TOO_LARGE        0x2E  // �յ��������NACK
#define ZCAN_UDS_ERROR_DOIP_DIAGNOSTIC_NACK_OUT_OF_MEMORY            0x2F  // �յ��������NACK
#define ZCAN_UDS_ERROR_DOIP_DIAGNOSTIC_NACK_TARGET_UNREACHABLE       0x30  // �յ��������NACK
#define ZCAN_UDS_ERROR_DOIP_DIAGNOSTIC_NACK_UNKNOWN_NETWORK          0x31  // �յ��������NACK
#define ZCAN_UDS_ERROR_DOIP_DIAGNOSTIC_NACK_TRANSPORT_PROTOCOL_ERROR 0x32  // �յ��������NACK
#define ZCAN_UDS_ERROR_DOIP_DIAGNOSTIC_NACK_UNKNOWN                  0x33  // �յ��������NACK
#define ZCAN_UDS_ERROR_DOIP_INVALID_HANDLE                           0x34  // ��Ч�ľ�ￄ1�7?
#define ZCAN_UDS_ERROR_DOIP_UNEXPECTED_NULL_POINTER                  0x35  // δԤ�ڵĿ�ָ��
#define ZCAN_UDS_ERROR_DOIP_UNKNOWN_HANDLE                           0x36  // δ֪�ľ�ￄ1�7?
#define ZCAN_UDS_ERROR_DOIP_OUT_OF_MEMORY                            0x37  // �ڴ治��
#define ZCAN_UDS_ERROR_DOIP_UNKNOWN_ERROR                            0x38  // δ֪�Ĵ���
#define ZCAN_UDS_ERROR_DOIP_ROUTING_ACTIVE_FAIL                      0x39  // ·�ɼ���ʧ��

typedef BYTE ZCAN_UDS_RESPONSE_TYPE;
#define ZCAN_UDS_RT_NEGATIVE 0  // ������Ӧ
#define ZCAN_UDS_RT_POSITIVE 1  // ������Ӧ
#define ZCAN_UDS_RT_NONE     2  // ����Ӧ

// UDS��Ӧ����
typedef struct _ZCAN_UDS_RESPONSE {
    ZCAN_UDS_ERROR         status;       // ��Ӧ״̬
    BYTE                   reserved[6];  // ����
    ZCAN_UDS_RESPONSE_TYPE type;         // ��Ӧ����
    union {
        struct {
            BYTE sid;       // ��Ӧ����id
            UINT data_len;  // ���ݳ���(������SID), ���ݴ���ڽӿڴ����dataBuf��
        } positive;
        struct {
            BYTE neg_code;    // �̶�Ϊ0x7F
            BYTE sid;         // �������id
            BYTE error_code;  // ������
        } negative;
        BYTE raw[8];
    };
} ZCAN_UDS_RESPONSE;

// UDS��������
typedef UINT ZCAN_UDS_CTRL_CODE;
#define ZCAN_UDS_CTRL_STOP_REQ 0  // ֹͣUDS����

// UDS��������
typedef struct _ZCAN_UDS_CTRL_REQ {
    UINT               reqID;        // ��������ID��ָ��Ҫ������һ������
    ZCAN_UDS_CTRL_CODE cmd;          // ��������
    BYTE               reserved[8];  // ����
} ZCAN_UDS_CTRL_REQ;

// UDS���ƽ�ￄ1�7?
typedef UINT ZCAN_UDS_CTRL_RESULT;
#define ZCAN_UDS_CTRL_RESULT_OK  0  // �ɹ�
#define ZCAN_UDS_CTRL_RESULT_ERR 1  // ʧ��

// UDS������Ӧ����
typedef struct _ZCAN_UDS_CTRL_RESP {
    ZCAN_UDS_CTRL_RESULT result;        // ������ￄ1�7?
    BYTE                 reserved[12];  // ����
} ZCAN_UDS_CTRL_RESP;

// CAN/CANFD UDS����
typedef struct tagZCANCANFDUdsData {
    const ZCAN_UDS_REQUEST *req;  // ������Ϣ
    BYTE                    reserved[24];
} ZCANCANFDUdsData;

// LIN UDS����
typedef struct tagZCANLINUdsData {
    const ZLIN_UDS_REQUEST *req;  // ������Ϣ
    BYTE                    reserved[24];
} ZCANLINUdsData;

// DoIP UDS����
typedef struct tagZDoIPUdsData {
    const ZDOIP_REQUEST *req;  // ������Ϣ
    BYTE                 reserved[24];
} ZDoIPUdsData;

// UDS���ݽṹ��֧��CAN/LIN��UDS��ͬ��������
typedef struct tagZCANUdsRequestDataObj {
    ZCAN_UDS_DATA_DEF dataType;  // ��������
    union {
        ZCANCANFDUdsData zcanCANFDUdsData;  // CAN/CANFD UDS����
        ZCANLINUdsData   zcanLINUdsData;    // LIN UDS����
        ZDoIPUdsData     zcanDoIPUdsData;   // DoIP UDS����
        BYTE             raw[63];           // RAW����
    } data;                                 // ʵ�����ݣ������壬��Ч��Ա���� dataType �ֶζ���
    BYTE reserved[32];                      // ����λ
} ZCANUdsRequestDataObj;

#pragma pack(pop)

#ifdef __cplusplus
#define DEF(a) = a
#else
#define DEF(a)
#endif

#ifdef WIN32
#define FUNC_CALL __stdcall
#else
#define FUNC_CALL  // __attribute__((stdcall))
#endif

#ifdef __cplusplus
extern "C" {
#endif

#define INVALID_DEVICE_HANDLE 0
DEVICE_HANDLE FUNC_CALL ZCAN_OpenDevice(UINT device_type, UINT device_index, UINT reserved);
UINT FUNC_CALL          ZCAN_CloseDevice(DEVICE_HANDLE device_handle);
UINT FUNC_CALL          ZCAN_GetDeviceInf(DEVICE_HANDLE device_handle, ZCAN_DEVICE_INFO *pInfo);

UINT FUNC_CALL ZCAN_IsDeviceOnLine(DEVICE_HANDLE device_handle);

#define INVALID_CHANNEL_HANDLE 0
CHANNEL_HANDLE FUNC_CALL ZCAN_InitCAN(DEVICE_HANDLE device_handle, UINT can_index,
                                      ZCAN_CHANNEL_INIT_CONFIG *pInitConfig);
UINT FUNC_CALL           ZCAN_StartCAN(CHANNEL_HANDLE channel_handle);
UINT FUNC_CALL           ZCAN_ResetCAN(CHANNEL_HANDLE channel_handle);
UINT FUNC_CALL           ZCAN_ClearBuffer(CHANNEL_HANDLE channel_handle);
UINT FUNC_CALL           ZCAN_ReadChannelErrInfo(CHANNEL_HANDLE channel_handle, ZCAN_CHANNEL_ERR_INFO *pErrInfo);
UINT FUNC_CALL           ZCAN_ReadChannelStatus(CHANNEL_HANDLE channel_handle, ZCAN_CHANNEL_STATUS *pCANStatus);
UINT FUNC_CALL           ZCAN_GetReceiveNum(CHANNEL_HANDLE channel_handle,
                                            BYTE           type);  // type:TYPE_CAN, TYPE_CANFD, TYPE_ALL_DATA
UINT FUNC_CALL           ZCAN_Transmit(CHANNEL_HANDLE channel_handle, ZCAN_Transmit_Data *pTransmit, UINT len);
UINT FUNC_CALL           ZCAN_Receive(CHANNEL_HANDLE channel_handle, ZCAN_Receive_Data *pReceive, UINT len,
                                      int wait_time DEF(-1));
UINT FUNC_CALL           ZCAN_TransmitFD(CHANNEL_HANDLE channel_handle, ZCAN_TransmitFD_Data *pTransmit, UINT len);
UINT FUNC_CALL           ZCAN_ReceiveFD(CHANNEL_HANDLE channel_handle, ZCAN_ReceiveFD_Data *pReceive, UINT len,
                                        int wait_time DEF(-1));

UINT FUNC_CALL ZCAN_TransmitData(DEVICE_HANDLE device_handle, ZCANDataObj *pTransmit, UINT len);
UINT FUNC_CALL ZCAN_ReceiveData(DEVICE_HANDLE device_handle, ZCANDataObj *pReceive, UINT len, int wait_time DEF(-1));
UINT FUNC_CALL ZCAN_SetValue(DEVICE_HANDLE device_handle, const char *path, const char *value);
const void *FUNC_CALL ZCAN_GetValue(DEVICE_HANDLE device_handle, const char *path);

IProperty *FUNC_CALL GetIProperty(DEVICE_HANDLE device_handle);
UINT FUNC_CALL       ReleaseIProperty(IProperty *pIProperty);

void FUNC_CALL ZCLOUD_SetServerInfo(const char *httpSvr, unsigned short httpPort, const char *authSvr,
                                    unsigned short authPort);
// return 0:success, 1:failure, 2:https error, 3:user login info error, 4:mqtt
// connection error, 5:no device
UINT FUNC_CALL ZCLOUD_ConnectServer(const char *username, const char *password);
// return 0:not connected, 1:connected
UINT FUNC_CALL ZCLOUD_IsConnected();
// return 0:success, 1:failure
UINT FUNC_CALL                    ZCLOUD_DisconnectServer();
const ZCLOUD_USER_DATA *FUNC_CALL ZCLOUD_GetUserData(int update DEF(0));
UINT FUNC_CALL                    ZCLOUD_ReceiveGPS(DEVICE_HANDLE device_handle, ZCLOUD_GPS_FRAME *pReceive, UINT len,
                                                    int wait_time DEF(-1));

CHANNEL_HANDLE FUNC_CALL ZCAN_InitLIN(DEVICE_HANDLE device_handle, UINT lin_index,
                                      PZCAN_LIN_INIT_CONFIG pLINInitConfig);
UINT FUNC_CALL           ZCAN_StartLIN(CHANNEL_HANDLE channel_handle);
UINT FUNC_CALL           ZCAN_ResetLIN(CHANNEL_HANDLE channel_handle);
UINT FUNC_CALL           ZCAN_TransmitLIN(CHANNEL_HANDLE channel_handle, PZCAN_LIN_MSG pSend, UINT Len);
UINT FUNC_CALL           ZCAN_GetLINReceiveNum(CHANNEL_HANDLE channel_handle);
UINT FUNC_CALL           ZCAN_ReceiveLIN(CHANNEL_HANDLE channel_handle, PZCAN_LIN_MSG pReceive, UINT Len, int WaitTime);

UINT FUNC_CALL ZCAN_SetLINSubscribe(CHANNEL_HANDLE channel_handle, PZCAN_LIN_SUBSCIBE_CFG pSend, UINT nSubscribeCount);
UINT FUNC_CALL ZCAN_SetLINPublish(CHANNEL_HANDLE channel_handle, PZCAN_LIN_PUBLISH_CFG pSend, UINT nPublishCount);
UINT FUNC_CALL ZCAN_SetLINPublishEx(CHANNEL_HANDLE channel_handle, PZCAN_LIN_PUBLISH_CFG_EX pSend, UINT nPublishCount);

UINT FUNC_CALL ZCAN_WakeUpLIN(CHANNEL_HANDLE channel_handle);

/**
 * @brief UDS������ￄ1�7? (DoCAN)
 * @param[in] device_handle �豸��ￄ1�7?
 * @param[in] req ������Ϣ
 * @param[out] resp ��Ӧ��Ϣ����Ϊnullptr����ʾ��������Ӧ����
 * @param[out] dataBuf
 * ��Ӧ���ݻ���������Ż�����Ӧ���������(������SID)��ʵ�ʳ���Ϊresp.positive.data_len
 * @param[in] dataBufSize ��Ӧ���ݻ������ܴ�С�����С����Ӧ������ݳ��ȣ�����
 * STATUS_BUFFER_TOO_SMALL
 * @return ִ�н��״�?
 */
ZCAN_RET_STATUS FUNC_CALL ZCAN_UDS_Request(DEVICE_HANDLE device_handle, const ZCAN_UDS_REQUEST *req,
                                           ZCAN_UDS_RESPONSE *resp, BYTE *dataBuf, UINT dataBufSize);

/**
 * @brief UDS��Ͽ��ￄ1�7?, ��ֹͣ����ִ�е�UDS���� (DoCAN)
 * @param[in] device_handle �豸��ￄ1�7?
 * @param[in] ctrl ����������Ϣ
 * @param[out] resp ��Ӧ��Ϣ����Ϊnullptr����ʾ��������Ӧ����
 * @return ִ�н��״�?
 */
ZCAN_RET_STATUS FUNC_CALL ZCAN_UDS_Control(DEVICE_HANDLE device_handle, const ZCAN_UDS_CTRL_REQ *ctrl,
                                           ZCAN_UDS_CTRL_RESP *resp);

/**
 * @brief UDS������ￄ1�7?(��)
 * @param[in] device_handle �豸��ￄ1�7?
 * @param[in] requestData ������Ϣ
 * @param[out] resp ��Ӧ��Ϣ����Ϊnullptr����ʾ��������Ӧ����
 * @param[out] dataBuf
 * ��Ӧ���ݻ���������Ż�����Ӧ���������(������SID)��ʵ�ʳ���Ϊresp.positive.data_len
 * @param[in] dataBufSize ��Ӧ���ݻ������ܴ�С�����С����Ӧ������ݳ��ȣ�����
 * STATUS_BUFFER_TOO_SMALL
 */
ZCAN_RET_STATUS FUNC_CALL ZCAN_UDS_RequestEX(DEVICE_HANDLE device_handle, const ZCANUdsRequestDataObj *requestData,
                                             ZCAN_UDS_RESPONSE *resp, BYTE *dataBuf, UINT dataBufSize);

/**
 * @brief UDS��Ͽ��ƣ���ֹͣ����ִ�е�UDS����(��)
 * @param[in] device_handle �豸��ￄ1�7?
 * @param[in] dataType ��������
 * @param[in] ctrl ����������Ϣ
 * @param[out] resp ��Ӧ��Ϣ����Ϊnullptr����ʾ��������Ӧ����
 * @return ִ�н��״�?
 */
ZCAN_RET_STATUS FUNC_CALL ZCAN_UDS_ControlEX(DEVICE_HANDLE device_handle, ZCAN_UDS_DATA_DEF dataType,
                                             const ZCAN_UDS_CTRL_REQ *ctrl, ZCAN_UDS_CTRL_RESP *resp);

/*������*/
UINT FUNC_CALL ZCAN_SetLINSlaveMsg(CHANNEL_HANDLE channel_handle, PZCAN_LIN_MSG pSend, UINT nMsgCount);
UINT FUNC_CALL ZCAN_ClearLINSlaveMsg(CHANNEL_HANDLE channel_handle, BYTE *pLINID, UINT nIDCount);

#ifdef __cplusplus
}
#endif

#endif  // ZLGCAN_H_


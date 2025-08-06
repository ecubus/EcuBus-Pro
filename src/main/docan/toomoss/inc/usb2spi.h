/**
  ******************************************************************************
  * @file    usb2spi.h
  * $Author: wdluo $
  * $Revision: 447 $
  * $Date:: 2013-06-29 18:24:57 +0800 #$
  * @brief   usb2spi相关函数和数据类型定义.
  ******************************************************************************
  * @attention
  *
  *<center><a href="http:\\www.toomoss.com">http://www.toomoss.com</a></center>
  *<center>All Rights Reserved</center></h3>
  * 
  ******************************************************************************
  */
#ifndef __USB2SPI_H_
#define __USB2SPI_H_

#include <stdint.h>
#ifndef OS_UNIX
#include <Windows.h>
#else
#include <unistd.h>
#ifndef WINAPI
#define WINAPI
#endif
#endif
//定义SPI通道
#define SPI1        (0x00)
#define SPI1_CS0    (0x00)
#define SPI1_CS1    (0x10)
#define SPI1_CS2    (0x20)
#define SPI1_CS3    (0x30)
#define SPI1_CS4    (0x40)

#define SPI2        (0x01)
#define SPI2_CS0    (0x01)
#define SPI2_CS1    (0x11)
#define SPI2_CS2    (0x21)
#define SPI2_CS3    (0x31)
#define SPI2_CS4    (0x41)
//定义工作模式
#define SPI_MODE_HARD_FDX       0 //硬件控制（全双工模式）
#define SPI_MODE_HARD_HDX       1 //硬件控制（半双工模式）
#define SPI_MODE_SOFT_HDX       2 //软件控制（半双工模式）
#define SPI_MODE_SOFT_ONE_WIRE  3 //单总线模式，数据线输入输出都为MOSI
#define SPI_MODE_SOFT_FDX       4 //软件控制（全双工模式）
//定义主从机模式
#define SPI_MASTER      1 //主机
#define SPI_SLAVE       0 //从机
//定义数据移位方式
#define SPI_MSB         0 //高位在前
#define SPI_LSB         1 //低位在前
//定义片选输出极性
#define SPI_SEL_LOW     0 //片选输出低电平
#define SPI_SEL_HIGH    1 //片选输出高电平

//定义EVENT引脚,注意EVENT引脚不要跟SPI通信引脚冲突
#define SPI_EVENT_P0    (1<<0)
#define SPI_EVENT_P1    (1<<1)
#define SPI_EVENT_P2    (1<<2)
#define SPI_EVENT_P3    (1<<3)
#define SPI_EVENT_P4    (1<<4)
#define SPI_EVENT_P5    (1<<5)
#define SPI_EVENT_P6    (1<<6)
#define SPI_EVENT_P7    (1<<7)
#define SPI_EVENT_P8    (1<<8)
#define SPI_EVENT_P9    (1<<9)
#define SPI_EVENT_P10    (1<<10)
#define SPI_EVENT_P11    (1<<11)
#define SPI_EVENT_P12    (1<<12)
#define SPI_EVENT_P13    (1<<13)
#define SPI_EVENT_P14    (1<<14)
#define SPI_EVENT_P15    (1<<15)

//定义事件类型
#define EVENT_TYPE_LOW      0x00
#define EVENT_TYPE_HIGH     0x11
#define EVENT_TYPE_RISING   0x01
#define EVENT_TYPE_FALLING  0x10

//定义从机模式下连续读取数据的回调函数
typedef  int (WINAPI *PSPI_GET_DATA_HANDLE)(int DevHandle,int SPIIndex,unsigned char *pData,int DataNum);//接收数据回掉函数

//定义初始化SPI的数据类型
typedef struct _SPI_CONFIG{
    char   Mode;              //SPI控制方式:0-硬件控制（全双工模式）,1-硬件控制（半双工模式），2-软件控制（半双工模式）,3-单总线模式，数据线输入输出都为MOSI,4-软件控制（全双工模式）
    char   Master;            //主从选择控制:0-从机，1-主机
    char   CPOL;              //时钟极性控制:0-SCK空闲时为低电平，1-SCK空闲时为高电平
    char   CPHA;              //时钟相位控制:0-第一个SCK时钟采样，1-第二个SCK时钟采样
    char   LSBFirst;          //数据移位方式:0-MSB在前，1-LSB在前
    char   SelPolarity;       //片选信号极性:0-低电平选中，1-高电平选中
    unsigned int ClockSpeedHz;//SPI时钟频率:单位为HZ，硬件模式下最大50000000，最小390625，频率按2的倍数改变
}SPI_CONFIG,*PSPI_CONFIG;

//定义SPI Flash器件配置参数数据类型
typedef struct _SPI_FLASH_CONFIG{
    unsigned char CMD_WriteEnable;          //使能写命令
    unsigned char CMD_WriteDisable;         //禁止写命令
    unsigned char CMD_WritePage;            //写数据命令
    unsigned char WritePageAddressBytes;    //写数据时的地址宽度，单位为字节
    unsigned char CMD_EraseSector;          //扇区擦出命令
    unsigned char EraseSectorAddressBytes;  //扇区擦出的地址宽度，单位为字节
    unsigned char CMD_EraseBulk;            //块擦出命令
    unsigned char CMD_EraseChip;            //整片擦出命令
    unsigned char CMD_ReadID;               //读芯片ID命令
    unsigned char CMD_ReadData;             //读数据命令
    unsigned char ReadDataAddressBytes;     //读数据时的地址宽度，单位为字节
    unsigned char CMD_ReadFast;             //快速模式读数据命令
    unsigned char ReadFastAddressBytes;     //快速读数据时的地址宽度，单位为字节
    unsigned char CMD_ReadStatus;           //读取状态寄存器命令
    unsigned char CMD_WriteStatus;          //写状态寄存器命令
    unsigned char ID[16];                   //芯片ID存储数组
    unsigned char ID_Length;                //ID长度，单位为字节
    int PageSize;                           //页大小，单位为字节
    int NumPages;                           //芯片总的页数
    int SectorSize;                         //扇区大小，单位为字节
}SPI_FLASH_CONFIG,*PSPI_FLASH_CONFIG;

//定义函数返回错误代码
#define SPI_SUCCESS             (0)   //函数执行成功
#define SPI_ERR_NOT_SUPPORT     (-1)  //适配器不支持该函数
#define SPI_ERR_USB_WRITE_FAIL  (-2)  //USB写数据失败
#define SPI_ERR_USB_READ_FAIL   (-3)  //USB读数据失败
#define SPI_ERR_CMD_FAIL        (-4)  //命令执行失败
#define SPI_ERR_PARAMETER       (-5)  //参数错误
#define SPI_ERR_EVENT_TIMEOUT   (-6)  //检测Event超时
#ifdef __cplusplus
extern "C"
{
#endif
/**
  * @brief  SPI初始化配置函数
  * @param  DevHandle 设备索引号
  * @param  SPIIndex SPI通道号，取值0或者1
  * @param  pConfig SPI初始化配置结构体指针
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI SPI_Init(int DevHandle,int SPIIndex, PSPI_CONFIG pConfig);

/**
  * @brief  SPI发送数据
  * @param  DevHandle 设备索引号
  * @param  SPIIndex SPI通道号，取值0或者1
  * @param  pWriteData 数据发送缓冲区首地址
  * @param  WriteLen 数据发送字节数
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI SPI_WriteBytes(int DevHandle,int SPIIndex,unsigned char *pWriteData,int WriteLen);

/**
  * @brief  SPI异步方式发送数据，函数调用之后不会等待数据发送完毕，该方式可以加大数据发送速率
  * @param  DevHandle 设备索引号
  * @param  SPIIndex SPI通道号，取值0或者1
  * @param  pWriteData 数据发送缓冲区首地址
  * @param  WriteLen 数据发送字节数
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI SPI_WriteBytesAsync(int DevHandle,int SPIIndex,unsigned char *pWriteData,int WriteLen);

/**
  * @brief  SPI接收数据
  * @param  DevHandle 设备索引号
  * @param  SPIIndex SPI通道号，取值0或者1
  * @param  pReadData 数据接收缓冲区首地址
  * @param  ReadLen 接收数据字节数
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI SPI_ReadBytes(int DevHandle,int SPIIndex,unsigned char *pReadData,int ReadLen);

/**
  * @brief  SPI发送接收数据，全双工模式下发送和接收同时进行，半双工模式下发送和接收分开进行，整个操作过程片选一直有效
  * @param  DevHandle 设备索引号
  * @param  SPIIndex SPI通道号，取值0或者1
  * @param  pWriteData 发送数据缓冲区首地址
  * @param  WriteLen 发送数据字节数
  * @param  pReadData 数据接收缓冲区首地址
  * @param  ReadLen 接收数据字节数
  * @param  IntervalTime 半双工模式下，发送数据和接收数据之间的时间间隔，单位为微妙
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI SPI_WriteReadBytes(int DevHandle,int SPIIndex,unsigned char *pWriteData,int WriteLen,unsigned char *pReadData,int ReadLen,int IntervalTimeUs);

/**
  * @brief  等到有效事件后SPI发送数据
  * @param  DevHandle 设备索引号
  * @param  SPIIndex SPI通道号，取值0或者1
  * @param  pWriteData 数据发送缓冲区首地址
  * @param  WriteLen 数据发送字节数
  * @param  EventPin 等待事件的GPIO引脚
  * @param  EventType 事件类型，0x00-低电平，0x11-高电平，0x10-下降沿，0x01上升沿
  * @param  TimeOutOfMs 等待事件超时时间，单位为毫秒
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI SPI_WriteBytesOfEvent(int DevHandle,int SPIIndex,unsigned char *pWriteData,int WriteLen,int EventPin,unsigned char EventType,int TimeOutOfMs);


/**
  * @brief  等到有效事件后SPI接收数据
  * @param  DevHandle 设备索引号
  * @param  SPIIndex SPI通道号，取值0或者1
  * @param  pReadData 数据接收缓冲区首地址
  * @param  ReadLen 接收数据字节数
  * @param  EventPin 等待事件的GPIO引脚
  * @param  EventType 事件类型，0x00-低电平，0x11-高电平，0x10-下降沿，0x01上升沿
  * @param  TimeOutOfMs 等待事件超时时间，单位为毫秒
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI SPI_ReadBytesOfEvent(int DevHandle,int SPIIndex,unsigned char *pReadData,int ReadLen,int EventPin,unsigned char EventType,int TimeOutOfMs);

/**
  * @brief  等到有效事件后SPI发送接收数据，全双工模式下发送和接收同时进行，半双工模式下发送和接收分开进行，整个操作过程片选一直有效
  * @param  DevHandle 设备索引号
  * @param  SPIIndex SPI通道号，取值0或者1
  * @param  pWriteData 发送数据缓冲区首地址
  * @param  WriteLen 发送数据字节数
  * @param  pReadData 数据接收缓冲区首地址
  * @param  ReadLen 接收数据字节数
  * @param  IntervalTime 半双工模式下，发送数据和接收数据之间的时间间隔，单位为微妙
  * @param  EventPin 等待事件的GPIO引脚
  * @param  EventType 事件类型，0x00-低电平，0x11-高电平，0x10-下降沿，0x01上升沿
  * @param  TimeOutOfMs 等待事件超时时间，单位为毫秒
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI SPI_WriteReadBytesOfEvent(int DevHandle,int SPIIndex,unsigned char *pWriteData,int WriteLen,unsigned char *pReadData,int ReadLen,int IntervalTimeUs,int EventPin,unsigned char EventType,int TimeOutOfMs);


/**
  * @brief  二进制模式写数据，该函数可以发送任意bit数数据
  * @param  DevHandle 设备索引号
  * @param  SPIIndex SPI通道号，取值0或者1
  * @param  pWriteBitStr 二进制数据字符串，如："100110011"
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI SPI_WriteBits(int DevHandle,int SPIIndex,char *pWriteBitStr);

/**
  * @brief  二进制模式读数据，该函数可以读取任意bit数数据
  * @param  DevHandle 设备索引号
  * @param  SPIIndex SPI通道号，取值0或者1
  * @param  pReadBitStr 读取到的二进制数据字符串，如："100110011"
  * @param  ReadBitsNum 读取数据的二进制bit数
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI SPI_ReadBits(int DevHandle,int SPIIndex,char *pReadBitStr,int ReadBitsNum);

/**
  * @brief  二进制模式写读数据，该函数可以写读取任意bit数数据
  * @param  DevHandle 设备索引号
  * @param  SPIIndex SPI通道号，取值0或者1
  * @param  pWriteBitStr 写二进制数据字符串，如："100110011"
  * @param  pReadBitStr 读取到的二进制数据字符串，如："100110011"
  * @param  ReadBitsNum 读取数据的二进制bit数
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI SPI_WriteReadBits(int DevHandle,int SPIIndex,char *pWriteBitStr,char *pReadBitStr,int ReadBitsNum);

/**
  * @brief  SPI从机模式下将数据写入数据发送缓冲区，等待主机的时钟信号再将数据发送出去
  * @param  DevHandle 设备索引号
  * @param  SPIIndex SPI通道号，取值0或者1
  * @param  pWriteData 发送数据缓冲区首地址
  * @param  WriteLen 发送数据字节数
  * @param  TimeOutMs 等待数据发送完毕超时时间，若小于或者等于0则不会等待数据发送完毕，函数立即返回
  * @retval 函数执行状态，小于0函数执行出错，大于0表示成功发送的字节数
  */
int WINAPI SPI_SlaveWriteBytes(int DevHandle,int SPIIndex,unsigned char *pWriteData,int WriteLen,int TimeOutMs);

/**
  * @brief  SPI从机模式下接收数据
  * @param  DevHandle 设备索引号
  * @param  SPIIndex SPI通道号，取值0或者1
  * @param  pReadData 数据接收缓冲区首地址
  * @param  pReadLen 准备接收数据的字节数
  * @retval 函数执行状态，小于0函数执行出错，大于0表示接收到的数据字节数
  */
int WINAPI SPI_SlaveReadBytes(int DevHandle,int SPIIndex,unsigned char *pReadData,int ReadLen,int TimeOutMs);

/**
  * @brief  SPI从机模式下读写数据，全双工模式下读写数据同时进行，半双工模式下先读数据，然后再写数据
  * @param  DevHandle 设备索引号
  * @param  SPIIndex SPI通道号，取值0或者1
  * @param  pReadData 从机模式下接收数据缓冲区地址
  * @param  ReadDataLen 从机模式下接收数据的长度
  * @param  pReadReadLen 从机数据收发字节数
  * @retval 函数执行状态，小于0函数执行出错，大于0则高16位是成功发送的数据字节数，低16位是成功读取的数据字节数
  */
int WINAPI SPI_SlaveReadWriteBytes(int DevHandle,int SPIIndex,unsigned char *pReadData,int ReadDataLen,unsigned char *pWriteData,int WriteDataLen,int TimeOutMs);

/**
  * @brief  SPI从机模式下同时发送接收数据
  * @param  DevHandle 设备索引号
  * @param  SPIIndex SPI通道号，取值0或者1
  * @param  pWriteData 发送数据缓冲区首地址
  * @param  WriteDataLen 从机数据发送字节数
  * @param  pReadData 数据接收缓冲区首地址
  * @param  pReadReadLen 从机数据读取字节数
  * @retval 函数执行状态，小于0函数执行出错，大于0则高16位是成功发送的数据字节数，低16位是成功读取的数据字节数
  */
int WINAPI SPI_SlaveWriteReadBytes(int DevHandle,int SPIIndex,unsigned char *pWriteData,int WriteDataLen,unsigned char *pReadData,int ReadDataLen,int TimeOutMs);

/**
  * @brief  SPI从机模式下连续读取数据,SPI在从机模式下接收到数据之后，通过回调函数传出数据
  * @param  DevHandle 设备索引号
  * @param  SPIIndex SPI通道号，取值0或者1
  * @param  pSlaveReadDataHandle 从机模式下接收到数据后的回调函数，若传入NULL，则可以通过调用SPI_SlaveGetBytes函数来获取缓冲区中接收到的数据
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI SPI_SlaveContinueRead(int DevHandle,int SPIIndex,PSPI_GET_DATA_HANDLE pSlaveReadDataHandle);

/**
  * @brief  SPI从机模式下获取接收数据缓冲区的数据
  * @param  DevHandle 设备索引号
  * @param  SPIIndex SPI通道号，取值0或者1
  * @param  pReadData 数据接收缓冲区首地址
  * @param  BufferSize 缓冲区长度
  * @retval 获取到的数据字节数
  */
int WINAPI SPI_SlaveGetBytes(int DevHandle,int SPIIndex,unsigned char *pReadData,int BufferSize);

/**
  * @brief  从SPI数据缓冲区中读取数据
  * @param  DevHandle 设备索引号
  * @param  SPIIndex SPI通道号，取值0或者1
  * @param  pReadData 数据接收缓冲区首地址
  * @param  TimeOutMs 等待数据超时时间
  * @retval 获取到的数据字节数
  */
int WINAPI SPI_SlaveReadBytesFromBuffer(int DevHandle,int SPIIndex,unsigned char *pReadData,int TimeOutMs);
/**
  * @brief  停止SPI从机模式下连续读取数据
  * @param  DevHandle 设备索引号
  * @param  SPIIndex SPI通道号，取值0或者1
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI SPI_SlaveContinueWriteReadStop(int DevHandle,int SPIIndex);

/**
  * @brief  停止SPI从机模式下连续读取数据
  * @param  DevHandle 设备索引号
  * @param  SPIIndex SPI通道号，取值0或者1
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI SPI_SlaveContinueReadStop(int DevHandle, int SPIIndex);

/**
  * @brief  SPI从机模式下连续发送数据，也就是将数据放到数据缓冲区中，主机来读取的时候会自动循环发送
  * @param  DevHandle 设备索引号
  * @param  SPIIndex SPI通道号，取值0或者1
  * @param  pWriteData 需要循环发送的数据缓冲区指针
  * @param  WriteDataNum 待发送的数据字节数
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI SPI_SlaveContinueWrite(int DevHandle,int SPIIndex,unsigned char *pWriteData,int WriteLen);

/**
  * @brief  读写SPI-Flash初始化配置
  * @param  DevHandle 设备索引号
  * @param  SPIIndex SPI通道号，取值0或者1
  * @param  ClockSpeed SPI时钟信号频率，单位为Hz,最大为50MHz，依次成倍递减
  * @param  pConfig SPI-Flash相关参数
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI SPI_FlashInit(int DevHandle,int SPIIndex,int ClockSpeed, PSPI_FLASH_CONFIG pConfig);

/**
  * @brief  读取SPI-Flash芯片的ID号
  * @param  DevHandle 设备索引号
  * @param  SPIIndex SPI通道号，取值0或者1
  * @param  pID 芯片ID号存储首地址，其长度由SPI_FLASH_CONFIG中的ID_Length决定
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI SPI_FlashReadID(int DevHandle,int SPIIndex,unsigned char *pID);

/**
  * @brief  擦除SPI-Flash的扇区数据
  * @param  DevHandle 设备索引号
  * @param  SPIIndex SPI通道号，取值0或者1
  * @param  StartSector 起始扇区号，注意是扇区号，不是具体的扇区地址
  * @param  NumSector 需要擦除的扇区数
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI SPI_FlashEraseSector(int DevHandle,int SPIIndex,int StartSector,int NumSector,int TimeOutMs);

/**
  * @brief  擦除SPI-Flash整个芯片的数据
  * @param  DevHandle 设备索引号
  * @param  SPIIndex SPI通道号，取值0或者1
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI SPI_FlashEraseChip(int DevHandle,int SPIIndex,int TimeOutMs);

/**
  * @brief  擦除SPI-Flash的数据，根据传入的指令不一样，可以是扇区擦除，块擦除，整片擦除
  * @param  DevHandle 设备索引号
  * @param  SPIIndex SPI通道号，取值0或者1
  * @param  StartAddr 擦除数据的起始地址
  * @param  AddrBytes 地址字节数，一般是3字节
  * @param  EraseCmd 擦除数据命令，不同的擦除方式，命令值不一样
  * @param  TimeOutMs 等待擦除完毕超时时间，若超时时间到之后还没擦除完毕，则返回超时错误
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI SPI_FlashErase(int DevHandle,int SPIIndex,int StartAddr,unsigned char AddrBytes,unsigned char EraseCmd,int TimeOutMs);

/**
  * @brief  向SPI-Flash写数据
  * @param  DevHandle 设备索引号
  * @param  SPIIndex SPI通道号，取值0或者1
  * @param  StartAddr 写数据起始地址
  * @param  pWriteData 写数据缓冲区首地址
  * @param  WriteLen 写数据字节数
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI SPI_FlashWrite(int DevHandle,int SPIIndex,int StartAddr,unsigned char *pWriteData,int WriteLen);

/**
  * @brief  从SPI-Flash读数据
  * @param  DevHandle 设备索引号
  * @param  SPIIndex SPI通道号，取值0或者1
  * @param  StartAddr 写数据起始地址
  * @param  pReadData 读数据缓冲区首地址
  * @param  ReadLen 读数据字节数
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI SPI_FlashRead(int DevHandle,int SPIIndex,int StartAddr,unsigned char *pReadData,int ReadLen);

/**
  * @brief  从SPI-Flash读数据
  * @param  DevHandle 设备索引号
  * @param  SPIIndex SPI通道号，取值0或者1
  * @param  StartAddr 写数据起始地址
  * @param  pReadData 读数据缓冲区首地址
  * @param  ReadLen 读数据字节数
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI SPI_FlashReadFast(int DevHandle,int SPIIndex,int StartAddr,unsigned char *pReadData,int ReadLen);

/**
  * @brief  Block模式写数据
  * @param  DevHandle 设备索引号
  * @param  SPIIndex SPI通道号，取值0或者1
  * @param  pWriteData 写数据起始地址
  * @param  BlockSize 每次写数据字节数
  * @param  BlockNum 写数据总次数
  * @param  IntervalTime 每次写数据之间的时间间隔，单位为微妙
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI SPI_BlockWriteBytes(int DevHandle,int SPIIndex,unsigned char *pWriteData,int BlockSize,int BlockNum,int IntervalTimeUs);

/**
  * @brief  Block模式读数据
  * @param  DevHandle 设备索引号
  * @param  SPIIndex SPI通道号，取值0或者1
  * @param  pReadData 读数据缓冲区首地址
  * @param  BlockSize 每次读数据字节数
  * @param  BlockNum 读数据总次数
  * @param  IntervalTime 每次写数据之间的时间间隔，单位为微妙
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI SPI_BlockReadBytes(int DevHandle,int SPIIndex,unsigned char *pReadData,int BlockSize,int BlockNum,int IntervalTimeUs);

/**
  * @brief  Block模式写读数据
  * @param  DevHandle 设备索引号
  * @param  SPIIndex SPI通道号，取值0或者1
  * @param  pWriteData 写数据起始地址
  * @param  WriteBlockSize 每次读数据字节数
  * @param  pReadData 读数据缓冲区首地址
  * @param  ReadBlockSize 每次读数据字节数
  * @param  BlockNum 读数据总次数
  * @param  IntervalTime 每次写数据之间的时间间隔，单位为微妙
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI SPI_BlockWriteReadBytes(int DevHandle,int SPIIndex,unsigned char *pWriteData,int WriteBlockSize,unsigned char *pReadData,int ReadBlockSize,int BlockNum,int IntervalTimeUs);

/**
  * @brief  Block模式写数据
  * @param  DevHandle 设备索引号
  * @param  SPIIndex SPI通道号，取值0或者1
  * @param  pWriteData 写数据起始地址
  * @param  BlockSize 每次写数据字节数
  * @param  BlockNum 写数据总次数
  * @param  EventPin 等待事件的GPIO引脚
  * @param  EventType 事件类型，0x00-低电平，0x11-高电平，0x10-下降沿，0x01上升沿
  * @param  TimeOutOfMs 等待事件超时时间，单位为毫秒
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI SPI_BlockWriteBytesOfEvent(int DevHandle,int SPIIndex,unsigned char *pWriteData,int BlockSize,int BlockNum,int EventPin,unsigned char EventType,int TimeOutOfMs);

/**
  * @brief  Block模式读数据
  * @param  DevHandle 设备索引号
  * @param  SPIIndex SPI通道号，取值0或者1
  * @param  pReadData 读数据缓冲区首地址
  * @param  BlockSize 每次读数据字节数
  * @param  BlockNum 读数据总次数
  * @param  EventPin 等待事件的GPIO引脚
  * @param  EventType 事件类型，0x00-低电平，0x11-高电平，0x10-下降沿，0x01上升沿
  * @param  TimeOutOfMs 等待事件超时时间，单位为毫秒
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI SPI_BlockReadBytesOfEvent(int DevHandle,int SPIIndex,unsigned char *pReadData,int BlockSize,int BlockNum,int EventPin,unsigned char EventType,int TimeOutOfMs);

/**
  * @brief  Block模式写读数据
  * @param  DevHandle 设备索引号
  * @param  SPIIndex SPI通道号，取值0或者1
  * @param  pWriteData 写数据起始地址
  * @param  WriteBlockSize 每次读数据字节数
  * @param  pReadData 读数据缓冲区首地址
  * @param  ReadBlockSize 每次读数据字节数
  * @param  BlockNum 读数据总次数
  * @param  EventPin 等待事件的GPIO引脚
  * @param  EventType 事件类型，0x00-低电平，0x11-高电平，0x10-下降沿，0x01上升沿
  * @param  TimeOutOfMs 等待事件超时时间，单位为毫秒
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI SPI_BlockWriteReadBytesOfEvent(int DevHandle,int SPIIndex,unsigned char *pWriteData,int WriteBlockSize,unsigned char *pReadData,int ReadBlockSize,int BlockNum,int EventPin,unsigned char EventType,int TimeOutOfMs);

#ifdef __cplusplus
}
#endif

#endif



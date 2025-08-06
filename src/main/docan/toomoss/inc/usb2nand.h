/**
  ******************************************************************************
  * @file    usb2nand.h
  * $Author: wdluo $
  * $Revision: 447 $
  * $Date:: 2013-06-29 18:24:57 +0800 #$
  * @brief   usb2nand相关函数和数据类型定义.
  ******************************************************************************
  * @attention
  *
  *<center><a href="http:\\www.toomoss.com">http://www.toomoss.com</a></center>
  *<center>All Rights Reserved</center></h3>
  * 
  ******************************************************************************
  */
#ifndef __USB2NAND_H_
#define __USB2NAND_H_

#include <stdint.h>
#ifndef OS_UNIX
#include <Windows.h>
#else
#include <unistd.h>
#ifndef WINAPI
#define WINAPI
#endif
#endif

//定义NAND操作时序参数
typedef struct _NAND_TIMING_COMFIG{
  uint32_t FSMC_SetupTime;
  uint32_t FSMC_WaitSetupTime;
  uint32_t FSMC_HoldSetupTime;
  uint32_t FSMC_HiZSetupTime;
}NAND_TIMING_COMFIG,*PNAND_TIMING_COMFIG;

//定义函数返回错误代码
#define NAND_SUCCESS             (0)   //函数执行成功
#define NAND_ERR_NOT_SUPPORT     (-1)  //适配器不支持该函数
#define NAND_ERR_USB_WRITE_FAIL  (-2)  //USB写数据失败
#define NAND_ERR_USB_READ_FAIL   (-3)  //USB读数据失败
#define NAND_ERR_CMD_FAIL        (-4)  //命令执行失败

#ifdef __cplusplus
extern "C"
{
#endif
/**
  * @brief  初始化配置NAND接口，该函数必须调用
  * @param  DevHandle 设备索引号
  * @param  ChipIndex NAND芯片片选号，取值0或者1
  * @param  PowerLevel NAND接口电压，1-1.8V，3-3.3V
  * @param  pTimeConfig 对NAND进行读写操作的时间参数
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI NAND_Init(int DevHandle,int ChipIndex,unsigned char PowerLevel,PNAND_TIMING_COMFIG pTimeConfig);

//NAND操作底层函数，调用这些函数理论上可以读写控制任何NAND芯片，底层操作函数不会自动输出片选信号，需要程序控制片选信号输出
/**
  * @brief  控制片选信号输出低电平
  * @param  DevHandle 设备索引号
  * @param  ChipIndex NAND芯片片选号，取值0或者1
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI NAND_Select(int DevHandle,int ChipIndex);

/**
  * @brief  控制片选信号输出高电平
  * @param  DevHandle 设备索引号
  * @param  ChipIndex NAND芯片片选号，取值0或者1
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI NAND_Unselect(int DevHandle,int ChipIndex);

/**
  * @brief  NAND接口输出命令数据
  * @param  DevHandle 设备索引号
  * @param  pCmds 命令存储数据缓冲区
  * @param  CmdsLen 需要发送的命令数
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI NAND_SendCmd(int DevHandle,int ChipIndex,unsigned char *pCmds,unsigned char CmdsLen);

/**
  * @brief  NAND接口输出地址数据
  * @param  DevHandle 设备索引号
  * @param  pAddrs 地址存储数据缓冲区
  * @param  AddrsLen 需要发送的地址数据字节数
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI NAND_SendAddr(int DevHandle,int ChipIndex,unsigned char *pAddrs,unsigned char AddrsLen);

/**
  * @brief  NAND接口输出数据
  * @param  DevHandle 设备索引号
  * @param  pWriteData 数据存储缓冲区
  * @param  WriteDataLen 需要发送的数据字节数
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI NAND_WriteData(int DevHandle,int ChipIndex,unsigned char *pWriteData,unsigned int WriteDataLen);

/**
  * @brief  NAND接口读取数据
  * @param  DevHandle 设备索引号
  * @param  pReadData 数据存储缓冲区
  * @param  ReadDataLen 需要读取的数据字节数
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI NAND_ReadData(int DevHandle,int ChipIndex,unsigned char *pReadData,unsigned int ReadDataLen);
/**
  * @brief  等待NAND接口的RB信号变高
  * @param  DevHandle 设备索引号
  * @param  ChipIndex 需要等待的RB通道号，0-RB0，1-RB1
  * @param  TimeOutOfMs 等待RB信号变高的超时时间，单位为毫秒，若设置为0则表示一直等待，直到变高后才返回
  * @retval 函数执行状态，小于0函数执行出错,0-等待超时且RB为低，1-超时时间范围内检测到RB为高
  */
int WINAPI NAND_WaitReady(int DevHandle,int ChipIndex,unsigned int TimeOutOfMs);



//NAND操作高层函数
/**
  * @brief  发送RESET(0xFF)命令并等待RB信号变高
  * @param  DevHandle 设备索引号
  * @param  ChipIndex CE和RB自动输出通道号，0-CE0,RB0;1-CE1,RB1
  * @retval 函数执行状态，小于0函数执行出错,0-等待超时且RB为低，1-超时时间范围内检测到RB变高
  */
int WINAPI NAND_Reset(int DevHandle,int ChipIndex);

/**
  * @brief  获取NAND Flash芯片的状态信息
  * @param  DevHandle 设备索引号
  * @param  ChipIndex 自动输出的NAND芯片片选号，取值0或者1
  * @param  pStatus 状态信息存储指针
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI NAND_ReadStatus(int DevHandle,int ChipIndex,unsigned int *pStatus);


/**
  * @brief  获取NAND Flash芯片ID信息
  * @param  DevHandle 设备索引号
  * @param  ChipIndex 自动输出的NAND芯片片选号，取值0或者1
  * @param  IDAddr 读取ID的地址信息
  * @param  pID 芯片ID存储缓冲区首地址
  * @param  IDLen 读取ID数据字节数
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI NAND_ReadID(int DevHandle,int ChipIndex,unsigned char IDAddr,unsigned char *pID,unsigned char IDLen);

/**
  * @brief  向NAND Flash写入数据，建议按照整页写，然后再将该函数返回的ECC写入备用区，以便以后读取的时候将读出数据的ECC和写入ECC做对比，实现对数据的校验
  * @param  DevHandle 设备索引号
  * @param  ChipIndex NAND芯片片选号，取值0或者1
  * @param  pCmds 写数据的命令
  * @param  CmdsLen 写数据命令字节数
  * @param  pAddrs 写数据的地址
  * @param  AddrLen 写数据的地址字节数
  * @param  pWriteData 待写入NAND Flash芯片的数据缓冲区首地址
  * @param  NumByteToWrite 待写入NAND Flash芯片的数据字节数
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI NAND_WritePage(int DevHandle,int ChipIndex,unsigned char *pCmds,unsigned char CmdsLen,unsigned char *pAddrs,unsigned char AddrLen,unsigned char *pWriteData,int NumByteToWrite);
/**
  * @brief  从NAND Flash读出数据
  * @param  DevHandle 设备索引号
  * @param  ChipIndex NAND芯片片选号，取值0或者1
  * @param  pCmds 读数据的命令
  * @param  CmdsLen 读数据命令字节数
  * @param  pAddrs 读数据的地址
  * @param  AddrLen 读数据的地址字节数
  * @param  pReadData 存储读出数据的缓冲区首地址
  * @param  NumByteToRead 待读出的数据字节数
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI NAND_ReadPage (int DevHandle,int ChipIndex, unsigned char *pCmds,unsigned char CmdsLen,unsigned char *pAddrs,unsigned char AddrLen,unsigned char *pReadData, int NumByteToRead);
/**
  * @brief  按块擦出NAND Flash数据，擦出后所有数据变成0xFF
  * @param  DevHandle 设备索引号
  * @param  ChipIndex NAND芯片片选号，取值0或者1
  * @param  pCmds 擦除数据的命令
  * @param  CmdsLen 擦除数据命令字节数
  * @param  pAddrs 擦除数据的地址
  * @param  AddrLen 擦除数据的地址字节数
  * @retval 函数执行状态，小于0函数执行出错
  */
int WINAPI NAND_EraseBlock(int DevHandle,int ChipIndex,unsigned char *pCmds,unsigned char CmdsLen,unsigned char *pAddrs,unsigned char AddrLen);


#ifdef __cplusplus
}
#endif

#endif


#ifndef UDSLINBOOTLOADER_H
#define UDSLINBOOTLOADER_H

#include <stdint.h>
#ifndef OS_UNIX
#include <Windows.h>
#else
#include <unistd.h>
#ifndef WINAPI
#define WINAPI
#endif
#endif

//定义函数返回错误代码
#define LIN_BOOT_SUCCESS            (0)     //函数执行成功
#define LIN_BOOT_SEND_ERROR         (-8)    //发送LIN数据出错
#define LIN_BOOT_READ_ERROR         (-9)    //读取LIN数据出错或者从设备没有返回数据
#define LIN_BOOT_RESP_ERROR         (-10)   //从机返回数据错误
#define LIN_BOOT_TIMEOUT_ERROR      (-11)   //操作超时错误
#define LIN_BOOT_DSIZE_ERROR        (-12)   //发送数据长度超过4096字节
#define LIN_BOOT_BSIZE_ERROR        (-13)   //从机返回数据缓冲区大小为0
#define LIN_BOOT_DTARN_ERROR        (-14)   //数据传输错误

#ifdef __cplusplus
extern "C"
{
#endif

int WINAPI USDLINBoot_Init(int DevHandle,int LINIndex,int BaudRate);
int WINAPI USDLINBoot_Start(int DevHandle,int LINIndex,unsigned char NAD,unsigned short KeyK,int TimeOutMs);
int WINAPI USDLINBoot_Erase(int DevHandle,int LINIndex,unsigned char NAD,unsigned int StartAddr,int MemSize,unsigned char OptByte);
int WINAPI USDLINBoot_WriteData(int DevHandle,int LINIndex,unsigned char NAD,unsigned int StartAddr,unsigned char *pData,unsigned int DataLen);
int WINAPI USDLINBoot_MemCheck(int DevHandle,int LINIndex,unsigned char NAD,unsigned int CheckValue);
int WINAPI USDLINBoot_ResetECU(int DevHandle,int LINIndex,unsigned char NAD);

#ifdef __cplusplus
}
#endif
#endif // UDSLINBOOTLOADER_H


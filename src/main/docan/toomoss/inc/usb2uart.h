/**
 * @file   usb2uart.h
 * @brief  USB转UART相关函数和数据类型定义
 * @author wdluo(wdluo@toomoss.com)
 * @version 1.0
 * @date 2022-10-05
 * @copyright Copyright (c) 2022 重庆图莫斯电子科技有限公司
 */
#ifndef __USB2UART_H_
#define __USB2UART_H_

#include <stdint.h>
#ifndef OS_UNIX
#include <Windows.h>
#else
#include <unistd.h>
#ifndef WINAPI
#define WINAPI
#endif
#endif
 /**
  *@defgroup USB转UART
  * @{
  * @brief USB转UART接口函数和数据类型定义
 */

 /**
  * @brief  UART初始化结构体
  */
typedef struct _UART_CONFIG{
  unsigned int  BaudRate;     ///<波特率值，建议不要超过100K，超过100K可能会导致数据收发出错
  unsigned char WordLength;   ///<数据位宽，0-8bit,1-9bit
  unsigned char StopBits;     ///<停止位宽，0-1bit,1-0.5bit,2-2bit,3-1.5bit
  unsigned char Parity;       ///<奇偶校验，0-No,4-Even,6-Odd
  unsigned char TEPolarity;   ///<TE输出控制，0x80-输出TE信号，且低电平有效，0x81-输出TE信号，且高电平有效，0x00不输出TE信号，0x42-使能LIN总线上的上拉电阻，0x40-关闭LIN总线上的上拉电阻，0x24-将当前串口跟SENT增强模块连接
}UART_CONFIG,*PUART_CONFIG;

/**
 *@name 函数返回错误值宏定义
 *@brief 函数调用出错后返回值定义
 *@{
*/
#define UART_SUCCESS             (0)   ///<函数执行成功
#define UART_ERR_NOT_SUPPORT     (-1)  ///<适配器不支持该函数
#define UART_ERR_USB_WRITE_FAIL  (-2)  ///<USB写数据失败
#define UART_ERR_USB_READ_FAIL   (-3)  ///<USB读数据失败
#define UART_ERR_CMD_FAIL        (-4)  ///<命令执行失败
/** @} */

/**
 *@name 数据位宽
 *@brief 数据位宽定义
 *@{
*/
#define UART_WORD_LENGTH_8BIT     0
#define UART_WORD_LENGTH_9BIT     1
/** @} */

/**
 *@name 停止位
 *@brief 停止位定义
 *@{
*/
#define UART_STOP_BITS_1          0//1bit
#define UART_STOP_BITS_05         1//0.5bit
#define UART_STOP_BITS_2          2//2bit
#define UART_STOP_BITS_15         3//1.5bit
/** @} */

/**
 *@name 奇偶校验位
 *@brief 奇偶校验位定义
 *@{
*/
#define UART_PARITY_NO            0
#define UART_PARITY_EVEN          4
#define UART_PARITY_ODD           6
/** @} */

/**
 *@name TE控制信号输出
 *@brief TE控制信号输出定义
 *@{
*/
#define UART_TE_DISEN             0x00
#define UART_TE_EN_LOW            0x80
#define UART_TE_EN_HIGH           0x81
/** @} */

/**
 *@name 内部上拉电阻配置
 *@brief 内部上拉电阻使能定义
 *@{
*/
#define UART_PPR_DISABLE          0x40
#define UART_PPR_ENABLE           0x42
/** @} */

#ifdef __cplusplus
extern "C"
{
#endif
/**
 * @brief  初始化UART，必须调用，否则后面的函数无法正常执行
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  Channel UART通道号，从0开始编号
 * @param  pConfig 初始化结构体指针
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI UART_Init(int DevHandle, unsigned char Channel, PUART_CONFIG pConfig);

/**
 * @brief  发送UART数据，该函数为阻塞函数，数据发送完毕后函数才会返回
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  Channel UART通道号，从0开始编号
 * @param  pWriteData 待发送的数据字节数组指针
 * @param  DataSize 待发送的数据字节数
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI UART_WriteBytes(int DevHandle,unsigned char Channel,unsigned char *pWriteData,int DataSize);

/**
 * @brief  发送UART数据，该函数为非阻塞函数，调用后数据会先缓存到适配器，然后立即返回，适配器继续发送数据
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  Channel UART通道号，从0开始编号
 * @param  pWriteData 待发送的数据字节数组指针
 * @param  DataSize 待发送的数据字节数
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI UART_WriteBytesAsync(int DevHandle,unsigned char Channel,unsigned char *pWriteData,int DataSize);
/**
 * @brief  根据设定的字节间隔发送数据，该函数为阻塞函数，数据发送完毕后才会返回
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  Channel UART通道号，从0开始编号
 * @param  pWriteData 待发送的数据字节数组指针
 * @param  DataSize 待发送的数据字节数
 * @param  IntervalTimeMs 发送数据间隔时间，单位为毫秒
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI UART_WriteBytesInterval(int DevHandle,unsigned char Channel,unsigned char *pWriteData,int DataSize,unsigned char IntervalTimeMs);

/**
 * @brief  根据设定的字节间隔发送数据，该函数为阻塞函数，数据发送完毕后才会返回
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  Channel UART通道号，从0开始编号
 * @param  pWriteData 待发送的数据字节数组指针
 * @param  DataSize 待发送的数据字节数
 * @param  IntervalTimeUs 发送数据间隔时间，单位为微秒
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI UART_WriteBytesIntervalUs(int DevHandle, unsigned char Channel, unsigned char* pWriteData, int DataSize, unsigned char IntervalTimeUs);

/**
 * @brief  获取适配器已经接收到的串口数据
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  Channel UART通道号，从0开始编号
 * @param  pReadData 待存储数据的数据缓冲区，注意缓冲区大小设置，太小了可能会到之后缓冲区溢出，程序崩溃
 * @param  TimeOutMs 等待数据超时时间，超时时间内若读取到数据则立即返回，否则等到超时时间到之后才返回
 * @return 函数执行状态
 * @retval >=0 成功读到的数据字节数
 * @retval <0 函数调用失败
 */
int WINAPI UART_ReadBytes(int DevHandle,unsigned char Channel,unsigned char *pReadData,int TimeOutMs);

/**
 * @brief  清空数据接收缓冲区数据
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  Channel UART通道号，从0开始编号
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI UART_ClearData(int DevHandle,unsigned char Channel);

#ifdef __cplusplus
}
#endif
/** @} USB转LIN*/
#endif


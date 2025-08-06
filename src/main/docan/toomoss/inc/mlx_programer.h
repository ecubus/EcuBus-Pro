/**
 * @file   mlx_programer.h
 * @brief  迈来芯(mlx)氛围灯芯片编程相关函数
 * @author wdluo(wdluo@toomoss.com)
 * @version 1.0
 * @date 2022-10-05
 * @copyright Copyright (c) 2022 重庆图莫斯电子科技有限公司
 */
#ifndef __MLX_PROGRAMER_H_
#define __MLX_PROGRAMER_H_

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
 *@defgroup 迈来芯芯片编程
 * @{
 * @brief 包含迈来芯氛围灯芯片编程接口函数
*/


/**
 *@name 函数返回错误值宏定义
 *@brief 函数调用出错后返回值定义
 *@{
*/
#define MLX_SUCCESS             (0)     ///<函数执行成功
#define MLX_ERR_OPEN_DEV        (-1)    ///<打开设备失败
#define MLX_ERR_INIT_DEV        (-2)    ///<初始化设备失败
#define MLX_ERR_FILE_FORMAT     (-3)    ///<文件格式错误
#define MLX_ERR_BEGIN_PROG      (-4)    ///<开始编程失败
#define MLX_ERR_CMD_FAIL        (-5)    ///<函数执行失败
#define MLX_ERR_WRITE_FLASH     (-6)    ///<写数据到FLASH失败
/** @} */

#ifdef __cplusplus
extern "C"
{
#endif
/**
 * @brief  编程初始化，必须调用
 * @param  DeviceHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  LINChannel LIN通道号，0-LIN1，1-LIN2，2-LIN3，3-LIN4
 * @param  BaudRateOfKbps 编程波特率，LIN模式默认为19200，FastLIN模式最大可支持到50K
 * @param  UseFastLIN 是否使用FastLIN模式编程，0-不使用，1-使用
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI MLX_ProgInit(int DeviceHandle, unsigned char LINChannel,unsigned char BaudRateOfKbps,unsigned char UseFastLIN);

/**
 * @brief  编程数据到芯片NVRAM
 * @param  DeviceHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  LINChannel LIN通道号，0-LIN1，1-LIN2，2-LIN3，3-LIN4
 * @param  nvramFileName 文件名称
 * @param  nad 节点地址，若不知道地址可以设置为0x7F
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI MLX_ProgNVRAM(int DeviceHandle, unsigned char LINChannel, const char* nvramFileName, uint8_t nad);

/**
 * @brief  编程程序数据到芯片Flash
 * @param  DeviceHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  LINChannel LIN通道号，0-LIN1，1-LIN2，2-LIN3，3-LIN4
 * @param  LoaderFileName loader文件名称，若芯片不需要loader文件可以不设置
 * @param  AppFileName 程序数据文件名称，必须传入
 * @param  nad 节点地址，若不知道地址可以设置为0x7F
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI MLX_ProgFlash(int DeviceHandle, unsigned char LINChannel, const char* LoaderFileName, const char* AppFileName, uint8_t nad);

#ifdef __cplusplus
}
#endif

/** @} */

#endif



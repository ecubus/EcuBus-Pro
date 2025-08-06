/**
 * @file usb_device.h
 * @brief  设备操作相关函数和数据类型定义
 * @author wdluo(wdluo@toomoss.com)
 * @version 1.0
 * @date 2022-10-04
 * @copyright Copyright (c) 2022 重庆图莫斯电子科技有限公司
 */
#ifndef __USB_DEVICE_H_
#define __USB_DEVICE_H_

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
* @mainpage  USB2XXX二次开发接口函数说明文档
* @section   内容简介
* 本文档为USB2XXX库里面的函数说明文档，对设备进行二次开发的所有接口函数都包含在里面，比如USB转CAN，USB转LIN，USB转IIC，USB转SPI，USB转PWM等功能。不管二次开发是使用的什么语言，调用的接口函数都是一样的，所以该文档适用于任何二次开发参考，只是不同的语言，其函数调用形式有所不同。
* 
* @section   用法描述 
* -# 首先将对应平台的库文件全部复制到程序工程目录下，USB2XXX可能会依赖libusb和其他库，都需要复制过去
* -# 将不同语言平台下的接口函数文件也复制到工程里面，然后加入到工程中后，程序里面直接调用即可
* -# 库函数使用范例程序源码下载：<a href="http://www.toomoss.com/download/4-cn.html">http://www.toomoss.com/download/4-cn.html</a>
* -# 最新版本SDK库下载：<a href="http://www.toomoss.com/download/9-cn.html">http://www.toomoss.com/download/9-cn.html</a>
*
* @section   版本记录 
* <table>
* <tr><th>日期        <th>版本   <th>作者    <th>描述</tr>
* <tr><td>2022/10/04 <td>1.0    <td>wdluo  <td>创建初始版本 </tr>
* </table>
*<center>Copyright (c) 2022 重庆图莫斯电子科技有限公司</center>
**********************************************************************************
*/
/**
 *@defgroup 设备管理
 * @{
 * @brief 设备操作相关函数，用户存储区操作相关函数
*/

/**
 * @brief  设备固件信息定义
 */
typedef struct _DEVICE_INFO
{
    char    FirmwareName[32];   ///<固件名称字符串
    char    BuildDate[32];      ///<固件编译时间字符串
    int     HardwareVersion;    ///<硬件版本号
    int     FirmwareVersion;    ///<固件版本号
    int     SerialNumber[3];    ///<适配器序列号
    int     Functions;          ///<适配器当前具备的功能
}DEVICE_INFO;
/**
 * @brief  设备硬件信息定义
 */
typedef struct
{
    unsigned char   McuModel[16];       ///<主芯片型号
    unsigned char   ProductModel[16];   ///<产品型号
    unsigned int    Version;            ///<硬件版本号

    unsigned char   CANChannelNum;      ///<CAN通道数
    unsigned char   LINChannelNum;      ///<LIN通道数
    unsigned char   PWMChannelNum;      ///<PWM通道数，包含LIN和DO可输出的
    unsigned char   HaveCANFD;          ///<是否支持CANFD功能

    unsigned char   DIChannelNum;       ///<独立DI通道数，不包含LIN通道
    unsigned char   DOChannelNum;       ///<独立DO通道数，不包含LIN通道
    unsigned char   HaveIsolation;      ///<是否支持电磁隔离
    unsigned char   ExPowerSupply;      ///<是否支持外部电源供电

    unsigned char   IsOEM;              ///<是客户定制版本吗
    unsigned char   EECapacity;         ///<EEPROM支持容量，单位为KByte,0表示没有EEPROM
    unsigned char   SPIFlashCapacity;   ///<Flash容量，单位为MByte,0表示没有Flash
    unsigned char   TFCardSupport;      ///<是否支持TF卡安装

    unsigned char   ProductionDate[12];  ///<生产日期

    unsigned char   USBControl;         ///<支持通过USB控制
    unsigned char   SerialControl;      ///<支持串口控制
    unsigned char   EthControl;         ///<支持网口控制
    unsigned char   VbatChannel;        ///<可以控制的VBAT输出通道数
}HARDWARE_INFO;
/**
 *@name 电压输出值宏定义
 *@brief 定义输出不同电压时对应的值，仅仅UTA0302设备适用
 *@{
*/
#define POWER_LEVEL_1V8     1   ///<输出1.8V
#define POWER_LEVEL_2V5     2   ///<输出2.5V
#define POWER_LEVEL_3V3     3   ///<输出3.3V
/** @} */

#ifdef __cplusplus
extern "C"
{
#endif

/**
  * @brief  初始化USB设备，获取设备连接数和每个设备的设备号，必须调用，程序运行后调用一次即可，无需重复调用
  * @param[out]  pDevHandle 设备号存储地址，每个设备返回唯一固定不变的设备号
  * @retval 扫描到的设备数量，若为0，表示没有扫描到设备
  */
#ifdef __OS_ANDROID_BACK
int WINAPI USB_ScanDevice(int *pDevHandle,int *pFd,int DevNum);
#else
int  WINAPI USB_ScanDevice(int *pDevHandle);
#endif

/**
 * @brief  打开设备，必须调用，否则其他函数可能会工作不正常，只需要调用一次即可
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @return 打开设备的状态
 * @retval 0 打开设备失败
 * @retval 1 打开设备成功
 */
unsigned char WINAPI USB_OpenDevice(int DevHandle);

/**
  * @brief  关闭已经被打开的设备，程序退出前调用一次即可
  * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
  * @return 关闭设备的状态
  * @retval 0 关闭设备失败
  * @retval 1 关闭设备成功
  */
unsigned char WINAPI USB_CloseDevice(int DevHandle);

/**
 * @brief  软件复位设备，复位后需要重新调用 @ref USB_ScanDevice ， @ref USB_OpenDevice 函数，程序所使用的其他外设需要重新初始化配置
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @return 复位设备状态
 * @retval 0 复位设备失败
 * @retval 1 复位设备成功
 */
unsigned char WINAPI USB_ResetDevice(int DevHandle);

/**
 * @brief  重新连接设备，再检测到USB断开连接后（函数返回值为负数），重新连接设备
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @return 重连设备状态
 * @retval 0 重连设备失败
 * @retval 1 重连设备成功
 */
unsigned char WINAPI USB_RetryConnect(int DevHandle);

/**
 * @brief  重新连接设备，再检测到USB断开连接后（函数返回值为负数），重新连接设备
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  TimeOutMs 等待USB恢复重连超时时间，单位为ms
 * @return 重连设备状态
 * @retval 0 重连设备失败
 * @retval 1 重连设备成功
 */
unsigned char WINAPI USB_WaitResume(int DevHandle,int TimeOutMs);

/**
  * @brief  获取设备信息，比如设备名称，固件版本号，设备序号，设备功能说明字符串等
  * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
  * @param  pDevInfo 设备信息结构体指针
  * @param  pFunctionStr 设备功能说明字符串
  * @return 获取设备信息的状态
  * @retval 0 获取设备信息失败
  * @retval 1 获取设备信息成功
  */
unsigned char WINAPI DEV_GetDeviceInfo(int DevHandle,DEVICE_INFO *pDevInfo,char *pFunctionStr);
/**
  * @brief  获取设备硬件信息，比如设备型号，生产日期，主芯片型号等
  * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
  * @param  pHardwareInfo 设备硬件信息存储结构体指针
  * @return 获取设备硬件信息的状态
  * @retval 0 获取设备硬件信息失败
  * @retval 1 获取设备硬件信息成功
  * @attention 老版本设备由于没有写入硬件信息到设备，所以无法获取到硬件信息
  */
unsigned char WINAPI DEV_GetHardwareInfo(int DevHandle, HARDWARE_INFO *pHardwareInfo);

/**
 * @brief  擦出用户存储区数据，在写入新的数据之前需要擦出，否则写入的数据可能不正确
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @return 擦出数据状态
 * @retval 0 擦出用户区数据失败
 * @retval 1 擦出用户区数据成功
 */
unsigned char WINAPI DEV_EraseUserData(int DevHandle);

/**
 * @brief  擦出指定扇区的用户数据
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  StartAddr 扇区起始地址
 * @return 擦出数据状态
 * @retval 0 擦出用户区数据失败
 * @retval 1 擦出用户区数据成功
 */
unsigned char WINAPI DEV_EraseUserDataSector(int DevHandle, int StartAddr);

/**
  * @brief  向用户区域写入用户自定义数据，写入数据之前需要调用擦出函数将数据擦出
  * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
  * @param  OffsetAddr 数据写入偏移地址，起始地址为0x00，用户区总容量为0x10000字节，也就是64KBye
  * @param[in]  pWriteData 用户数据缓冲区指针
  * @param  DataLen 待写入的数据字节数
  * @return 写入用户自定义数据状态
  * @retval 0 写入用户区数据失败
  * @retval 1 写入用户区数据成功
  */
unsigned char WINAPI DEV_WriteUserData(int DevHandle,int OffsetAddr,unsigned char *pWriteData,int DataLen);

/**
  * @brief  从用户自定义数据区读出数据
  * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
  * @param  OffsetAddr 数据读出偏移地址，起始地址为0x00，用户区总容量为0x10000字节，也就是64KBye
  * @param[out]  pReadData 存储用户数据缓冲区指针
  * @param  DataLen 待读出的数据字节数
  * @return 读出用户自定义数据的状态
  * @retval 0 读出用户区数据失败
  * @retval 1 读出用户区数据成功
  */
unsigned char WINAPI DEV_ReadUserData(int DevHandle,int OffsetAddr,unsigned char *pReadData,int DataLen);

/**
  * @brief  设置适配器接口输出指定电压，该函数只适用于UTA0302
  * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
  * @param  PowerLevel 输出电压值\n
  * @ref POWER_LEVEL_1V8 接口电压设置为1.8V\n
  * @ref POWER_LEVEL_2V5 接口电压设置为2.5V\n
  * @ref POWER_LEVEL_3V3 接口电压设置为3.3V
  * @return 设置输出电压状态
  * @retval 0 设置电压失败
  * @retval 1 设置电压成功
  * @attention 该函数只适用于UTA0302，其他设备调用该函数无任何作用
  */
unsigned char WINAPI DEV_SetPowerLevel(int DevHandle,char PowerLevel);

/**
  * @brief  获取CAN或者LIN的当前时间戳原始值
  * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
  * @param  BusType 总线类型，0-获取CAN总线时间戳，1-获取LIN总线时间戳
  * @param[out]  pTimestamp 时间戳指针
  * @return 获取时间戳状态
  * @retval 0 获取时间戳失败
  * @retval 1 获取时间戳成功
  */
unsigned char WINAPI DEV_GetTimestamp(int DevHandle,char BusType,unsigned int *pTimestamp);

/**
  * @brief  复位CAN和LIN时间戳，需要在初始化CAN和LIN之后调用
  * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
  * @return 复位时间戳状态
  * @retval 0 复位时间戳失败
  * @retval 1 复位时间戳成功
  */
unsigned char WINAPI DEV_ResetTimestamp(int DevHandle);


/**
 * @brief  获取当前库编译日期和时间
 * @param[out]  pDateTime 存储库编译日期时间字符串指针
 * @return 获取库编译日期时间状态
 * @retval 0 获取日期时间失败
 * @retval 1 获取日期时间成功
 */
unsigned char WINAPI DEV_GetDllBuildTime(char* pDateTime);
#ifdef __cplusplus
}
#endif


/** @} usb_device*/
#endif



/**
 * @file   usb2pwm.h
 * @brief  USB转PWM接口函数和相关数据类型定义，也包含PWM监控相关函数和数据类型定义
 * @author wdluo(wdluo@toomoss.com)
 * @version 1.0
 * @date 2022-10-05
 * @copyright Copyright (c) 2022 重庆图莫斯电子科技有限公司
 */
#ifndef __USB2PWM_H_
#define __USB2PWM_H_

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
 *@defgroup USB转PWM
 * @{
 * @brief USB转PWM接口函数和数据类型定义，也包含PWM监控相关函数和数据类型定义
*/

/**
 * @brief  PWM初始化结构体定义
 */
typedef struct _PWM_CONFIG{
  unsigned short Prescaler[8];  ///<预分频器
  unsigned short Precision[8];  ///<占空比调节精度,实际频率 = PWM主频/(Prescaler*Precision)
  unsigned short Pulse[8];      ///<占空比，实际占空比=(Pulse/Precision)*100%
  unsigned short Phase[8];      ///<波形相位，取值0到Precision-1
  unsigned char  Polarity[8];   ///<波形极性，取值0或者1
  unsigned char  ChannelMask;   ///<通道号，若要使能某个通道，则对应位为1，最低位对应通道0
}PWM_CONFIG,*PPWM_CONFIG;

/**
 * @brief  PWM监控数据结构定义
 */
typedef struct _PWM_CAP_DATA{
  unsigned short LowValue;///<低电平时间，单位为初始化时传入的时间精度值
  unsigned short HighValue;///<高电平时间，单位为初始化时传入的时间精度值
}PWM_CAP_DATA;

/**
 *@name 函数返回错误值宏定义
 *@brief 函数调用出错后返回值定义
 *@{
*/
#define PWM_SUCCESS             (0)   ///<函数执行成功
#define PWM_ERR_NOT_SUPPORT     (-1)  ///<适配器不支持该函数
#define PWM_ERR_USB_WRITE_FAIL  (-2)  ///<USB写数据失败
#define PWM_ERR_USB_READ_FAIL   (-3)  ///<USB读数据失败
#define PWM_ERR_CMD_FAIL        (-4)  ///<命令执行失败
#define PWM_ERR_ARG				(-5)  ///<传入函数参数异常
/** @} */

#ifdef __cplusplus
extern "C"
{
#endif
//UTA0101 UTA0201 UTA0301 UTA0302引脚定义参考引脚定义说明文档，主频为200M
//UTA0403 UTA0402 UTA0401  LIN1对应的PWM通道为0x40,LIN2对应的PWM通道为0x80，主频84M
//UTA0503  LIN1对应的PWM通道为0x02,LIN2对应的PWM通道为0x04，主频220M
//UTA0504  LIN1->0x01 LIN2->0x02 LIN3->0x04 LIN4->0x08 DO0->0x10 DO1->0x20,主频240M

/**
 * @brief  初始化PWM，使用PWM输出功能时该函数必须调用
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param[in]  pConfig PWM初始化参数结构体指针
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 * @attention 不同型号产品对应的PWM主频时钟：
 * <table>
 * <tr><th> <th>UTA0401/UTA0402/UTA0403/UTA0404/UTA0405/UTA0406 <th>UTA0503   <th>UTA0504 <th>UTA0101/UTA0201/UTA0301/UTA0302 </tr>
 * <tr><th>PWM主频 <td><center>84MHz</center> <td><center>220MHz</center> <td><center>240MHz</center> <td><center>200MHz</center></tr>
 * </table>
 */
int WINAPI PWM_Init(int DevHandle, PWM_CONFIG *pConfig);

/**
 * @brief  使能PWM输出
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  ChannelMask 使能PWM输出的通道，对应bit为1则开启该通道PWM输出
 * @param  RunTimeUs 输出PWM时间，单位为us，若要一直输出，则传入0即可，通过调用 @ref PWM_Stop 停止输出
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI PWM_Start(int DevHandle,unsigned char ChannelMask,unsigned int RunTimeUs);

/**
 * @brief  设置PWM占空比参数
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  ChannelMask 设置PWM占空比的通道，对应bit为1则修改对应通道的占空比，否则不更改
 * @param[in]  pPulse 占空比参数指针
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI PWM_SetPulse(int DevHandle,unsigned char ChannelMask,unsigned short *pPulse);

/**
 * @brief  设置PWM相位参数值
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  ChannelMask 设置PWM相位的通道，对应bit为1则修改对应通道的相位参数，否则不更改
 * @param  pPhase 相位参数指针
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI PWM_SetPhase(int DevHandle,unsigned char ChannelMask,unsigned short *pPhase);

/**
 * @brief  设置PWM输出频率
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  ChannelMask 设置PWM频率的通道，对应bit为1则修改对应通道的频率参数，否则不更改
 * @param  pPrescaler 预分频参数指针
 * @param  pPrecision 占空比精度指针
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI PWM_SetFrequency(int DevHandle,unsigned char ChannelMask,unsigned short *pPrescaler,unsigned short *pPrecision);

/**
 * @brief  停止PWM输出
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  ChannelMask 需要停止PWM输出的通道，对应bit为1则停止对应通道输出，否则不改变原来的状态
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI PWM_Stop(int DevHandle,unsigned char ChannelMask);

/**
 * @brief  新版本PWM初始化，使用PWM输出功能需要调用该函数
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  ChannelIndex PWM通道号，通道号跟PWM通道对应关系见下面表格
 * @param  Frequency PWM输出频率值，单位为Hz
 * @param  Polarity PWM输出空闲时电平极性，0-空闲时输出低电平，1-空闲时输出高电平
 * @param  Precision 占空比精度值，比如设置为100，则占空比调整精度为1%，设置为1000，调整精度为0.1%
 * @param  DutyCycle 占空比值，实际输出咱空比=DutyCycle/Precision
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 * @attention PWM通道号跟PWM通道对应关系如下：
 * <table>
 * <tr><th>ChannelIndex <th>UTA0401   <th>UTA0402/UTA0403/UTA0404/UTA0405/UTA0503 <th>UTA0504 <th>UTA0101/UTA0201/UTA0301/UTA0302 </tr>
 * <tr><td>0 <td>LIN1     <td>LIN1    <td>LIN1    <td>PWM_CH0</tr>
 * <tr><td>1 <td>无       <td>LIN2    <td>LIN2    <td>PWM_CH1</tr>
 * <tr><td>2 <td>无       <td>无      <td>LIN3    <td>PWM_CH2</tr>
 * <tr><td>3 <td>无       <td>无      <td>LIN4    <td>PWM_CH3</tr>
 * <tr><td>4 <td>无       <td>无      <td>DO0     <td>PWM_CH4</tr>
 * <tr><td>5 <td>无       <td>无      <td>DO1     <td>PWM_CH5</tr>
 * <tr><td>6 <td>无       <td>无      <td>无      <td>PWM_CH6</tr>
 * <tr><td>7 <td>无       <td>无      <td>无      <td>PWM_CH7</tr>
 * </table>
 */
int WINAPI PWM2_Init(int DevHandle, unsigned char ChannelIndex,unsigned int Frequency, unsigned char  Polarity,unsigned short Precision, unsigned short DutyCycle);

/**
 * @brief  启动已经初始化后的PWM通道
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  ChannelIndex PWM通道索引号，具体可以参考 @ref PWM2_Init
 * @param  RunTimeUs PWM输出时间，单位为微秒，若需要一直输出，则传入0即可
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI PWM2_Start(int DevHandle, unsigned char ChannelIndex, unsigned int RunTimeUs);

/**
 * @brief  设置PWM占空比
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  ChannelIndex PWM通道索引号，具体可以参考 @ref PWM2_Init
 * @param  DutyCycle 咱空比值，输出占空比=DutyCycle/Precision
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI PWM2_SetDutyCycle(int DevHandle, unsigned char ChannelIndex, unsigned short DutyCycle);

/**
 * @brief  设置PWM输出瓶率
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  ChannelIndex PWM通道索引号，具体可以参考 @ref PWM2_Init
 * @param  Frequency 输出频率值，单位为Hz
 * @param  Precision 占空比精度值
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI PWM2_SetFrequency(int DevHandle, unsigned char ChannelIndex, unsigned int Frequency, unsigned short Precision);

/**
 * @brief  停止PWM输出
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  ChannelIndex PWM通道索引号，具体可以参考 @ref PWM2_Init
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI PWM2_Stop(int DevHandle, unsigned char ChannelIndex);

/**
 * @brief  PWM监控初始化，PWM频率=1000000/((PWMData.LowValue+PWMData.HighValue)*TimePrecUs)，PWM占空比=PWMData.HighValue/(PWMData.LowValue+PWMData.HighValue)
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  Channel 监控通道号，0-LIN1，1-LIN2
 * @param  TimePrecUs 监控精度，单位为微秒，推荐设置为1，10，100，若被测信号频率较小，该值建议设置大一点
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败
 */
int WINAPI PWM_CAP_Init(int DevHandle, unsigned char Channel,unsigned char TimePrecUs);

/**
 * @brief  获取PWM监控到的最新数据值
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  Channel 监控通道号，0-LIN1，1-LIN2
 * @param[out]  pPWMData 监控到的PWM数据结构体指针
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败 
 */
int WINAPI PWM_CAP_GetData(int DevHandle, unsigned char Channel,PWM_CAP_DATA *pPWMData);

/**
 * @brief  获取PWM监控到的所有数据值
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  Channel 监控通道号，0-LIN1，1-LIN2
 * @param[out]  pPWMData 监控到的PWM数据结构体指针
 * @return 函数执行状态
 * @retval >=0 获取到的PWM数据帧数
 * @retval <0 函数调用失败
 */
int WINAPI PWM_CAP_GetAllData(int DevHandle, unsigned char Channel, PWM_CAP_DATA* pPWMData);

/**
 * @brief  停止PWM数据监控
 * @param  DevHandle 设备号，通过调用 @ref USB_ScanDevice 获取
 * @param  Channel 监控通道号，0-LIN1，1-LIN2
 * @return 函数执行状态
 * @retval =0 函数执行成功
 * @retval <0 函数调用失败 
 */
int WINAPI PWM_CAP_Stop(int DevHandle, unsigned char Channel);
#ifdef __cplusplus
}
#endif

/** @} USB转PWM*/
#endif


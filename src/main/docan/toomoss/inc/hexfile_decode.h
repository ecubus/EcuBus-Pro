/**
 * @file   hexfile_decode.h
 * @brief  HEX,S19文件解析相关函数
 * @author wdluo(wdluo@toomoss.com)
 * @version 1.0
 * @date 2022-10-10
 * @copyright Copyright (c) 2022 重庆图莫斯电子科技有限公司
 */
#ifndef __HEXFILE_DECODE_H_
#define __HEXFILE_DECODE_H_

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
 *@defgroup HEX_DECODE
 * @{
 * @brief HEX,S19文件解析相关函数
*/

/**
 * @brief  文件数据块结构体定义
 */
typedef struct _HEX_FILE_BLOCK
{
    unsigned int  StartAddr;///<数据块起始地址
    unsigned int  DataNum;  ///<数据块字节数
    unsigned char *pData;   ///<数据块数据存储指针
}HEX_FILE_BLOCK,*PHEX_FILE_BLOCK;

/**
 *@name 存储类型定义
 *@brief HEX文件中一个地址单元存储的数据字节数定义
 *@{
*/
#define MEMTYPE_UINT8    1  ///<1个地址单元存储1字节数据
#define MEMTYPE_UINT16   2  ///<1个地址单元存储2字节数据
#define MEMTYPE_UINT32   4  ///<1个地址单元存储4字节数据
/** @} */

#ifdef __cplusplus
extern "C"
{
#endif
    int WINAPI hexfile_load_file(const char *filename, char *fileBuf);
    int WINAPI hexfile_convert_s19(char *fileBuf, int lenFileBuf, HEX_FILE_BLOCK *pHexFileBlock, int maxBlockNum, char memType);
    int WINAPI hexfile_convert_ihx(char *fileBuf, int lenFileBuf, HEX_FILE_BLOCK *pHexFileBlock, int maxBlockNum, char memType);
    int WINAPI hexfile_convert_txt(char *fileBuf, int lenFileBuf, HEX_FILE_BLOCK *pHexFileBlock, int maxBlockNum, char memType);
    int WINAPI hexfile_free_data(HEX_FILE_BLOCK *pHexFileBlock, int maxBlockNum);
    int WINAPI hexfile_save_image(const char *filename,HEX_FILE_BLOCK *pHexFileBlock, int maxBlockNum, char memType,char fillBytes);
    int WINAPI hexfile_convert_image(char *pOutData,HEX_FILE_BLOCK *pHexFileBlock, int maxBlockNum, char memType,char fillBytes);
#ifdef __cplusplus
}
#endif

/** @} */
#endif


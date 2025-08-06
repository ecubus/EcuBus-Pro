#ifndef __DELAY_H
#define __DELAY_H

#ifndef OS_UNIX
#include <Windows.h>
#else
#include <unistd.h>
#ifndef WINAPI
#define WINAPI
#endif
#endif

#ifdef __cplusplus
extern "C"
{
#endif
void WINAPI delay_us(long us);
void WINAPI delay_ms(long ms);
void WINAPI sleep_ms(long ms);
#ifdef __cplusplus
}
#endif
#endif


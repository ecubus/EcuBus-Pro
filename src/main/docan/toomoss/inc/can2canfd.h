#ifndef __CAN2CANFD_H_
#define __CAN2CANFD_H_

#include "usb2can.h"
#include "usb2canfd.h"

void CAN2CANFD(CAN_MSG *pCANMsg,CANFD_MSG *pCANFDMsg,int len);
void CANFD2CAN(CANFD_MSG *pCANFDMsg,CAN_MSG *pCANMsg,int len);

#endif


%module xmlpp

%header %{
#include <stdlib.h>
#include "usb2can.h"
#include "usb2canfd.h"
#include "usb_device.h"
%}


%wrapper %{

%}

%include <stdint.i>
%include <windows.i>



%include <cpointer.i>

// %pointer_class(unsigned long,JSUINT64)
// %pointer_class(UINT64,TimeStamp)
// %pointer_class(long,JSINT64)
// %pointer_class(unsigned int,JSUINT32)



%include <carrays.i>

%array_class(int, I32Array);
%array_class(unsigned int, U32Array);
// %array_class(BYTE, ByteArray);
// %array_class(ZCAN_Receive_Data, ReceiveDataArray);
// %array_class(ZCAN_ReceiveFD_Data, ReceiveFDDataArray);

%include <usb2can.h>
%include <usb2canfd.h>
%include <usb_device.h>







%inline %{
void LoadDll(const char* path) {
#ifdef _WIN32
  SetDllDirectory(path);
#endif
}

%}



%init %{

extern void CreateTSFN(const Napi::CallbackInfo &info);
extern void FreeTSFN(const Napi::CallbackInfo &info);
extern void SendCANMsg(const Napi::CallbackInfo& info);


do {
  Napi::PropertyDescriptor pd = Napi::PropertyDescriptor::Function("CreateTSFN", CreateTSFN);
  NAPI_CHECK_MAYBE(exports.DefineProperties({
    pd
  }));
} while (0);

do {
  Napi::PropertyDescriptor pd = Napi::PropertyDescriptor::Function("FreeTSFN", FreeTSFN);
  NAPI_CHECK_MAYBE(exports.DefineProperties({
	pd
  }));
} while (0);
do{
  Napi::PropertyDescriptor pd = Napi::PropertyDescriptor::Function("SendCANMsg", SendCANMsg);
  NAPI_CHECK_MAYBE(exports.DefineProperties({
	pd
  }));
} while (0);

%}

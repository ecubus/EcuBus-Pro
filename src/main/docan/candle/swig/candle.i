%module xmlpp

%header %{
#include <windows.h>
#include <stdlib.h>
#include "candle_defs.h"
#include "candle.h"
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

%pointer_class(candle_device_t,DevicePointer)
%pointer_class(candle_list_handle,ListPointer)


%include <carrays.i>

%array_class(uint8_t, U8Array);

//candle_device_t
%array_class(candle_device_t, DeviceArray);
%array_class(uint16_t, CharArray);

// %array_class(BYTE, ByteArray);
// %array_class(ZCAN_Receive_Data, ReceiveDataArray);
// %array_class(ZCAN_ReceiveFD_Data, ReceiveFDDataArray);
%include "candle_defs.h"



%include "candle.h"







%inline %{


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
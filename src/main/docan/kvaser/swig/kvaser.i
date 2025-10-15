%module xmlpp

%header %{
#include <windows.h>
#include <stdlib.h>
#include "canlib.h"
#include "canlib.h"
%}


%wrapper %{

%}

%include <stdint.i>
%include <windows.i>

/*
cantp_status __stdcall CANTP_MsgDataInit_2016(
	cantp_msg* msg_buffer,
	uint32_t can_id,
	cantp_can_msgtype can_msgtype,
	uint32_t data_length,
	const void* data,
	cantp_netaddrinfo* netaddrinfo _DEF_ARG);
*/
// %include "./buffer.i"
// %typemap(in)        (uint32_t data_length,const void* data) = (const size_t buffer_len,const void* buffer_data);
// %typemap(typecheck) (uint32_t data_length,const void* data) = (const size_t buffer_len,const void* buffer_data);

/*
canStatus CANLIBAPI canGetErrorText(canStatus err, char *buf, unsigned int bufsiz);
*/
%include "./buffer1.i"
%typemap(in)        (char *buf, unsigned int bufsiz) = (const void* buffer_data, const size_t buffer_len);
%typemap(typecheck) (char *buf, unsigned int bufsiz) = (const void* buffer_data, const size_t buffer_len);
/*
canStatus CANLIBAPI canIoCtl(const CanHandle hnd,
                             unsigned int func,
                             void *buf,
                             unsigned int buflen);
*/
%typemap(in)        (void *buf,unsigned int buflen) = (const void* buffer_data, const size_t buffer_len);
%typemap(typecheck) (void *buf,unsigned int buflen) = (const void* buffer_data, const size_t buffer_len);
/*
canStatus CANLIBAPI canGetChannelData(int channel,
                                      int item,
                                      void *buffer,
                                      size_t bufsize);
*/
%typemap(in)        (void *buffer,size_t bufsize) = (const void* buffer_data, const size_t buffer_len);
%typemap(typecheck) (void *buffer,size_t bufsize) = (const void* buffer_data, const size_t buffer_len);


%include <cpointer.i>

%pointer_class(unsigned long,JSUINT64)
%pointer_class(KVINT64,TimeStamp)
%pointer_class(long,JSINT64)
%pointer_class(unsigned int,JSUINT32)
%pointer_class(int,JSINT32)


%include <carrays.i>

%array_class(uint8_t, ByteArray);

%include <canstat.h>
%include <canlib.h>




%inline %{
void LoadDll(const char* path) {
  SetDllDirectory(path);
}

%}



%init %{

extern void CreateTSFN(const Napi::CallbackInfo &info);
extern void FreeTSFN(const Napi::CallbackInfo &info);
extern Napi::Value StartPeriodSend(const Napi::CallbackInfo &info);
extern void StopPeriodSend(const Napi::CallbackInfo &info);
extern void ChangeData(const Napi::CallbackInfo &info);


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

do {
  Napi::PropertyDescriptor pd = Napi::PropertyDescriptor::Function("StartPeriodSend", StartPeriodSend);
  NAPI_CHECK_MAYBE(exports.DefineProperties({
	pd
  }));
} while (0);

do {
  Napi::PropertyDescriptor pd = Napi::PropertyDescriptor::Function("StopPeriodSend", StopPeriodSend);
  NAPI_CHECK_MAYBE(exports.DefineProperties({
	pd
  }));
} while (0);

do {
  Napi::PropertyDescriptor pd = Napi::PropertyDescriptor::Function("ChangeData", ChangeData);
  NAPI_CHECK_MAYBE(exports.DefineProperties({
	pd
  }));
} while (0);
%}

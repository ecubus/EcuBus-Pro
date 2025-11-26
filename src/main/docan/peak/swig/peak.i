%module xmlpp

%header %{
#include <windows.h>
#include <stdlib.h>
#include "PCAN-ISO-TP_2016.h"
#include "PCANBasic.h"
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
%include "./buffer.i"
%typemap(in)        (uint32_t data_length,const void* data) = (const size_t buffer_len,const void* buffer_data);
%typemap(typecheck) (uint32_t data_length,const void* data) = (const size_t buffer_len,const void* buffer_data);

/*
cantp_status __stdcall CANTP_GetValue_2016(
	cantp_handle channel,
	cantp_parameter parameter,
	void* buffer,
	uint32_t buffer_size);
*/
%include "./buffer1.i"
%typemap(in)        (void* buffer,uint32_t buffer_size) = (const void* buffer_data, const size_t buffer_len);
%typemap(typecheck) (void* buffer,uint32_t buffer_size) = (const void* buffer_data, const size_t buffer_len);
/*cantp_status __stdcall CANTP_GetErrorText_2016(
	cantp_status error,
	uint16_t language,
	char* buffer,
	uint32_t buffer_size);
*/
%typemap(in)        (char* buffer,uint32_t buffer_size) = (const void* buffer_data, const size_t buffer_len);
%typemap(typecheck) (char* buffer,uint32_t buffer_size) = (const void* buffer_data, const size_t buffer_len);


%include <cpointer.i>

%pointer_class(uint64_t,TimeStamp)

%include <carrays.i>

%array_class(uint8_t, ByteArray);


%include <PCAN-ISO-TP_2016.h>
%include <PCANBasic.h>




// %include <cmalloc.i>

//
// %pointer_class(cantp_msg,cantp_msg) 

// %malloc(uint8_t,U8)
// %free(uint8_t,U8)



%inline %{
void LoadDll(const char* path) {
  SetDllDirectory(path);
}

cantp_msgdata_isotp* GetMsgDataIsoTp(cantp_msg* msg) {
  return msg->msgdata.isotp;
}

cantp_msgdata* GetMsgDataAny(cantp_msg* msg) {
  return msg->msgdata.any;
}

cantp_msgdata_can* GetMsgDataCan(cantp_msg* msg) {
  return msg->msgdata.can;
}

cantp_msgdata_canfd* GetMsgDataCanFd(cantp_msg* msg) {
  return msg->msgdata.canfd;
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

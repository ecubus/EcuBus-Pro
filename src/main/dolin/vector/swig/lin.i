%module vector

%header %{
#include <windows.h>
#include <winnt.h>
#include <stdlib.h>
#include "vxlapi.h"
#include <napi.h>
%}


%wrapper %{

%}

%include <windows.i>
%include <stdint.i>
%include <carrays.i>
%include <cpointer.i>
%include <vxlapi.h>

%pointer_class(unsigned int, UINT32)
%pointer_class(unsigned short, UINT16)
%pointer_class(XLportHandle, XLPORTHANDLE)
%pointer_class(XLaccess, XLACCESS)

%array_class(XLchannelConfig, CHANNEL_CONFIG);
%array_class(XLstatus, xlstatus);
%array_class(unsigned char, UINT8ARRAY)
%array_class(XLevent, XLEVENT);
%array_class(XLcanRxEvent, XLCANRXEVENT);

%inline %{
void LoadDll(const char* path) {
  SetDllDirectory(path);
}

%}


%init %{

extern void CreateTSFN(const Napi::CallbackInfo &info);
extern void FreeTSFN(const Napi::CallbackInfo &info);
extern Napi::String JSxlGetErrorString(const Napi::CallbackInfo &info);


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
  Napi::PropertyDescriptor pd = Napi::PropertyDescriptor::Function("JSxlGetErrorString", JSxlGetErrorString);
  NAPI_CHECK_MAYBE(exports.DefineProperties({
	pd
  }));
} while (0);

%}


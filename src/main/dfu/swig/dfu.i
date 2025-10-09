%module  vsomeip

%header %{
#include <windows.h>

#define VSOMEIP_INTERNAL_SUPPRESS_DEPRECATED
#include <CubeProgrammer_API.h>
%}


%wrapper %{

%}

%include <stdint.i>
%include <windows.i>
%include <CubeProgrammer_API.h>
%include <carrays.i>
%include <cpointer.i>

%array_class(dfuDeviceInfo, dfuDeviceInfoArray);
%pointer_class(dfuDeviceInfoPtr, dfuDeviceInfoPtr)

%include "./buffer1.i"
%typemap(in)        (char *data, uint32_t length) = (const void* buffer_data, const size_t buffer_len);
%typemap(typecheck) (char *data, uint32_t length) = (const void* buffer_data, const size_t buffer_len);



%inline %{
void LoadDll(const char* path) {
  SetDllDirectory(path);
}

%}



%init %{

%}

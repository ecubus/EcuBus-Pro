
#include "napi.h"
#include <chrono>
#include <thread>
#include <windows.h>
#include <map>
#include <cstring>
#include "vxlapi.h"


// Data structure representing our thread-safe function context
struct TsfnContext {
  std::thread nativeThread;  
  bool closed;                // Flag to signal thread termination
  Napi::ThreadSafeFunction tsfn;
  XLhandle xlHandle;          // Vector handle for notification
  HANDLE stopEvent;
  XLportHandle portHandle;    // Vector port handle
};

// Map to store the tsfn context by name
std::map<std::string, TsfnContext *> tsfnContextMap;

// The thread entry point
void threadEntry(TsfnContext *context);
void FinalizerCallback(Napi::Env env, void *finalizeData, TsfnContext *context);


Napi::String JSxlGetErrorString(const Napi::CallbackInfo &info){
  Napi::Env env = info.Env();
  XLstatus status = info[0].As<Napi::Number>().Uint32Value();
  XLstringType errorString = xlGetErrorString(status);
  Napi::String result = Napi::String::New(env, errorString);
  return result;
}
// Creates the thread-safe function and native thread
void CreateTSFN(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  
  // Extract port handle from parameters - directly use Uint64Value
  XLportHandle portHandle = info[0].As<Napi::Number>().Uint32Value();
  Napi::String name = info[1].As<Napi::String>();
  
  // Construct context data
  auto context = new TsfnContext();

  context->portHandle = portHandle;
  context->stopEvent = CreateEvent(NULL, FALSE, FALSE, NULL);
  // Create a new ThreadSafeFunction
  context->tsfn = Napi::ThreadSafeFunction::New(
      env,                          // Environment
      info[2].As<Napi::Function>(), // JS function from caller
      name.Utf8Value().data(),      // Resource name
      0,                            // Max queue size
      1,                            // Initial thread count
      context,                       // Context,
      FinalizerCallback,
      (void *)nullptr               // Finalizer data
  );
  
  //create handle

  // Set up Vector notification
  XLstatus status = xlSetNotification(portHandle, &context->xlHandle, 1);
  if (status != XL_SUCCESS) {
    char errorText[256];
    // Get error string from Vector API
    XLstringType errorString = xlGetErrorString(status);
    std::snprintf(errorText, sizeof(errorText), "xlSetNotification failed: %s", errorString);
    Napi::Error::New(env, errorText).ThrowAsJavaScriptException();
    delete context;
    return;
  }
  
  // Start the thread
  context->nativeThread = std::thread(threadEntry, context);
  
  // Store by name
  tsfnContextMap[name.Utf8Value()] = context;
}

void FreeTSFN(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  Napi::String name = info[0].As<Napi::String>();
  auto it = tsfnContextMap.find(name.Utf8Value());
  if (it != tsfnContextMap.end()) {
    TsfnContext *context = it->second;
    SetEvent(context->stopEvent);
    // Release the thread-safe function. This decrements the internal thread
    // count, and will perform finalization since the count will reach 0.
    context->tsfn.Release();
    tsfnContextMap.erase(it);
  }
}

// The thread entry point
void threadEntry(TsfnContext *context) {
  DWORD result;
  HANDLE handles[2] = {context->xlHandle, context->stopEvent};
  while (1) {
    result = WaitForMultipleObjects(2, handles, FALSE, INFINITE);
    if (result == WAIT_OBJECT_0) {
      context->tsfn.BlockingCall();
    }else if(result == WAIT_OBJECT_0 + 1){
      break;
    }
  }
}

void FinalizerCallback(Napi::Env env, void *finalizeData,
                       TsfnContext *context) {
  
  // Join the thread
  context->nativeThread.join();
  // free event
  CloseHandle(context->xlHandle);
  CloseHandle(context->stopEvent);
  // Clean up the context.
  delete context;
}

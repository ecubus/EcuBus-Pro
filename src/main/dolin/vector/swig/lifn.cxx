#include "vxlapi.h"
#include "napi.h"
#include <chrono>
#include <thread>
#include <windows.h>
#include <map>
#include <cstring>

// Data structure representing our thread-safe function context.
struct TsfnContext {
  // Native thread
  std::thread nativeThread;
  HANDLE rEvent;
  HANDLE stopEvent;
  Napi::ThreadSafeFunction tsfn;
  
};

//a std::map store the tsfn context
std::map<std::string, TsfnContext *> tsfnContextMap;

// The thread entry point. This takes as its arguments the specific
// threadsafe-function context created inside the main thread.
void threadEntry(TsfnContext *context);

// The thread-safe function finalizer callback. This callback executes
// at destruction of thread-safe function, taking as arguments the finalizer
// data and threadsafe-function context.
void FinalizerCallback(Napi::Env env, void *finalizeData, TsfnContext *context);

Napi::String JSxlGetErrorString(const Napi::CallbackInfo &info){
  Napi::Env env = info.Env();
  XLstatus status = info[0].As<Napi::Number>().Uint32Value();
  XLstringType errorString = xlGetErrorString(status);
  Napi::String result = Napi::String::New(env, errorString);
  return result;
}

// Exported JavaScript function. Creates the thread-safe function and native
// thread. Promise is resolved in the thread-safe function's finalizer.
void CreateTSFN(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  // HLINCLIENT handle = (HLINCLIENT)info[0].As<Napi::Number>().Uint32Value();
  Napi::String name = info[1].As<Napi::String>();
  // Construct context data
  auto testData = new TsfnContext();
  testData->rEvent = CreateEvent(NULL, FALSE, FALSE, NULL);
  testData->stopEvent = CreateEvent(NULL, FALSE, FALSE, NULL);
  // TLINError status =
  //     LIN_SetClientParam(handle, clpOnReceiveEventHandle,(DWORD)testData->rEvent);
  // if (status != errOK) {
  if (0) {
    char errorText[256];
    // LIN_GetErrorText(status,9, errorText, sizeof(errorText));
    Napi::Error::New(env, errorText).ThrowAsJavaScriptException();
    return;
  }
  // Create a new ThreadSafeFunction.
  testData->tsfn = Napi::ThreadSafeFunction::New(
      env,                          // Environment
      info[2].As<Napi::Function>(), // JS function from caller
      name.Utf8Value().data(),      // Resource name
      0,                            // Max queue size (0 = unlimited).
      1,                            // Initial thread count
      testData,                     // Context,
      FinalizerCallback,            // Finalizer
      (void *)nullptr               // Finalizer data
  );
  testData->nativeThread = std::thread(threadEntry, testData);
  //store by name
  tsfnContextMap[name.Utf8Value()] = testData;
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

// The thread entry point. This takes as its arguments the specific
// threadsafe-function context created inside the main thread.
void threadEntry(TsfnContext *context) {
  DWORD result;
  HANDLE handles[2] = {context->rEvent, context->stopEvent};
  while (1) {
    result = WaitForMultipleObjects(2, handles, FALSE, INFINITE);
    if (result == WAIT_OBJECT_0) {
      context->tsfn.BlockingCall();
    }else if(result == WAIT_OBJECT_0 + 1){
      break;
    }
  }
  // Release the thread-safe function. This decrements the internal thread
  // count, and will perform finalization since the count will reach 0.
}

void FinalizerCallback(Napi::Env env, void *finalizeData,
                       TsfnContext *context) {
  
  // Join the thread
  context->nativeThread.join();
  // free event
  CloseHandle(context->rEvent);
  CloseHandle(context->stopEvent);
  // Clean up the context.
  delete context;
}
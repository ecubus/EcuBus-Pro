#include "zlgcan.h"
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
  bool closed;
  Napi::ThreadSafeFunction tsfn;
  Napi::ThreadSafeFunction tsfnfd;
   Napi::ThreadSafeFunction tserror;
  CHANNEL_HANDLE channel;
  
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

// Exported JavaScript function. Creates the thread-safe function and native
// thread. Promise is resolved in the thread-safe function's finalizer.
void CreateTSFN(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  uint32_t a0=info[0].As<Napi::Number>().Uint32Value();
  uint32_t a1=info[1].As<Napi::Number>().Uint32Value();
  CHANNEL_HANDLE handle = (CHANNEL_HANDLE)(((uint64_t)a1<<32)|a0);
  Napi::String name = info[2].As<Napi::String>();
  Napi::String nameFd = info[3].As<Napi::String>();
  // Construct context data
  auto testData = new TsfnContext();
  testData->closed=false;
  testData->channel = handle;
  // Create a new ThreadSafeFunction.
  
   testData->tsfn = Napi::ThreadSafeFunction::New(
      env,                          // Environment
      info[4].As<Napi::Function>(), // JS function from caller
      name.Utf8Value().data(),      // Resource name
      0,                            // Max queue size (0 = unlimited).
      1,                            // Initial thread count
      testData                     // Context,
    
  );
  testData->tsfnfd = Napi::ThreadSafeFunction::New(
      env,                          // Environment
      info[5].As<Napi::Function>(), // JS function from caller
      nameFd.Utf8Value().data(),      // Resource name
      0,                            // Max queue size (0 = unlimited).
      1,                            // Initial thread count
      testData                     // Context
  );
  Napi::String nameError = info[6].As<Napi::String>();
  testData->tserror = Napi::ThreadSafeFunction::New(
      env,                          // Environment
      info[7].As<Napi::Function>(), // JS function from caller
      nameError.Utf8Value().data(),      // Resource name
      0,                            // Max queue size (0 = unlimited).
      1,                            // Initial thread count
      testData                     // Context
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
    context->closed=true;
    context->nativeThread.join();

    context->tsfn.Release();
    context->tsfnfd.Release();
    context->tserror.Release();

    delete context;
    tsfnContextMap.erase(it);
  }
}

// The thread entry point. This takes as its arguments the specific
// threadsafe-function context created inside the main thread.
void threadEntry(TsfnContext *context) {
  auto callback = []( Napi::Env env, Napi::Function jsCallback, UINT* value ) {
      // Transform native data into JS data, passing it to the provided
      // `jsCallback` -- the TSFN's JavaScript function.
      jsCallback.Call( {Napi::Number::New( env, *value )} );

      // We're finished with the data.
      delete value;
  };
  UINT numCan=0;
  UINT numCanFd=0;
  ZCAN_CHANNEL_ERR_INFO err;
  UINT ret=0;
  while (!context->closed) {
    numCan=ZCAN_GetReceiveNum(context->channel,TYPE_CAN);
    if(numCan>0){
      UINT* numCanPtr = new UINT;
      *numCanPtr=numCan;
      context->tsfn.NonBlockingCall(numCanPtr,callback);
    }
   
    numCanFd=ZCAN_GetReceiveNum(context->channel,TYPE_CANFD);
    if(numCanFd>0){
      UINT* numCanFdPtr = new UINT;
      *numCanFdPtr=numCanFd;
      context->tsfnfd.NonBlockingCall(numCanFdPtr,callback);
    }
    // ZCAN_CHANNEL_ERR_INFO err;
    ret=0;
    do{
      err.error_code=0;
      ZCAN_ReadChannelErrInfo(context->channel,&err);
      if(err.error_code!=0){
        ret=err.error_code;
        ZCAN_ResetCAN(context->channel);
      }
    }while(err.error_code!=0&&context->closed==false);



    if(ret!=0){
      UINT* retPtr = new UINT;
      *retPtr=ret;
      context->tserror.NonBlockingCall(retPtr,callback);
    }
      
      // ZCAN_StartCAN(context->channel);
      
      

    

    //delay 100us
    // std::this_thread::sleep_for(std::chrono::microseconds(100));
  }
}


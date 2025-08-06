#include "linlib.h"
#include "napi.h"
#include <chrono>
#include <thread>
#include <windows.h>
#include <map>
#include <cstring>
#include <atomic>

// Data structure representing our thread-safe function context.
struct TsfnContext {
  // Native thread
  std::thread nativeThread;
  
  Napi::ThreadSafeFunction tsfn;
  
  // LIN handle
  LinHandle handle;
  
  // Stop flag
  std::atomic<bool> shouldStop{false};
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
  LinHandle handle = (LinHandle)info[0].As<Napi::Number>().Uint32Value();
  Napi::String name = info[1].As<Napi::String>();

  // Construct context data
  auto context = new TsfnContext();
  context->handle = handle;
  context->shouldStop = false;

  // Create a new ThreadSafeFunction
  context->tsfn = Napi::ThreadSafeFunction::New(
      env,                          // Environment
      info[2].As<Napi::Function>(), // JS function from caller
      name.Utf8Value().data(),      // Resource name
      0,                            // Max queue size (0 = unlimited)
      1,                            // Initial thread count
      context,                      // Context
      FinalizerCallback,            // Finalizer
      (void *)nullptr               // Finalizer data
  );

  // Start the native thread
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
    
    // Set stop flag
    context->shouldStop = true;
    
    // Release the thread-safe function
    context->tsfn.Release();
    
    // Remove from map
    tsfnContextMap.erase(it);
  }
}

// The thread entry point. This takes as its arguments the specific
// threadsafe-function context created inside the main thread.
void threadEntry(TsfnContext *context) {
  LinHandle h = (LinHandle)context->handle;
  unsigned int id;
  unsigned char msg[8];
  unsigned int dlc;
  unsigned int flags;
  LinMessageInfo msgInfo;
  const unsigned long TIMEOUT_MS = 100; // 100ms timeout for periodic checks

  while (1) {
    // Check if we should stop
    if (context->shouldStop) {
      break;
    }

    // Try to read a message with timeout
    LinStatus status = linReadMessageWait(h, &id, msg, &dlc, &flags, &msgInfo, TIMEOUT_MS);
    
    if (status == linOK) {
      // Message received, call the callback
      context->tsfn.BlockingCall([id, msg, dlc, flags, msgInfo](Napi::Env env, Napi::Function jsCallback) {
        // Create JavaScript objects for the message data
        auto msgArray = Napi::ArrayBuffer::New(env, dlc);
        memcpy(msgArray.Data(), msg, dlc);
        
        auto msgInfoObj = Napi::Object::New(env);
        msgInfoObj.Set("timestamp", Napi::Number::New(env, msgInfo.timestamp));
        msgInfoObj.Set("synchBreakLength", Napi::Number::New(env, msgInfo.synchBreakLength));
        msgInfoObj.Set("frameLength", Napi::Number::New(env, msgInfo.frameLength));
        msgInfoObj.Set("bitrate", Napi::Number::New(env, msgInfo.bitrate));
        msgInfoObj.Set("checkSum", Napi::Number::New(env, msgInfo.checkSum));
        msgInfoObj.Set("idPar", Napi::Number::New(env, msgInfo.idPar));

        // Call the JavaScript callback with the message data
        jsCallback.Call({
          Napi::Number::New(env, id),
          msgArray,
          Napi::Number::New(env, dlc),
          Napi::Number::New(env, flags),
          msgInfoObj
        });
      });
    }
    // If status is not linOK, we just continue the loop
    // This handles both timeout (linERR_TIMEOUT) and other errors
  }
}

void FinalizerCallback(Napi::Env env, void *finalizeData, TsfnContext *context) {
  // Join the thread
  context->nativeThread.join();
  
  // Clean up the context
  delete context;
}

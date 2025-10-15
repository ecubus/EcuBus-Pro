#include "canlib.h"
#include "napi.h"
#include "timer.hpp"
#include <chrono>
#include <thread>
#include <windows.h>
#include <map>
#include <cstring>

// Kvaser CAN Bus implementation
class KvaserBus : public BusABC {
public:
  KvaserBus(CanHandle handle) : handle_(handle) {}
  
  void send(const CanMessage& msg) override {
    // Build flags based on message properties
    unsigned int flag = 0;
    
    if (msg.extendId) {
      flag |= canMSG_EXT;  // 0x0004 - Extended (29-bit) identifier
    } else {
      flag |= canMSG_STD;  // 0x0002 - Standard (11-bit) identifier
    }
    
    if (msg.canfd) {
      flag |= canFDMSG_FDF;  // 0x010000 - CAN FD message
      if (msg.brs) {
        flag |= canFDMSG_BRS;  // 0x020000 - Bit rate switch
      }
    }
    
    if (msg.remoteFrame) {
      flag |= canMSG_RTR;  // 0x0001 - Remote request
    }
    
    canWrite(
      handle_,
      msg.arbitration_id,
      const_cast<uint8_t*>(msg.data.data()),
      msg.data.size(),
      flag
    );
    
   
  }
  
private:
  CanHandle handle_;
};

// Data structure representing our thread-safe function context.
struct TsfnContext {
  // Native thread
  std::thread nativeThread;
  HANDLE rEvent;
  HANDLE stopEvent;
  Napi::ThreadSafeFunction tsfn;
  CanHandle handle;
  
};

//a std::map store the tsfn context
std::map<std::string, TsfnContext *> tsfnContextMap;

// Map to store cyclic send tasks by ID
std::map<std::string, ThreadBasedCyclicSendTask*> cyclicTaskMap;
std::map<std::string, KvaserBus*> busMap;

// Counter for generating unique task IDs
static std::atomic<uint64_t> taskIdCounter{0};

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
  CanHandle handle = (CanHandle)info[0].As<Napi::Number>().Uint32Value();
  Napi::String name = info[1].As<Napi::String>();
  // Construct context data
  auto testData = new TsfnContext();
  testData->handle = handle;  // Store the handle
  canStatus status= canIoCtl(handle,canIOCTL_GET_EVENTHANDLE,&testData->rEvent,sizeof(testData->rEvent));
   if (canOK != status) {
    char errorText[256];
    delete testData;
    canGetErrorText(status,errorText, sizeof(errorText));
    Napi::Error::New(env, errorText).ThrowAsJavaScriptException();
    return;
  }
  testData->stopEvent = CreateEvent(NULL, FALSE, FALSE, NULL);
 
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
  std::string nameStr = name.Utf8Value();
  
  // Clean up tsfn context
  auto it = tsfnContextMap.find(nameStr);
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
  // CloseHandle(context->rEvent);
  CloseHandle(context->stopEvent);
  // Clean up the context.
  delete context;
}

// ================================================================
// API: startPeriodSend
// Parameters:
//   name: string - context name to lookup handle
//   message: object - single message object with {id, channel?, data}
//   period: number - period in seconds
//   duration: number - optional duration in seconds (0 = infinite)
// Returns: string - task ID for later modification/stopping
// ================================================================
Napi::Value StartPeriodSend(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  
  // Validate arguments
  if (info.Length() < 3) {
    Napi::TypeError::New(env, "Expected at least 3 arguments: name, message, period")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  std::string name = info[0].As<Napi::String>().Utf8Value();
  Napi::Object msgObj = info[1].As<Napi::Object>();
  double period = info[2].As<Napi::Number>().DoubleValue();
  double duration = info.Length() > 3 ? info[3].As<Napi::Number>().DoubleValue() : 0.0;
  
  // Find context by name
  auto it = tsfnContextMap.find(name);
  if (it == tsfnContextMap.end()) {
    Napi::Error::New(env, "Context not found: " + name).ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  TsfnContext *context = it->second;
  
  // Parse single message
  CanMessage msg;
  msg.arbitration_id = msgObj.Get("id").As<Napi::Number>().Uint32Value();
  msg.extendId = msgObj.Has("extendId") ? msgObj.Get("extendId").As<Napi::Boolean>().Value() : false;
  msg.remoteFrame = msgObj.Has("remoteFrame") ? msgObj.Get("remoteFrame").As<Napi::Boolean>().Value() : false;
  msg.brs = msgObj.Has("brs") ? msgObj.Get("brs").As<Napi::Boolean>().Value() : false;
  msg.canfd = msgObj.Has("canfd") ? msgObj.Get("canfd").As<Napi::Boolean>().Value() : false;
  
  Napi::Array dataArray = msgObj.Get("data").As<Napi::Array>();
  for (uint32_t j = 0; j < dataArray.Length(); j++) {
    msg.data.push_back(dataArray.Get(j).As<Napi::Number>().Uint32Value());
  }
  
  // Generate unique task ID
  uint64_t taskNum = taskIdCounter.fetch_add(1);
  std::string taskId = std::to_string(taskNum);
  
  KvaserBus* bus = nullptr;
  ThreadBasedCyclicSendTask* task = nullptr;
  
  try {
    // Create bus for this task
    bus = new KvaserBus(context->handle);
    
    // Create new cyclic task with single message
    task = new ThreadBasedCyclicSendTask(
      bus,
      msg,  // Pass single message directly
      period,
      duration,
      nullptr,  // onError callback
      true      // autostart
    );
    
    // Store in maps only after successful creation
    busMap[taskId] = bus;
    cyclicTaskMap[taskId] = task;
    
    // Return task ID
    return Napi::String::New(env, taskId);
    
  } catch (const std::exception& e) {
    // Clean up resources on failure (correct order: task first, then bus)
    if (task) {
      delete task;
      task = nullptr;
    }
    if (bus) {
      delete bus;
      bus = nullptr;
    }
    
    Napi::Error::New(env, std::string("Failed to start periodic send: ") + e.what())
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

// ================================================================
// API: stopPeriodSend
// Parameters:
//   taskId: string - task ID returned from StartPeriodSend
// ================================================================
void StopPeriodSend(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 1) {
    Napi::TypeError::New(env, "Expected 1 argument: taskId")
        .ThrowAsJavaScriptException();
    return;
  }
  
  std::string taskId = info[0].As<Napi::String>().Utf8Value();
  
  // Find all resources first
  auto taskIt = cyclicTaskMap.find(taskId);
  auto busIt = busMap.find(taskId);
  
  // Stop and delete in correct order: stop task first, then delete task (may use bus in destructor), then delete bus
  if (taskIt != cyclicTaskMap.end()) {
    taskIt->second->stop(); // 显式调用 stop() 以立刻停止
    delete taskIt->second;
    cyclicTaskMap.erase(taskIt);
  }
  
  if (busIt != busMap.end()) {
    delete busIt->second;
    busMap.erase(busIt);
  }
}

// ================================================================
// API: changeData
// Parameters:
//   taskId: string - task ID returned from StartPeriodSend
//   data: array - new data bytes
// ================================================================
void ChangeData(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 2) {
    Napi::TypeError::New(env, "Expected 2 arguments: taskId, data")
        .ThrowAsJavaScriptException();
    return;
  }
  
  std::string taskId = info[0].As<Napi::String>().Utf8Value();
  
  auto it = cyclicTaskMap.find(taskId);
  if (it == cyclicTaskMap.end()) {
    Napi::Error::New(env, "Cyclic task not found: " + taskId).ThrowAsJavaScriptException();
    return;
  }
  
  ThreadBasedCyclicSendTask *task = it->second;
  
  try {
    // Parse new data
    Napi::Array dataArray = info[1].As<Napi::Array>();
    std::vector<uint8_t> data;
    
    for (uint32_t j = 0; j < dataArray.Length(); j++) {
      data.push_back(dataArray.Get(j).As<Napi::Number>().Uint32Value());
    }
    
    // Modify the message data
    task->modifyData(data);
    
  } catch (const std::exception& e) {
    Napi::Error::New(env, std::string("Failed to change data: ") + e.what())
        .ThrowAsJavaScriptException();
  }
}

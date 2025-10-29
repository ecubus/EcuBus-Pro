
#include "napi.h"
#include "timer.hpp"
#include <chrono>
#include <thread>
#include <windows.h>
#include <map>
#include <cstring>
#include <atomic>
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

// Vector CAN Bus implementation
class VectorBus : public BusABC {
public:
  VectorBus(XLportHandle portHandle, XLaccess channelMask, bool canfd) 
    : portHandle_(portHandle), channelMask_(channelMask), canfd_(canfd) {}
  
  void send(const CanMessage& msg) override {
    if (canfd_) {
      // CAN FD message using xlCanTransmitEx
      XLcanTxEvent canTxEvt;
      canTxEvt.tag = 0x0440;  // XL_CAN_EV_TAG_TX_MSG
      canTxEvt.transId = 0;
      canTxEvt.channelIndex = 0;
      std::memset(canTxEvt.reserved, 0, sizeof(canTxEvt.reserved));
      
      unsigned int canId = msg.arbitration_id;
      if (msg.extendId) {
        canId |= 0x80000000;  // XL_CAN_EXT_MSG_ID
      }
      
      unsigned int flag = 0;
      if (msg.remoteFrame) {
        flag |= 0x0010;  // XL_CAN_TXMSG_FLAG_RTR
      }
      if (msg.canfd) {
        flag |= 0x0001;  // XL_CAN_TXMSG_FLAG_EDL
        if (msg.brs) {
          flag |= 0x0002;  // XL_CAN_TXMSG_FLAG_BRS
        }
      }
      
      canTxEvt.tagData.canMsg.canId = canId;
      canTxEvt.tagData.canMsg.msgFlags = flag;
      
      // Calculate DLC from data length
      unsigned char dlc = 0;
      if (msg.data.size() <= 8) {
        dlc = msg.data.size();
      } else if (msg.data.size() <= 12) {
        dlc = 9;
      } else if (msg.data.size() <= 16) {
        dlc = 10;
      } else if (msg.data.size() <= 20) {
        dlc = 11;
      } else if (msg.data.size() <= 24) {
        dlc = 12;
      } else if (msg.data.size() <= 32) {
        dlc = 13;
      } else if (msg.data.size() <= 48) {
        dlc = 14;
      } else {
        dlc = 15;
      }
      
      canTxEvt.tagData.canMsg.dlc = dlc;
      std::memset(canTxEvt.tagData.canMsg.reserved, 0, sizeof(canTxEvt.tagData.canMsg.reserved));
      std::memset(canTxEvt.tagData.canMsg.data, 0, sizeof(canTxEvt.tagData.canMsg.data));
      
      for (size_t i = 0; i < msg.data.size() && i < sizeof(canTxEvt.tagData.canMsg.data); i++) {
        canTxEvt.tagData.canMsg.data[i] = msg.data[i];
      }
      
      unsigned int messageCount = 1;
      unsigned int cntSent = 0;
      xlCanTransmitEx(portHandle_, channelMask_, messageCount, &cntSent, &canTxEvt);
    } else {
      // Standard CAN message using xlCanTransmit
      XLevent event;
      event.tag = 10;  // XL_TRANSMIT_MSG
      event.chanIndex = 0;
      event.transId = 0;
      event.portHandle = 0;
      event.flags = 0;
      event.reserved = 0;
      event.timeStamp = 0;
      
      unsigned int canId = msg.arbitration_id;
      if (msg.extendId) {
        canId |= 0x80000000;  // XL_CAN_EXT_MSG_ID
      }
      
      unsigned short flag = 0;
      if (msg.remoteFrame) {
        flag |= 0x0010;  // XL_CAN_MSG_FLAG_REMOTE_FRAME
      }
      
      event.tagData.msg.id = canId;
      event.tagData.msg.flags = flag;
      
      // Calculate DLC from data length
      unsigned char dlc = (msg.data.size() <= 8) ? msg.data.size() : 8;
      event.tagData.msg.dlc = dlc;
      
      std::memset(event.tagData.msg.data, 0, sizeof(event.tagData.msg.data));
      for (size_t i = 0; i < msg.data.size() && i < sizeof(event.tagData.msg.data); i++) {
        event.tagData.msg.data[i] = msg.data[i];
      }
      
      unsigned int cntSent = 1;
      xlCanTransmit(portHandle_, channelMask_, &cntSent, &event);
    }
  }
  
private:
  XLportHandle portHandle_;
  XLaccess channelMask_;
  bool canfd_;
};

// Map to store the tsfn context by name
std::map<std::string, TsfnContext *> tsfnContextMap;

// Map to store cyclic send tasks by ID
std::map<std::string, ThreadBasedCyclicSendTask*> cyclicTaskMap;
std::map<std::string, VectorBus*> busMap;

// Counter for generating unique task IDs
static std::atomic<uint64_t> taskIdCounter{0};

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

// ================================================================
// API: startPeriodSend
// Parameters:
//   name: string - context name to lookup handle
//   message: object - single message object with {id, extendId?, remoteFrame?, brs?, canfd?, data}
//   period: number - period in seconds
//   duration: number - optional duration in seconds (0 = infinite)
//   channelMask: number - channel mask (XLaccess)
//   canfd: boolean - whether CAN FD is enabled
// Returns: string - task ID for later modification/stopping
// ================================================================
Napi::Value StartPeriodSend(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  
  // Validate arguments
  if (info.Length() < 5) {
    Napi::TypeError::New(env, "Expected at least 5 arguments: name, message, period, channelMask, canfd")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  std::string name = info[0].As<Napi::String>().Utf8Value();
  Napi::Object msgObj = info[1].As<Napi::Object>();
  double period = info[2].As<Napi::Number>().DoubleValue();
  XLaccess channelMask = static_cast<XLaccess>(info[3].As<Napi::Number>().Uint32Value());
  bool canfd = info[4].As<Napi::Boolean>().Value();
  double duration = info.Length() > 5 ? info[5].As<Napi::Number>().DoubleValue() : 0.0;
  
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
  
  VectorBus* bus = nullptr;
  ThreadBasedCyclicSendTask* task = nullptr;
  
  try {
    // Create bus for this task
    bus = new VectorBus(context->portHandle, channelMask, canfd);
    
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
    taskIt->second->stop(); // Explicitly call stop() to stop immediately
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

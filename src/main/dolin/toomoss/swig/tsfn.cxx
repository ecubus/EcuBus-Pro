#include "usb2lin_ex.h"
#include "napi.h"
#include <chrono>
#include <thread>
#include <windows.h>
#include <map>
#include <cstring>
#include <queue>
#include <mutex>
#include <condition_variable>
#include <vector>
#include "concurrentqueue.h"
#include "blockconcurrentqueue.h"
// Data structure representing our thread-safe function context.
struct TxMessage {
    int devHandle;
    uint8_t linIndex;
    LIN_EX_MSG linMsg;
    uint32_t cnt;  // 添加发送计数字段
    
};

// 定义队列节点结构
struct TxQueueEntry {
    SLIST_ENTRY ItemEntry;
    TxMessage msg;
};

struct TxResult {
    uint32_t id;      // 发送计数
    int result;        // 发送结果
    LIN_EX_MSG linMsg;
};

// 1. 首先定义完整的 TsfnContext 结构体
struct TsfnContext {
    bool closed;
    int DevHandle;
    uint8_t linIndex;
    bool isMaster;
    

    // 发送线程相关
    std::thread txThread;
    Napi::ThreadSafeFunction txtsfn;


    moodycamel::BlockingConcurrentQueue<TxMessage> txQueue{10};  // 使用阻塞队列
};

//a std::map store the tsfn context
std::map<std::string, TsfnContext *> tsfnContextMap;



auto txCallback = [](Napi::Env env, Napi::Function jsCallback, TxResult* result) {
    if(!result) {
        jsCallback.Call({env.Null()});
        return;
    }

    // 创建返回对象
    Napi::Object resultObj = Napi::Object::New(env);
    resultObj.Set("id", Napi::Number::New(env, (double)result->id));
    resultObj.Set("result", Napi::Number::New(env, result->result));
    
    Napi::Object linMsgObj = Napi::Object::New(env);
    linMsgObj.Set("MsgType", Napi::Number::New(env, result->linMsg.MsgType));
    linMsgObj.Set("CheckType", Napi::Number::New(env, result->linMsg.CheckType));
    linMsgObj.Set("PID", Napi::Number::New(env, result->linMsg.PID));
    linMsgObj.Set("Check", Napi::Number::New(env, result->linMsg.Check));
    linMsgObj.Set("BreakBits", Napi::Number::New(env, result->linMsg.BreakBits));
    linMsgObj.Set("Timestamp", Napi::Number::New(env, result->linMsg.Timestamp));
    
    linMsgObj.Set("Data", Napi::Buffer<uint8_t>::Copy(env, result->linMsg.Data, result->linMsg.DataLen));
  

    resultObj.Set("linMsg", linMsgObj);

    jsCallback.Call({resultObj});
    delete result;
};

// 3. 声明线程入口函数
void txThreadEntry(TsfnContext *context);


// Exported JavaScript function. Creates the thread-safe function and native
// thread. Promise is resolved in the thread-safe function's finalizer.
void CreateTSFN(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
    int DevHandle = info[0].As<Napi::Number>().Uint32Value();
    uint8_t linIndex = info[1].As<Napi::Number>().Uint32Value();
    bool isMaster = info[2].As<Napi::Boolean>().Value();
    Napi::String name = info[3].As<Napi::String>();
    
    // Construct context data
    auto testData = new TsfnContext();
    testData->closed = false;
    testData->DevHandle = DevHandle;
    testData->linIndex = linIndex;
    testData->isMaster = isMaster;

    

    // Create tx ThreadSafeFunction
    testData->txtsfn = Napi::ThreadSafeFunction::New(
        env,                          // Environment
        info[4].As<Napi::Function>(), // JS function from caller
        name.Utf8Value().data(),    // Resource name
        0,                            // Max queue size
        1,                            // Initial thread count
        testData                      // Context
    );
    
    // Start thread after all ThreadSafeFunctions are initialized
    
    testData->txThread = std::thread(txThreadEntry, testData);
    
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
  
    context->txThread.join();

   
    context->txtsfn.Release();

    delete context;
    tsfnContextMap.erase(it);
  }
}

// 修改发送函数
void SendLinMsg(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    try {
        if (info.Length() != 5) {
            throw Napi::Error::New(env, "Wrong number of arguments");
        }

        // 获取上下文
        std::string id = info[3].As<Napi::String>().Utf8Value();  // 第4个参数是context id
        auto it = tsfnContextMap.find(id);
        if(it == tsfnContextMap.end()) {
            throw Napi::Error::New(env, "Context not found");
        }
        TsfnContext* context = it->second;
       
        
        // 创建消息
        TxMessage msg;
        memset(&msg.linMsg, 0, sizeof(LIN_EX_MSG));
        msg.devHandle = info[0].As<Napi::Number>().Int32Value();
        msg.linIndex = info[1].As<Napi::Number>().Uint32Value();
        msg.cnt = info[2].As<Napi::Number>().Uint32Value();

        auto msgObj = info[4].As<Napi::Object>();
      
        msg.linMsg.MsgType = msgObj.Get("MsgType").As<Napi::Number>().Uint32Value();
        msg.linMsg.CheckType = msgObj.Get("CheckType").As<Napi::Number>().Uint32Value();
        msg.linMsg.PID = msgObj.Get("PID").As<Napi::Number>().Uint32Value();
        msg.linMsg.Check = msgObj.Get("Check").As<Napi::Number>().Uint32Value();
        msg.linMsg.BreakBits = 13;
        msg.linMsg.Sync = 0x55;
        msg.linMsg.Timestamp = 0;
        
        auto dataBuffer = msgObj.Get("Data").As<Napi::Buffer<uint8_t>>();
        memcpy(msg.linMsg.Data, dataBuffer.Data(), dataBuffer.Length());
        msg.linMsg.DataLen = dataBuffer.Length();
        

        // 使用 enqueue 发送消息
        if (!context->txQueue.enqueue(msg)) {
            throw Napi::Error::New(env, "Failed to enqueue message - queue might be full");
        }

    } catch (const std::exception& e) {
        throw Napi::Error::New(env, e.what());
    }
}



// 修改发送线程入口函数
void txThreadEntry(TsfnContext *context) {
    TxMessage msg;
    PLIN_EX_MSG linOutMsg[512];
    while (!context->closed) {
       
        if(context->isMaster) {
            // 使用带超时的等待，每100ms检查一次closed标志
            if (context->txQueue.wait_dequeue_timed(msg, std::chrono::milliseconds(100))) {
                // 收集要发送的消息，先添加第一个消息
                std::vector<TxMessage> msgsToSend;
                msgsToSend.push_back(msg);
                
                // 检查队列中是否还有更多消息，最多收集512个（基于linOutMsg数组大小）
                TxMessage additionalMsg;
                while (msgsToSend.size() < 100 && context->txQueue.try_dequeue(additionalMsg)) {
                    msgsToSend.push_back(additionalMsg);
                }
                
                // 准备发送消息数组
                std::vector<LIN_EX_MSG> linMsgs;
                for (const auto& txMsg : msgsToSend) {
                    linMsgs.push_back(txMsg.linMsg);
                }
                
                // 一次性发送所有消息
                int ret = LIN_EX_MasterSync(context->DevHandle, context->linIndex, linMsgs.data(), (LIN_EX_MSG *)linOutMsg, msgsToSend.size());
                
                // 处理返回结果
                if(ret > 0) {
                    for(int i = 0; i < ret; i++) {
                        TxResult* result = new TxResult();
                        result->result = ret;
                        // 使用对应消息的计数ID
                        result->id = (i < msgsToSend.size()) ? msgsToSend[i].cnt : 0;
                        memcpy(&result->linMsg, &linOutMsg[i], sizeof(LIN_EX_MSG));
                        context->txtsfn.NonBlockingCall(result, txCallback);
                        if(context->closed) {
                            break;
                        }
                    }
                } else {
                    // 发送失败，为每个消息创建错误结果
                    for(size_t i = 0; i < msgsToSend.size(); i++) {
                        TxResult* result = new TxResult();
                        result->result = ret;
                        result->id = msgsToSend[i].cnt;
                        memcpy(&result->linMsg, &msgsToSend[i].linMsg, sizeof(LIN_EX_MSG));
                        context->txtsfn.NonBlockingCall(result, txCallback);
                        if(context->closed) {
                            break;
                        }
                    }
                }
            }
        }else{
            int ret = LIN_EX_SlaveGetData(context->DevHandle, context->linIndex, (LIN_EX_MSG *)linOutMsg);
           
            if(ret > 0) {
                for(int i = 0; i < ret; i++) {
                    TxResult* result = new TxResult();
                    result->result = ret;
                    memcpy(&result->linMsg, &linOutMsg[i], sizeof(LIN_EX_MSG));
                    context->txtsfn.NonBlockingCall(result, txCallback);
                    if(context->closed) {
                        break;
                    }
                }
            }
            //delay 10ms
            std::this_thread::sleep_for(std::chrono::milliseconds(10));
        }
    }
}


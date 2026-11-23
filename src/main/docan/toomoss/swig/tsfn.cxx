#include "usb2can.h"
#include "usb2canfd.h"
#include "napi.h"
#include <chrono>
#include <thread>
#include <atomic>
#include <map>
#include <cstring>
#include <queue>
#include <mutex>
#include <condition_variable>
#include "concurrentqueue.h"
#include "blockconcurrentqueue.h"
// Data structure representing our thread-safe function context.
struct TxMessage {
    int devHandle;
    uint8_t canIndex;
    bool isCanFd;
    uint32_t cnt;  // 添加发送计数字段
    union {
        CAN_MSG canMsg;
        CANFD_MSG canfdMsg;
    };
};

struct TxResult {
    uint32_t id;      // 发送计数
    uint64_t timestamp;// 时间戳
    int result;        // 发送结果
};

// 1. 首先定义完整的 TsfnContext 结构体
struct TsfnContext {
    std::atomic<bool> closed;
    bool isCanFd;
    int DevHandle;
    uint8_t CanIndex;
    
    // 接收线程相关
    std::thread rxThread;
    Napi::ThreadSafeFunction tsfn;
    // 错误监控线程相关
    std::thread errorThread;
    Napi::ThreadSafeFunction tserror;
    // 发送线程相关
    std::thread txThread;
    Napi::ThreadSafeFunction txtsfn;
    moodycamel::BlockingConcurrentQueue<TxMessage> txQueue{10000};  // 使用阻塞队列
};

//a std::map store the tsfn context
std::map<std::string, TsfnContext *> tsfnContextMap;

// 2. 然后定义回调函数
auto callback = []( Napi::Env env, Napi::Function jsCallback, const CAN_MSG* value ) {
    // 创建返回对象
    Napi::Object msgObj = Napi::Object::New(env);
    unsigned int id = value->ID;
    if(value->ExternFlag&0x1) {
        id |= 0x80000000;
    }
    if(value->RemoteFlag&0x1) {
        id |= 0x40000000;
    }
    // 设置基本属性
    msgObj.Set("ID", Napi::Number::New(env, id));
    msgObj.Set("TimeStamp", Napi::Number::New(env, value->TimeStamp));
    msgObj.Set("Flags", Napi::Number::New(env, 0));
    msgObj.Set("DLC", Napi::Number::New(env, value->DataLen));
    msgObj.Set("TimeStampHigh", Napi::Number::New(env, value->TimeStampHigh));
    
    // 创建数据Buffer
    Napi::Buffer<unsigned char> dataBuffer = Napi::Buffer<unsigned char>::Copy(env, 
                                                                             value->Data,
                                                                             value->DataLen);
    msgObj.Set("Data", dataBuffer);

    // 调用JavaScript回调函数
    jsCallback.Call( {msgObj} );
};

auto callbackFd = []( Napi::Env env, Napi::Function jsCallback, const CANFD_MSG* value ) {
    // 创建返回对象
    Napi::Object msgObj = Napi::Object::New(env);
    
    // 设置基本属性
    msgObj.Set("ID", Napi::Number::New(env, value->ID));
    msgObj.Set("DLC", Napi::Number::New(env, value->DLC));
    msgObj.Set("Flags", Napi::Number::New(env, value->Flags));
    msgObj.Set("TimeStamp", Napi::Number::New(env, value->TimeStamp));
    msgObj.Set("TimeStampHigh", Napi::Number::New(env, value->TimeStampHigh));
    
    // 创建数据Buffer
    Napi::Buffer<unsigned char> dataBuffer = Napi::Buffer<unsigned char>::Copy(env,
                                                                             value->Data,
                                                                             value->DLC);
    msgObj.Set("Data", dataBuffer);

    // 调用JavaScript回调函数
    jsCallback.Call( {msgObj} );
};

auto fdStatusCallback = [](Napi::Env env, Napi::Function jsCallback, const CANFD_BUS_ERROR* busError) {
    Napi::Object statusObj = Napi::Object::New(env);
    statusObj.Set("type", "CANFD_BUS_ERROR");
    statusObj.Set("TEC", busError->TEC);
    statusObj.Set("REC", busError->REC);
    statusObj.Set("Flags", busError->Flags);
    jsCallback.Call({statusObj});
};

auto statusCallback = [](Napi::Env env, Napi::Function jsCallback, const CAN_STATUS* canStatus) {
    Napi::Object statusObj = Napi::Object::New(env);
    statusObj.Set("type", "CAN_STATUS");
    statusObj.Set("TSR", canStatus->TSR);
    statusObj.Set("ESR", canStatus->ESR);
    statusObj.Set("RECounter", canStatus->RECounter);
    statusObj.Set("TECounter", canStatus->TECounter);
    statusObj.Set("LECode", canStatus->LECode);
    statusObj.Set("ErrFlag", canStatus->ErrFlag);
    jsCallback.Call({statusObj});
};

template <typename T, typename Callback>
void queue_callback(Napi::ThreadSafeFunction& target, const T& value, Callback callback) {
    target.NonBlockingCall([value, callback](Napi::Env env, Napi::Function jsCallback) {
        callback(env, jsCallback, &value);
    });
}

auto txCallback = [](Napi::Env env, Napi::Function jsCallback, TxResult* result) {
    if(!result) {
        jsCallback.Call({env.Null()});
        return;
    }

    // 创建返回对象
    Napi::Object resultObj = Napi::Object::New(env);
    resultObj.Set("id", Napi::Number::New(env, (double)result->id));
    resultObj.Set("timestamp", Napi::Number::New(env, (double)result->timestamp));
    resultObj.Set("result", Napi::Number::New(env, result->result));

    jsCallback.Call({resultObj});
    delete result;
};

// 3. 声明线程入口函数
void rxThreadEntry(TsfnContext *context);
void errorThreadEntry(TsfnContext *context);
void txThreadEntry(TsfnContext *context);


// Exported JavaScript function. Creates the thread-safe function and native
// thread. Promise is resolved in the thread-safe function's finalizer.
void CreateTSFN(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
    int DevHandle = info[0].As<Napi::Number>().Uint32Value();
    uint8_t CanIndex = info[1].As<Napi::Number>().Uint32Value();
    bool isCanFd = info[2].As<Napi::Boolean>().Value();
    Napi::String name = info[3].As<Napi::String>();
    
    // Construct context data
    auto testData = new TsfnContext();
    testData->closed = false;
    testData->DevHandle = DevHandle;
    testData->CanIndex = CanIndex;
    testData->isCanFd = isCanFd;

    // Create rx ThreadSafeFunction
    testData->tsfn = Napi::ThreadSafeFunction::New(
        env,                          // Environment
        info[4].As<Napi::Function>(), // JS function from caller
        name.Utf8Value().data(),      // Resource name
        0,                            // Max queue size (0 = unlimited)
        1,                            // Initial thread count
        testData                      // Context
    );

    // Create error ThreadSafeFunction  
    Napi::String nameError = info[5].As<Napi::String>();
    testData->tserror = Napi::ThreadSafeFunction::New(
        env,                          // Environment
        info[6].As<Napi::Function>(), // JS function from caller
        nameError.Utf8Value().data(), // Resource name
        0,                            // Max queue size
        1,                            // Initial thread count
        testData                      // Context
    );

    // Create tx ThreadSafeFunction
    Napi::String nameTx = info[7].As<Napi::String>();
    testData->txtsfn = Napi::ThreadSafeFunction::New(
        env,                          // Environment
        info[8].As<Napi::Function>(), // JS function from caller
        nameTx.Utf8Value().data(),    // Resource name
        0,                            // Max queue size
        1,                            // Initial thread count
        testData                      // Context
    );
    
    // Start thread after all ThreadSafeFunctions are initialized
    testData->rxThread = std::thread(rxThreadEntry, testData);
    testData->errorThread = std::thread(errorThreadEntry, testData);
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
    context->rxThread.join();
    context->errorThread.join();
    context->txThread.join();

    context->tsfn.Release();
    context->tserror.Release();
    context->txtsfn.Release();

    delete context;
    tsfnContextMap.erase(it);
  }
}

// 修改发送函数
void SendCANMsg(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    try {
        if (info.Length() < 6) {
            throw Napi::Error::New(env, "Wrong number of arguments");
        }

        // 获取上下文
        std::string id = info[3].As<Napi::String>().Utf8Value();  // 第4个参数是context id
        auto it = tsfnContextMap.find(id);
        if(it == tsfnContextMap.end()) {
            throw Napi::Error::New(env, "Context not found");
        }
        TsfnContext* context = it->second;
        uint32_t index=info[4].As<Napi::Number>().Uint32Value();
        
        // 创建消息
        TxMessage msg{};
        msg.devHandle = info[0].As<Napi::Number>().Int32Value();
        msg.canIndex = info[1].As<Napi::Number>().Uint32Value();
        msg.isCanFd = info[2].As<Napi::Boolean>().Value();
        msg.cnt = info[4].As<Napi::Number>().Uint32Value();

        auto msgObj = info[5].As<Napi::Object>();
        auto dataBuffer = msgObj.Get("Data").As<Napi::Buffer<uint8_t>>();
        if (dataBuffer.Length() > (msg.isCanFd ? sizeof(msg.canfdMsg.Data) : sizeof(msg.canMsg.Data))) {
            throw Napi::RangeError::New(env, "CAN payload exceeds frame capacity");
        }
        if (!msg.isCanFd) {
            msg.canMsg.ID = msgObj.Get("ID").As<Napi::Number>().Uint32Value();
            msg.canMsg.RemoteFlag = msgObj.Get("RemoteFlag").As<Napi::Number>().Uint32Value();
            msg.canMsg.ExternFlag = msgObj.Get("ExternFlag").As<Napi::Number>().Uint32Value();
            msg.canMsg.DataLen = static_cast<uint8_t>(dataBuffer.Length());
            memcpy(msg.canMsg.Data, dataBuffer.Data(), msg.canMsg.DataLen);
        } else {
            msg.canfdMsg.ID = msgObj.Get("ID").As<Napi::Number>().Uint32Value();
            msg.canfdMsg.DLC = static_cast<uint8_t>(dataBuffer.Length());
            msg.canfdMsg.Flags = msgObj.Get("Flags").As<Napi::Number>().Uint32Value();
            
            memcpy(msg.canfdMsg.Data, dataBuffer.Data(), dataBuffer.Length());
        }

        // 使用 enqueue 发送消息
        if (!context->txQueue.enqueue(msg)) {
            throw Napi::Error::New(env, "Failed to enqueue message - queue might be full");
        }

    } catch (const std::exception& e) {
        throw Napi::Error::New(env, e.what());
    }
}

// 接收线程入口函数
void rxThreadEntry(TsfnContext *context) {
    int ret = 0;
    
    while (!context->closed) {
        if(!context->isCanFd) {
            CAN_MSG frame;
            ret = CAN_GetMsgWithSize(context->DevHandle, context->CanIndex, &frame, 1);
            if(ret > 0 && !(frame.ExternFlag & 0x80) && frame.DataLen <= sizeof(frame.Data)) {
                queue_callback(context->tsfn, frame, callback);
            }
        } else {
            CANFD_MSG frame;
            ret = CANFD_GetMsg(context->DevHandle, context->CanIndex, &frame, 1);
            if(ret > 0 && frame.DLC <= sizeof(frame.Data)) {
                queue_callback(context->tsfn, frame, callbackFd);
            }
        }
        std::this_thread::sleep_for(std::chrono::microseconds(100));
    }
}

// 错误监控线程入口函数
void errorThreadEntry(TsfnContext *context) {
    int ret = 0;
    
    while (!context->closed) {
        if(!context->isCanFd) {
            CAN_STATUS status;
            ret = CAN_GetStatus(context->DevHandle, context->CanIndex, &status);
            if(ret == 0) {
                if(status.ErrFlag != 0 || status.TECounter != 0 || status.RECounter != 0) {
                    queue_callback(context->tserror, status, statusCallback);
                }
            }
        } else {
            CANFD_BUS_ERROR error;
            ret = CANFD_GetBusError(context->DevHandle, context->CanIndex, &error);
            if(ret == 0) {
                if(error.Flags != 0 || error.REC != 0 || error.TEC != 0) {
                    queue_callback(context->tserror, error, fdStatusCallback);
                }
            }
        }
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }
}

// 修改发送线程入口函数
void txThreadEntry(TsfnContext *context) {
    TxMessage msg;
    while (!context->closed) {
        // 使用带超时的等待，每100ms检查一次closed标志
        if (context->txQueue.wait_dequeue_timed(msg, std::chrono::milliseconds(100))) {
            TxResult* result = new TxResult();
            int ret = 0;

            if(!msg.isCanFd) {
                msg.canMsg.TimeStamp = 0;
                msg.canMsg.TimeStampHigh = 0;
                ret = CAN_SendMsg(msg.devHandle, msg.canIndex, &msg.canMsg, 1);
                result->timestamp = ((uint64_t)msg.canMsg.TimeStampHigh << 32) | msg.canMsg.TimeStamp;
            } else {
                msg.canfdMsg.TimeStamp = 0;
                msg.canfdMsg.TimeStampHigh = 0;
                ret = CANFD_SendMsg(msg.devHandle, msg.canIndex, &msg.canfdMsg, 1);
                result->timestamp = ((uint64_t)msg.canfdMsg.TimeStampHigh << 32) | msg.canfdMsg.TimeStamp;
            }

            result->result = ret;
            result->id = msg.cnt;
            context->txtsfn.NonBlockingCall(result, txCallback);
        }
    }
}


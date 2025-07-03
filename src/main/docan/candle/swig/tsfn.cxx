#include "candle.h"
#include "napi.h"
#include <chrono>
#include <thread>
#include <windows.h>
#include <map>
#include <cstring>
#include <queue>
#include <mutex>
#include <condition_variable>
#include "concurrentqueue.h"
#include "blockconcurrentqueue.h"
#include "candle_defs.h"

// 发送消息结构
struct TxMessage {
    candle_handle hdev;
    uint8_t channel;

    candle_frame_t frame;
};

// 发送结果结构
struct TxResult {
    uint32_t id;      // 发送计数
    uint64_t timestamp;// 时间戳
    int result;        // 发送结果
};

// 简化的上下文结构 - 只保留接收和发送
struct TsfnContext {
    // 基本配置
    bool closed;
   
    candle_handle hdev;
    uint8_t channel;
    
    // 接收相关
    std::thread rxThread;
    Napi::ThreadSafeFunction rxTsfn;
    candle_frame_t rxFrame;

    // 发送相关
    std::thread txThread;
    moodycamel::BlockingConcurrentQueue<TxMessage> txQueue{10000};
};

// 全局上下文映射
std::map<std::string, TsfnContext *> tsfnContextMap;
std::mutex contextMapMutex;




// 接收回调函数
auto rxCallback = [](Napi::Env env, Napi::Function jsCallback, void* value) {
    if (!value) {
        jsCallback.Call({env.Null()});
        return;
    }

    TsfnContext* context = (TsfnContext*)value;
    Napi::Object msgObj = Napi::Object::New(env);

    // 使用candle API获取帧信息
    uint32_t id = candle_frame_id(&context->rxFrame);
    bool isExtended = candle_frame_is_extended_id(&context->rxFrame);
    bool isRtr = candle_frame_is_rtr(&context->rxFrame);
    uint8_t dlc = candle_frame_dlc(&context->rxFrame);
    uint8_t* data = candle_frame_data(&context->rxFrame);
    uint32_t timestamp = candle_frame_timestamp_us(&context->rxFrame);
    candle_frametype_t frameType = candle_frame_type(&context->rxFrame);

    // 设置ID（包含扩展和RTR标志）
    if (isExtended) {
        id |= CANDLE_ID_EXTENDED;
    }
    if (isRtr) {
        id |= CANDLE_ID_RTR;
    }
    
    msgObj.Set("ID", Napi::Number::New(env, id));
    msgObj.Set("TimeStamp", Napi::Number::New(env, timestamp));
    msgObj.Set("TimeStampHigh", Napi::Number::New(env, 0)); // High 32 bits are 0 for microsecond timestamps
    msgObj.Set("DLC", Napi::Number::New(env, dlc));
    msgObj.Set("Flags", Napi::Number::New(env, context->rxFrame.flags));
    msgObj.Set("FrameType", Napi::Number::New(env, frameType));
    
    // 创建数据Buffer - 使用实际数据长度而不是DLC
    uint8_t actualDataLength = dlc;
    if (context->rxFrame.flags & CANDLE_FLAG_FD) {
        // CANFD帧的实际数据长度可能大于8字节
        if (dlc > 8) {
            actualDataLength = dlc; // CANFD DLC直接对应数据长度
        }
    } else {
        // 普通CAN帧最大8字节
        if (dlc > 8) {
            actualDataLength = 8;
        }
    }
    Napi::Buffer<unsigned char> dataBuffer = Napi::Buffer<unsigned char>::Copy(env, data, actualDataLength);
    msgObj.Set("Data", dataBuffer);

    jsCallback.Call({msgObj});
};

// 线程入口函数声明
void rxThreadEntry(TsfnContext* context);
void txThreadEntry(TsfnContext* context);



void __stdcall DLL SetContextDevice(std::string name,candle_device_t* hdev){
    std::lock_guard<std::mutex> lock(contextMapMutex);
    auto it = tsfnContextMap.find(name);
    if (it != tsfnContextMap.end()) {
        it->second->hdev = hdev;
    }
}

// 创建TSFN
void CreateTSFN(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 3) {
        throw Napi::Error::New(env, "Insufficient arguments. Expected: channel, name");
    }
   
    uint8_t channel = info[0].As<Napi::Number>().Uint32Value();
    Napi::String name = info[1].As<Napi::String>();

    
    
    // 创建上下文
    auto context = new TsfnContext();
    context->closed = false;
    context->channel = channel;


    // 创建接收ThreadSafeFunction
    context->rxTsfn = Napi::ThreadSafeFunction::New(
        env,
        info[2].As<Napi::Function>(),
        (name.Utf8Value() + "_rx").data(),
        0,  // 无限制队列大小
        1,  // 初始线程数
        context
    );

    
    // 启动线程
    context->rxThread = std::thread(rxThreadEntry, context);
    context->txThread = std::thread(txThreadEntry, context);
    
    // 存储上下文
    {
        std::lock_guard<std::mutex> lock(contextMapMutex);
        tsfnContextMap[name.Utf8Value()] = context;
    }
}

// 释放TSFN
void FreeTSFN(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 2) {
        throw Napi::Error::New(env, "Insufficient arguments. Expected: name, deviceIndex");
    }

    Napi::String name = info[0].As<Napi::String>();
  
    
    TsfnContext* context = nullptr;
    
    {
        std::lock_guard<std::mutex> lock(contextMapMutex);
        auto it = tsfnContextMap.find(name.Utf8Value());
        if (it != tsfnContextMap.end()) {
            context = it->second;
            tsfnContextMap.erase(it);
        }
    }
    
    if (context) {
        // 标记关闭
        context->closed = true;
        
        // 等待线程结束
        if (context->rxThread.joinable()) {
            context->rxThread.join();
        }
        if (context->txThread.joinable()) {
            context->txThread.join();
        }

        // 释放ThreadSafeFunction
        context->rxTsfn.Release();
   
       

        delete context;
    }
}

// 发送CAN消息
bool __stdcall DLL SendCANMsg(std::string name,candle_device_t* hdev, uint8_t ch,candle_frame_t *frame) {
   
    TsfnContext* context = nullptr;
    
    {
        std::lock_guard<std::mutex> lock(contextMapMutex);
        auto it = tsfnContextMap.find(name);
        if (it == tsfnContextMap.end()) {
            return false;
        }
        context = it->second;
    }

    // 创建发送消息
    TxMessage msg;
    msg.hdev = hdev;
    msg.channel = ch;

    
    

    // 初始化candle_frame_t结构
    memcpy(&msg.frame, frame, sizeof(candle_frame_t));
    
    // 入队发送
    if (!context->txQueue.enqueue(msg)) {
       return false;
    }
    return true;
}

// 接收线程入口函数
void rxThreadEntry(TsfnContext* context) {
    while (!context->closed) {
        if(context->hdev==nullptr){
            std::this_thread::sleep_for(std::chrono::milliseconds(100));
            continue;
        }
        bool ret = candle_frame_read(context->hdev, &context->rxFrame, 100); // 100ms timeout
        
        if (ret) {
            // 只处理接收帧，忽略其他类型
        
           
            context->rxTsfn.NonBlockingCall(context, rxCallback);
            
        }
    }
}

// 发送线程入口函数
void txThreadEntry(TsfnContext* context) {
    TxMessage msg;
    
    while (!context->closed) {
        // 使用带超时的等待，每50ms检查一次closed标志
        if (context->txQueue.wait_dequeue_timed(msg, std::chrono::milliseconds(50))) {
            
            if(!candle_frame_send(msg.hdev, msg.channel, &msg.frame)){
                printf("send frame %d failed\n", msg.frame.can_id);
                  context->rxTsfn.NonBlockingCall(context, rxCallback);
            }else{
                printf("send frame %d success\n", msg.frame.can_id);
              
            }
            // context->rxTsfn.NonBlockingCall(context, rxCallback);


          
        }
    }
}
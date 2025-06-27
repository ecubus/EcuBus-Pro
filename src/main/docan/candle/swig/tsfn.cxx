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

// 发送消息结构
struct TxMessage {
    candle_handle hdev;
    uint8_t channel;
    bool isCanFd;
    uint32_t cnt;  // 发送计数
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
    bool isCanFd;
    candle_handle hdev;
    uint8_t channel;
    
    // 接收相关
    std::thread rxThread;
    Napi::ThreadSafeFunction rxTsfn;
    candle_frame_t rxFrame;

    // 发送相关
    std::thread txThread;
    Napi::ThreadSafeFunction txTsfn;
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
    msgObj.Set("DLC", Napi::Number::New(env, dlc));
    msgObj.Set("Flags", Napi::Number::New(env, context->rxFrame.flags));
    msgObj.Set("FrameType", Napi::Number::New(env, frameType));
    
    // 创建数据Buffer
    Napi::Buffer<unsigned char> dataBuffer = Napi::Buffer<unsigned char>::Copy(env, data, dlc);
    msgObj.Set("Data", dataBuffer);

    jsCallback.Call({msgObj});
};

// 发送回调函数
auto txCallback = [](Napi::Env env, Napi::Function jsCallback, TxResult* result) {
    if (!result) {
        jsCallback.Call({env.Null()});
        return;
    }

    Napi::Object resultObj = Napi::Object::New(env);
    resultObj.Set("id", Napi::Number::New(env, (double)result->id));
    resultObj.Set("timestamp", Napi::Number::New(env, (double)result->timestamp));
    resultObj.Set("result", Napi::Number::New(env, result->result));

    jsCallback.Call({resultObj});
    delete result;
};

// 线程入口函数声明
void rxThreadEntry(TsfnContext* context);
void txThreadEntry(TsfnContext* context);

// 创建TSFN
void CreateTSFN(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 6) {
        throw Napi::Error::New(env, "Insufficient arguments. Expected: hdev, channel, isCanFd, name, rxCallback, txCallback");
    }

    candle_handle hdev = (candle_handle)info[0].As<Napi::Number>().Int32Value();
    uint8_t channel = info[1].As<Napi::Number>().Uint32Value();
    bool isCanFd = info[2].As<Napi::Boolean>().Value();
    Napi::String name = info[3].As<Napi::String>();
    
    // 创建上下文
    auto context = new TsfnContext();
    context->closed = false;
    context->hdev = hdev;
    context->channel = channel;
    context->isCanFd = isCanFd;

    // 创建接收ThreadSafeFunction
    context->rxTsfn = Napi::ThreadSafeFunction::New(
        env,
        info[4].As<Napi::Function>(),
        (name.Utf8Value() + "_rx").data(),
        0,  // 无限制队列大小
        1,  // 初始线程数
        context
    );

    // 创建发送ThreadSafeFunction
    context->txTsfn = Napi::ThreadSafeFunction::New(
        env,
        info[5].As<Napi::Function>(),
        (name.Utf8Value() + "_tx").data(),
        0,
        1,
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
    
    if (info.Length() < 1) {
        throw Napi::Error::New(env, "Missing context name");
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
        context->txTsfn.Release();

        delete context;
    }
}

// 发送CAN消息
void SendCANMsg(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 6) {
        throw Napi::Error::New(env, "Insufficient arguments for SendCANMsg");
    }

    std::string contextName = info[3].As<Napi::String>().Utf8Value();
    TsfnContext* context = nullptr;
    
    {
        std::lock_guard<std::mutex> lock(contextMapMutex);
        auto it = tsfnContextMap.find(contextName);
        if (it == tsfnContextMap.end()) {
            throw Napi::Error::New(env, "Context not found: " + contextName);
        }
        context = it->second;
    }

    // 创建发送消息
    TxMessage msg;
    msg.hdev = (candle_handle)info[0].As<Napi::Number>().Int32Value();
    msg.channel = info[1].As<Napi::Number>().Uint32Value();
    msg.isCanFd = info[2].As<Napi::Boolean>().Value();
    msg.cnt = info[4].As<Napi::Number>().Uint32Value();

    auto msgObj = info[5].As<Napi::Object>();
    
    // 初始化candle_frame_t结构
    memset(&msg.frame, 0, sizeof(candle_frame_t));
    
    // 设置基本字段
    msg.frame.can_id = msgObj.Get("ID").As<Napi::Number>().Uint32Value();
    msg.frame.can_dlc = msgObj.Get("DLC").As<Napi::Number>().Uint32Value();
    msg.frame.channel = msg.channel;
    msg.frame.flags = 0;
    
    // 处理扩展ID和RTR标志
    if (msg.frame.can_id & CANDLE_ID_EXTENDED) {
        msg.frame.can_id &= ~CANDLE_ID_EXTENDED;
        msg.frame.flags |= CANDLE_ID_EXTENDED;
    }
    if (msg.frame.can_id & CANDLE_ID_RTR) {
        msg.frame.can_id &= ~CANDLE_ID_RTR;
        msg.frame.flags |= CANDLE_ID_RTR;
    }
    
    // 处理CANFD标志
    if (msg.isCanFd) {
        msg.frame.flags |= CANDLE_FLAG_FD;
        if (msgObj.Has("BRS")) {
            if (msgObj.Get("BRS").As<Napi::Boolean>().Value()) {
                msg.frame.flags |= CANDLE_FLAG_BRS;
            }
        }
        if (msgObj.Has("ESI")) {
            if (msgObj.Get("ESI").As<Napi::Boolean>().Value()) {
                msg.frame.flags |= CANDLE_FLAG_ESI;
            }
        }
    }
    
    // 复制数据到正确的联合体字段
    auto dataBuffer = msgObj.Get("Data").As<Napi::Buffer<uint8_t>>();
    if (msg.isCanFd) {
        // CANFD数据
        memcpy(msg.frame.msg.canfd.data, dataBuffer.Data(), dataBuffer.Length());
    } else {
        // 普通CAN数据
        memcpy(msg.frame.msg.classic_can.data, dataBuffer.Data(),dataBuffer.Length());
    }

    // 入队发送
    if (!context->txQueue.enqueue(msg)) {
        throw Napi::Error::New(env, "Failed to enqueue message - queue is full");
    }
}

// 接收线程入口函数
void rxThreadEntry(TsfnContext* context) {
    while (!context->closed) {
        bool ret = candle_frame_read(context->hdev, &context->rxFrame, 100); // 100ms timeout
        
        if (ret) {
            // 只处理接收帧，忽略其他类型
            candle_frametype_t frameType = candle_frame_type(&context->rxFrame);
            if (frameType == CANDLE_FRAMETYPE_RECEIVE) {
                context->rxTsfn.NonBlockingCall(context, rxCallback);
            }
        }
        
        // 优化：根据接收频率调整睡眠时间
        if (ret) {
            std::this_thread::sleep_for(std::chrono::microseconds(50));  // 有数据时快速响应
        } else {
            std::this_thread::sleep_for(std::chrono::microseconds(200)); // 无数据时稍慢
        }
    }
}

// 发送线程入口函数
void txThreadEntry(TsfnContext* context) {
    TxMessage msg;
    
    while (!context->closed) {
        // 使用带超时的等待，每50ms检查一次closed标志
        if (context->txQueue.wait_dequeue_timed(msg, std::chrono::milliseconds(50))) {
            TxResult* result = new TxResult();
            bool ret = candle_frame_send(msg.hdev, msg.channel, &msg.frame);

            result->result = ret ? 0 : -1; // candle API返回bool，转换为int
            result->id = msg.cnt;
            result->timestamp = candle_frame_timestamp_us(&msg.frame);
            
            // 异步回调发送结果
            context->txTsfn.NonBlockingCall(result, txCallback);
        }
    }
} 
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
#include <setupapi.h>
#include <devguid.h>
#include <string>
#include "concurrentqueue.h"
#include "blockconcurrentqueue.h"
#include "candle_defs.h"

// 发送消息结构
struct TxMessage {
    candle_device_t* hdev;
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
   
    candle_device_t* hdev;
    uint8_t channel;
    
    // 接收相关
    std::thread rxThread;
    Napi::ThreadSafeFunction rxTsfn;

    // 发送相关
    std::thread txThread;
    moodycamel::BlockingConcurrentQueue<TxMessage> txQueue{10000};
    
    // 错误回调
    Napi::ThreadSafeFunction errorTsfn;
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

    candle_frame_t* frame = (candle_frame_t*)value;
    Napi::Object msgObj = Napi::Object::New(env);

    // 使用candle API获取帧信息
    uint32_t id = candle_frame_id(frame);
    bool isExtended = candle_frame_is_extended_id(frame);
    bool isRtr = candle_frame_is_rtr(frame);
    uint8_t dlc = candle_frame_dlc(frame);
    uint8_t* data = candle_frame_data(frame);
    uint32_t timestamp = candle_frame_timestamp_us(frame);
    candle_frametype_t frameType = candle_frame_type(frame);

    // 设置ID（包含扩展和RTR标志）
    if (isExtended) {
        id |= CANDLE_ID_EXTENDED;
    }
    if (isRtr) {
        id |= CANDLE_ID_RTR;
    }
    
    msgObj.Set("ID", Napi::Number::New(env, id));
    msgObj.Set("TimeStamp", Napi::Number::New(env, timestamp));
    // msgObj.Set("TimeStampHigh", Napi::Number::New(env, 0)); // High 32 bits are 0 for microsecond timestamps
    msgObj.Set("DLC", Napi::Number::New(env, dlc));
    msgObj.Set("Flags", Napi::Number::New(env, frame->flags));
    msgObj.Set("FrameType", Napi::Number::New(env, frameType));
    //echo_id
    // msgObj.Set("EchoID", Napi::Number::New(env, frame->echo_id));
    
    // 创建数据Buffer - 使用实际数据长度而不是DLC
    uint8_t size = 0;
   if (dlc > 8) {
        switch (dlc) {
        case 0x09:
            size = 12;
            break;
        case 0x0A:
            size = 16;
            break;
        case 0x0B:
            size = 20;
            break;
        case 0x0C:
            size = 24;
            break;
        case 0x0D:
            size = 32;
            break;
        case 0x0E:
            size = 48;
            break;
        case 0x0F:
            size = 64;
            break;
        default:
            size = 0;
            break;
        }
    } else {
        size = frame->can_dlc;
    }

    
    Napi::Buffer<unsigned char> dataBuffer = Napi::Buffer<unsigned char>::Copy(env, data, size);
    msgObj.Set("Data", dataBuffer);

    jsCallback.Call({msgObj});
    
    // 删除帧对象
    delete frame;
};

// 错误回调函数
auto errorCallback = [](Napi::Env env, Napi::Function jsCallback, void* value) {
    if (!value) {
        jsCallback.Call({env.Null()});
        return;
    }

    TsfnContext* context = (TsfnContext*)value;
    Napi::Object errorObj = Napi::Object::New(env);

    // 获取设备错误信息
    candle_err_t lastError = candle_dev_last_error(context->hdev);
    DWORD winError = context->hdev->error;
    
    errorObj.Set("lastError", Napi::Number::New(env, lastError));
    errorObj.Set("winError", Napi::Number::New(env, winError));
    errorObj.Set("channel", Napi::Number::New(env, context->channel));
    
    // 添加错误描述
    std::string errorDesc;
    switch (lastError) {
        case CANDLE_ERR_SEND_FRAME:
            errorDesc = "Send frame failed";
            break;
        case CANDLE_ERR_CREATE_FILE:
            errorDesc = "Create file failed";
            break;
        case CANDLE_ERR_WINUSB_INITIALIZE:
            errorDesc = "WinUSB initialize failed";
            break;
        default:
            errorDesc = "Unknown error";
            break;
    }
    errorObj.Set("errorDesc", Napi::String::New(env, errorDesc));

    jsCallback.Call({errorObj});
};

// 线程入口函数声明
void rxThreadEntry(TsfnContext* context);
void txThreadEntry(TsfnContext* context);



std::string __stdcall DLL GetDevicePath(candle_device_t* hdev) {
    if (!hdev) {
        return "";
    }
    
   
    // Create wstring with proper length
    std::wstring wDevicePath(hdev->path);
    
    //convert wstring to string
    std::string devicePath(wDevicePath.begin(), wDevicePath.end());
   
    
    return devicePath;
}

// 获取设备友好名称的函数
std::string __stdcall DLL GetDeviceFriendlyName(candle_device_t* hdev) {
    if (!hdev) {
        return "";
    }
    return std::string(hdev->friendly_name);
}



bool __stdcall DLL SetContextDevice(std::string name,candle_device_t* hdev){
    std::lock_guard<std::mutex> lock(contextMapMutex);
    auto it = tsfnContextMap.find(name);
    if (it != tsfnContextMap.end()) {
        it->second->hdev = hdev;
        if(it->second->hdev!=nullptr){
            return true;
        }
    }
    return false;
}

// 创建TSFN
void CreateTSFN(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 4) {
        throw Napi::Error::New(env, "Insufficient arguments. Expected: channel, name, rxCallback, errorCallback");
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

    // 创建错误回调ThreadSafeFunction
    context->errorTsfn = Napi::ThreadSafeFunction::New(
        env,
        info[3].As<Napi::Function>(),
        (name.Utf8Value() + "_error").data(),
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
    
    if (info.Length() < 1) {
        throw Napi::Error::New(env, "Insufficient arguments. Expected: name");
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

        // 清理发送队列中的剩余消息
        TxMessage msg;
        while (context->txQueue.try_dequeue(msg)) {
            // 队列中的消息会被自动清理，因为TxMessage不包含动态分配的内存
        }

        // 释放ThreadSafeFunction
        context->rxTsfn.Release();
        context->errorTsfn.Release();
   
       

        delete context;
    }
}

// 发送CAN消息
bool __stdcall DLL SendCANMsg(std::string name, uint8_t ch,candle_frame_t *frame) {
   
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
    msg.hdev = context->hdev;
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
        
        // 创建新的帧对象
        candle_frame_t* frame = new candle_frame_t();
        bool ret = candle_frame_read(context->hdev, frame, 100); // 100ms timeout
        
        if (ret) {
            // 只处理接收帧，忽略其他类型
            context->rxTsfn.NonBlockingCall(frame, rxCallback);
        } else {
            // 如果读取失败，删除帧对象
            delete frame;
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
                // 发送失败时调用错误回调
                context->errorTsfn.NonBlockingCall(context, errorCallback);
            }
        }
    }
}

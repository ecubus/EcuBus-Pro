#pragma once
#define NAPI_VERSION 6
#include <napi.h>
#include <chrono>
#include <thread>
#include <windows.h>
#include <map>
#include <string>

struct DelayContext {
    std::thread nativeThread;
    HANDLE stopEvent;
    Napi::ThreadSafeFunction tsfn;
    uint32_t delayMs;
    std::chrono::steady_clock::time_point startTime;  // 添加启动时间
};

class Delay {
private:
    static std::map<std::string, DelayContext*> delayContextMap;
    static void threadEntry(DelayContext* context);
    static void finalizerCallback(Napi::Env env, void* finalizeData, DelayContext* context);

public:
    static void StartDelay(const Napi::CallbackInfo& info);
    static void CancelDelay(const Napi::CallbackInfo& info);
    static napi_value Init(Napi::Env env, napi_value exports);
};


#include "delay.hpp"

std::map<std::string, DelayContext*> Delay::delayContextMap;

void Delay::threadEntry(DelayContext* context) {
    auto now = std::chrono::steady_clock::now();
    // 计算从创建到线程启动的时间差
    auto elapsed = std::chrono::duration_cast<std::chrono::microseconds>(now - context->startTime);
    // 减去已经过去的时间
    auto target_time = now + std::chrono::milliseconds(context->delayMs) - elapsed - std::chrono::microseconds(300);

    while (true) {
        if (WaitForSingleObject(context->stopEvent, 0) == WAIT_OBJECT_0) {
            break;
        }

        now = std::chrono::steady_clock::now();
        if (now >= target_time) {
            context->tsfn.BlockingCall();
            break;
        }

        // 更短的自旋等待间隔
        std::this_thread::sleep_for(std::chrono::microseconds(10));
    }
}

void Delay::finalizerCallback(Napi::Env env, void* finalizeData, DelayContext* context) {
    context->nativeThread.join();
    CloseHandle(context->stopEvent);
    delete context;
}

void Delay::StartDelay(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 3) {
        Napi::Error::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
        return;
    }

    uint32_t delayMs = info[0].As<Napi::Number>().Uint32Value();
    Napi::String name = info[1].As<Napi::String>();
    std::string nameStr = name.Utf8Value();

    // 如果已存在同名delay，先取消它
    auto it = delayContextMap.find(nameStr);
    if (it != delayContextMap.end()) {
        DelayContext* oldContext = it->second;
        SetEvent(oldContext->stopEvent);
        oldContext->tsfn.Release();
        delayContextMap.erase(it);
    }
    
    auto context = new DelayContext();
    context->delayMs = delayMs;
    context->stopEvent = CreateEvent(NULL, TRUE, FALSE, NULL);
    context->startTime = std::chrono::steady_clock::now();  // 记录启动时间
    
    context->tsfn = Napi::ThreadSafeFunction::New(
        env,
        info[2].As<Napi::Function>(),
        nameStr.c_str(),
        0,
        1,
        context,
        Delay::finalizerCallback,
        (void *)nullptr 
    );

    context->nativeThread = std::thread(Delay::threadEntry, context);
    SetThreadPriority(
        context->nativeThread.native_handle(), 
        THREAD_PRIORITY_TIME_CRITICAL  // 使用最高优先级
    );
    delayContextMap[nameStr] = context;
}

void Delay::CancelDelay(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::String name = info[0].As<Napi::String>();
    
    auto it = delayContextMap.find(name.Utf8Value());
    if (it != delayContextMap.end()) {
        DelayContext* context = it->second;
        SetEvent(context->stopEvent);
        context->tsfn.Release();
        delayContextMap.erase(it);
    }
}

napi_value Delay::Init(Napi::Env env, napi_value exports) {
    Napi::Object exportsObj = Napi::Object(env, exports);
    exportsObj.Set("startDelay", Napi::Function::New(env, Delay::StartDelay));
    exportsObj.Set("cancelDelay", Napi::Function::New(env, Delay::CancelDelay));
    return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Delay::Init)


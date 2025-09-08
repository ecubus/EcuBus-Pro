#include "napi.h"
#include <chrono>
#include <thread>
#include <windows.h>
#include <map>
#include <cstring>
#include <queue>
#include <mutex>
#include <condition_variable>

// 定时任务结构
struct TimerTask {
    UINT64 triggerTimeMicrosec;  // 触发时间（微秒）
    UINT64 intervalMicrosec;     // 间隔时间（微秒，0表示单次执行）
    void* userData;              // 用户数据
    bool active;                 // 是否激活
    UINT64 taskId;              // 任务ID
};

// 定时器上下文结构
struct TimerContext {
    // 基本配置
    bool stopped;
    std::string name;
    
    // 线程相关
    std::thread timerThread;
    HANDLE stopEvent;
    
    // 任务队列
    std::priority_queue<TimerTask*, std::vector<TimerTask*>, 
                       [](const TimerTask* a, const TimerTask* b) {
                           return a->triggerTimeMicrosec > b->triggerTimeMicrosec;
                       }> taskQueue;
    std::mutex queueMutex;
    std::condition_variable queueCondition;
    
    // JavaScript回调
    Napi::ThreadSafeFunction callbackTsfn;
    
    // 任务ID计数器
    UINT64 nextTaskId;
    
    // 高精度时钟
    LARGE_INTEGER clockFrequency;
    LARGE_INTEGER startTime;
};

// 全局定时器上下文映射
std::map<std::string, TimerContext*> timerContextMap;
std::mutex contextMapMutex;

// 获取高精度时间戳（微秒）
UINT64 GetHighPrecisionTimestamp(TimerContext* context) {
    LARGE_INTEGER currentTime;
    QueryPerformanceCounter(&currentTime);
    
    // 计算从启动时间开始的微秒数
    UINT64 elapsedTicks = currentTime.QuadPart - context->startTime.QuadPart;
    return (elapsedTicks * 1000000) / context->clockFrequency.QuadPart;
}

// 高精度延迟函数
void HighPrecisionDelay(UINT64 delayMicrosec) {
    if (delayMicrosec < 1000) {
        // 小于1ms的延迟使用busy-wait
        LARGE_INTEGER liStart, liEnd, liFreq;
        QueryPerformanceFrequency(&liFreq);
        QueryPerformanceCounter(&liStart);
        
        UINT64 targetTicks = delayMicrosec * liFreq.QuadPart / 1000000;
        
        do {
            QueryPerformanceCounter(&liEnd);
        } while ((liEnd.QuadPart - liStart.QuadPart) < targetTicks);
    }
    else {
        // 大于1ms的延迟使用Sleep，但要考虑精度损失
        DWORD sleepMs = static_cast<DWORD>(delayMicrosec / 1000);
        UINT64 remainingMicrosec = delayMicrosec % 1000;
        
        if (sleepMs > 0) {
            Sleep(sleepMs);
        }
        
        // 处理剩余的微秒级延迟
        if (remainingMicrosec > 0) {
            HighPrecisionDelay(remainingMicrosec);
        }
    }
}

// 定时器线程入口函数
void TimerThreadEntry(TimerContext* context) {
    while (!context->stopped) {
        std::unique_lock<std::mutex> lock(context->queueMutex);
        
        // 等待任务或停止信号
        if (context->taskQueue.empty()) {
            // 等待新任务或停止信号
            HANDLE handles[1] = {context->stopEvent};
            lock.unlock();
            
            DWORD result = WaitForSingleObject(context->stopEvent, 100); // 100ms超时
            if (result == WAIT_OBJECT_0) {
                break; // 收到停止信号
            }
            continue;
        }
        
        // 获取最近的任务
        TimerTask* nextTask = context->taskQueue.top();
        UINT64 currentTime = GetHighPrecisionTimestamp(context);
        
        if (nextTask->triggerTimeMicrosec <= currentTime) {
            // 时间到了，执行任务
            context->taskQueue.pop();
            lock.unlock();
            
            if (nextTask->active) {
                // 调用JavaScript回调
                auto callback = [](Napi::Env env, Napi::Function jsCallback, TimerTask* task) {
                    if (!task) {
                        jsCallback.Call({env.Null()});
                        return;
                    }
                    
                    Napi::Object taskObj = Napi::Object::New(env);
                    taskObj.Set("taskId", Napi::Number::New(env, task->taskId));
                    taskObj.Set("triggerTime", Napi::Number::New(env, task->triggerTimeMicrosec));
                    taskObj.Set("userData", task->userData ? 
                                Napi::External<void>::New(env, task->userData) : env.Null());
                    
                    jsCallback.Call({taskObj});
                };
                
                // 异步调用JavaScript回调
                context->callbackTsfn.NonBlockingCall(nextTask, callback);
                
                // 如果是周期性任务，重新添加到队列
                if (nextTask->intervalMicrosec > 0) {
                    nextTask->triggerTimeMicrosec = currentTime + nextTask->intervalMicrosec;
                    
                    std::lock_guard<std::mutex> queueLock(context->queueMutex);
                    context->taskQueue.push(nextTask);
                } else {
                    // 单次任务，删除
                    delete nextTask;
                }
            } else {
                // 任务已被取消，删除
                delete nextTask;
            }
        } else {
            // 还没到时间，计算等待时间
            UINT64 waitTime = nextTask->triggerTimeMicrosec - currentTime;
            lock.unlock();
            
            // 使用高精度延迟
            if (waitTime > 0) {
                // 限制最大等待时间，避免长时间阻塞
                UINT64 maxWait = std::min(waitTime, (UINT64)10000); // 最多等待10ms
                HighPrecisionDelay(maxWait);
            }
        }
    }
}

// 定时器清理回调
void TimerFinalizerCallback(Napi::Env env, void* finalizeData, TimerContext* context) {
    // 停止定时器线程
    context->stopped = true;
    SetEvent(context->stopEvent);
    
    // 等待线程结束
    if (context->timerThread.joinable()) {
        context->timerThread.join();
    }
    
    // 清理任务队列
    std::lock_guard<std::mutex> lock(context->queueMutex);
    while (!context->taskQueue.empty()) {
        TimerTask* task = context->taskQueue.top();
        context->taskQueue.pop();
        delete task;
    }
    
    // 清理事件句柄
    CloseHandle(context->stopEvent);
    
    // 删除上下文
    delete context;
}

// 创建精确定时器
void CreatePrecisionTimer(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 2 || !info[0].IsString() || !info[1].IsFunction()) {
        Napi::TypeError::New(env, "Expected (string, function) arguments").ThrowAsJavaScriptException();
        return;
    }
    
    std::string timerName = info[0].As<Napi::String>().Utf8Value();
    
    std::lock_guard<std::mutex> lock(contextMapMutex);
    
    // 检查是否已存在同名定时器
    if (timerContextMap.find(timerName) != timerContextMap.end()) {
        Napi::Error::New(env, "Timer with this name already exists").ThrowAsJavaScriptException();
        return;
    }
    
    // 创建新的定时器上下文
    TimerContext* context = new TimerContext();
    context->stopped = false;
    context->name = timerName;
    context->nextTaskId = 1;
    
    // 初始化高精度时钟
    QueryPerformanceFrequency(&context->clockFrequency);
    QueryPerformanceCounter(&context->startTime);
    
    // 创建停止事件
    context->stopEvent = CreateEvent(NULL, TRUE, FALSE, NULL);
    if (!context->stopEvent) {
        delete context;
        Napi::Error::New(env, "Failed to create stop event").ThrowAsJavaScriptException();
        return;
    }
    
    // 创建线程安全函数
    context->callbackTsfn = Napi::ThreadSafeFunction::New(
        env,
        info[1].As<Napi::Function>(),
        timerName.c_str(),
        0,  // 无限队列大小
        1,  // 初始线程计数
        context,
        TimerFinalizerCallback,
        (void*)nullptr
    );
    
    // 启动定时器线程
    context->timerThread = std::thread(TimerThreadEntry, context);
    
    //set thread priority
    SetThreadPriority(context->timerThread.native_handle(), THREAD_PRIORITY_TIME_CRITICAL);
    
    // 存储上下文
    timerContextMap[timerName] = context;
}

// 添加定时任务
void AddTimerTask(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 3 || !info[0].IsString() || !info[1].IsNumber() || !info[2].IsNumber()) {
        Napi::TypeError::New(env, "Expected (string, number, number, [userData]) arguments").ThrowAsJavaScriptException();
        return;
    }
    
    std::string timerName = info[0].As<Napi::String>().Utf8Value();
    UINT64 delayMicrosec = info[1].As<Napi::Number>().Uint32Value();
    UINT64 intervalMicrosec = info[2].As<Napi::Number>().Uint32Value();
    
    void* userData = nullptr;
    if (info.Length() > 3 && info[3].IsExternal()) {
        userData = info[3].As<Napi::External<void>>().Data();
    }
    
    std::lock_guard<std::mutex> lock(contextMapMutex);
    
    auto it = timerContextMap.find(timerName);
    if (it == timerContextMap.end()) {
        Napi::Error::New(env, "Timer not found").ThrowAsJavaScriptException();
        return;
    }
    
    TimerContext* context = it->second;
    
    // 创建新任务
    TimerTask* task = new TimerTask();
    task->taskId = context->nextTaskId++;
    task->triggerTimeMicrosec = GetHighPrecisionTimestamp(context) + delayMicrosec;
    task->intervalMicrosec = intervalMicrosec;
    task->userData = userData;
    task->active = true;
    
    // 添加到队列
    {
        std::lock_guard<std::mutex> queueLock(context->queueMutex);
        context->taskQueue.push(task);
    }
    
    // 通知定时器线程
    context->queueCondition.notify_one();
    
    // 返回任务ID
    info.GetReturnValue().Set(Napi::Number::New(env, task->taskId));
}

// 取消定时任务
void CancelTimerTask(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 2 || !info[0].IsString() || !info[1].IsNumber()) {
        Napi::TypeError::New(env, "Expected (string, number) arguments").ThrowAsJavaScriptException();
        return;
    }
    
    std::string timerName = info[0].As<Napi::String>().Utf8Value();
    UINT64 taskId = info[1].As<Napi::Number>().Uint32Value();
    
    std::lock_guard<std::mutex> lock(contextMapMutex);
    
    auto it = timerContextMap.find(timerName);
    if (it == timerContextMap.end()) {
        Napi::Error::New(env, "Timer not found").ThrowAsJavaScriptException();
        return;
    }
    
    TimerContext* context = it->second;
    
    // 在队列中查找并标记任务为非激活状态
    std::lock_guard<std::mutex> queueLock(context->queueMutex);
    
    // 注意：这里我们只是标记任务为非激活，实际删除会在执行时进行
    // 这样避免了在优先队列中删除元素的复杂性
    std::priority_queue<TimerTask*, std::vector<TimerTask*>, 
                       std::function<bool(const TimerTask*, const TimerTask*)>> tempQueue(
        [](const TimerTask* a, const TimerTask* b) {
            return a->triggerTimeMicrosec > b->triggerTimeMicrosec;
        });
    
    bool found = false;
    while (!context->taskQueue.empty()) {
        TimerTask* task = context->taskQueue.top();
        context->taskQueue.pop();
        
        if (task->taskId == taskId) {
            task->active = false;
            found = true;
        }
        tempQueue.push(task);
    }
    
    context->taskQueue = std::move(tempQueue);
    
    info.GetReturnValue().Set(Napi::Boolean::New(env, found));
}

// 销毁精确定时器
void DestroyPrecisionTimer(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "Expected string argument").ThrowAsJavaScriptException();
        return;
    }
    
    std::string timerName = info[0].As<Napi::String>().Utf8Value();
    
    std::lock_guard<std::mutex> lock(contextMapMutex);
    
    auto it = timerContextMap.find(timerName);
    if (it != timerContextMap.end()) {
        TimerContext* context = it->second;
        
        // 释放线程安全函数，这将触发清理回调
        context->callbackTsfn.Release();
        
        // 从映射中移除
        timerContextMap.erase(it);
    }
}

// 获取当前高精度时间戳
void GetCurrentTimestamp(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    LARGE_INTEGER frequency, counter;
    QueryPerformanceFrequency(&frequency);
    QueryPerformanceCounter(&counter);
    
    // 转换为微秒
    UINT64 microseconds = (counter.QuadPart * 1000000) / frequency.QuadPart;
    
    info.GetReturnValue().Set(Napi::Number::New(env, microseconds));
}

// 导出函数
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("createPrecisionTimer", Napi::Function::New(env, CreatePrecisionTimer));
    exports.Set("addTimerTask", Napi::Function::New(env, AddTimerTask));
    exports.Set("cancelTimerTask", Napi::Function::New(env, CancelTimerTask));
    exports.Set("destroyPrecisionTimer", Napi::Function::New(env, DestroyPrecisionTimer));
    exports.Set("getCurrentTimestamp", Napi::Function::New(env, GetCurrentTimestamp));
    
    return exports;
}

NODE_API_MODULE(precision_timer, Init)

#include "napi.h"
#include <chrono>
#include <thread>
#include <map>
#include <cstring>
#include <queue>
#include <mutex>
#include <condition_variable>
#include <atomic>
#include <memory>
#include <functional>

#ifdef _WIN32
#include <windows.h>
#else
#include <unistd.h>
#include <sys/time.h>
#include <pthread.h>
#include <errno.h>
#endif

// Cross-platform type definitions
#ifdef _WIN32
using PlatformHandle = HANDLE;
using ThreadHandle = HANDLE;
#else
using PlatformHandle = int;
using ThreadHandle = pthread_t;
#endif

// 定时任务结构
struct TimerTask {
    uint64_t triggerTimeMicrosec;  // 触发时间（微秒）
    uint64_t intervalMicrosec;     // 间隔时间（微秒，0表示单次执行）
    uint64_t originalTriggerTime;  // 原始计划触发时间（用于避免累积漂移）
    std::atomic<bool> active;      // 是否激活（原子操作）
    uint64_t taskId;              // 任务ID
    
    TimerTask() : active(true), originalTriggerTime(0) {}
};

// 任务比较器类型定义
using TaskComparator = std::function<bool(TimerTask* const&, TimerTask* const&)>;

// 定时器上下文结构
struct TimerContext {
    // 基本配置
    std::atomic<bool> stopped;
    std::string name;
    
    // 线程相关
    std::thread timerThread;
    PlatformHandle stopEvent;
    
    // 任务队列
    std::priority_queue<TimerTask*, std::vector<TimerTask*>, TaskComparator> taskQueue;
    std::mutex queueMutex;
    std::condition_variable queueCondition;
    
    // JavaScript回调
    Napi::ThreadSafeFunction callbackTsfn;
    
    // 任务ID计数器
    std::atomic<uint64_t> nextTaskId;
    
    // 高精度时钟 - 跨平台
#ifdef _WIN32
    LARGE_INTEGER clockFrequency;
    LARGE_INTEGER startTime;
#else
    std::chrono::high_resolution_clock::time_point startTime;
#endif
    
    TimerContext() : stopped(false), nextTaskId(1), 
                     taskQueue(TaskComparator([](TimerTask* const& a, TimerTask* const& b) {
                         return a->triggerTimeMicrosec > b->triggerTimeMicrosec;
                     })) {
#ifdef _WIN32
        stopEvent = INVALID_HANDLE_VALUE;
#else
        stopEvent = -1;
#endif
    }
};

// 全局定时器上下文映射 - 使用原始指针，在finalizer中手动释放
std::map<std::string, TimerContext*> timerContextMap;
std::mutex contextMapMutex;

// 获取高精度时间戳（微秒）
uint64_t GetHighPrecisionTimestamp(TimerContext* context) {
#ifdef _WIN32
    LARGE_INTEGER currentTime;
    QueryPerformanceCounter(&currentTime);
    
    // 计算从启动时间开始的微秒数
    uint64_t elapsedTicks = currentTime.QuadPart - context->startTime.QuadPart;
    return (elapsedTicks * 1000000ULL) / context->clockFrequency.QuadPart;
#else
    auto currentTime = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::microseconds>(
        currentTime - context->startTime);
    return static_cast<uint64_t>(duration.count());
#endif
}

// 高精度延迟函数 - 跨平台
void HighPrecisionDelay(uint64_t delayMicrosec) {
    if (delayMicrosec == 0) return;
    
    if (delayMicrosec < 2000) {
        // 小于2ms的延迟使用busy-wait
#ifdef _WIN32
        LARGE_INTEGER liStart, liEnd, liFreq;
        QueryPerformanceFrequency(&liFreq);
        QueryPerformanceCounter(&liStart);
        
        uint64_t targetTicks = delayMicrosec * liFreq.QuadPart / 1000000ULL;
        
        do {
            QueryPerformanceCounter(&liEnd);
        } while (static_cast<uint64_t>(liEnd.QuadPart - liStart.QuadPart) < targetTicks);
#else
        auto start = std::chrono::high_resolution_clock::now();
        auto target = start + std::chrono::microseconds(delayMicrosec);
        
        while (std::chrono::high_resolution_clock::now() < target) {
            // Busy wait for high precision
        }
#endif
    }
    else {
        // 大于2ms的延迟使用Sleep，但要考虑精度损失
        uint32_t sleepMs = static_cast<uint32_t>(delayMicrosec / 1000);
        
        uint64_t remainingMicrosec = delayMicrosec % 1000;
        if(sleepMs > 1) {
            sleepMs = sleepMs - 1;
            remainingMicrosec+=1000;
        }
        
        if (sleepMs > 0) {
#ifdef _WIN32
            Sleep(sleepMs);
#else
            usleep(sleepMs * 1000); // usleep takes microseconds
#endif
        }
        
        // 处理剩余的微秒级延迟
        if (remainingMicrosec > 0) {
            HighPrecisionDelay(remainingMicrosec);
        }
    }
}

// 跨平台等待函数
bool WaitForStopSignal(PlatformHandle stopEvent, uint32_t timeoutMs) {
#ifdef _WIN32
    DWORD result = WaitForSingleObject(stopEvent, timeoutMs);
    return (result == WAIT_OBJECT_0);
#else
    // Linux下使用condition variable和timeout
    // 这里简化处理，实际应该使用eventfd或pipe
    usleep(timeoutMs * 1000);
    return false; // 简化实现，总是超时
#endif
}

// 定时器线程入口函数
void TimerThreadEntry(TimerContext* context) {
    while (!context->stopped.load()) {
        std::unique_lock<std::mutex> lock(context->queueMutex);
        
        // 等待任务或停止信号
        if (context->taskQueue.empty()) {
            lock.unlock();
            
            // 等待停止信号或超时
            if (WaitForStopSignal(context->stopEvent, 100)) {
                break; // 收到停止信号
            }
            continue;
        }
        
        // 获取最近的任务
        auto nextTask = context->taskQueue.top();
        uint64_t currentTime = GetHighPrecisionTimestamp(context);
        
        if (nextTask->triggerTimeMicrosec <= currentTime) {
            // 时间到了，执行任务
            context->taskQueue.pop();
            lock.unlock();
            
            if (nextTask->active.load()) {
                // 调用JavaScript回调
                auto callback = [](Napi::Env env, Napi::Function jsCallback, TimerTask* task) {
                    if (!task) {
                        jsCallback.Call({env.Null()});
                        return;
                    }
                    
                    Napi::Object taskObj = Napi::Object::New(env);
                    taskObj.Set("taskId", Napi::Number::New(env, static_cast<double>(task->taskId)));
                    taskObj.Set("triggerTime", Napi::Number::New(env, static_cast<double>(task->triggerTimeMicrosec)));
                    
                    jsCallback.Call({taskObj});
                };
                
                // 异步调用JavaScript回调
                context->callbackTsfn.NonBlockingCall(nextTask, callback);
                
                // 如果是周期性任务，重新添加到队列
                if (nextTask->intervalMicrosec > 0 && nextTask->active.load()) {
                    // 基于绝对时间调度，避免累积漂移
                    // 计算下一次应该触发的绝对时间
                    uint64_t nextScheduledTime = nextTask->originalTriggerTime + nextTask->intervalMicrosec;
                    
                    // 如果计划时间已经过去太多，则跳过错过的周期
                    while (nextScheduledTime <= currentTime) {
                        nextScheduledTime += nextTask->intervalMicrosec;
                    }
                    
                    // 更新触发时间和原始计划时间
                    nextTask->triggerTimeMicrosec = nextScheduledTime;
                    nextTask->originalTriggerTime = nextScheduledTime;
                    
                    std::lock_guard<std::mutex> queueLock(context->queueMutex);
                    context->taskQueue.push(nextTask);
                } else {
                    // 非周期性任务或已取消的任务，手动释放内存
                    delete nextTask;
                }
            } else {
                // 取消的任务，手动释放内存
                delete nextTask;
            }
        } else {
            // 还没到时间，计算等待时间
            uint64_t waitTime = nextTask->triggerTimeMicrosec - currentTime;
            lock.unlock();
            
            // 使用高精度延迟
            if (waitTime > 0) {
                // 限制最大等待时间，避免长时间阻塞
                uint64_t maxWait = std::min(waitTime, static_cast<uint64_t>(10000)); // 最多等待10ms
                HighPrecisionDelay(maxWait);
            }
        }
    }
}

// 跨平台事件设置函数
void SetStopEvent(PlatformHandle stopEvent) {
#ifdef _WIN32
    SetEvent(stopEvent);
#else
    // Linux下的简化实现，实际应该使用eventfd写入
    // 这里由于简化了等待逻辑，不需要特别处理
#endif
}

// 跨平台事件句柄清理
void CloseStopEvent(PlatformHandle stopEvent) {
#ifdef _WIN32
    if (stopEvent != INVALID_HANDLE_VALUE) {
        CloseHandle(stopEvent);
    }
#else
    if (stopEvent >= 0) {
        close(stopEvent);
    }
#endif
}

// 定时器清理回调
void TimerFinalizerCallback(Napi::Env env, void* finalizeData, TimerContext* context) {
    // 停止定时器线程
    context->stopped.store(true);
    SetStopEvent(context->stopEvent);
    
    // 等待线程结束
    if (context->timerThread.joinable()) {
        context->timerThread.join();
    }
    
    // 清理任务队列 - 手动释放所有任务内存
    {
        std::lock_guard<std::mutex> lock(context->queueMutex);
        while (!context->taskQueue.empty()) {
            TimerTask* task = context->taskQueue.top();
            context->taskQueue.pop();
            delete task; // 手动释放任务内存
        }
    }
    
    // 清理事件句柄
    CloseStopEvent(context->stopEvent);
    
    // 手动释放context内存
    delete context;
}

// 跨平台创建事件句柄
PlatformHandle CreateStopEvent() {
#ifdef _WIN32
    return CreateEvent(NULL, TRUE, FALSE, NULL);
#else
    // Linux下简化实现，实际应该使用eventfd
    return -1; // 简化实现
#endif
}

// 跨平台设置线程优先级
void SetHighThreadPriority(std::thread& thread) {
#ifdef _WIN32
    SetThreadPriority(thread.native_handle(), THREAD_PRIORITY_TIME_CRITICAL);
#else
    pthread_t handle = thread.native_handle();
    struct sched_param param;
    param.sched_priority = sched_get_priority_max(SCHED_FIFO);
    pthread_setschedparam(handle, SCHED_FIFO, &param);
#endif
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
    context->stopped.store(false);
    context->name = timerName;
    context->nextTaskId.store(1);
    
    
    // 初始化高精度时钟
#ifdef _WIN32
    QueryPerformanceFrequency(&context->clockFrequency);
    QueryPerformanceCounter(&context->startTime);
#else
    context->startTime = std::chrono::high_resolution_clock::now();
#endif
  
    // 创建停止事件
    context->stopEvent = CreateStopEvent();
#ifdef _WIN32
    if (context->stopEvent == NULL) {
        Napi::Error::New(env, "Failed to create stop event").ThrowAsJavaScriptException();
        return;
    }
#endif
  
    // 创建线程安全函数
    try {
        context->callbackTsfn = Napi::ThreadSafeFunction::New(
            env,
            info[1].As<Napi::Function>(),
            timerName,
            0,  // 无限队列大小
            1,  // 初始线程计数
            context,
            TimerFinalizerCallback,
            (void*)nullptr
        );
        
        // 启动定时器线程
        context->timerThread = std::thread(TimerThreadEntry, context);
        
        // 设置高优先级（可能失败，但不影响功能）
        try {
            SetHighThreadPriority(context->timerThread);
        } catch (...) {
            // 忽略设置优先级失败
        }
        
        // 存储上下文
        timerContextMap[timerName] = context;
        
    } catch (const std::exception& e) {
        CloseStopEvent(context->stopEvent);
        delete context; // 释放内存
        Napi::Error::New(env, std::string("Failed to create timer: ") + e.what()).ThrowAsJavaScriptException();
        return;
    }
}

// 添加定时任务
Napi::Value AddTimerTask(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 3 || !info[0].IsString() || !info[1].IsNumber() || !info[2].IsNumber()) {
        Napi::TypeError::New(env, "Expected (string, number, number) arguments").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    std::string timerName = info[0].As<Napi::String>().Utf8Value();
    // 修复：使用DoubleValue()而不是Uint32Value()来避免截断
    uint64_t delayMicrosec = static_cast<uint64_t>(info[1].As<Napi::Number>().DoubleValue());
    uint64_t intervalMicrosec = static_cast<uint64_t>(info[2].As<Napi::Number>().DoubleValue());
    
    std::lock_guard<std::mutex> lock(contextMapMutex);
    
    auto it = timerContextMap.find(timerName);
    if (it == timerContextMap.end()) {
        Napi::Error::New(env, "Timer not found").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    auto context = it->second;
    
    // 创建新任务 - 使用原始指针
    TimerTask* task = new TimerTask();
    task->taskId = context->nextTaskId.fetch_add(1);
    task->triggerTimeMicrosec = GetHighPrecisionTimestamp(context) + delayMicrosec;
    task->originalTriggerTime = task->triggerTimeMicrosec;  // 记录原始计划时间
    task->intervalMicrosec = intervalMicrosec;
    task->active.store(true);
    
    // 添加到队列
    {
        std::lock_guard<std::mutex> queueLock(context->queueMutex);
        context->taskQueue.push(task);
    }
    
    // 通知定时器线程
    context->queueCondition.notify_one();
    
    // 返回任务ID

    return Napi::Number::New(env, static_cast<double>(task->taskId));
}

// 取消定时任务
Napi::Value CancelTimerTask(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 2 || !info[0].IsString() || !info[1].IsNumber()) {
        Napi::TypeError::New(env, "Expected (string, number) arguments").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    std::string timerName = info[0].As<Napi::String>().Utf8Value();
    uint64_t taskId = static_cast<uint64_t>(info[1].As<Napi::Number>().DoubleValue());
    
    std::lock_guard<std::mutex> lock(contextMapMutex);
    
    auto it = timerContextMap.find(timerName);
    if (it == timerContextMap.end()) {
        Napi::Error::New(env, "Timer not found").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    auto context = it->second;
    
    // 在队列中查找并标记任务为非激活状态
    std::lock_guard<std::mutex> queueLock(context->queueMutex);
    
    // 注意：这里我们只是标记任务为非激活，实际删除会在执行时进行
    // 这样避免了在优先队列中删除元素的复杂性
    std::vector<TimerTask*> tempTasks;
    
    bool found = false;
    while (!context->taskQueue.empty()) {
        TimerTask* task = context->taskQueue.top();
        context->taskQueue.pop();
        
        if (task->taskId == taskId) {
            task->active.store(false);
            found = true;
        }
        tempTasks.push_back(task);
    }
    
    // 重新构建队列
    for (TimerTask* task : tempTasks) {
        context->taskQueue.push(task);
    }
    return Napi::Boolean::New(env, found);
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
        
        // 释放线程安全函数，这将触发清理回调（在回调中会释放context）
        context->callbackTsfn.Release();
        
        // 从映射中移除，内存在finalizer回调中释放
        timerContextMap.erase(it);
    }
}

// 获取当前高精度时间戳
Napi::Value GetCurrentTimestamp(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
#ifdef _WIN32
    LARGE_INTEGER frequency, counter;
    QueryPerformanceFrequency(&frequency);
    QueryPerformanceCounter(&counter);
    
    // 转换为微秒
    uint64_t microseconds = (static_cast<uint64_t>(counter.QuadPart) * 1000000ULL) / 
                           static_cast<uint64_t>(frequency.QuadPart);
#else
    auto now = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::microseconds>(
        now.time_since_epoch());
    uint64_t microseconds = static_cast<uint64_t>(duration.count());
#endif

    return Napi::Number::New(env, static_cast<double>(microseconds));
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

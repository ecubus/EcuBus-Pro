#ifndef CYCLIC_SEND_TASK_H
#define CYCLIC_SEND_TASK_H

#include <thread>
#include <vector>
#include <atomic>
#include <functional>
#include <mutex>
#include <chrono>
#include <iostream>
#include <optional>
#include <stdexcept>
#include <cstring>
#include <condition_variable>

#ifdef _WIN32
#include <windows.h>
#endif

// ================================================================
// CAN message definition
// ================================================================
struct CanMessage {
    uint32_t arbitration_id;       // CAN ID
    bool extendId;
    bool remoteFrame;
    bool brs;
    bool canfd;
    std::vector<uint8_t> data;     // message payload
};

// ================================================================
// Abstract Bus interface
// ================================================================
class BusABC {
public:
    virtual ~BusABC() = default;
    virtual void send(const CanMessage& msg) = 0;
};

// ================================================================
// Thread-based cyclic send task
// ================================================================
class ThreadBasedCyclicSendTask {
public:
    using OnErrorCallback = std::function<bool(const std::exception&)>;

    ThreadBasedCyclicSendTask(
        BusABC* bus,
        const CanMessage& message,
        double periodSec,
        double durationSec = 0.0,
        OnErrorCallback onError = nullptr,
        bool autostart = true)
        : bus_(bus),
          message_(message),
          period_(periodSec),
          duration_(durationSec > 0 ? std::optional<double>(durationSec) : std::nullopt),
          onError_(onError)
    {
        if (periodSec < 0.001)
            throw std::invalid_argument("period cannot be smaller than 1 ms");

#ifdef _WIN32
        hTimer_ = CreateWaitableTimer(NULL, FALSE, NULL);
        hStopEvent_ = CreateEvent(NULL, TRUE, FALSE, NULL); // Manual reset event
        if (!hTimer_ || !hStopEvent_) {
            throw std::runtime_error("Failed to create Windows synchronization objects");
        }
#endif
        if (autostart)
            start();
    }

    ~ThreadBasedCyclicSendTask() {
        stop();
#ifdef _WIN32
        if (hTimer_) CloseHandle(hTimer_);
        if (hStopEvent_) CloseHandle(hStopEvent_);
#endif
    }

    // 启动周期任务
    void start() {
        stopped_ = false;
#ifdef _WIN32
        if (hStopEvent_) ResetEvent(hStopEvent_); // 重置停止事件
#endif
        if (thread_.joinable())
            thread_.join();
        thread_ = std::thread(&ThreadBasedCyclicSendTask::run, this);
        
        // 设置线程为高优先级，确保精确的周期性发送
#ifdef _WIN32
        SetThreadPriority(thread_.native_handle(), THREAD_PRIORITY_TIME_CRITICAL);
#endif
    }

    // 停止周期任务
    void stop() {
        stopped_ = true;
#ifdef _WIN32
        if (hTimer_) CancelWaitableTimer(hTimer_);
        if (hStopEvent_) SetEvent(hStopEvent_); // 立刻唤醒等待线程
#else
        cv_.notify_all(); // 立刻唤醒等待线程
#endif
        if (thread_.joinable()) {
            thread_.join();
        }
    }

    // ================================================================
    // 动态修改内部CAN数据（线程安全）
    // ================================================================
    void modifyData(const std::vector<uint8_t>& newData) {
        std::lock_guard<std::mutex> guard(dataLock_);
        message_.data = newData;
    }

private:
    void run() {
        using namespace std::chrono;
        auto nextDueTime = steady_clock::now();
        auto endTime = duration_ ? steady_clock::now() + duration<double>(duration_.value()) : time_point<steady_clock>::max();

        #ifdef _WIN32
        // 设置定时器为周期性触发
        if (hTimer_) {
            LARGE_INTEGER liDueTime;
            // 不要立即触发定时器（0 会导致立即信号，配合下面的立即发送会产生紧邻的两次发送）
            // 我们希望：启动时先发送一次，然后定时器在 periodMs 毫秒后第一次触发。
            LONG periodMs = static_cast<LONG>(period_ * 1000.0);
            if (periodMs <= 0) periodMs = 1; // 保底，避免传 0 给 SetWaitableTimer

            // SetWaitableTimer 的 due time 以 100 纳秒为单位，负数表示相对时间
            liDueTime.QuadPart = -static_cast<LONGLONG>(periodMs) * 10000LL; // 等待 periodMs 毫秒后首次触发

            if (!SetWaitableTimer(hTimer_, &liDueTime, periodMs, NULL, NULL, FALSE)) {
                std::cerr << "[CyclicTask] SetWaitableTimer failed: " << GetLastError() << std::endl;
                return;
            }
        }
#endif

        while (!stopped_) {
            if (steady_clock::now() >= endTime) {
                stop();
                break;
            }

           
            CanMessage msgCopy;
            {   // 复制当前 message，避免发送时数据被修改
                std::lock_guard<std::mutex> guard(dataLock_);
                msgCopy = message_;
            }

            bus_->send(msgCopy);
           

#ifdef _WIN32
            if (hTimer_ && hStopEvent_) {
                HANDLE handles[2] = {hTimer_, hStopEvent_};
                DWORD result = WaitForMultipleObjects(2, handles, FALSE, INFINITE);
                if (result == WAIT_OBJECT_0 + 1) {
                    // Stop event signaled, exit immediately
                    break;
                }
                // result == WAIT_OBJECT_0 means timer signaled, continue to next iteration
            }
#else
            nextDueTime += std::chrono::duration_cast<steady_clock::duration>(duration<double>(period_));
            std::unique_lock<std::mutex> lock(cvMutex_);
            cv_.wait_until(lock, nextDueTime, [this]() { return stopped_.load(); });
            if (stopped_) break;
#endif
        }
    }

private:
    BusABC* bus_;
    CanMessage message_;
    double period_;
    std::optional<double> duration_;
    OnErrorCallback onError_;
    std::thread thread_;
    std::atomic<bool> stopped_{true};

    std::mutex dataLock_; // 🔒 用于保护 message 修改

#ifdef _WIN32
    HANDLE hTimer_{nullptr};
    HANDLE hStopEvent_{nullptr}; // 用于立刻停止线程
#else
    std::mutex cvMutex_; // 用于条件变量
    std::condition_variable cv_; // 用于可中断的等待
#endif
};

#endif // CYCLIC_SEND_TASK_H
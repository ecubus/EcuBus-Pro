#ifndef CYCLIC_SEND_TASK_HPP
#define CYCLIC_SEND_TASK_HPP

#include <thread>
#include <atomic>
#include <mutex>
#include <functional>
#include <vector>
#include <chrono>
#include <stdexcept>

#ifdef _WIN32
#include <windows.h>
#include <timeapi.h>
#pragma comment(lib, "winmm.lib")
#else
#include <sys/timerfd.h>
#include <sys/select.h>
#include <unistd.h>
#include <cstring>
#include <cerrno>
#endif

// CAN 消息结构
struct CanMessage {
    uint32_t arbitration_id;
    std::vector<uint8_t> data;
    bool extendId = false;
    bool remoteFrame = false;
    bool brs = false;
    bool canfd = false;
};

class BusABC {
public:
    virtual void send(const CanMessage& msg) = 0;
    virtual ~BusABC() = default;
};

class CyclicSendTask {
public:
    using OnErrorCallback = std::function<bool(const std::exception&)>;

    CyclicSendTask(
        BusABC* bus,
        const CanMessage& message,
        double periodSec,
        OnErrorCallback onError = nullptr,
        bool autostart = true)
        : bus_(bus),
          message_(message),
          periodSec_(periodSec),
          onError_(onError)
#ifdef _WIN32
          , hTimer_(NULL)
          , hStopEvent_(NULL)
#else
          , timerfd_(-1)
#endif
    {
        if (periodSec < 0.001)
            throw std::invalid_argument("period cannot be smaller than 1 ms");

#ifdef _WIN32
        // 设置系统定时器精度为1ms
        timeBeginPeriod(1);
        
        // 创建停止事件
        hStopEvent_ = CreateEventW(NULL, TRUE, FALSE, NULL);
        if (hStopEvent_ == NULL) {
            throw std::runtime_error("Failed to create stop event");
        }
        
        // 创建高精度 Waitable Timer
        hTimer_ = CreateWaitableTimerExW(
            NULL, 
            NULL,
            CREATE_WAITABLE_TIMER_HIGH_RESOLUTION,
            TIMER_ALL_ACCESS
        );
        
        if (hTimer_ == NULL) {
            // 如果高精度失败，尝试普通版本
            hTimer_ = CreateWaitableTimerW(NULL, FALSE, NULL);
            if (hTimer_ == NULL) {
                CloseHandle(hStopEvent_);
                throw std::runtime_error("Failed to create waitable timer");
            }
        }
#else
        // 创建 Linux timerfd (阻塞模式)
        timerfd_ = timerfd_create(CLOCK_MONOTONIC, 0);
        if (timerfd_ < 0) {
            throw std::runtime_error("Failed to create timerfd");
        }
#endif

        if (autostart)
            start();
    }

    ~CyclicSendTask() {
        stop();
        
#ifdef _WIN32
        if (hTimer_ != NULL) {
            CloseHandle(hTimer_);
            hTimer_ = NULL;
        }
        if (hStopEvent_ != NULL) {
            CloseHandle(hStopEvent_);
            hStopEvent_ = NULL;
        }
        timeEndPeriod(1);
#else
        if (timerfd_ >= 0) {
            close(timerfd_);
            timerfd_ = -1;
        }
#endif
    }

    // 启动周期任务
    void start() {
        if (!stopped_.exchange(false)) {
            return; // 已经在运行
        }

        if (thread_.joinable())
            thread_.join();

#ifdef _WIN32
        // 重置停止事件
        ResetEvent(hStopEvent_);
        
        // 配置 Windows Waitable Timer
        // 使用单次触发模式（period=0），在 run() 中手动重设，以补偿发送耗时
        LARGE_INTEGER dueTime;
        // 负值表示相对时间，单位是100纳秒
        dueTime.QuadPart = -static_cast<LONGLONG>(periodSec_ * 10000000.0);
        
        // period=0 表示单次触发，不自动重复
        if (!SetWaitableTimer(hTimer_, &dueTime, 0, NULL, NULL, FALSE)) {
            stopped_ = true;
            throw std::runtime_error("Failed to set waitable timer");
        }
#else
        // 配置 Linux timerfd
        // 使用单次触发模式（interval=0），在 run() 中手动重设，以补偿发送耗时
        struct itimerspec spec;
        memset(&spec, 0, sizeof(spec));
        
        long long period_ns = static_cast<long long>(periodSec_ * 1000000000.0);
        spec.it_value.tv_sec = period_ns / 1000000000;
        spec.it_value.tv_nsec = period_ns % 1000000000;
        // interval=0 表示单次触发，不自动重复
        spec.it_interval.tv_sec = 0;
        spec.it_interval.tv_nsec = 0;
        
        if (timerfd_settime(timerfd_, 0, &spec, NULL) < 0) {
            stopped_ = true;
            throw std::runtime_error("Failed to set timerfd");
        }
#endif

        thread_ = std::thread(&CyclicSendTask::run, this);

#ifdef _WIN32
        // 设置较高优先级（不需要 TIME_CRITICAL，因为使用系统定时器）
        SetThreadPriority(thread_.native_handle(), THREAD_PRIORITY_ABOVE_NORMAL);
#else
        // Linux 下可选设置较高优先级
        // 不设置实时优先级也能保持良好精度
#endif
    }

    // 停止周期任务
    void stop() {
        if (stopped_) {
            return; // 已经停止
        }
        
        stopped_ = true;
        
#ifdef _WIN32
        // 设置停止事件，唤醒等待的线程
        if (hStopEvent_ != NULL) {
            SetEvent(hStopEvent_);
        }
#else
        // Linux: 向 timerfd 写入数据来唤醒（实际上我们用 stopped_ 标志）
        // 为了立即停止，可以关闭并重新创建 timerfd，但这里用标志更简单
#endif
        
        if (thread_.joinable()) {
            thread_.join();
        }
        
#ifdef _WIN32
        // 取消定时器
        if (hTimer_ != NULL) {
            CancelWaitableTimer(hTimer_);
        }
#else
        // Linux: 停止 timerfd
        if (timerfd_ >= 0) {
            struct itimerspec spec;
            memset(&spec, 0, sizeof(spec));
            timerfd_settime(timerfd_, 0, &spec, NULL);
        }
#endif
    }

    // 动态修改 CAN 数据（线程安全）
    void modifyData(const std::vector<uint8_t>& newData) {
        std::lock_guard<std::mutex> guard(dataLock_);
        message_.data = newData;
    }

    // 修改整个消息
    void modifyMessage(const CanMessage& newMessage) {
        std::lock_guard<std::mutex> guard(dataLock_);
        message_ = newMessage;
    }

    // 获取当前周期（秒）
    double getPeriod() const {
        return periodSec_;
    }

    // 是否正在运行
    bool isRunning() const {
        return !stopped_;
    }

private:
    void run() {
        using namespace std::chrono;
        
        // 记录期望的下次触发时间
        auto nextTriggerTime = high_resolution_clock::now() + 
                               duration_cast<high_resolution_clock::duration>(
                                   duration<double>(periodSec_));
        
        while (!stopped_) {
#ifdef _WIN32
            // Windows: 同时等待定时器和停止事件
            HANDLE handles[2] = {hTimer_, hStopEvent_};
            DWORD result = WaitForMultipleObjects(2, handles, FALSE, INFINITE);
            
            if (result == WAIT_OBJECT_0) {
                // 定时器触发
                if (stopped_) break;
            } else if (result == WAIT_OBJECT_0 + 1) {
                // 停止事件触发
                break;
            } else {
                // 等待失败
                break;
            }
#else
            // Linux: 使用 select 实现超时等待，便于响应 stopped_ 标志
            fd_set readfds;
            FD_ZERO(&readfds);
            FD_SET(timerfd_, &readfds);
            
            struct timeval timeout;
            timeout.tv_sec = 0;
            timeout.tv_usec = 100000;  // 100ms 超时，用于检查 stopped_
            
            int ret = select(timerfd_ + 1, &readfds, NULL, NULL, &timeout);
            
            if (stopped_) {
                break;
            }
            
            if (ret > 0 && FD_ISSET(timerfd_, &readfds)) {
                // 定时器触发，读取数据
                uint64_t expirations;
                ssize_t bytesRead = read(timerfd_, &expirations, sizeof(expirations));
                
                if (bytesRead < 0) {
                    if (errno != EAGAIN && errno != EINTR) {
                        break;
                    }
                    continue;
                }
                
                // 如果 expirations > 1，说明错过了一些周期
                if (expirations > 1 && onError_) {
                    try {
                        std::runtime_error err("Missed cycles detected");
                        onError_(err);
                    } catch (...) {}
                }
            } else if (ret < 0 && errno != EINTR) {
                // select 错误
                break;
            } else {
                // 超时或中断，继续循环检查 stopped_
                continue;
            }
#endif

            // 发送消息
            try {
                CanMessage msgCopy;
                {
                    std::lock_guard<std::mutex> guard(dataLock_);
                    msgCopy = message_;
                }
                bus_->send(msgCopy);
            }
            catch (const std::exception& e) {
                if (onError_ && !onError_(e)) {
                    break; // 错误处理函数返回 false，停止任务
                }
            }
            
#ifdef _WIN32
            // Windows: 重新设置定时器到精确的下次触发时间，补偿发送耗时
            auto now = high_resolution_clock::now();
            nextTriggerTime += duration_cast<high_resolution_clock::duration>(
                duration<double>(periodSec_));
            
            auto timeUntilNext = duration_cast<duration<double>>(nextTriggerTime - now);
            
            // 如果已经超时，立即设置为下一个周期
            if (timeUntilNext.count() <= 0) {
                nextTriggerTime = now + duration_cast<high_resolution_clock::duration>(
                    duration<double>(periodSec_));
                timeUntilNext = duration<double>(periodSec_);
            }
            
            // 重新设置定时器（单次模式）
            LARGE_INTEGER dueTime;
            dueTime.QuadPart = -static_cast<LONGLONG>(timeUntilNext.count() * 10000000.0);
            
            if (!SetWaitableTimer(hTimer_, &dueTime, 0, NULL, NULL, FALSE)) {
                break; // 设置失败，退出
            }
#else
            // Linux: 重新设置 timerfd 到精确的下次触发时间，补偿发送耗时
            auto now = high_resolution_clock::now();
            nextTriggerTime += duration_cast<high_resolution_clock::duration>(
                duration<double>(periodSec_));
            
            auto timeUntilNext = duration_cast<duration<double>>(nextTriggerTime - now);
            
            // 如果已经超时，立即设置为下一个周期
            if (timeUntilNext.count() <= 0) {
                nextTriggerTime = now + duration_cast<high_resolution_clock::duration>(
                    duration<double>(periodSec_));
                timeUntilNext = duration<double>(periodSec_);
            }
            
            // 重新设置 timerfd（单次模式）
            struct itimerspec spec;
            memset(&spec, 0, sizeof(spec));
            
            long long wait_ns = static_cast<long long>(timeUntilNext.count() * 1000000000.0);
            spec.it_value.tv_sec = wait_ns / 1000000000;
            spec.it_value.tv_nsec = wait_ns % 1000000000;
            spec.it_interval.tv_sec = 0;
            spec.it_interval.tv_nsec = 0;
            
            if (timerfd_settime(timerfd_, 0, &spec, NULL) < 0) {
                break; // 设置失败，退出
            }
#endif
        }
    }

private:
    BusABC* bus_;
    CanMessage message_;
    double periodSec_;
    OnErrorCallback onError_;
    
    std::thread thread_;
    std::atomic<bool> stopped_{true};
    std::mutex dataLock_; // 保护 message_ 的修改
    
#ifdef _WIN32
    HANDLE hTimer_;      // Windows Waitable Timer 句柄
    HANDLE hStopEvent_;  // Windows 停止事件句柄
#else
    int timerfd_;        // Linux timerfd 文件描述符
#endif
};

#endif // CYCLIC_SEND_TASK_HPP

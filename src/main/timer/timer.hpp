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

#ifdef _WIN32
#include <windows.h>
#endif

// ================================================================
// CAN message definition
// ================================================================
struct CanMessage {
    uint32_t arbitration_id;       // CAN ID
    int channel;                   // channel index
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
        std::mutex* lock,
        const std::vector<CanMessage>& messages,
        double periodSec,
        double durationSec = 0.0,
        OnErrorCallback onError = nullptr,
        bool autostart = true)
        : bus_(bus),
          sendLock_(lock),
          messages_(messages),
          period_(periodSec),
          duration_(durationSec > 0 ? std::optional<double>(durationSec) : std::nullopt),
          onError_(onError)
    {
        if (messages.empty())
            throw std::invalid_argument("messages cannot be empty");
        if (periodSec < 0.001)
            throw std::invalid_argument("period cannot be smaller than 1 ms");

#ifdef _WIN32
        hTimer_ = CreateWaitableTimer(NULL, FALSE, NULL);
#endif
        if (autostart)
            start();
    }

    ~ThreadBasedCyclicSendTask() {
        stop();
#ifdef _WIN32
        if (hTimer_) CloseHandle(hTimer_);
#endif
    }

    // 启动周期任务
    void start() {
        stopped_ = false;
        if (thread_.joinable())
            thread_.join();
        thread_ = std::thread(&ThreadBasedCyclicSendTask::run, this);
    }

    // 停止周期任务
    void stop() {
        stopped_ = true;
#ifdef _WIN32
        if (hTimer_) CancelWaitableTimer(hTimer_);
#endif
        if (thread_.joinable()) {
            thread_.join();
        }
    }

    // ================================================================
    // 动态修改内部CAN数据（线程安全）
    // ================================================================
    void modifyData(size_t index, const std::vector<uint8_t>& newData) {
        std::lock_guard<std::mutex> guard(dataLock_);
        if (index >= messages_.size()) {
            throw std::out_of_range("Invalid message index");
        }
        messages_[index].data = newData;
    }

    // 批量修改所有 messages
    void modifyAllData(const std::vector<std::vector<uint8_t>>& newDataList) {
        std::lock_guard<std::mutex> guard(dataLock_);
        if (newDataList.size() != messages_.size()) {
            throw std::invalid_argument("Size mismatch between newDataList and messages");
        }
        for (size_t i = 0; i < messages_.size(); ++i) {
            messages_[i].data = newDataList[i];
        }
    }

private:
    void run() {
        using namespace std::chrono;
        size_t msgIndex = 0;
        auto nextDueTime = steady_clock::now();
        auto endTime = duration_ ? steady_clock::now() + duration<double>(duration_.value()) : time_point<steady_clock>::max();

#ifdef _WIN32
        LARGE_INTEGER liDueTime{};
        liDueTime.QuadPart = 0;
        if (hTimer_) {
            SetWaitableTimer(hTimer_, &liDueTime, static_cast<LONG>(period_ * 1000), NULL, NULL, FALSE);
        }
#endif

        while (!stopped_) {
            if (steady_clock::now() >= endTime) {
                stop();
                break;
            }

            try {
                CanMessage msgCopy;
                {   // 复制当前 message，避免发送时数据被修改
                    std::lock_guard<std::mutex> guard(dataLock_);
                    msgCopy = messages_[msgIndex];
                }

                {
                    std::lock_guard<std::mutex> guard(*sendLock_);
                    bus_->send(msgCopy);
                }
            } catch (const std::exception& e) {
                std::cerr << "[CyclicTask] Exception: " << e.what() << std::endl;

                if (!onError_) {
                    stop();
                    throw;
                }
                if (!onError_(e)) {
                    stop();
                    break;
                }
            }

            msgIndex = (msgIndex + 1) % messages_.size();

#ifdef _WIN32
            if (hTimer_) {
                WaitForSingleObject(hTimer_, INFINITE);
            } else
#endif
            {
                nextDueTime += duration<double>(period_);
                std::this_thread::sleep_until(nextDueTime);
            }
        }
    }

private:
    BusABC* bus_;
    std::mutex* sendLock_;
    std::vector<CanMessage> messages_;
    double period_;
    std::optional<double> duration_;
    OnErrorCallback onError_;
    std::thread thread_;
    std::atomic<bool> stopped_{true};

    std::mutex dataLock_; // 🔒 用于保护 message 修改

#ifdef _WIN32
    HANDLE hTimer_{nullptr};
#endif
};

#endif // CYCLIC_SEND_TASK_H

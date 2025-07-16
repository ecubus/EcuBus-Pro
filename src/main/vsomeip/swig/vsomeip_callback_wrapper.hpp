// Copyright (C) 2014-2021 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

#ifndef VSOMEIP_CALLBACK_WRAPPER_HPP
#define VSOMEIP_CALLBACK_WRAPPER_HPP

/**
 * \brief vSomeIP Callback Wrapper header for Node.js integration.
 * 
 * This header provides the VsomeipCallbackWrapper class interface for
 * managing vSomeIP callbacks in a Node.js environment.
 */

#include <memory>
#include <string>
#include <chrono>
#include <thread>

namespace vsomeip_v3 {
    class application;
}



/**
 * \brief vSomeIP callback wrapper class for Node.js integration
 * 
 * This class provides a wrapper around vSomeIP application callbacks,
 * allowing JavaScript functions to be registered as callbacks for
 * various vSomeIP events.
 */
class VsomeipCallbackWrapper {
private:
    std::shared_ptr<vsomeip_v3::application> app_;
    std::thread app_thread_;
    bool is_running_;

public:
    /**
     * \brief Constructor
     * 
     * \param app Shared pointer to vSomeIP application instance
     */
    VsomeipCallbackWrapper(std::shared_ptr<vsomeip_v3::application> app = nullptr);
    
    /**
     * \brief Destructor
     */
    ~VsomeipCallbackWrapper();
    
    /**
     * \brief Set the vSomeIP application instance
     * 
     * \param app Shared pointer to vSomeIP application
     */
    void setApplication(std::shared_ptr<vsomeip_v3::application> app);
    
    /**
     * \brief Get the current vSomeIP application instance
     * 
     * \return Shared pointer to vSomeIP application
     */
    std::shared_ptr<vsomeip_v3::application> getApplication() const;
    
    /**
     * \brief Check if application is set
     * 
     * \return true if application is set, false otherwise
     */
    bool hasApplication() const;
    
    /**
     * \brief Start the vSomeIP application in a separate thread
     * 
     * This method starts a new thread that calls the app's start() method.
     * The thread will run until the application is stopped.
     */
    void start();
    
    /**
     * \brief Check if the application is currently running
     * 
     * \return true if the application is running, false otherwise
     */
    bool isRunning() const;
    
    /**
     * \brief Stop the vSomeIP application and wait for the thread to complete
     * 
     * This method stops the application and waits for the running thread
     * to complete, ensuring proper cleanup of resources including lock files.
     */
    void stop();
    
    /**
     * \brief Register a state handler callback
     * 
     * \param callbackId Unique identifier for the callback
     */
    void registerStateHandler(const std::string& callbackId);
    
    /**
     * \brief Register a message handler callback
     * 
     * \param service Service identifier
     * \param instance Instance identifier
     * \param method Method identifier
     * \param callbackId Unique identifier for the callback
     */
    void registerMessageHandler(uint16_t service, uint16_t instance, uint16_t method, 
                               const std::string& callbackId);
    
    /**
     * \brief Register an availability handler callback
     * 
     * \param service Service identifier
     * \param instance Instance identifier
     * \param callbackId Unique identifier for the callback
     */
    void registerAvailabilityHandler(uint16_t service, uint16_t instance, 
                                    const std::string& callbackId);
    
    /**
     * \brief Register a subscription handler callback
     * 
     * \param service Service identifier
     * \param instance Instance identifier
     * \param eventgroup Eventgroup identifier
     * \param callbackId Unique identifier for the callback
     */
    void registerSubscriptionHandler(uint16_t service, uint16_t instance, uint16_t eventgroup, 
                                   const std::string& callbackId);
    
    /**
     * \brief Register a subscription status handler callback
     * 
     * \param service Service identifier
     * \param instance Instance identifier
     * \param eventgroup Eventgroup identifier
     * \param event Event identifier
     * \param is_selective Selective subscription flag
     * \param callbackId Unique identifier for the callback
     */
    void registerSubscriptionStatusHandler(uint16_t service, uint16_t instance, 
                                         uint16_t eventgroup, uint16_t event, bool is_selective,
                                         const std::string& callbackId);
    
    /**
     * \brief Set a watchdog handler callback
     * 
     * \param callbackId Unique identifier for the callback
     * \param interval Watchdog interval in seconds
     */
    void setWatchdogHandler(const std::string& callbackId, std::chrono::seconds interval);
};


#endif // VSOMEIP_CALLBACK_WRAPPER_HPP 
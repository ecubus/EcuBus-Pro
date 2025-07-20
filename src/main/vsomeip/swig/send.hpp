// Copyright (C) 2014-2021 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

#ifndef VSOMEIP_SEND_HPP
#define VSOMEIP_SEND_HPP

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
#include <map>

namespace vsomeip_v3 {
    class application;
    class runtime;
    class message;
}



/**
 * \brief vSomeIP callback wrapper class for Node.js integration
 * 
 * This class provides a wrapper around vSomeIP application callbacks,
 * allowing JavaScript functions to be registered as callbacks for
 * various vSomeIP events.
 */
class Send {
private:
    std::shared_ptr<vsomeip_v3::runtime> rtm_;
    std::shared_ptr<vsomeip_v3::application> app_;
    std::map<int, std::shared_ptr<vsomeip_v3::message>> messageStore_;
    int messageIdCounter_;

public:
    /**
     * \brief Constructor
     * 
     * \param app Shared pointer to vSomeIP application instance
     */
    Send(std::shared_ptr<vsomeip_v3::runtime> rtm = nullptr,std::shared_ptr<vsomeip_v3::application> app = nullptr);
    
    /**
     * \brief Destructor
     */
    ~Send();

    void sendMessage(uint16_t service, uint16_t instance,uint16_t method,char* data,uint32_t length);
    
    void sendResponse(int messageId, char* data, uint32_t length);
    
    // Helper methods for message management
    int storeMessage(std::shared_ptr<vsomeip_v3::message> msg);
    std::shared_ptr<vsomeip_v3::message> getMessage(int messageId);
    void removeMessage(int messageId);
};




#endif // VSOMEIP_CALLBACK_WRAPPER_HPP 
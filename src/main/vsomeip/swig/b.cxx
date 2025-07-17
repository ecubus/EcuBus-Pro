#include "napi.h"
#include "vsomeip_callback_wrapper.hpp"
#include <vsomeip/vsomeip.hpp>
#include <map>
#include <memory>
#include <string>
#include <functional>

using namespace vsomeip_v3;

// Callback context structure to store JavaScript callbacks
struct CallbackContext {
    Napi::ThreadSafeFunction tsfn;
    std::string callbackId;
    std::string callbackType;
    
    CallbackContext(Napi::ThreadSafeFunction tsfn, std::string id, std::string type) 
        : tsfn(tsfn), callbackId(id), callbackType(type) {}
};

// Global callback registry
std::map<std::string, std::shared_ptr<CallbackContext>> callbackRegistry;

// Helper function to generate unique callback IDs
std::string generateCallbackId(const std::string& prefix) {
    static int counter = 0;
    return prefix + "_" + std::to_string(++counter);
}

// Finalizer callback for ThreadSafeFunction
void FinalizerCallback(Napi::Env env, void* finalizeData, CallbackContext* context) {
    // Clean up the context
    delete context;
}

// Helper function to call JavaScript callback with type and data
void CallJsCallback(CallbackContext* context, const std::function<void(Napi::Env, Napi::Function)>& callback) {
    if (context) {
        context->tsfn.BlockingCall([callback](Napi::Env env, Napi::Function jsCallback) {
            callback(env, jsCallback);
        });
    }
}

// VsomeipCallbackWrapper implementation
VsomeipCallbackWrapper::VsomeipCallbackWrapper(std::shared_ptr<application> app) : app_(app), is_running_(false) {}

VsomeipCallbackWrapper::~VsomeipCallbackWrapper() {
    // If the thread is still running, we should join it
    if (app_thread_.joinable()) {
        app_thread_.join();
    }
}

void VsomeipCallbackWrapper::setApplication(std::shared_ptr<application> app) {
    app_ = app;
}

std::shared_ptr<application> VsomeipCallbackWrapper::getApplication() const {
    return app_;
}

bool VsomeipCallbackWrapper::hasApplication() const {
    return app_ != nullptr;
}

void VsomeipCallbackWrapper::start() {
    if (!app_) {
        return;
    }
    
    if (is_running_) {
        return; // Already running
    }
    
    is_running_ = true;
    
    // Start the application in a separate thread
    app_thread_ = std::thread([this]() {
        if (app_) {
            app_->start();
        }
        is_running_ = false;
    });
}

bool VsomeipCallbackWrapper::isRunning() const {
    return is_running_;
}

void VsomeipCallbackWrapper::stop() {
    if (!app_ || !is_running_) {
        return;
    }
    
    // Stop the vSomeIP application
    app_->stop();
    
    // Wait for the thread to complete
    if (app_thread_.joinable()) {
        app_thread_.join();
    }
    
    is_running_ = false;
}

// State handler wrapper
void VsomeipCallbackWrapper::registerStateHandler(const std::string& callbackId) {
    if (!app_) {
        return;
    }
    
    if (callbackRegistry.find(callbackId) == callbackRegistry.end()) {
        return;
    }
    
    auto context = callbackRegistry[callbackId];
    app_->register_state_handler([context](state_type_e state) {
        CallJsCallback(context.get(), [state](Napi::Env env, Napi::Function jsCallback) {
            Napi::Object result = Napi::Object::New(env);
            result.Set("type", Napi::String::New(env, "state"));
            result.Set("data", Napi::Number::New(env, static_cast<int>(state)));
            
            jsCallback.Call({result});
        });
    });
}

// Message handler wrapper
void VsomeipCallbackWrapper::registerMessageHandler(uint16_t service, uint16_t instance, uint16_t method, 
                               const std::string& callbackId) {
    if (!app_) {
        return;
    }
    
    if (callbackRegistry.find(callbackId) == callbackRegistry.end()) {
        return;
    }
    
    auto context = callbackRegistry[callbackId];
    app_->register_message_handler(service, instance, method, 
        [context](const std::shared_ptr<message>& msg) {
            CallJsCallback(context.get(), [msg](Napi::Env env, Napi::Function jsCallback) {
                // Create a JavaScript object representing the message
                Napi::Object msgObj = Napi::Object::New(env);
                
                // Add basic message properties
                msgObj.Set("service", Napi::Number::New(env, msg->get_service()));
                msgObj.Set("instance", Napi::Number::New(env, msg->get_instance()));
                msgObj.Set("method", Napi::Number::New(env, msg->get_method()));
                msgObj.Set("client", Napi::Number::New(env, msg->get_client()));
                msgObj.Set("session", Napi::Number::New(env, msg->get_session()));
                
                // Add payload if available
                if (msg->get_payload()) {
                    auto payload = msg->get_payload();
                    auto data = payload->get_data();
                    auto size = payload->get_length();
                    
                    Napi::Buffer<uint8_t> buffer = Napi::Buffer<uint8_t>::Copy(env, data, size);
                    msgObj.Set("payload", buffer);
                }
                
                Napi::Object result = Napi::Object::New(env);
                result.Set("type", Napi::String::New(env, "message"));
                result.Set("data", msgObj);
                
                jsCallback.Call({result});
            });
        });
}

// Availability handler wrapper
void VsomeipCallbackWrapper::registerAvailabilityHandler(uint16_t service, uint16_t instance, 
                                    const std::string& callbackId) {
    if (!app_) {
        return;
    }
    
    if (callbackRegistry.find(callbackId) == callbackRegistry.end()) {
        return;
    }
    
    auto context = callbackRegistry[callbackId];
    app_->register_availability_handler(service, instance, 
        [context](service_t service, instance_t instance, bool is_available) {
            CallJsCallback(context.get(), [service, instance, is_available](Napi::Env env, Napi::Function jsCallback) {
                Napi::Object availabilityObj = Napi::Object::New(env);
                availabilityObj.Set("service", Napi::Number::New(env, service));
                availabilityObj.Set("instance", Napi::Number::New(env, instance));
                availabilityObj.Set("available", Napi::Boolean::New(env, is_available));
                
                Napi::Object result = Napi::Object::New(env);
                result.Set("type", Napi::String::New(env, "availability"));
                result.Set("data", availabilityObj);
                
                jsCallback.Call({result});
            });
        });
}

// Subscription handler wrapper
void VsomeipCallbackWrapper::registerSubscriptionHandler(uint16_t service, uint16_t instance, uint16_t eventgroup, 
                                   const std::string& callbackId) {
    if (!app_) {
        return;
    }
    
    if (callbackRegistry.find(callbackId) == callbackRegistry.end()) {
        return;
    }
    
    auto context = callbackRegistry[callbackId];
    app_->register_subscription_handler(service, instance, eventgroup, 
        [context](client_t client, uid_t uid, gid_t gid, bool is_subscribed) -> bool {
            CallJsCallback(context.get(), [client, uid, gid, is_subscribed](Napi::Env env, Napi::Function jsCallback) {
                Napi::Object subscriptionObj = Napi::Object::New(env);
                subscriptionObj.Set("client", Napi::Number::New(env, client));
                subscriptionObj.Set("uid", Napi::Number::New(env, uid));
                subscriptionObj.Set("gid", Napi::Number::New(env, gid));
                subscriptionObj.Set("subscribed", Napi::Boolean::New(env, is_subscribed));
                
                Napi::Object result = Napi::Object::New(env);
                result.Set("type", Napi::String::New(env, "subscription"));
                result.Set("data", subscriptionObj);
                
                jsCallback.Call({result});
            });
            return true; // Accept subscription
        });
}

// Subscription status handler wrapper - Fixed signature to match subscription_status_handler_t
void VsomeipCallbackWrapper::registerSubscriptionStatusHandler(uint16_t service, uint16_t instance, 
                                         uint16_t eventgroup, uint16_t event, bool is_selective,
                                         const std::string& callbackId) {
    if (!app_) {
        return;
    }
    
    if (callbackRegistry.find(callbackId) == callbackRegistry.end()) {
        return;
    }
    
    auto context = callbackRegistry[callbackId];
    app_->register_subscription_status_handler(service, instance, eventgroup, event, 
        [context](const service_t service, const instance_t instance, const eventgroup_t eventgroup,
                 const event_t event, const uint16_t status) {
            CallJsCallback(context.get(), [service, instance, eventgroup, event, status](Napi::Env env, Napi::Function jsCallback) {
                Napi::Object statusObj = Napi::Object::New(env);
                statusObj.Set("service", Napi::Number::New(env, service));
                statusObj.Set("instance", Napi::Number::New(env, instance));
                statusObj.Set("eventgroup", Napi::Number::New(env, eventgroup));
                statusObj.Set("event", Napi::Number::New(env, event));
                statusObj.Set("status", Napi::Number::New(env, status));
                
                Napi::Object result = Napi::Object::New(env);
                result.Set("type", Napi::String::New(env, "subscription_status"));
                result.Set("data", statusObj);
                
                jsCallback.Call({result});
            });
        }, is_selective);
}

// Watchdog handler wrapper
void VsomeipCallbackWrapper::setWatchdogHandler(const std::string& callbackId, std::chrono::seconds interval) {
    if (!app_) {
        return;
    }
    
    if (callbackRegistry.find(callbackId) == callbackRegistry.end()) {
        return;
    }
    
    auto context = callbackRegistry[callbackId];
    app_->set_watchdog_handler(
        [context]() {
            CallJsCallback(context.get(), [](Napi::Env env, Napi::Function jsCallback) {
                Napi::Object result = Napi::Object::New(env);
                result.Set("type", Napi::String::New(env, "watchdog"));
                result.Set("data", env.Undefined());
                
                jsCallback.Call({result});
            });
        }, 
        interval
    );
}

// N-API wrapper functions
Napi::Value RegisterCallback(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() <3) {
        Napi::Error::New(env, "Expected 3 arguments: callback type, callback name and JavaScript function").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    std::string callbackType = info[0].As<Napi::String>().Utf8Value();
    std::string callbackName = info[1].As<Napi::String>().Utf8Value();
    Napi::Function jsCallback = info[2].As<Napi::Function>();
    
    // Generate unique callback ID
    std::string callbackId = generateCallbackId(callbackType);
    
    // Create ThreadSafeFunction
    auto context = new CallbackContext(
        Napi::ThreadSafeFunction::New(
            env,
            jsCallback,
            callbackId,
          0// Unlimited queue
        1 // Initial thread count
        ),
        callbackId,
        callbackType
    );
    
    // Store in registry
    callbackRegistry[callbackId] = std::shared_ptr<CallbackContext>(context);
    
    return Napi::String::New(env, callbackId);
}

Napi::Value UnregisterCallback(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1) {
        Napi::Error::New(env, "Expected callback ID").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    std::string callbackId = info[0].As<Napi::String>().Utf8Value();
    
    auto it = callbackRegistry.find(callbackId);
    if (it != callbackRegistry.end()) {
        // Release the ThreadSafeFunction
        it->second->tsfn.Release();
        callbackRegistry.erase(it);
    }
    
    return env.Undefined();
}


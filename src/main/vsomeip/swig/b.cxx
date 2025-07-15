#include "napi.h"
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
    
    CallbackContext(Napi::ThreadSafeFunction tsfn, std::string id) 
        : tsfn(tsfn), callbackId(id) {}
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

// Helper function to call JavaScript callback
void CallJsCallback(CallbackContext* context, const std::function<void(Napi::Env, Napi::Function)>& callback) {
    if (context) {
        context->tsfn.BlockingCall([callback](Napi::Env env, Napi::Function jsCallback) {
            callback(env, jsCallback);
        });
    }
}

// vSomeIP callback wrappers
class VsomeipCallbackWrapper {
private:
    std::shared_ptr<application> app_;
    
public:
    VsomeipCallbackWrapper(std::shared_ptr<application> app) : app_(app) {}
    
    /**
     * Set the vSomeIP application instance
     */
    void setApplication(std::shared_ptr<application> app) {
        app_ = app;
    }
    
    /**
     * Get the current vSomeIP application instance
     */
    std::shared_ptr<application> getApplication() const {
        return app_;
    }
    
    /**
     * Check if application is set
     */
    bool hasApplication() const {
        return app_ != nullptr;
    }
    
    // State handler wrapper
    void registerStateHandler(const std::string& callbackId) {
        if (!app_) {
            return;
        }
        
        if (callbackRegistry.find(callbackId) == callbackRegistry.end()) {
            return;
        }
        
        auto context = callbackRegistry[callbackId];
        app_->register_state_handler([context](state_type_e state) {
            CallJsCallback(context.get(), [state](Napi::Env env, Napi::Function jsCallback) {
                jsCallback.Call({Napi::Number::New(env, static_cast<int>(state))});
            });
        });
    }
    
    // Message handler wrapper
    void registerMessageHandler(service_t service, instance_t instance, method_t method, 
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
                    
                    jsCallback.Call({msgObj});
                });
            });
    }
    
    // Availability handler wrapper
    void registerAvailabilityHandler(service_t service, instance_t instance, 
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
                    Napi::Object result = Napi::Object::New(env);
                    result.Set("service", Napi::Number::New(env, service));
                    result.Set("instance", Napi::Number::New(env, instance));
                    result.Set("available", Napi::Boolean::New(env, is_available));
                    
                    jsCallback.Call({result});
                });
            });
    }
    
    // Subscription handler wrapper
    void registerSubscriptionHandler(service_t service, instance_t instance, eventgroup_t eventgroup, 
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
                    Napi::Object result = Napi::Object::New(env);
                    result.Set("client", Napi::Number::New(env, client));
                    result.Set("uid", Napi::Number::New(env, uid));
                    result.Set("gid", Napi::Number::New(env, gid));
                    result.Set("subscribed", Napi::Boolean::New(env, is_subscribed));
                    
                    jsCallback.Call({result});
                });
                return true; // Accept subscription
            });
    }
    
    // Subscription status handler wrapper
    // void registerSubscriptionStatusHandler(service_t service, instance_t instance, 
    //                                      eventgroup_t eventgroup, event_t event, 
    //                                      const std::string& callbackId) {
    //     if (!app_) {
    //         return;
    //     }
        
    //     if (callbackRegistry.find(callbackId) == callbackRegistry.end()) {
    //         return;
    //     }
        
    //     auto context = callbackRegistry[callbackId];
    //     app_->register_subscription_status_handler(service, instance, eventgroup, event, 
    //         [context](eventgroup_t eg, event_t evt, subscription_status_e st) {
    //             CallJsCallback(context.get(), [eg, evt, st](Napi::Env env, Napi::Function jsCallback) {
    //                 Napi::Object result = Napi::Object::New(env);
    //                 result.Set("eventgroup", Napi::Number::New(env, eg));
    //                 result.Set("event", Napi::Number::New(env, evt));
    //                 result.Set("status", Napi::Number::New(env, static_cast<int>(st)));
                    
    //                 jsCallback.Call({result});
    //             });
    //         });
    // }
    
    // Watchdog handler wrapper
    void setWatchdogHandler(const std::string& callbackId, std::chrono::seconds interval) {
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
                    jsCallback.Call({});
                });
            }, 
            interval
        );
    }
};

// N-API wrapper functions
Napi::Value RegisterCallback(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 2) {
        Napi::Error::New(env, "Expected 2 arguments: callback type and JavaScript function").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    std::string callbackType = info[0].As<Napi::String>().Utf8Value();
    Napi::Function jsCallback = info[1].As<Napi::Function>();
    
    // Generate unique callback ID
    std::string callbackId = generateCallbackId(callbackType);
    
    // Create ThreadSafeFunction
    auto context = new CallbackContext(
        Napi::ThreadSafeFunction::New(
            env,
            jsCallback,
            callbackId,
            0,  // Unlimited queue
            1   // Initial thread count
        ),
        callbackId
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


/**
 * SocketCAN fake/stub for non-Linux platforms
 * Exports same interface as socketcan.cxx but returns empty/error
 */

#include <napi.h>

Napi::Value ListInterfaces(const Napi::CallbackInfo& info) {
  return Napi::Array::New(info.Env());
}

Napi::Value CreateTSFN(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::Error::New(env, "SocketCAN is only supported on Linux").ThrowAsJavaScriptException();
  return env.Null();
}

void FreeTSFN(const Napi::CallbackInfo& info) {}

Napi::Value SendCANMsg(const Napi::CallbackInfo& info) {
  return Napi::Boolean::New(info.Env(), false);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("ListInterfaces", Napi::Function::New(env, ListInterfaces));
  exports.Set("CreateTSFN", Napi::Function::New(env, CreateTSFN));
  exports.Set("FreeTSFN", Napi::Function::New(env, FreeTSFN));
  exports.Set("SendCANMsg", Napi::Function::New(env, SendCANMsg));
  return exports;
}

NODE_API_MODULE(socketcan, Init)

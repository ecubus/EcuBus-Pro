/**
 * SocketCAN Node.js N-API binding
 * Linux only - uses native SocketCAN API
 */

#include <napi.h>
#include <map>
#include <mutex>
#include <thread>
#include <cstring>
#include <string>
#include "api/socketcan_api.h"

struct SocketcanContext {
  int fd;
  std::string name;
  bool closed;
  std::thread rxThread;
  Napi::ThreadSafeFunction rxTsfn;
  Napi::ThreadSafeFunction errorTsfn;
};

std::map<std::string, SocketcanContext*> g_contextMap;
std::mutex g_contextMutex;

static void rxCallback(Napi::Env env, Napi::Function jsCallback, void* data) {
  socketcan_frame_t* frame = (socketcan_frame_t*)data;
  if (!frame) {
    jsCallback.Call({env.Null()});
    return;
  }

  Napi::Object msgObj = Napi::Object::New(env);
  msgObj.Set("ID", Napi::Number::New(env, frame->can_id));
  msgObj.Set("TimeStamp", Napi::Number::New(env, 0));  /* SocketCAN doesn't provide hw timestamp in basic read */
  msgObj.Set("DLC", Napi::Number::New(env, frame->can_dlc));
  msgObj.Set("Flags", Napi::Number::New(env, 0));
  msgObj.Set("FrameType", Napi::Number::New(env, 1));  /* 1 = receive */

  uint8_t len = frame->can_dlc > 8 ? 8 : frame->can_dlc;
  Napi::Buffer<uint8_t> dataBuffer = Napi::Buffer<uint8_t>::Copy(env, frame->data, len);
  msgObj.Set("Data", dataBuffer);

  jsCallback.Call({msgObj});
  delete frame;
}

static void errorCallback(Napi::Env env, Napi::Function jsCallback, void* data) {
  SocketcanContext* ctx = (SocketcanContext*)data;
  Napi::Object errObj = Napi::Object::New(env);
  errObj.Set("message", Napi::String::New(env, "SocketCAN error"));
  if (ctx) {
    errObj.Set("fd", Napi::Number::New(env, ctx->fd));
  }
  jsCallback.Call({errObj});
}

static void rxThreadEntry(SocketcanContext* ctx) {
  socketcan_frame_t frame;
  while (!ctx->closed && ctx->fd >= 0) {
    int ret = socketcan_receive(ctx->fd, &frame, 100);
    if (ret == 1) {
      socketcan_frame_t* copy = new socketcan_frame_t();
      memcpy(copy, &frame, sizeof(socketcan_frame_t));
      ctx->rxTsfn.NonBlockingCall(copy, rxCallback);
    } else if (ret < 0 && !ctx->closed) {
      ctx->errorTsfn.NonBlockingCall(ctx, errorCallback);
      break;
    }
  }
}

Napi::Value ListInterfaces(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  char ifaces[32][16];
  int count = socketcan_list_interfaces(ifaces, 32);

  Napi::Array arr = Napi::Array::New(env);
  if (count > 0) {
    for (int i = 0; i < count; i++) {
      arr[i] = Napi::String::New(env, ifaces[i]);
    }
  }
  return arr;
}

Napi::Value CreateTSFN(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 5) {
    Napi::TypeError::New(env, "Expected: ifaceName, bitrate, name, rxCallback, errorCallback")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  std::string ifaceName = info[0].As<Napi::String>().Utf8Value();
  uint32_t bitrate = info[1].As<Napi::Number>().Uint32Value();
  std::string name = info[2].As<Napi::String>().Utf8Value();

  int fd = socketcan_open(ifaceName.c_str(), bitrate);
  if (fd < 0) {
    Napi::Error::New(env, std::string("SocketCAN open failed: ") + socketcan_strerror(fd))
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  auto ctx = new SocketcanContext();
  ctx->fd = fd;
  ctx->name = name;
  ctx->closed = false;

  ctx->rxTsfn = Napi::ThreadSafeFunction::New(
      env, info[3].As<Napi::Function>(), (name + "_rx").c_str(), 0, 1, ctx);
  ctx->errorTsfn = Napi::ThreadSafeFunction::New(
      env, info[4].As<Napi::Function>(), (name + "_err").c_str(), 0, 1, ctx);

  ctx->rxThread = std::thread(rxThreadEntry, ctx);

  {
    std::lock_guard<std::mutex> lock(g_contextMutex);
    g_contextMap[name] = ctx;
  }

  return env.Undefined();
}

void FreeTSFN(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1) {
    Napi::TypeError::New(env, "Expected: name").ThrowAsJavaScriptException();
    return;
  }

  std::string name = info[0].As<Napi::String>().Utf8Value();
  SocketcanContext* ctx = nullptr;

  {
    std::lock_guard<std::mutex> lock(g_contextMutex);
    auto it = g_contextMap.find(name);
    if (it != g_contextMap.end()) {
      ctx = it->second;
      g_contextMap.erase(it);
    }
  }

  if (ctx) {
    ctx->closed = true;
    if (ctx->fd >= 0) {
      socketcan_close(ctx->fd);
      ctx->fd = -1;
    }
    if (ctx->rxThread.joinable()) {
      ctx->rxThread.join();
    }
    ctx->rxTsfn.Release();
    ctx->errorTsfn.Release();
    delete ctx;
  }
}

Napi::Value SendCANMsg(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 4) {
    Napi::TypeError::New(env, "Expected: name, canId, flags, dataBuffer").ThrowAsJavaScriptException();
    return Napi::Boolean::New(env, false);
  }

  std::string name = info[0].As<Napi::String>().Utf8Value();
  uint32_t canId = info[1].As<Napi::Number>().Uint32Value();
  uint32_t flags = info[2].As<Napi::Number>().Uint32Value();
  Napi::Buffer<uint8_t> buf = info[3].As<Napi::Buffer<uint8_t>>();

  SocketcanContext* ctx = nullptr;
  {
    std::lock_guard<std::mutex> lock(g_contextMutex);
    auto it = g_contextMap.find(name);
    if (it != g_contextMap.end()) {
      ctx = it->second;
    }
  }

  if (!ctx || ctx->fd < 0) {
    return Napi::Boolean::New(env, false);
  }

  socketcan_frame_t frame;
  memset(&frame, 0, sizeof(frame));
  frame.can_id = canId | flags;
  size_t len = buf.ByteLength();
  if (len > 8) len = 8;
  frame.can_dlc = (uint8_t)len;
  memcpy(frame.data, buf.Data(), len);

  int ret = socketcan_send(ctx->fd, &frame);
  return Napi::Boolean::New(env, ret == SOCKETCAN_OK);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("ListInterfaces", Napi::Function::New(env, ListInterfaces));
  exports.Set("CreateTSFN", Napi::Function::New(env, CreateTSFN));
  exports.Set("FreeTSFN", Napi::Function::New(env, FreeTSFN));
  exports.Set("SendCANMsg", Napi::Function::New(env, SendCANMsg));
  return exports;
}

NODE_API_MODULE(socketcan, Init)

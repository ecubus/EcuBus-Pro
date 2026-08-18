/*
 * Minimal POSIX JSON-RPC client demo for `ecb_cli rpc`.
 *
 *   1. Start the server:  ecb_cli rpc
 *   2. Build:             make
 *   3. Run:               ./can_rpc_demo
 *
 * This is a reference for a PC MCAL Can.c — not a full AUTOSAR stack.
 */
#define _POSIX_C_SOURCE 200809L
#include "can_rpc.h"

#include <arpa/inet.h>
#include <errno.h>
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <time.h>
#include <unistd.h>

static int g_id = 1;

static int rpc_connect(const char *host, int port) {
  int fd = socket(AF_INET, SOCK_STREAM, 0);
  if (fd < 0) {
    perror("socket");
    return -1;
  }
  int one = 1;
  setsockopt(fd, IPPROTO_TCP, TCP_NODELAY, &one, sizeof(one));
  struct sockaddr_in addr;
  memset(&addr, 0, sizeof(addr));
  addr.sin_family = AF_INET;
  addr.sin_port = htons((uint16_t)port);
  if (inet_pton(AF_INET, host, &addr.sin_addr) != 1) {
    fprintf(stderr, "invalid host %s\n", host);
    close(fd);
    return -1;
  }
  if (connect(fd, (struct sockaddr *)&addr, sizeof(addr)) != 0) {
    perror("connect");
    close(fd);
    return -1;
  }
  return fd;
}

static int rpc_call(int fd, const char *req, char *resp, size_t resp_sz) {
  size_t n = strlen(req);
  if (write(fd, req, n) != (ssize_t)n) {
    perror("write");
    return -1;
  }
  size_t off = 0;
  while (off + 1 < resp_sz) {
    ssize_t r = read(fd, resp + off, resp_sz - off - 1);
    if (r <= 0) {
      perror("read");
      return -1;
    }
    off += (size_t)r;
    resp[off] = '\0';
    if (strchr(resp, '\n') != NULL) {
      return 0;
    }
  }
  fprintf(stderr, "response too large\n");
  return -1;
}

static int rpc_fmt_call(int fd, const char *method, const char *params, char *resp, size_t resp_sz) {
  char req[2048];
  int n = snprintf(
      req,
      sizeof(req),
      "{\"jsonrpc\":\"2.0\",\"method\":\"%s\",\"params\":%s,\"id\":%d}\n",
      method,
      params,
      g_id++
  );
  if (n < 0 || (size_t)n >= sizeof(req)) {
    fprintf(stderr, "request too large\n");
    return -1;
  }
  printf(">> %s", req);
  if (rpc_call(fd, req, resp, resp_sz) != 0) {
    return -1;
  }
  printf("<< %s", resp);
  return 0;
}

int main(int argc, char **argv) {
  const char *host = argc > 1 ? argv[1] : ECB_RPC_DEFAULT_HOST;
  int port = argc > 2 ? atoi(argv[2]) : ECB_RPC_DEFAULT_PORT;

  int fd = rpc_connect(host, port);
  if (fd < 0) {
    fprintf(stderr, "start the server first: ecb_cli rpc -p %d\n", port);
    return 1;
  }

  char resp[8192];
  if (rpc_fmt_call(fd, ECB_RPC_SYS_PING, "{}", resp, sizeof(resp)) != 0) {
    close(fd);
    return 1;
  }

  /* Two simulate controllers: TX on 0, RX on 1 (virtual bus loopback). */
  if (rpc_fmt_call(
          fd,
          ECB_RPC_CAN_INIT,
          "{\"controllers\":["
          "{\"controllerId\":0,\"vendor\":\"simulate\",\"handle\":0,\"name\":\"MCU\"},"
          "{\"controllerId\":1,\"vendor\":\"simulate\",\"handle\":1,\"name\":\"PEER\"}"
          "]}",
          resp,
          sizeof(resp)
      ) != 0) {
    close(fd);
    return 1;
  }

  rpc_fmt_call(
      fd,
      ECB_RPC_CAN_SET_CONTROLLER_MODE,
      "{\"controller\":0,\"transition\":\"CAN_T_START\"}",
      resp,
      sizeof(resp)
  );
  rpc_fmt_call(
      fd,
      ECB_RPC_CAN_SET_CONTROLLER_MODE,
      "{\"controller\":1,\"transition\":\"CAN_T_START\"}",
      resp,
      sizeof(resp)
  );

  /* Can_Write(Hth=0, id=0x123, 4 bytes) */
  rpc_fmt_call(
      fd,
      ECB_RPC_CAN_WRITE_HTH,
      "{\"hth\":0,\"id\":\"0x123\",\"sdu\":[1,2,3,4],\"swPduHandle\":1}",
      resp,
      sizeof(resp)
  );

  {
    struct timespec ts = {0, 20 * 1000 * 1000};
    nanosleep(&ts, NULL);
  }

  /* Can_MainFunction_Read -> CanIf_RxIndication */
  rpc_fmt_call(fd, ECB_RPC_CAN_MF_READ, "{\"max\":16}", resp, sizeof(resp));
  rpc_fmt_call(fd, ECB_RPC_CAN_MF_WRITE, "{}", resp, sizeof(resp));

  rpc_fmt_call(fd, ECB_RPC_CAN_DEINIT, "{}", resp, sizeof(resp));
  close(fd);
  return 0;
}

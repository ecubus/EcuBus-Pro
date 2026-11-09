/*
 * SocketCAN API for Linux
 * Provides C interface for SocketCAN operations
 */

#ifndef SOCKETCAN_API_H
#define SOCKETCAN_API_H

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

/* CAN frame structure compatible with linux/can.h */
typedef struct {
  uint32_t can_id;
  uint8_t can_dlc;
  uint8_t __pad;
  uint8_t __res0;
  uint8_t __res1;
  uint8_t data[8];
} socketcan_frame_t;

/* CAN FD frame - for future CAN FD support */
typedef struct {
  uint32_t can_id;
  uint8_t len;
  uint8_t flags;
  uint8_t __res0;
  uint8_t __res1;
  uint8_t data[64];
} socketcan_fd_frame_t;

/* Result codes */
typedef enum {
  SOCKETCAN_OK = 0,
  SOCKETCAN_ERR_SOCKET = -1,
  SOCKETCAN_ERR_BIND = -2,
  SOCKETCAN_ERR_IOCTL = -3,
  SOCKETCAN_ERR_SEND = -4,
  SOCKETCAN_ERR_RECV = -5,
  SOCKETCAN_ERR_INVALID_PARAM = -6,
  SOCKETCAN_ERR_IFACE_DOWN = -7,
  SOCKETCAN_ERR_TIMEOUT = -8
} socketcan_err_t;

/*
 * Get list of available CAN interfaces.
 * Returns number of interfaces found, or negative on error.
 * iface_names: array of char pointers, each will be set to interface name (caller allocates)
 * max_count: maximum number of interfaces to return
 */
int socketcan_list_interfaces(char iface_names[][16], int max_count);

/*
 * Open SocketCAN interface.
 * iface_name: interface name (e.g. "can0", "vcan0")
 * bitrate: bitrate in bps (0 = use existing config, for vcan typically 0)
 * Returns socket fd on success, negative on error
 */
int socketcan_open(const char* iface_name, uint32_t bitrate);

/*
 * Close SocketCAN socket.
 */
void socketcan_close(int fd);

/*
 * Send CAN frame.
 * fd: socket from socketcan_open
 * frame: CAN frame to send
 * Returns SOCKETCAN_OK on success
 */
int socketcan_send(int fd, const socketcan_frame_t* frame);

/*
 * Receive CAN frame with timeout.
 * fd: socket from socketcan_open
 * frame: output frame
 * timeout_ms: timeout in milliseconds
 * Returns 1 on success, 0 on timeout, negative on error
 */
int socketcan_receive(int fd, socketcan_frame_t* frame, int timeout_ms);

/*
 * Get last error string.
 */
const char* socketcan_strerror(int err);

#ifdef __cplusplus
}
#endif

#endif /* SOCKETCAN_API_H */

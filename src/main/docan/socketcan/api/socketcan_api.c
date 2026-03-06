/*
 * SocketCAN API implementation for Linux
 */

#define _GNU_SOURCE
#include "socketcan_api.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <errno.h>
#include <dirent.h>
#include <sys/socket.h>
#include <sys/ioctl.h>
#include <net/if.h>
#include <linux/can/raw.h>
#include <linux/can.h>
#include <poll.h>

static const char* err_strings[] = {
  "Success",
  "Socket creation failed",
  "Bind failed",
  "Ioctl failed",
  "Send failed",
  "Receive failed",
  "Invalid parameter",
  "Interface down",
  "Timeout"
};

const char* socketcan_strerror(int err) {
  int idx = -err;
  if (idx >= 0 && idx < (int)(sizeof(err_strings) / sizeof(err_strings[0]))) {
    return err_strings[idx];
  }
  return strerror(errno);
}

int socketcan_list_interfaces(char iface_names[][16], int max_count) {
  DIR* dir = opendir("/sys/class/net");
  if (!dir) {
    return -1;
  }

  int count = 0;
  struct dirent* entry;

  while ((entry = readdir(dir)) != NULL && count < max_count) {
    if (entry->d_name[0] == '.') continue;
    /* Filter: can*, vcan*, slcan* */
    if (strncmp(entry->d_name, "can", 3) == 0 ||
        strncmp(entry->d_name, "vcan", 4) == 0 ||
        strncmp(entry->d_name, "slcan", 5) == 0) {
      strncpy(iface_names[count], entry->d_name, 15);
      iface_names[count][15] = '\0';
      count++;
    }
  }

  closedir(dir);
  return count;
}

static int set_can_bitrate(const char* iface_name, uint32_t bitrate) {
  char cmd[256];
  int ret;
  /* Use ip command to set bitrate - requires interface to be down first */
  snprintf(cmd, sizeof(cmd), "ip link set %s down 2>/dev/null; ip link set %s type can bitrate %u 2>/dev/null",
           iface_name, iface_name, (unsigned int)bitrate);
  ret = system(cmd);
  if (ret != 0) {
    return SOCKETCAN_ERR_IOCTL;
  }
  return SOCKETCAN_OK;
}

static int bring_interface_up(const char* iface_name) {
  char cmd[128];
  snprintf(cmd, sizeof(cmd), "ip link set %s up 2>/dev/null", iface_name);
  if (system(cmd) != 0) {
    return SOCKETCAN_ERR_IFACE_DOWN;
  }
  return SOCKETCAN_OK;
}

int socketcan_open(const char* iface_name, uint32_t bitrate) {
  int fd;
  struct sockaddr_can addr;
  struct ifreq ifr;

  if (!iface_name || strlen(iface_name) == 0) {
    return SOCKETCAN_ERR_INVALID_PARAM;
  }

  fd = socket(PF_CAN, SOCK_RAW, CAN_RAW);
  if (fd < 0) {
    return SOCKETCAN_ERR_SOCKET;
  }

  memset(&ifr, 0, sizeof(ifr));
  strncpy(ifr.ifr_name, iface_name, IFNAMSIZ - 1);
  ifr.ifr_name[IFNAMSIZ - 1] = '\0';

  if (ioctl(fd, SIOCGIFINDEX, &ifr) < 0) {
    close(fd);
    return SOCKETCAN_ERR_IOCTL;
  }

  /* Set bitrate if specified and not vcan (vcan doesn't support bitrate) */
  if (bitrate > 0 && strncmp(iface_name, "vcan", 4) != 0) {
    if (set_can_bitrate(iface_name, bitrate) != SOCKETCAN_OK) {
      close(fd);
      return SOCKETCAN_ERR_IOCTL;
    }
  }

  if (bring_interface_up(iface_name) != SOCKETCAN_OK) {
    close(fd);
    return SOCKETCAN_ERR_IFACE_DOWN;
  }

  memset(&addr, 0, sizeof(addr));
  addr.can_family = AF_CAN;
  addr.can_ifindex = ifr.ifr_ifindex;

  if (bind(fd, (struct sockaddr*)&addr, sizeof(addr)) < 0) {
    close(fd);
    return SOCKETCAN_ERR_BIND;
  }

  /* Enable receiving own messages (loopback) - useful for testing */
  int loopback = 1;
  setsockopt(fd, SOL_CAN_RAW, CAN_RAW_RECV_OWN_MSGS, &loopback, sizeof(loopback));

  return fd;
}

void socketcan_close(int fd) {
  if (fd >= 0) {
    close(fd);
  }
}

int socketcan_send(int fd, const socketcan_frame_t* frame) {
  ssize_t n;

  if (fd < 0 || !frame) {
    return SOCKETCAN_ERR_INVALID_PARAM;
  }

  n = write(fd, frame, sizeof(socketcan_frame_t));
  if (n != (ssize_t)sizeof(socketcan_frame_t)) {
    return SOCKETCAN_ERR_SEND;
  }

  return SOCKETCAN_OK;
}

int socketcan_receive(int fd, socketcan_frame_t* frame, int timeout_ms) {
  struct pollfd pfd;
  ssize_t n;

  if (fd < 0 || !frame) {
    return SOCKETCAN_ERR_INVALID_PARAM;
  }

  pfd.fd = fd;
  pfd.events = POLLIN;

  if (poll(&pfd, 1, timeout_ms) <= 0) {
    return (timeout_ms > 0 && errno == 0) ? 0 : SOCKETCAN_ERR_TIMEOUT;
  }

  n = read(fd, frame, sizeof(socketcan_frame_t));
  if (n != (ssize_t)sizeof(socketcan_frame_t)) {
    return SOCKETCAN_ERR_RECV;
  }

  return 1;
}

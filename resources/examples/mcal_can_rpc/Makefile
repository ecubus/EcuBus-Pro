CC ?= cc
CFLAGS ?= -std=c11 -Wall -Wextra -O2

.PHONY: all clean

all: can_rpc_demo

can_rpc_demo: can_rpc_demo.c can_rpc.h
	$(CC) $(CFLAGS) -o $@ can_rpc_demo.c

clean:
	rm -f can_rpc_demo

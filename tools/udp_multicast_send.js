const dgram = require('dgram');

// 配置参数
const INTERFACE_IP = '192.168.6.63';     // 网卡 IP
const MULTICAST_ADDRESS = '224.224.224.245'; // 组播地址
const PORT = 30490;                      // 端口号

// 创建 UDP socket
const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

// Socket 错误处理
socket.on('error', (err) => {
  console.error('Socket error:', err);
  socket.close();
});

// Socket 消息监听（用于接收组播数据）
socket.on('message', (msg, rinfo) => {
  console.log(`[${new Date().toISOString()}] Received multicast message:`);
  console.log(`  From: ${rinfo.address}:${rinfo.port}`);
  console.log(`  Length: ${msg.length} bytes`);
  console.log(`  Data (hex): ${msg.toString('hex')}`);
  console.log(`  Data (string): ${msg.toString('utf8')}`);
  console.log('---');
});

// Socket 监听完成
socket.on('listening', () => {
  const address = socket.address();
  console.log(`Socket listening on ${address.address}:${address.port}`);
  console.log(`Interface: ${INTERFACE_IP}`);
  console.log(`Multicast address: ${MULTICAST_ADDRESS}:${PORT}`);
});

// 绑定到端口（在 Windows 上绑定到 0.0.0.0 可能更可靠）
// 注意：某些情况下绑定到特定 IP 可能不工作，可以尝试绑定到 0.0.0.0
socket.bind(PORT, () => {
  try {
    // 设置组播 TTL (Time To Live) - 仅用于发送
    socket.setMulticastTTL(128);
    
    // 设置组播接口（绑定到指定的网卡）- 用于发送
    // 在 Windows 上，可以尝试使用接口索引或 IP 地址
    try {
      socket.setMulticastInterface(INTERFACE_IP);
      console.log(`Multicast interface set to: ${INTERFACE_IP}`);
    } catch (err) {
      console.warn(`Warning: Could not set multicast interface: ${err.message}`);
      console.warn('Trying without explicit interface setting...');
    }
    
    // 必须加入组播组才能接收数据！
    try {
      socket.addMembership(MULTICAST_ADDRESS, INTERFACE_IP);
      console.log(`Joined multicast group: ${MULTICAST_ADDRESS} on interface ${INTERFACE_IP}`);
    } catch (err) {
      console.warn(`Warning: Could not join multicast on specific interface: ${err.message}`);
      console.warn('Trying to join without specifying interface...');
      try {
        socket.addMembership(MULTICAST_ADDRESS);
        console.log(`Joined multicast group: ${MULTICAST_ADDRESS} (default interface)`);
      } catch (err2) {
        console.error('Failed to join multicast group:', err2);
        throw err2;
      }
    }
    
    // 设置组播回环（允许接收自己发送的数据）
    // socket.setMulticastLoopback(true);
    
    console.log('Socket bound and ready for multicast receiving/sending');
    console.log('Waiting for multicast messages...\n');
    
    // 发送组播消息示例（可选）
    // sendMulticastMessage('Hello from UDP multicast sender!');
    
    // 定期发送消息（可选）
    // setInterval(() => {
    //   const message = `Multicast message at ${new Date().toISOString()}`;
    //   sendMulticastMessage(message);
    // }, 1000);
  } catch (err) {
    console.error('Error setting up multicast:', err);
    socket.close();
    process.exit(1);
  }
});

// 发送组播消息的函数
function sendMulticastMessage(message) {
  const messageBuffer = Buffer.from(message);
  
  socket.send(
    messageBuffer,
    0,
    messageBuffer.length,
    PORT,
    MULTICAST_ADDRESS,
    (err) => {
      if (err) {
        console.error('Error sending multicast message:', err);
      } else {
        console.log(`Sent multicast message: ${message}`);
      }
    }
  );
}

// 优雅退出处理
process.on('SIGINT', () => {
  console.log('\nClosing socket...');
  socket.close(() => {
    console.log('Socket closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\nClosing socket...');
  socket.close(() => {
    console.log('Socket closed');
    process.exit(0);
  });
});


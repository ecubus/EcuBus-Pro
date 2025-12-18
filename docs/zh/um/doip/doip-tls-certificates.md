# DoIP v3 TLS 证书生成指南

本文档描述了如何使用 OpenSSL 为 DoIP v3 安全通信生成 TLS 证书和密钥。

## 概述

DoIP v3 使用 TLS（传输层安全）来加密测试仪（客户端）与 ECU/车辆网关（服务器）之间的诊断通信。 需要生成以下证书：

- **CA（证书颁发机构）**：用于签署服务器和客户端证书的根证书
- **服务器证书**：由 DoIP 实体（ECU/网关）用于验证自身身份
- **客户端证书**：由诊断测试仪用于验证自身身份（双向 TLS）

## 目录结构

```
doip-certs/
├── ca/
│   ├── ca.key          # CA 私钥
│   └── ca.crt          # CA 证书
├── server/
│   ├── server.key      # 服务器私钥
│   ├── server.csr      # 服务器证书签名请求
│   └── server.crt      # 服务器证书
└── tester/
    ├── tester.key      # 测试仪私钥
    ├── tester.csr      # 测试仪证书签名请求
    └── tester.crt      # 测试仪证书
```

## 分步命令

### 1. 创建目录结构

```bash
mkdir -p doip-certs/ca doip-certs/server doip-certs/tester
cd doip-certs
```

### 2. 生成 CA（证书颁发机构）

CA 是信任根。 服务器和测试仪证书都将由此 CA 签署。

```bash
# 生成 CA 私钥（4096 位 RSA）
openssl genrsa -out ca/ca.key 4096

# 生成自签名 CA 证书（有效期为 10 年）
openssl req -new -x509 -days 3650 -key ca/ca.key -out ca/ca.crt \
    -subj "/C=CN/ST=Shanghai/L=Shanghai/O=EcuBus/OU=DoIP/CN=DoIP-CA"
```

**用途：**

- `ca.key`：CA 的私钥，必须安全保管。 用于签署其他证书。
- `ca.crt`：CA 的公钥证书，分发给服务器和测试仪以进行信任验证。

---

### 3. 生成服务器证书（DoIP 实体 / ECU / 网关）

服务器证书由 DoIP 实体使用，用于向连接的测试仪证明其身份。

```bash
# 生成服务器私钥（2048 位 RSA）
openssl genrsa -out server/server.key 2048

# 创建服务器证书签名请求（CSR）
openssl req -new -key server/server.key -out server/server.csr \
    -subj "/C=CN/ST=Shanghai/L=Shanghai/O=EcuBus/OU=DoIP-Server/CN=doip-server"

# 使用 CA 签署服务器证书（有效期为 1 年）
openssl x509 -req -days 365 -in server/server.csr -CA ca/ca.crt -CAkey ca/ca.key \
    -CAcreateserial -out server/server.crt
```

**用途（服务器端）：**

- `server.key`：服务器的私钥，用于 TLS 握手加密。 必须仅保存在服务器上。
- `server.csr`：证书签名请求，证书生成过程中使用的临时文件。
- `server.crt`：服务器的公钥证书，在 TLS 握手期间发送给客户端以证明身份。

**服务器端需要的文件：**

- `server.key` - 用于解密的私钥
- `server.crt` - 向客户端出示的证书
- `ca.crt` - 用于验证客户端证书（用于双向 TLS）

---

### 4. 生成测试仪证书（诊断测试仪 / 客户端）

测试仪证书用于双向 TLS 认证，允许服务器验证测试仪的身份。

```bash
# 生成测试仪私钥（2048 位 RSA）
openssl genrsa -out tester/tester.key 2048

# 创建测试仪证书签名请求（CSR）
openssl req -new -key tester/tester.key -out tester/tester.csr \
    -subj "/C=CN/ST=Shanghai/L=Shanghai/O=EcuBus/OU=DoIP-Tester/CN=doip-tester"

# 使用 CA 签署测试仪证书（有效期为 1 年）
openssl x509 -req -days 365 -in tester/tester.csr -CA ca/ca.crt -CAkey ca/ca.key \
    -CAcreateserial -out tester/tester.crt
```

**用途（测试仪端）：**

- `tester.key`：测试仪的私钥，用于证明证书的所有权。
- `tester.csr`：证书签名请求，证书生成过程中使用的临时文件。
- `tester.crt`：测试仪的公钥证书，发送给服务器以进行双向认证。

**测试仪端需要的文件：**

- `tester.key` - 用于认证的私钥
- `tester.crt` - 向服务器出示的证书
- `ca.crt` - 用于验证服务器证书

---

## 完整脚本

以下是一个生成所有证书的完整脚本：

```bash
#!/bin/bash

# 创建目录
mkdir -p doip-certs/ca doip-certs/server doip-certs/tester
cd doip-certs

echo "=== 生成 CA ==="
openssl genrsa -out ca/ca.key 4096
openssl req -new -x509 -days 3650 -key ca/ca.key -out ca/ca.crt \
    -subj "/C=CN/ST=Shanghai/L=Shanghai/O=EcuBus/OU=DoIP/CN=DoIP-CA"

echo "=== 生成服务器证书 ==="
openssl genrsa -out server/server.key 2048
openssl req -new -key server/server.key -out server/server.csr \
    -subj "/C=CN/ST=Shanghai/L=Shanghai/O=EcuBus/OU=DoIP-Server/CN=doip-server"
openssl x509 -req -days 365 -in server/server.csr -CA ca/ca.crt -CAkey ca/ca.key \
    -CAcreateserial -out server/server.crt

echo "=== 生成测试仪证书 ==="
openssl genrsa -out tester/tester.key 2048
openssl req -new -key tester/tester.key -out tester/tester.csr \
    -subj "/C=CN/ST=Shanghai/L=Shanghai/O=EcuBus/OU=DoIP-Tester/CN=doip-tester"
openssl x509 -req -days 365 -in tester/tester.csr -CA ca/ca.crt -CAkey ca/ca.key \
    -CAcreateserial -out tester/tester.crt

echo "=== 验证证书 ==="
echo "服务器证书："
openssl verify -CAfile ca/ca.crt server/server.crt

echo "测试仪证书："
openssl verify -CAfile ca/ca.crt tester/tester.crt

echo "=== 完成 ==="
```

---

## PowerShell 脚本（Windows）

```powershell
# 创建目录
New-Item -ItemType Directory -Force -Path "doip-certs/ca", "doip-certs/server", "doip-certs/tester"
Set-Location doip-certs

Write-Host "=== 生成 CA ===" -ForegroundColor Green
openssl genrsa -out ca/ca.key 4096
openssl req -new -x509 -days 3650 -key ca/ca.key -out ca/ca.crt `
    -subj "/C=CN/ST=Shanghai/L=Shanghai/O=EcuBus/OU=DoIP/CN=DoIP-CA"

Write-Host "=== 生成服务器证书 ===" -ForegroundColor Green
openssl genrsa -out server/server.key 2048
openssl req -new -key server/server.key -out server/server.csr `
    -subj "/C=CN/ST=Shanghai/L=Shanghai/O=EcuBus/OU=DoIP-Server/CN=doip-server"
openssl x509 -req -days 365 -in server/server.csr -CA ca/ca.crt -CAkey ca/ca.key `
    -CAcreateserial -out server/server.crt

Write-Host "=== 生成测试仪证书 ===" -ForegroundColor Green
openssl genrsa -out tester/tester.key 2048
openssl req -new -key tester/tester.key -out tester/tester.csr `
    -subj "/C=CN/ST=Shanghai/L=Shanghai/O=EcuBus/OU=DoIP-Tester/CN=doip-tester"
openssl x509 -req -days 365 -in tester/tester.csr -CA ca/ca.crt -CAkey ca/ca.key `
    -CAcreateserial -out tester/tester.crt

Write-Host "=== 验证证书 ===" -ForegroundColor Green
openssl verify -CAfile ca/ca.crt server/server.crt
openssl verify -CAfile ca/ca.crt tester/tester.crt

Write-Host "=== 完成 ===" -ForegroundColor Green
```

---

## 证书摘要表

| 文件           | 位置  | 用途         | 保密？        |
| ------------ | --- | ---------- | ---------- |
| `ca.key`     | CA  | 签署所有证书     | **是**（主密钥） |
| `ca.crt`     | 两者  | 根信任锚点      | 否          |
| `server.key` | 服务器 | 服务器 TLS 认证 | **是**      |
| `server.crt` | 服务器 | 服务器身份证明    | 否          |
| `tester.key` | 测试仪 | 测试仪 TLS 认证 | **是**      |
| `tester.crt` | 测试仪 | 测试仪身份证明    | 否          |

---

## 有用的验证命令

```bash
# 查看证书详情
openssl x509 -in server/server.crt -text -noout

# 验证证书链
openssl verify -CAfile ca/ca.crt server/server.crt
openssl verify -CAfile ca/ca.crt tester/tester.crt

# 测试 TLS 连接（服务器端）
openssl s_server -accept 13400 -cert server/server.crt -key server/server.key -CAfile ca/ca.crt -Verify 1

# 测试 TLS 连接（测试仪端）
openssl s_client -connect localhost:13400 -cert tester/tester.crt -key tester/tester.key -CAfile ca/ca.crt
```

---

## TLS 握手流程（DoIP v3）

```
    测试仪（客户端）                           DoIP 实体（服务器）
         |                                            |
         |  1. ClientHello                            |
         |  ----------------------------------------> |
         |                                            |
         |  2. ServerHello + server.crt               |
         |  <---------------------------------------- |
         |                                            |
         |  3. 使用 ca.crt 验证 server.crt          |
         |                                            |
         |  4. CertificateRequest（双向 TLS）        |
         |  <---------------------------------------- |
         |                                            |
         |  5. tester.crt + KeyExchange               |
         |  ----------------------------------------> |
         |                                            |
         |  6. 使用 ca.crt 验证 tester.crt          |
         |                                            |
         |  7. Finished                               |
         |  <---------------------------------------> |
         |                                            |
         |  === 安全 DoIP 通信 ===         |
         |                                            |
```

---

## 备注

1. **密钥长度**：CA 使用 4096 位以增强安全性，而服务器/测试仪使用 2048 位以在安全性和性能之间取得平衡。

2. **有效期**：CA 有效期为 10 年，而服务器/测试仪证书有效期为 1 年。 请在到期前续期。

3. **CN（通用名称）**：可根据您的需求进行自定义。 对于生产环境，请使用实际的域名或 VIN 号码。

4. **DoIP 端口**：默认 DoIP TLS 端口为 **3496**（安全）与 **13400**（不安全）。

5. **生产使用**：对于生产环境，请考虑使用适当的 PKI 基础设施和 HSM 进行密钥存储。


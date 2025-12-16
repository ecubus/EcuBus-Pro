# DoIP v3 TLS Certificates Generation Guide

This document describes how to generate TLS certificates and keys for DoIP v3 secure communication using OpenSSL.

## Overview

DoIP v3 uses TLS (Transport Layer Security) to encrypt diagnostic communication between the tester (client) and ECU/vehicle gateway (server). The following certificates need to be generated:

- **CA (Certificate Authority)**: Root certificate used to sign both server and client certificates
- **Server Certificate**: Used by DoIP entity (ECU/Gateway) to authenticate itself
- **Client Certificate**: Used by diagnostic tester to authenticate itself (mutual TLS)

## Directory Structure

```
doip-certs/
├── ca/
│   ├── ca.key          # CA private key
│   └── ca.crt          # CA certificate
├── server/
│   ├── server.key      # Server private key
│   ├── server.csr      # Server certificate signing request
│   └── server.crt      # Server certificate
└── tester/
    ├── tester.key      # Tester private key
    ├── tester.csr      # Tester certificate signing request
    └── tester.crt      # Tester certificate
```

## Step-by-Step Commands

### 1. Create Directory Structure

```bash
mkdir -p doip-certs/ca doip-certs/server doip-certs/tester
cd doip-certs
```

### 2. Generate CA (Certificate Authority)

The CA is the root of trust. Both server and tester certificates will be signed by this CA.

```bash
# Generate CA private key (4096 bits RSA)
openssl genrsa -out ca/ca.key 4096

# Generate self-signed CA certificate (valid for 10 years)
openssl req -new -x509 -days 3650 -key ca/ca.key -out ca/ca.crt \
    -subj "/C=CN/ST=Shanghai/L=Shanghai/O=EcuBus/OU=DoIP/CN=DoIP-CA"
```

**Purpose:**
- `ca.key`: CA's private key, must be kept secure. Used to sign other certificates.
- `ca.crt`: CA's public certificate, distributed to both server and tester for trust verification.

---

### 3. Generate Server Certificate (DoIP Entity / ECU / Gateway)

The server certificate is used by the DoIP entity to prove its identity to connecting testers.

```bash
# Generate server private key (2048 bits RSA)
openssl genrsa -out server/server.key 2048

# Create server certificate signing request (CSR)
openssl req -new -key server/server.key -out server/server.csr \
    -subj "/C=CN/ST=Shanghai/L=Shanghai/O=EcuBus/OU=DoIP-Server/CN=doip-server"

# Sign server certificate with CA (valid for 1 year)
openssl x509 -req -days 365 -in server/server.csr -CA ca/ca.crt -CAkey ca/ca.key \
    -CAcreateserial -out server/server.crt
```

**Purpose (Server Side):**
- `server.key`: Server's private key, used for TLS handshake encryption. Must be kept on the server only.
- `server.csr`: Certificate Signing Request, temporary file used during certificate generation.
- `server.crt`: Server's public certificate, sent to clients during TLS handshake to prove identity.

**Files needed on Server:**
- `server.key` - Private key for decryption
- `server.crt` - Certificate to present to clients
- `ca.crt` - To verify client certificates (for mutual TLS)

---

### 4. Generate Tester Certificate (Diagnostic Tester / Client)

The tester certificate is used for mutual TLS authentication, allowing the server to verify the tester's identity.

```bash
# Generate tester private key (2048 bits RSA)
openssl genrsa -out tester/tester.key 2048

# Create tester certificate signing request (CSR)
openssl req -new -key tester/tester.key -out tester/tester.csr \
    -subj "/C=CN/ST=Shanghai/L=Shanghai/O=EcuBus/OU=DoIP-Tester/CN=doip-tester"

# Sign tester certificate with CA (valid for 1 year)
openssl x509 -req -days 365 -in tester/tester.csr -CA ca/ca.crt -CAkey ca/ca.key \
    -CAcreateserial -out tester/tester.crt
```

**Purpose (Tester Side):**
- `tester.key`: Tester's private key, used to prove ownership of the certificate.
- `tester.csr`: Certificate Signing Request, temporary file used during certificate generation.
- `tester.crt`: Tester's public certificate, sent to server for mutual authentication.

**Files needed on Tester:**
- `tester.key` - Private key for authentication
- `tester.crt` - Certificate to present to server
- `ca.crt` - To verify server certificate

---

## Complete Script

Here's a complete script to generate all certificates:

```bash
#!/bin/bash

# Create directories
mkdir -p doip-certs/ca doip-certs/server doip-certs/tester
cd doip-certs

echo "=== Generating CA ==="
openssl genrsa -out ca/ca.key 4096
openssl req -new -x509 -days 3650 -key ca/ca.key -out ca/ca.crt \
    -subj "/C=CN/ST=Shanghai/L=Shanghai/O=EcuBus/OU=DoIP/CN=DoIP-CA"

echo "=== Generating Server Certificate ==="
openssl genrsa -out server/server.key 2048
openssl req -new -key server/server.key -out server/server.csr \
    -subj "/C=CN/ST=Shanghai/L=Shanghai/O=EcuBus/OU=DoIP-Server/CN=doip-server"
openssl x509 -req -days 365 -in server/server.csr -CA ca/ca.crt -CAkey ca/ca.key \
    -CAcreateserial -out server/server.crt

echo "=== Generating Tester Certificate ==="
openssl genrsa -out tester/tester.key 2048
openssl req -new -key tester/tester.key -out tester/tester.csr \
    -subj "/C=CN/ST=Shanghai/L=Shanghai/O=EcuBus/OU=DoIP-Tester/CN=doip-tester"
openssl x509 -req -days 365 -in tester/tester.csr -CA ca/ca.crt -CAkey ca/ca.key \
    -CAcreateserial -out tester/tester.crt

echo "=== Verifying Certificates ==="
echo "Server certificate:"
openssl verify -CAfile ca/ca.crt server/server.crt

echo "Tester certificate:"
openssl verify -CAfile ca/ca.crt tester/tester.crt

echo "=== Done ==="
```

---

## PowerShell Script (Windows)

```powershell
# Create directories
New-Item -ItemType Directory -Force -Path "doip-certs/ca", "doip-certs/server", "doip-certs/tester"
Set-Location doip-certs

Write-Host "=== Generating CA ===" -ForegroundColor Green
openssl genrsa -out ca/ca.key 4096
openssl req -new -x509 -days 3650 -key ca/ca.key -out ca/ca.crt `
    -subj "/C=CN/ST=Shanghai/L=Shanghai/O=EcuBus/OU=DoIP/CN=DoIP-CA"

Write-Host "=== Generating Server Certificate ===" -ForegroundColor Green
openssl genrsa -out server/server.key 2048
openssl req -new -key server/server.key -out server/server.csr `
    -subj "/C=CN/ST=Shanghai/L=Shanghai/O=EcuBus/OU=DoIP-Server/CN=doip-server"
openssl x509 -req -days 365 -in server/server.csr -CA ca/ca.crt -CAkey ca/ca.key `
    -CAcreateserial -out server/server.crt

Write-Host "=== Generating Tester Certificate ===" -ForegroundColor Green
openssl genrsa -out tester/tester.key 2048
openssl req -new -key tester/tester.key -out tester/tester.csr `
    -subj "/C=CN/ST=Shanghai/L=Shanghai/O=EcuBus/OU=DoIP-Tester/CN=doip-tester"
openssl x509 -req -days 365 -in tester/tester.csr -CA ca/ca.crt -CAkey ca/ca.key `
    -CAcreateserial -out tester/tester.crt

Write-Host "=== Verifying Certificates ===" -ForegroundColor Green
openssl verify -CAfile ca/ca.crt server/server.crt
openssl verify -CAfile ca/ca.crt tester/tester.crt

Write-Host "=== Done ===" -ForegroundColor Green
```

---

## Certificate Summary Table

| File | Location | Purpose | Keep Secret? |
|------|----------|---------|--------------|
| `ca.key` | CA | Signs all certificates | **YES** (Master key) |
| `ca.crt` | Both | Root trust anchor | No |
| `server.key` | Server | Server TLS authentication | **YES** |
| `server.crt` | Server | Server identity proof | No |
| `tester.key` | Tester | Tester TLS authentication | **YES** |
| `tester.crt` | Tester | Tester identity proof | No |

---

## Useful Verification Commands

```bash
# View certificate details
openssl x509 -in server/server.crt -text -noout

# Verify certificate chain
openssl verify -CAfile ca/ca.crt server/server.crt
openssl verify -CAfile ca/ca.crt tester/tester.crt

# Test TLS connection (server side)
openssl s_server -accept 13400 -cert server/server.crt -key server/server.key -CAfile ca/ca.crt -Verify 1

# Test TLS connection (tester side)
openssl s_client -connect localhost:13400 -cert tester/tester.crt -key tester/tester.key -CAfile ca/ca.crt
```

---

## TLS Handshake Flow (DoIP v3)

```
    Tester (Client)                           DoIP Entity (Server)
         |                                            |
         |  1. ClientHello                            |
         |  ----------------------------------------> |
         |                                            |
         |  2. ServerHello + server.crt               |
         |  <---------------------------------------- |
         |                                            |
         |  3. Verify server.crt with ca.crt          |
         |                                            |
         |  4. CertificateRequest (mutual TLS)        |
         |  <---------------------------------------- |
         |                                            |
         |  5. tester.crt + KeyExchange               |
         |  ----------------------------------------> |
         |                                            |
         |  6. Verify tester.crt with ca.crt          |
         |                                            |
         |  7. Finished                               |
         |  <---------------------------------------> |
         |                                            |
         |  === Secure DoIP Communication ===         |
         |                                            |
```

---

## Notes

1. **Key Length**: CA uses 4096 bits for stronger security, while server/tester use 2048 bits for balance between security and performance.

2. **Validity Period**: CA is valid for 10 years, while server/tester certificates are valid for 1 year. Renew before expiration.

3. **CN (Common Name)**: Can be customized based on your requirements. For production, use actual domain names or VIN numbers.

4. **DoIP Port**: Default DoIP TLS port is **3496** (secure) vs **13400** (unsecure).

5. **Production Use**: For production environments, consider using a proper PKI infrastructure and HSM for key storage.


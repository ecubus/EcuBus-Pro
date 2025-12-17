# DoIP v3 TLS Certificate Generation Script
# This script generates CA, Server, and Tester certificates for DoIP secure communication

param(
    [string]$OutputDir = "doip-certs",
    [string]$Country = "CN",
    [string]$State = "Shanghai",
    [string]$City = "Shanghai",
    [string]$Organization = "EcuBus"
)

Write-Host @"
+================================================================+
|          DoIP v3 TLS Certificate Generation Script             |
+================================================================+
|  This script will generate:                                    |
|  - CA Certificate (Certificate Authority)                      |
|  - Server Certificate (for DoIP Entity/ECU/Gateway)            |
|  - Tester Certificate (for Diagnostic Tester/Client)           |
+================================================================+
"@ -ForegroundColor Cyan

# Check if OpenSSL is available
try {
    $opensslVersion = openssl version
    Write-Host "Using: $opensslVersion" -ForegroundColor Gray
} catch {
    Write-Host "ERROR: OpenSSL is not installed or not in PATH!" -ForegroundColor Red
    Write-Host "Please install OpenSSL and add it to your PATH." -ForegroundColor Yellow
    exit 1
}

# Create output directories
Write-Host "`n[1/6] Creating directory structure..." -ForegroundColor Yellow
$caDir = Join-Path $OutputDir "ca"
$serverDir = Join-Path $OutputDir "server"
$testerDir = Join-Path $OutputDir "tester"

New-Item -ItemType Directory -Force -Path $caDir, $serverDir, $testerDir | Out-Null
Write-Host "       Created: $OutputDir/{ca, server, tester}" -ForegroundColor Green

# Generate CA
Write-Host "`n[2/6] Generating CA (Certificate Authority)..." -ForegroundColor Yellow
$caKeyPath = Join-Path $caDir "ca.key"
$caCrtPath = Join-Path $caDir "ca.crt"
$caSubject = "/C=$Country/ST=$State/L=$City/O=$Organization/OU=DoIP/CN=DoIP-CA"

openssl genrsa -out $caKeyPath 4096 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR generating CA key!" -ForegroundColor Red; exit 1 }

openssl req -new -x509 -days 3650 -key $caKeyPath -out $caCrtPath -subj $caSubject 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR generating CA certificate!" -ForegroundColor Red; exit 1 }

Write-Host "       CA Key:         $caKeyPath" -ForegroundColor Green
Write-Host "       CA Certificate: $caCrtPath (valid 10 years)" -ForegroundColor Green

# Generate Server Certificate
Write-Host "`n[3/6] Generating Server Certificate (DoIP Entity)..." -ForegroundColor Yellow
$serverKeyPath = Join-Path $serverDir "server.key"
$serverCsrPath = Join-Path $serverDir "server.csr"
$serverCrtPath = Join-Path $serverDir "server.crt"
$serverSubject = "/C=$Country/ST=$State/L=$City/O=$Organization/OU=DoIP-Server/CN=doip-server"

openssl genrsa -out $serverKeyPath 2048 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR generating server key!" -ForegroundColor Red; exit 1 }

openssl req -new -key $serverKeyPath -out $serverCsrPath -subj $serverSubject 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR generating server CSR!" -ForegroundColor Red; exit 1 }

Write-Host "       Server Key: $serverKeyPath" -ForegroundColor Green
Write-Host "       Server CSR: $serverCsrPath" -ForegroundColor Green

# Sign Server Certificate
Write-Host "`n[4/6] Signing Server Certificate with CA..." -ForegroundColor Yellow
openssl x509 -req -days 365 -in $serverCsrPath -CA $caCrtPath -CAkey $caKeyPath -CAcreateserial -out $serverCrtPath 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR signing server certificate!" -ForegroundColor Red; exit 1 }

Write-Host "       Server Certificate: $serverCrtPath (valid 1 year)" -ForegroundColor Green

# Generate Tester Certificate
Write-Host "`n[5/6] Generating Tester Certificate (Diagnostic Client)..." -ForegroundColor Yellow
$testerKeyPath = Join-Path $testerDir "tester.key"
$testerCsrPath = Join-Path $testerDir "tester.csr"
$testerCrtPath = Join-Path $testerDir "tester.crt"
$testerSubject = "/C=$Country/ST=$State/L=$City/O=$Organization/OU=DoIP-Tester/CN=doip-tester"

openssl genrsa -out $testerKeyPath 2048 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR generating tester key!" -ForegroundColor Red; exit 1 }

openssl req -new -key $testerKeyPath -out $testerCsrPath -subj $testerSubject 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR generating tester CSR!" -ForegroundColor Red; exit 1 }

Write-Host "       Tester Key: $testerKeyPath" -ForegroundColor Green
Write-Host "       Tester CSR: $testerCsrPath" -ForegroundColor Green

# Sign Tester Certificate
Write-Host "`n[6/6] Signing Tester Certificate with CA..." -ForegroundColor Yellow
openssl x509 -req -days 365 -in $testerCsrPath -CA $caCrtPath -CAkey $caKeyPath -CAcreateserial -out $testerCrtPath 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR signing tester certificate!" -ForegroundColor Red; exit 1 }

Write-Host "       Tester Certificate: $testerCrtPath (valid 1 year)" -ForegroundColor Green

# Verify certificates
Write-Host "`n[Verification] Checking certificate chain..." -ForegroundColor Yellow
$serverVerify = openssl verify -CAfile $caCrtPath $serverCrtPath 2>&1
$testerVerify = openssl verify -CAfile $caCrtPath $testerCrtPath 2>&1

if ($serverVerify -match "OK") {
    Write-Host "       Server Certificate: VALID" -ForegroundColor Green
} else {
    Write-Host "       Server Certificate: INVALID - $serverVerify" -ForegroundColor Red
}

if ($testerVerify -match "OK") {
    Write-Host "       Tester Certificate: VALID" -ForegroundColor Green
} else {
    Write-Host "       Tester Certificate: INVALID - $testerVerify" -ForegroundColor Red
}

# Summary
Write-Host @"

+================================================================+
|                    Generation Complete!                        |
+================================================================+
|  Files for DoIP Server (ECU/Gateway):                          |
|    - server/server.key  (PRIVATE - keep secret!)               |
|    - server/server.crt  (Public certificate)                   |
|    - ca/ca.crt          (To verify tester certificates)        |
|                                                                |
|  Files for DoIP Tester (Diagnostic Client):                    |
|    - tester/tester.key  (PRIVATE - keep secret!)               |
|    - tester/tester.crt  (Public certificate)                   |
|    - ca/ca.crt          (To verify server certificates)        |
+================================================================+
"@ -ForegroundColor Cyan

Write-Host "Output directory: $(Resolve-Path $OutputDir)" -ForegroundColor White


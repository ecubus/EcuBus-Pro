#!/usr/bin/env bash
# Idempotent Cloud Agent bootstrap for EcuBus-Pro.
# Refreshes JS deps, the embedded standalone Python used for ODX/CDD/DBC
# parsing, the Linux native module stubs, and the bundled worker scripts.
set -euo pipefail

cd "$(dirname "$0")/.."

# Pinned to match .github/actions/setup-python-build/action.yml
PY_RELEASE="20260211"
PY_VERSION="3.13.12"
PY_ARCHIVE="cpython-${PY_VERSION}+${PY_RELEASE}-x86_64-unknown-linux-gnu-install_only.tar.gz"
PY_URL="https://github.com/astral-sh/python-build-standalone/releases/download/${PY_RELEASE}/${PY_ARCHIVE}"
PYTHON_BIN="resources/python/bin/python3"

echo "==> npm install"
npm install

if [ ! -x "$PYTHON_BIN" ]; then
  echo "==> Downloading standalone Python ${PY_VERSION}"
  tmp="$(mktemp -d)"
  curl -fsSL -o "${tmp}/python.tar.gz" "$PY_URL"
  mkdir -p resources
  tar -xzf "${tmp}/python.tar.gz" -C resources
  rm -rf "$tmp"
else
  echo "==> Standalone Python already present, skipping download"
fi

echo "==> Installing Python requirements"
"$PYTHON_BIN" -m pip install -r resources/requirements.txt

echo "==> Building native modules (Linux stubs)"
npm run native

echo "==> Building worker scripts"
npm run worker:js

echo "==> Install complete"

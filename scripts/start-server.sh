#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../server"
if [ -z "${JAVA_HOME:-}" ] && [ -x /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home/bin/java ]; then
  export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
fi
exec mvn spring-boot:run "$@"

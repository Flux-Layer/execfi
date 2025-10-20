#!/usr/bin/env bash
set -euo pipefail

# Ensure we are running from the contracts directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export FOUNDRY_OFFLINE=${FOUNDRY_OFFLINE:-true}

echo "Running ParameterRegistry tests..."
forge test --match-contract ParameterRegistry "$@"

echo "Running Item1155 tests..."
forge test --match-contract Item1155 "$@"

echo "Running Land721 tests..."
forge test --match-contract Land721 "$@"

echo "Running Shop tests..."
forge test --match-contract Shop "$@"

echo "Running Marketplace tests..."
forge test --match-contract Marketplace "$@"

echo "Running FarmingCore tests..."
forge test --match-contract FarmingCore "$@"

echo "All Greenvale module tests completed."

#!/usr/bin/env bash
# Compiles every circuit and writes a Solidity verifier per circuit to contracts/<Name>Verifier.sol.
# Run with `pnpm build:verifier`.
set -euo pipefail
cd "$(dirname "$0")"

nargo compile --workspace

# bb names the contract HonkVerifier and its linked libraries RelationsLib and ZKTranscriptLib in every
# verifier it generates. Two verifiers with the same names make Hardhat artifact lookups and Ignition
# library linking ambiguous, so prefix them with the circuit's name.
build_verifier() {
  local circuit=$1 name=$2
  local verifier="../contracts/${name}Verifier.sol"
  mkdir -p "target/$circuit"
  bb write_vk -t evm -b "target/$circuit.json" -o "target/$circuit"
  bb write_solidity_verifier -t evm -k "target/$circuit/vk" -o "$verifier"
  perl -pi -e "s/\bHonkVerifier\b/${name}Verifier/g; s/\b(RelationsLib|ZKTranscriptLib)\b/${name}\$1/g" "$verifier"
  echo "wrote $verifier"
}

build_verifier wakestake WakeStake
build_verifier stake_ownership StakeOwnership

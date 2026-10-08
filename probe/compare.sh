#!/bin/bash
# Repeatable A/B: native Pi vs Pi + this extension, same replay copy, same 120x40 tmux size, same flags.
# Output: <out>/report.txt plus every captured screen.
set -e; cd "$(dirname "$0")/.."
OUT=${1:-$PWD/probe/out/compare}
mkdir -p "$OUT"; : > "$OUT/report.txt"
probe/run.sh native; probe/run.sh av -e "$PWD/index.ts"; /bin/sleep 2
for L in native av; do probe/measure.sh $L "$OUT/$L" 1500 | tee -a "$OUT/report.txt"; done

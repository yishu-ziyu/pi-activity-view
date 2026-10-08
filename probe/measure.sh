#!/bin/bash
# usage: measure.sh <label> <outdir> [max]
# From the bottom, press PageUp until this turn's user prompt is visible. Saves every screen; prints the count.
L=$1; OUT=$2; MAX=${3:-400}; rm -rf "$OUT"; mkdir -p "$OUT"; n=0
tmux -L pav send-keys -t "$L" C-End; /bin/sleep 0.5
while [ $n -le $MAX ]; do
  f="$OUT/$(printf %04d $n).txt"; tmux -L pav capture-pane -p -t "$L" > "$f"
  grep -q "${PROMPT:-执行方案并且在虚拟机中测试}" "$f" && { echo "$L: $n pageups"; exit 0; }
  tmux -L pav send-keys -t "$L" PPage; n=$((n+1)); /bin/sleep 0.4
done; echo "$L: not found after $MAX"

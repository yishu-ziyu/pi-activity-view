#!/bin/bash
# usage: [LENS=1] [REPLAY=file] [WORKDIR=dir] run.sh <label> [extra pi args...]  (pi-lens is off unless LENS=1)
# Starts pi on a fresh copy of the replay session in a detached tmux session (120x40, socket "pav").
REPLAY=${REPLAY:-$(cd "$(dirname "$0")" && pwd)/fixtures/replay.jsonl}
L=$1; COPY=${TMPDIR:-/tmp}/pav-replay-$L.jsonl; cp "$REPLAY" "$COPY"; shift
tmux -L pav kill-session -t "$L" 2>/dev/null
tmux -L pav new-session -d -s "$L" -x 120 -y 40 -c "${WORKDIR:-$PWD}" "pi $([ "$LENS" = 1 ] || echo --no-lens) --session '$COPY' $*"
for i in $(seq 1 60); do tmux -L pav capture-pane -p -t "$L" | grep -q "Todos" && break; /bin/sleep 0.5; done
echo "$L ready"

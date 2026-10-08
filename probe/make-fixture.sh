#!/bin/bash
# Cut a recorded Pi session right after the turn whose prompt starts with PREFIX into probe/fixtures/replay.jsonl.
# The fixture holds real project content; it is git-ignored.
set -e; cd "$(dirname "$0")"
SRC="${1:?usage: make-fixture.sh <session.jsonl> [prompt-prefix]}"
PREFIX="${2:-执行方案并且在虚拟机中测试}"
python3 -I - "$SRC" fixtures/replay.jsonl "$PREFIX" <<'PY'
import json,sys
out=open(sys.argv[2],'w');on=False
for line in open(sys.argv[1]):
    try:e=json.loads(line)
    except: out.write(line);continue
    if e.get('type')=='message' and e['message'].get('role')=='user':
        c=e['message']['content'];t=c if isinstance(c,str) else ' '.join(x.get('text','') for x in c if x.get('type')=='text')
        if on: break
        on=t.startswith(sys.argv[3])
    out.write(line)
PY
echo "fixture: $(wc -c < fixtures/replay.jsonl) bytes"

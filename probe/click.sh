#!/bin/bash
# usage: click.sh <label> <regex>  -> left-click the first visible line matching regex (SGR mouse), print the screen after
L=$1; row=$(tmux -L pav capture-pane -p -t "$L" | grep -n -m1 -E "$2" | cut -d: -f1)
[ -z "$row" ] && { echo "no line matches: $2"; exit 1; }
tmux -L pav send-keys -t "$L" -l $'\e[<0;6;'"$row"'M'; tmux -L pav send-keys -t "$L" -l $'\e[<0;6;'"$row"'m'
/bin/sleep 0.6; echo "clicked row $row"; tmux -L pav capture-pane -p -t "$L"

// Turn real captured Pi screens into JSON the video renders. Usage: node prep.mjs <trialDir> <compareDir>
import fs from "fs"; import path from "path"; import Convert from "ansi-to-html";
const [trial, compare] = process.argv.slice(2);
const conv = () => new Convert({ escapeXML: true, stream: false, fg: "#d6d6d2", bg: "transparent" });
const clean = (s) => s.replace(/\x1b\]8;;[^\x1b\x07]*(\x1b\\|\x07)/g, "").replace(/\x1b\[\?[0-9;]*[a-zA-Z]/g, "");
const ans = (f) => clean(fs.readFileSync(f, "utf8")).split("\n").map((l) => conv().toHtml(l.replace(/\s+[│┃]\s*$/, "")));
// Lines overlaid by the "Jump to latest" hint are partial; mark them so they can be dropped.
const plain = (f) => fs.readFileSync(f, "utf8").split("\n").map((l) => (l.includes("Jump to latest") ? "" : l.replace(/\s*[│┃]\s*$/, "")));
const snaps = (d) => fs.readdirSync(d).filter((f) => /^\d+\.ans$/.test(f)).sort();
const out = {};
const nat = snaps(path.join(trial, "snaps/native"));
// Scene 1 must show the same recorded turn its numbers describe (the os session), not the demo task.
const nfiles0 = fs.readdirSync(path.join(compare, "native")).filter((f) => f.endsWith(".txt")).sort();
out.noise = [0.3, 0.55, 0.8].map((r) => plain(path.join(compare, "native", nfiles0[Math.floor(r * (nfiles0.length - 1))])).slice(0, 17));
const nfiles = fs.readdirSync(path.join(compare, "native")).filter((f) => f.endsWith(".txt")).sort();
out.scroll = Array.from({ length: 48 }, (_, i) => plain(path.join(compare, "native", nfiles[Math.floor((i / 47) * (nfiles.length - 1))])).slice(0, 17));
out.scrollCount = nfiles.length - 1;
// grouped view of the same turn, stitched in reading order
const afiles = fs.readdirSync(path.join(compare, "av")).filter((f) => f.endsWith(".txt")).sort().reverse();
const seen = new Set(); const stitched = []; let on = false;
for (const f of afiles) for (const l of plain(path.join(compare, "av", f)).slice(0, 17)) {
  if (l.includes("执行方案并且在虚拟机中测试")) on = true;
  if (!on || !l.trim() || seen.has(l)) continue; seen.add(l); stitched.push(l);
}
out.grouped = stitched.filter((l) => !/^ (Error: fetch failed|Thinking\.\.\.|Session compacted|Warning: tmux|and restart tmux)|^─|Update Available|New version|Changelog|Package Updates|pi update/i.test(l)).slice(0, 20);
// the explanation card (last one on screen)
const card = ans(path.join(trial, "snaps/pia2/card.ans"));
const rawCard = clean(fs.readFileSync(path.join(trial, "snaps/pia2/card.ans"), "utf8")).replace(/\x1b\[[0-9;:]*m/g, "").split("\n");
const start = rawCard.map((l, i) => (l.includes("用大白话说") ? i : -1)).filter((i) => i >= 0).pop();
let end = start; while (end < rawCard.length && !/Todos/.test(rawCard[end])) end++;
out.card = card.slice(start, end).filter((l) => l.replace(/<[^>]+>/g, "").trim());
// the prefill moment from the recorded replay (plain text, real wording)
out.prefill = ["   → 你要决定：是否重载检查器并继续，让 Agent 修正问题后重新验收。", "     已填入输入框：/reload　按 Enter 执行；不同意就清空，自己写。重载后会再填：继续"];
fs.writeFileSync("src/screens.json", JSON.stringify(out, null, 1));
console.log(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Array.isArray(v) ? v.length : v])));

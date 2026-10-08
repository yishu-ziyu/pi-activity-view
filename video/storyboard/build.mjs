// Storyboard: 3 directions, one still per scene, all built from the real captures in ../src/screens.json.
// Usage: node storyboard/build.mjs <out.html>
import fs from "fs";
const S = JSON.parse(fs.readFileSync(new URL("../src/screens.json", import.meta.url)));
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const html2txt = (h) => h.replace(/<[^>]+>/g, "").replace(/&#x([0-9A-F]+);/gi, (_, x) => String.fromCodePoint(parseInt(x, 16))).replace(/&amp;/g, "&");

// ---- frame building blocks (drawn at 1920x1080, scaled down by CSS) ----
const term = ({ lines, w = 1100, h = 640, x = 0, y = 0, rx = 0, ry = 0, rz = 0, blur = 0, title = "pi", fs = 19, theme = "dark", extra = "" }) => `
<div class="term ${theme}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;transform:perspective(2200px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg);filter:blur(${blur}px);${extra}">
 <div class="bar"><i></i><i></i><i></i><span>${title}</span></div>
 <div class="body" style="font-size:${fs}px">${lines.join("\n")}</div>
</div>`;
const plainLines = (arr, n = 99, max = 80) => arr.slice(0, n).map((l) => `<div>${esc(l.slice(0, max)) || "&nbsp;"}</div>`);
const htmlLines = (arr) => arr.map((l) => `<div>${l || "&nbsp;"}</div>`);
const groupedLines = (arr, max = 64) =>
	arr.map((l) => {
		const m = l.match(/^ ([·✗✓◐]) (.*)$/);
		if (!m) return `<div class="muted">${esc(l.slice(0, max)) || "&nbsp;"}</div>`;
		const fail = m[1] === "✗";
		return `<div class="hdr"><b class="${fail ? "err" : "dim"}">${m[1]}</b> ${esc(m[2].slice(0, max))}</div>`;
	});
const head = (lines, { x = 120, y = 140, size = 72, align = "left", partial = 99, color } = {}) =>
	`<div class="head" style="left:${x}px;top:${y}px;font-size:${size}px;text-align:${align};${align === "center" ? "width:1680px;" : ""}${color ? `color:${color};` : ""}">${lines
		.map((l, i) => `<div style="${i === 0 && lines.length > 1 ? "opacity:.5" : ""}">${l
			.split("")
			.map((c, j) => `<span style="opacity:${j < partial ? 1 : 0.12};filter:blur(${j < partial ? 0 : 6}px)">${c}</span>`)
			.join("")}</div>`)
		.join("")}</div>`;
const abs = (x, y, inner, style = "") => `<div style="position:absolute;left:${x}px;top:${y}px;${style}">${inner}</div>`;
const glowBar = (y) => `<div class="glowbar" style="top:${y}px"></div>`;
const key = (label, x, y, style = "") => abs(x, y, `<div class="key">${label}</div>`, style);
const card = S.card.map(html2txt);
const warnIdx = card.findIndex((l) => l.includes("⚠"));

// ---- three directions ----
const A = {
	name: "A · 折叠",
	pitch: "照 Pi decluttered 的镜头语言：日志被一道光压成段头。深色、冷灰、一种暖黄强调色。节奏稳，镜头一直在缓慢推近。",
	music: "极简电子氛围，92 BPM 的柔和脉冲；光带扫过时一个上升音效，压缩完成时一下低音落地。",
	scenes: [
		["0–5s", "问题", "左边两个数字跟着日志滚动同步往上跳（235 次调用 / 9,731 行），最后补一行“往回翻 279 页”。标题逐词出现。终端在右侧倾斜，持续向上滚。",
			head(["Agent 干完了活。", "你收到的是一屏日志。"], { size: 64, partial: 14 }) + abs(120, 470, `<div class="stat"><b>235</b> 次工具调用</div><div class="stat"><b>9,731</b> 行输出</div><div class="stat"><b>279</b> 页才翻回开头</div>`) + term({ lines: plainLines(S.noise[1], 17, 70), x: 860, y: 200, w: 960, h: 640, ry: -16, rx: 8 })],
		["5–10s", "做了什么：压成段头", "一道暖黄光带从上往下扫；光带下面是原始日志，光带上面已经收成段头。扫完时低音落地。",
			term({ lines: [...groupedLines(S.grouped.slice(0, 7)), ...plainLines(S.noise[2], 9, 80).map((l) => l.replace("<div>", '<div class="raw">'))], x: 360, y: 140, w: 1200, h: 800, rx: 10 }) + glowBar(560) + head(["235 次调用，收成几行。"], { x: 0, y: 960, size: 44, align: "center" })],
		["10–16s", "对不对：大白话卡", "镜头推近到翻译卡，景深：其他行虚化。⚠ 那一行向前浮起、发光；鼠标停在 [T12 T13 A1] 上，原文证据以浮层弹出。",
			head(["你没让它修，", "它也修了。"], { size: 64 }) + term({ lines: card.map((l, i) => `<div class="${i === warnIdx ? "lift" : i ? "soft" : ""}">${esc(l)}</div>`), x: 700, y: 330, w: 1160, h: 420, fs: 22, title: "任务：加 FALL15 折扣码" }) + abs(1180, 640, `<div class="pop"><div class="dim">T13 · edit src/discount.js</div><span class="err">-  return subtotal - Math.floor((subtotal * percent) / 100);</span><br><span style="color:#6cc28a">+  return subtotal - Math.round((subtotal * percent) / 100);</span></div>`)],
		["16–20s", "要不要你：一键接手", "Enter 键帽按下（有回弹），输入框里的 /reload 变成“继续”。标题：要你拿主意的，放在最后一行。",
			head(["要你拿主意的，", "放在最后一行。"], { x: 0, y: 120, size: 64, align: "center" }) + term({ lines: [`<div class="amber">→ 你要决定：是否重载检查器并继续，让 Agent 修正问题后重新验收。</div>`, `<div class="dim">  已填入输入框：/reload　按 Enter 执行</div>`, `<div class="input">继续<span class="amber">▍</span></div>`], x: 260, y: 430, w: 1400, h: 230, fs: 24 }) + key("Enter ⏎", 850, 760)],
		["20–23s", "名字", "π 标记发光出现；“pi-activity-view”逐字打出；下面一行灰字：只改显示，不改 Agent 的工作。",
			abs(900, 330, `<div class="logo">π</div>`) + head(["pi-activity-view"], { x: 0, y: 520, size: 64, align: "center" }).replace('class="head"', 'class="head mono"') + head(["看得懂 Agent 在做什么。"], { x: 0, y: 620, size: 34, align: "center", color: "#8b8a85" })],
	],
};

const B = {
	name: "B · 翻译",
	pitch: "照 One 的明亮风格：浅色纸面、大黑字、真实界面。核心画面是“每一句都连回证据”：句子和日志之间画出连线。",
	music: "温暖的钢琴 + 轻电子，84 BPM；每条连线画出时一个轻敲音。",
	scenes: [
		["0–4s", "问题", "先是一句大字“Agent：都做完了。”，随后缩到左上；身后一屏真实日志从虚到实浮出来；右侧出现“真的吗？”",
			head(["都做完了。"], { x: 120, y: 120, size: 48, color: "#141414" }) + term({ lines: plainLines(S.noise[0], 17, 80), x: 260, y: 260, w: 1400, h: 640, blur: 2, theme: "dark" }) + head(["真的吗？"], { x: 1300, y: 120, size: 72, color: "#141414" })],
		["4–8s", "做了什么：段头", "日志向上收拢，变成几行段头（真实界面）；每行段头左边亮起一个小圆点。标题：235 次调用，收成几行。",
			head(["235 次调用，收成几行。"], { x: 0, y: 130, size: 60, align: "center", color: "#141414" }) + term({ lines: groupedLines(S.grouped.slice(0, 14)), x: 360, y: 290, w: 1200, h: 640 })],
		["8–13s", "对不对：每句连回证据", "左边：原始日志的几行；右边：大白话句子。每句的 [T#] 拉出一根细线，连到左边那一行，依次画出。",
			term({ lines: [`<div class="dim">T11  npm test → 失败 # pass 3 # fail 1</div>`, `<div class="dim">T12  todo: Fix existing rounding failure</div>`, `<div class="dim">T13  edit src/discount.js</div>`, `<div class="dim">T14  npm test; git diff → # pass 4 # fail 0</div>`], x: 100, y: 330, w: 780, h: 300, fs: 22 }) +
				abs(1060, 330, `<div class="plain">✗ 首次测试有一项取整失败。<span>[T11]</span></div><div class="plain">⚠ 你没让它修取整，它也修了。<span>[T12 T13]</span></div><div class="plain">✓ 最后一次测试，四项全部通过。<span>[T14]</span></div>`) +
				`<svg class="links" width="1920" height="1080"><path d="M880 360 C 970 360, 970 365, 1060 365"/><path d="M880 435 C 970 435, 970 445, 1060 445"/><path d="M880 470 C 970 470, 970 445, 1060 445"/><path d="M880 505 C 970 505, 970 525, 1060 525"/></svg>` +
				head(["每一句，都连回证据。"], { x: 0, y: 140, size: 64, align: "center", color: "#141414" })],
		["13–16s", "对不对：多做的事", "其他句子退场，⚠ 那句放大成满屏大字，逐字出现。",
			head(["你没让它修取整，", "它也修了。"], { x: 0, y: 360, size: 96, align: "center", color: "#141414" }) + head(["金额计算变了。保不保留，由你定。"], { x: 0, y: 640, size: 40, align: "center", color: "#7a776f" })],
		["16–19s", "要不要你：一个键", "仿 One 的键帽：一个大 Enter 键帽居中，旁边是真实的“你要决定”那一行。按下时界面切换。",
			term({ lines: [`<div>→ 你要决定：额外的取整修改要不要保留？</div>`, `<div class="dim">  保留则四项测试通过，撤回则取整测试仍失败。</div>`], x: 360, y: 300, w: 1200, h: 170, fs: 24 }) + key("Enter ⏎", 840, 600, "transform:scale(1.4)")],
		["19–22s", "名字", "浅色背景，π 标记 + 名字 + 一句：看得懂 Agent 在做什么。",
			abs(900, 340, `<div class="logo light">π</div>`) + head(["pi-activity-view"], { x: 0, y: 530, size: 60, align: "center", color: "#141414" }).replace('class="head"', 'class="head mono"') + head(["看得懂 Agent 在做什么。"], { x: 0, y: 625, size: 32, align: "center", color: "#7a776f" })],
	],
	light: true,
};

const C = {
	name: "C · 三件事",
	pitch: "纯排版、硬切卡点：大数字和大字一拍一换，真实界面只露关键的一行，放大到满屏。最短、最有冲击力。",
	music: "鼓点型电子，120 BPM；每个硬切都落在拍子上，结尾一下收住。",
	scenes: [
		["0–3s", "问题", "一拍一个大数字：2 小时 35 分 → 235 次调用 → 9,731 行 → 279 页。数字背后闪过真实日志碎片。",
			term({ lines: plainLines(S.noise[2], 17, 80), x: 200, y: 160, w: 1520, h: 760, blur: 5, extra: "opacity:.35" }) + head(["9,731 行"], { x: 0, y: 400, size: 200, align: "center" })],
		["3–6s", "三个问题", "“你只想知道三件事”，然后三个词依次砸下：做了什么 / 对不对 / 要不要你。",
			head(["你只想知道三件事"], { x: 0, y: 200, size: 52, align: "center", color: "#8b8a85" }) + abs(0, 420, `<div class="three"><span>做了什么</span><span>对不对</span><span class="amber">要不要你</span></div>`, "width:1920px")],
		["6–9s", "做了什么", "满屏放大一行真实段头，其余全黑。",
			abs(0, 0, `<div class="zoomline">${esc("· 接通应用持有的共享任务管理 · 读 7 · 命令 27 · 改 4 个文件")}</div>`, "width:1920px;height:1080px") + head(["做了什么"], { x: 120, y: 120, size: 44, color: "#8b8a85" })],
		["9–13s", "对不对", "满屏放大 ⚠ 那一行，带暖黄底光。",
			abs(0, 0, `<div class="zoomline warn">${esc(card[warnIdx] || "")}</div>`, "width:1920px;height:1080px") + head(["对不对"], { x: 120, y: 120, size: 44, color: "#8b8a85" })],
		["13–17s", "要不要你", "满屏放大“→ 你要决定”那一行，下方 Enter 键帽一按。",
			abs(0, 0, `<div class="zoomline">→ 你要决定：额外的取整修改要不要保留</div>`, "width:1920px;height:1080px") + head(["要不要你"], { x: 120, y: 120, size: 44, color: "#8b8a85" }) + key("Enter ⏎", 860, 760)],
		["17–20s", "名字", "“3 秒看懂一轮。”硬切到名字。",
			head(["3 秒看懂一轮。"], { x: 0, y: 380, size: 110, align: "center" }) + head(["pi-activity-view"], { x: 0, y: 580, size: 40, align: "center", color: "#8b8a85" }).replace('class="head"', 'class="head mono"')],
	],
};

const tag = (name) => { const k = ["做了什么", "对不对", "要不要你"].find((x) => name.includes(x)); return k ? `<em class="tag">核心：${k}</em>` : ""; };
const frame = (inner, light) => `<div class="frame-wrap"><div class="frame ${light ? "light" : ""}">${inner}</div></div>`;
const dir = (d) => `
<section class="dir">
 <h2>${d.name}</h2>
 <p class="pitch">${d.pitch}</p>
 <p class="music">音乐：${d.music}</p>
 <div class="scenes">${d.scenes
		.map(([t, name, note, inner], i) => `<figure>${frame(inner, d.light)}<figcaption><b>${i + 1}. ${name}</b><span>${t}</span>${tag(name)}<p>${note}</p></figcaption></figure>`)
		.join("")}</div>
</section>`;

const page = `<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>宣传片故事板</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>
:root{--bg:#f4f3ef;--fg:#1b1b1a;--mut:#6e6c66;--line:#dedcd5;--card:#fff}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#111113;--fg:#ecebe6;--mut:#94928c;--line:#2a2b2e;--card:#18191b}}
:root[data-theme=dark]{--bg:#111113;--fg:#ecebe6;--mut:#94928c;--line:#2a2b2e;--card:#18191b}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.6 Inter,"PingFang SC",sans-serif}
main{max-width:1500px;margin:0 auto;padding:28px 16px 80px}
h1{font-size:24px;margin:0 0 4px}.sub{color:var(--mut);margin:0 0 26px}
.dir{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px;margin-bottom:26px}
.dir h2{margin:0;font-size:20px}.pitch{margin:6px 0 2px}.music{margin:0 0 14px;color:var(--mut);font-size:14px}
.scenes{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(440px,100%),1fr));gap:16px}
figure{margin:0}figcaption{font-size:13.5px;margin-top:6px}figcaption span{color:var(--mut);margin-left:8px}figcaption p{margin:2px 0 0;color:var(--mut)}
.frame-wrap{width:100%;aspect-ratio:16/9;overflow:hidden;border-radius:8px;position:relative;container-type:inline-size}
.frame{position:absolute;left:0;top:0;width:1920px;height:1080px;transform-origin:0 0;transform:scale(calc(100cqw / 1920px));background:radial-gradient(1200px 700px at 60% 40%,#17171b,#0b0b0d);overflow:hidden;font-family:Inter,"PingFang SC",sans-serif;color:#ecebe6}
.frame.light{background:radial-gradient(1200px 700px at 50% 30%,#fbfaf7,#eceae4);color:#141414}
.head{position:absolute;font-weight:600;letter-spacing:-.02em;line-height:1.22}
.mono{font-family:"JetBrains Mono","SF Mono",monospace}
.term{position:absolute;background:#141518;border:1px solid #26272b;border-radius:14px;overflow:hidden;box-shadow:0 50px 140px rgba(0,0,0,.6);color:#d6d6d2}
.term .bar{height:38px;background:#1b1c20;display:flex;align-items:center;gap:8px;padding:0 16px}
.term .bar i{width:12px;height:12px;border-radius:6px;background:#3a3b40}.term .bar span{flex:1;text-align:center;font:14px "JetBrains Mono",monospace;color:#5d5c58}
.term .body{padding:18px 22px;font-family:"JetBrains Mono","SF Mono","PingFang SC",monospace;line-height:1.6;white-space:pre}
.term .hdr{background:rgba(233,179,90,.07);border-radius:6px;margin:2px -8px;padding:0 8px;color:#ecebe6}
.term .muted{color:#9a9994}.term .raw{color:#6f8f5f}.dim{color:#6b6a66}.err{color:#e5675a}.amber{color:#e9b35a}
.term .soft{opacity:.32;filter:blur(1px)}.term .lift{background:rgba(233,179,90,.16);box-shadow:0 0 0 2px rgba(233,179,90,.6),0 20px 60px rgba(233,179,90,.25);border-radius:6px;margin:0 -10px;padding:0 10px;transform:scale(1.04);transform-origin:left}
.term .input{border-top:1px solid #2a2b30;margin-top:16px;padding-top:12px}
.stat{font-size:30px;color:#8b8a85}.stat b{font:300 120px Inter;color:#ecebe6;letter-spacing:-4px;margin-right:16px}
.glowbar{position:absolute;left:280px;width:1360px;height:4px;background:#e9b35a;box-shadow:0 0 40px 12px rgba(233,179,90,.55),0 0 160px 40px rgba(233,179,90,.2);border-radius:4px}
.pop{background:#1f2024;border:1px solid #34353a;border-radius:12px;padding:18px 22px;font:20px/1.6 "JetBrains Mono",monospace;color:#d6d6d2;box-shadow:0 40px 100px rgba(0,0,0,.6)}
.key{font:600 34px Inter;color:#ecebe6;background:linear-gradient(#2c2d32,#1c1d21);border:1px solid #3a3b40;border-radius:18px;padding:26px 46px;box-shadow:0 10px 0 #08080a,0 30px 60px rgba(0,0,0,.5)}
.logo{width:120px;height:120px;border-radius:30px;background:#18191c;border:1px solid #34353a;display:grid;place-items:center;font:600 64px Inter;color:#ecebe6;box-shadow:0 0 80px rgba(233,179,90,.35)}
.logo.light{background:#fff;color:#141414;border-color:#dedcd5;box-shadow:0 20px 60px rgba(0,0,0,.12)}
.plain{font:500 30px/1.5 "PingFang SC",Inter;color:#141414;margin-bottom:26px}.plain span{font:20px "JetBrains Mono";color:#b07a2a;margin-left:12px}
.links path{fill:none;stroke:#b07a2a;stroke-width:2.5;stroke-dasharray:6 6}
.three{display:flex;justify-content:center;gap:90px;font:600 96px "PingFang SC",Inter}
.zoomline{display:flex;align-items:center;justify-content:center;height:100%;font:600 54px "JetBrains Mono","PingFang SC",monospace;color:#ecebe6;padding:0 80px;text-align:center}
.zoomline.warn{color:#f3d199;background:radial-gradient(900px 260px at 50% 50%,rgba(233,179,90,.18),transparent)}
figcaption em.tag{font-style:normal;font-size:12px;margin-left:8px;padding:1px 8px;border-radius:10px;background:rgba(233,179,90,.18);color:#b07a2a}
.ask{border:2px solid #e9b35a;border-radius:12px;padding:16px 18px}
</style></head><body><main>
<h1>宣传片故事板 · 3 个方向</h1>
<p class="sub">三个方向走同一条主线：问题 → 做了什么 → 对不对 → 要不要你 → 名字。每格标出它展示的核心功能；不服务于这三件事的镜头已删掉。每个场景一张静帧，先定方向再做动画。界面内容全部取自真实运行（os 那轮会话 + 折扣码试用）。文字说明里是镜头和动作。</p>
${dir(A)}${dir(B)}${dir(C)}
<div class="ask"><b>需要你选：</b>A / B / C，或者“A 的结构 + B 的连线镜头”这样组合。也可以直接用导演口吻批注某一格，比如“A4 光带再慢一点”“B3 连线改成依次亮起”。</div>
</main></body></html>`;
fs.writeFileSync(process.argv[2], page);
console.log("wrote", process.argv[2]);

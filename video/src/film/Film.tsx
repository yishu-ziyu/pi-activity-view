// Full promo. Five scenes on a 120 BPM grid (15 frames per beat); every text and number is real:
// os session (235 calls, 9,731 lines, 279 vs 6 PageUps), FALL15 trial (verify scene), os replay (decide scene).
import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import screens from "../screens.json";
import { Verify } from "../verify/Verify";
import { Backdrop, Grain, K, MONO, Reveal, SANS, Vignette, clamp, prog } from "./kit";
import T from "./timeline.json";

export const FILM_DURATION = T.duration;

// Focus-pull transition: the outgoing scene drifts forward out of focus, the incoming one resolves from blur.
const Shot: React.FC<{ len: number; first?: boolean; last?: boolean; children: React.ReactNode }> = ({ len, first, last, children }) => {
	const f = useCurrentFrame();
	const o = T.overlap;
	const inP = first ? 1 : prog(f, 0, o);
	const outP = last ? 0 : interpolate(f, [len - o, len + o], [0, 1], clamp);
	return (
		<AbsoluteFill
			style={{
				opacity: inP * (1 - outP),
				filter: `blur(${(1 - inP) * 14 + outP * 18}px)`,
				transform: `scale(${(0.97 + 0.03 * inP) * (1 + 0.06 * outP)})`,
			}}
		>
			{children}
		</AbsoluteFill>
	);
};

// Drop lines that came from the capture harness (tmux warning, update banners), not from Pi's own output.
const HARNESS = /tmux|extended-keys|Update Available|New version|Changelog|pi update|Package Updates|^ - pi-|^Packages:|restart tmux/;
const LOG_BLUR = 2.2;
// Keep each real line's length, indentation and punctuation, but replace letters, digits and CJK with
// deterministic filler, so no path, product name or code from the private project can be read.
const scramble = (l: string, seed: number) => {
	let h = seed * 2654435761;
	const next = () => ((h = (h ^ (h << 13)) >>> 0), (h = (h ^ (h >>> 17)) >>> 0), (h = (h ^ (h << 5)) >>> 0), h);
	const lower = "abcdefghijklmnopqrstuvwxyz", upper = lower.toUpperCase();
	return [...l].map((c) => (/[a-z]/.test(c) ? lower[next() % 26] : /[A-Z]/.test(c) ? upper[next() % 26] : /[0-9]/.test(c) ? String(next() % 10) : /[\u4e00-\u9fff]/.test(c) ? "口" : c)).join("");
};
const LINES = screens.scroll.flat().filter((l) => l.trim() && !HARNESS.test(l)).map((l, i) => scramble(l, i + 1));

// Dark terminal window shared by scenes 1-2.
const Window: React.FC<{ title: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ title, children, style }) => (
	<div
		style={{
			position: "absolute",
			borderRadius: 16,
			background: K.panel,
			border: `1px solid ${K.panelEdge}`,
			boxShadow: "0 60px 140px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.04)",
			overflow: "hidden",
			...style,
		}}
	>
		<div style={{ height: 38, display: "flex", alignItems: "center", padding: "0 18px", gap: 8, borderBottom: `1px solid ${K.panelEdge}` }}>
			{[0, 1, 2].map((i) => (
				<div key={i} style={{ width: 11, height: 11, borderRadius: 6, background: "#2A2C3D" }} />
			))}
			<div style={{ flex: 1, textAlign: "center", fontFamily: MONO, fontSize: 14, color: "#5E5C76" }}>{title}</div>
		</div>
		{children}
	</div>
);

const Stat: React.FC<{ value: number; label: string; start: number; end: number; suffix?: string }> = ({ value, label, start, end, suffix = "" }) => {
	const f = useCurrentFrame();
	const v = Math.round(interpolate(f, [start, end], [0, value], { ...clamp, easing: (t) => 1 - Math.pow(1 - t, 3) }));
	const p = prog(f, start - 4, 12);
	return (
		<div style={{ display: "flex", alignItems: "baseline", gap: 18, opacity: p, filter: `blur(${(1 - p) * 8}px)` }}>
			<div style={{ fontFamily: SANS, fontWeight: 300, fontSize: 118, letterSpacing: -4, color: K.text, fontVariantNumeric: "tabular-nums", minWidth: 340, textAlign: "right" }}>
				{v.toLocaleString("en-US")}
				{suffix}
			</div>
			<div style={{ fontFamily: SANS, fontSize: 28, color: K.muted }}>{label}</div>
		</div>
	);
};

// 1. Problem: the real log scrolls; the counters climb with it.
const Problem: React.FC = () => {
	const f = useCurrentFrame();
	const P = T.problem;
	const scroll = interpolate(f, [0, T.scenes.problem.len], [0, 46 * 30], { easing: (t) => t * t * 0.6 + t * 0.4 });
	return (
		<AbsoluteFill>
			<Backdrop />
			<div style={{ position: "absolute", left: 120, top: 130, fontFamily: SANS, fontWeight: 600, fontSize: 70, letterSpacing: -1.5, lineHeight: 1.18, color: K.text }}>
				<div style={{ color: K.muted }}>
					<Reveal text="Agent 干完了活。" start={P.headline} />
				</div>
				<Reveal text="你收到的是一屏日志。" start={P.headline + 14} />
			</div>
			<div style={{ position: "absolute", left: 40, top: 470, display: "flex", flexDirection: "column", gap: 0 }}>
				<Stat value={235} label="次工具调用" start={P.counters} end={P.pages - 8} />
				<Stat value={9731} label="行输出" start={P.counters + 4} end={P.pages - 4} />
				<Stat value={279} label="页，才翻回开头" start={P.pages} end={P.pages + 20} />
			</div>
			<Window
				title="原生 Pi · 一条指令，2 小时 35 分"
				style={{ left: 930, top: 170, width: 900, height: 760, transform: `perspective(2000px) rotateY(-16deg) rotateX(7deg)`, transformOrigin: "left center" }}
			>
				{/* Real log, deliberately unreadable: it shows the volume, not the private paths and code inside it. */}
				<div style={{ padding: "16px 22px", fontFamily: MONO, fontSize: 18, lineHeight: "30px", color: "#9C9BB0", whiteSpace: "pre", transform: `translateY(${-scroll}px)`, filter: `blur(${LOG_BLUR}px)` }}>
					{LINES.slice(0, 120).map((l, i) => (
						<div key={i} style={{ height: 30, overflow: "hidden" }}>{l.slice(0, 74)}</div>
					))}
				</div>
				<div style={{ position: "absolute", inset: "38px 0 0 0", background: "linear-gradient(#111219 0%, transparent 18%, transparent 80%, #111219 100%)" }} />
			</Window>
		</AbsoluteFill>
	);
};

// 2. What it did: the window turns to face us, a light bar sweeps down, above it the log is already grouped.
const GroupedRow: React.FC<{ l: string }> = ({ l }) => {
	const m = l.match(/^ ([·✗✓◐]) (.*)$/);
	if (!m) return <div style={{ height: 34, color: "#B9B8C8", overflow: "hidden" }}>{l.slice(0, 70)}</div>;
	const fail = m[2].match(/(.*?)(最后一步失败：[^·]*)(.*)/);
	return (
		<div style={{ height: 34, overflow: "hidden", background: "rgba(169,163,217,0.08)", borderRadius: 6, margin: "0 -10px", padding: "0 10px", color: K.text }}>
			<span style={{ color: m[1] === "✗" ? K.err : K.muted }}>{m[1]} </span>
			{fail ? (
				<>
					<b style={{ fontWeight: 500 }}>{fail[1]}</b>
					<span style={{ color: K.err }}>{fail[2].slice(0, 26)}</span>
				</>
			) : (
				<span>{m[2].slice(0, 62)}</span>
			)}
		</div>
	);
};

const Fold: React.FC = () => {
	const f = useCurrentFrame();
	const { fps } = useVideoConfig();
	const F = T.fold;
	const turn = spring({ frame: f - F.turn, fps, config: { damping: 26, stiffness: 50 } });
	const sweep = interpolate(f, [F.sweepStart, F.sweepEnd], [0, 1], { ...clamp, easing: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2) });
	const H = 700; // content height inside the window
	const barY = 38 + sweep * H;
	const landed = prog(f, F.sweepEnd, 10);
	return (
		<AbsoluteFill>
			<Backdrop />
			<div style={{ position: "absolute", left: 120, top: 150, width: 560, fontFamily: SANS, fontWeight: 600, fontSize: 64, letterSpacing: -1.5, lineHeight: 1.2, color: K.text }}>
				<div style={{ color: K.muted }}>
					<Reveal text="235 次调用，" start={8} />
				</div>
				<Reveal text="收成几行段头。" start={20} />
				<div style={{ fontWeight: 400, fontSize: 26, color: K.muted, marginTop: 60, opacity: landed }}>同一轮工作，往回翻</div>
				<div style={{ display: "flex", alignItems: "baseline", gap: 26, marginTop: 8, opacity: landed, transform: `translateY(${(1 - landed) * 16}px)` }}>
					<span style={{ fontSize: 60, fontWeight: 300, color: "#5E5C76", textDecoration: "line-through" }}>279 页</span>
					<span style={{ fontSize: 110, fontWeight: 500, color: K.warn, letterSpacing: -3 }}>6 页</span>
				</div>
			</div>
			<Window
				title="pi + pi-activity-view · 同一轮工作"
				style={{ left: 760, top: 150, width: 1060, height: H + 38, transform: `perspective(2000px) rotateY(${-16 * (1 - turn)}deg) rotateX(${7 * (1 - turn)}deg) translateX(${(1 - turn) * 120}px)`, transformOrigin: "left center" }}
			>
				{/* raw log underneath */}
				<div style={{ position: "absolute", top: 38, left: 0, right: 0, padding: "16px 22px", fontFamily: MONO, fontSize: 18, lineHeight: "30px", color: "#7E8F74", whiteSpace: "pre", clipPath: `inset(${barY - 38}px 0 0 0)`, filter: `blur(${LOG_BLUR}px)` }}>
					{LINES.slice(200, 224).map((l, i) => (
						<div key={i} style={{ height: 30, overflow: "hidden" }}>{l.slice(0, 84)}</div>
					))}
				</div>
				{/* grouped view revealed above the bar */}
				<div style={{ position: "absolute", top: 38, left: 0, right: 0, padding: "18px 28px", fontFamily: MONO, fontSize: 20, lineHeight: "34px", whiteSpace: "pre", clipPath: `inset(0 0 ${H + 38 - barY}px 0)` }}>
					{screens.grouped.slice(0, 19).map((l, i) => (
						<GroupedRow key={i} l={l} />
					))}
				</div>
				{/* the light bar */}
				<div
					style={{
						position: "absolute",
						left: 0,
						right: 0,
						top: barY - 2,
						height: 3,
						background: K.warn,
						opacity: sweep > 0 && sweep < 1 ? 1 : 0,
						boxShadow: "0 0 30px 10px rgba(233,179,90,0.55), 0 0 140px 40px rgba(233,179,90,0.22)",
					}}
				/>
			</Window>
		</AbsoluteFill>
	);
};

// 4. Needs you: the real decision line from the os replay; Enter on the beat; the editor then holds "继续".
const Decide: React.FC = () => {
	const f = useCurrentFrame();
	const D = T.decide;
	const panel = prog(f, D.panel, 16);
	const press = interpolate(f, [D.press, D.press + 3, D.press + 10], [0, 1, 0], clamp);
	const after = f >= D.press + 6;
	const keyIn = prog(f, D.panel + 20, 12);
	return (
		<AbsoluteFill>
			<Backdrop />
			<div style={{ position: "absolute", left: 0, right: 0, top: 120, textAlign: "center", fontFamily: SANS, fontWeight: 600, fontSize: 64, letterSpacing: -1.5, lineHeight: 1.2, color: K.text }}>
				<div style={{ color: K.muted }}>
					<Reveal text="要你拿主意的，" start={D.headline} />
				</div>
				<Reveal text="放在最后一行。" start={D.headline + 12} />
			</div>
			<Window
				title="真实会话 · Agent 停下来等你"
				style={{ left: 210, top: 400, width: 1500, height: 250, opacity: panel, filter: `blur(${(1 - panel) * 10}px)`, transform: `translateY(${(1 - panel) * 24}px)` }}
			>
				<div style={{ padding: "22px 30px", fontFamily: MONO, fontSize: 25, lineHeight: 1.6, whiteSpace: "pre" }}>
					<div style={{ color: K.text }}>
						<span style={{ color: K.warn }}>→</span>
						{screens.prefill[0].replace(/^\s*→/, "")}
					</div>
					<div style={{ color: K.muted }}>{screens.prefill[1]}</div>
					<div style={{ borderTop: `1px solid ${K.panelEdge}`, marginTop: 14, paddingTop: 12, color: K.text }}>
						{after ? "继续" : "/reload"}
						<span style={{ opacity: Math.floor(f / 15) % 2 ? 0 : 1, color: K.warn }}>▍</span>
					</div>
				</div>
			</Window>
			<div
				style={{
					position: "absolute",
					left: 860,
					top: 730,
					fontFamily: SANS,
					fontWeight: 600,
					fontSize: 34,
					color: K.text,
					background: "linear-gradient(#2C2D38, #1B1C24)",
					border: "1px solid #3A3B4C",
					borderRadius: 18,
					padding: "24px 44px",
					opacity: keyIn,
					boxShadow: `0 ${10 - 8 * press}px 0 #06060A, 0 30px 60px rgba(0,0,0,0.5), 0 0 ${40 * press}px rgba(233,179,90,${0.5 * press})`,
					transform: `translateY(${8 * press + (1 - keyIn) * 20}px)`,
				}}
			>
				Enter ⏎
			</div>
		</AbsoluteFill>
	);
};

// 5. Name.
const Name: React.FC = () => {
	const f = useCurrentFrame();
	const N = T.name;
	const logo = prog(f, N.logo, 16);
	const word = "pi-activity-view";
	const typed = Math.max(0, Math.min(word.length, Math.floor((f - N.type) / 1.2)));
	return (
		<AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
			<Backdrop />
			<div style={{ position: "absolute", width: 900, height: 360, borderRadius: 400, background: `radial-gradient(closest-side, rgba(169,163,217,${0.14 * logo}), transparent)` }} />
			<div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
			<div
				style={{
					width: 128,
					height: 128,
					borderRadius: 32,
					background: "linear-gradient(#1B1C26, #121219)",
					border: "1px solid #34364F",
					display: "grid",
					placeItems: "center",
					fontFamily: SANS,
					fontSize: 66,
					fontWeight: 500,
					color: K.text,
					opacity: logo,
					filter: `blur(${(1 - logo) * 10}px)`,
					transform: `scale(${0.92 + 0.08 * logo})`,
					boxShadow: `0 0 80px rgba(169,163,217,${0.3 * logo}), 0 40px 80px rgba(0,0,0,0.6)`,
				}}
			>
				π
			</div>
			<div style={{ marginTop: 40, fontFamily: MONO, fontSize: 60, color: K.text, height: 80 }}>
				{word.slice(0, typed)}
				<span style={{ opacity: typed < word.length || Math.floor(f / 15) % 2 ? 1 : 0, color: K.lilac }}>▍</span>
			</div>
			<div style={{ marginTop: 14, fontFamily: SANS, fontSize: 32, color: K.muted, opacity: prog(f, N.tagline, 14) }}>看得懂 Agent 在做什么。</div>
			<div style={{ marginTop: 34, fontFamily: SANS, fontSize: 21, color: "#5E5C76", opacity: prog(f, N.fine, 14) }}>Pi 扩展 · 只改显示，不改 Agent 的工作</div>
			</div>
		</AbsoluteFill>
	);
};

export const Film: React.FC = () => {
	const S = T.scenes;
	const o = T.overlap;
	const order: [keyof typeof S, React.ReactNode][] = [
		["problem", <Problem />],
		["fold", <Fold />],
		["verify", <Verify withAudio={false} />],
		["decide", <Decide />],
		["name", <Name />],
	];
	return (
		<AbsoluteFill style={{ background: K.bg }}>
			<Audio src={staticFile("film.wav")} />
			{order.map(([k, node], i) => (
				<Sequence key={k} from={S[k].start} durationInFrames={S[k].len + (i < order.length - 1 ? o : 0)}>
					<Shot len={S[k].len} first={i === 0} last={i === order.length - 1}>
						{node}
					</Shot>
				</Sequence>
			))}
			<Vignette />
			<Grain />
		</AbsoluteFill>
	);
};

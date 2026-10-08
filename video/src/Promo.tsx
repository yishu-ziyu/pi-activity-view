// Promo for pi-activity-view. Every screen is a real Pi capture (see prep.mjs); every number is measured.
import React from "react";
import { AbsoluteFill, Easing, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import screens from "./screens.json";

const C = {
	bg: "#0e0e10",
	panel: "#151619",
	bar: "#1c1d21",
	text: "#ecebe6",
	muted: "#8b8a85",
	dim: "#5d5c58",
	accent: "#e9b35a",
	error: "#e5675a",
	ok: "#6cc28a",
};
const SANS = '"PingFang SC", "Helvetica Neue", system-ui, sans-serif';
const MONO = '"SF Mono", Menlo, "PingFang SC", monospace';

// Scene boundaries in frames (30 fps).
const S = { noise: 0, scroll: 150, title: 270, grouped: 360, card: 540, decide: 780, end: 870 };
export const DURATION = 960;

const useIn = (delay = 0, damping = 200) => {
	const f = useCurrentFrame();
	const { fps } = useVideoConfig();
	return spring({ frame: f - delay, fps, config: { damping } });
};

const Headline: React.FC<{ lines: string[]; sub?: string; delay?: number; size?: number; style?: React.CSSProperties }> = ({ lines, sub, delay = 0, size = 64, style }) => {
	const p = useIn(delay);
	return (
		<div style={{ fontFamily: SANS, color: C.text, opacity: p, transform: `translateY(${(1 - p) * 24}px)`, ...style }}>
			{lines.map((l, i) => (
				<div key={i} style={{ fontSize: size, fontWeight: 600, letterSpacing: -1, lineHeight: 1.25, color: i === 0 && lines.length > 1 ? C.muted : C.text }}>
					{l}
				</div>
			))}
			{sub && <div style={{ marginTop: 18, fontSize: size * 0.42, color: C.muted, fontWeight: 400 }}>{sub}</div>}
		</div>
	);
};

const Terminal: React.FC<{
	children: React.ReactNode;
	width: number;
	height: number;
	tilt?: number;
	title?: string;
	style?: React.CSSProperties;
	fontSize?: number;
}> = ({ children, width, height, tilt = 0, title = "pi — ~/project", style, fontSize = 19 }) => (
	<div style={{ perspective: 2200, ...style }}>
		<div
			style={{
				width,
				height,
				background: C.panel,
				borderRadius: 14,
				border: "1px solid #26272b",
				boxShadow: "0 40px 120px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.02)",
				overflow: "hidden",
				transform: `rotateX(${tilt * 0.6}deg) rotateY(${-tilt}deg)`,
				transformOrigin: "center",
			}}
		>
			<div style={{ height: 38, background: C.bar, display: "flex", alignItems: "center", padding: "0 16px", gap: 8 }}>
				{["#ff5f57", "#febc2e", "#28c840"].map((c) => (
					<div key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c, opacity: 0.8 }} />
				))}
				<div style={{ flex: 1, textAlign: "center", fontFamily: MONO, fontSize: 14, color: C.dim }}>{title}</div>
			</div>
			<div style={{ padding: "18px 22px", fontFamily: MONO, fontSize, lineHeight: 1.55, color: "#d6d6d2", whiteSpace: "pre" }}>{children}</div>
		</div>
	</div>
);

const Html: React.FC<{ html: string; style?: React.CSSProperties }> = ({ html, style }) => (
	<div style={{ minHeight: "1.55em", overflow: "hidden", textOverflow: "ellipsis", ...style }} dangerouslySetInnerHTML={{ __html: html || "&nbsp;" }} />
);

const Counter: React.FC<{ to: number; label: string; delay: number }> = ({ to, label, delay }) => {
	const f = useCurrentFrame();
	const v = Math.round(interpolate(f - delay, [0, 45], [0, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }));
	const p = useIn(delay);
	return (
		<div style={{ fontFamily: SANS, opacity: p, display: "flex", alignItems: "baseline", gap: 18 }}>
			<div style={{ fontSize: 120, fontWeight: 300, color: C.text, fontVariantNumeric: "tabular-nums", letterSpacing: -3, minWidth: 330, textAlign: "right" }}>{v.toLocaleString("en-US")}</div>
			<div style={{ fontSize: 30, color: C.muted }}>{label}</div>
		</div>
	);
};

// 1. Noise: real native Pi screens, with the measured totals of the recorded turn.
const Noise: React.FC = () => {
	const f = useCurrentFrame();
	const idx = Math.min(screens.noise.length - 1, Math.floor(f / 40));
	const drift = interpolate(f, [0, 150], [0, -40]);
	return (
		<AbsoluteFill style={{ background: C.bg }}>
			<div style={{ position: "absolute", left: 120, top: 150 }}>
				<Headline lines={["Agent 干完了活。", "你收到的是一屏日志。"]} />
			</div>
			<div style={{ position: "absolute", left: 60, top: 520, display: "flex", flexDirection: "column", gap: 4 }}>
				<Counter to={235} label="次工具调用" delay={20} />
				<Counter to={9731} label="行输出" delay={32} />
			</div>
			<Terminal width={1000} height={640} tilt={14} style={{ position: "absolute", right: 70, top: 200 + drift }} title="原生 Pi · 这一轮的中间">
				{screens.noise[idx].map((l, i) => (
					<div key={i} style={{ minHeight: "1.55em", overflow: "hidden" }}>{l.slice(0, 78)}</div>
				))}
			</Terminal>
			<div style={{ position: "absolute", left: 120, bottom: 70, fontFamily: SANS, fontSize: 20, color: C.dim }}>真实会话：一条指令，2 小时 35 分，235 次工具调用</div>
		</AbsoluteFill>
	);
};

// 2. Scroll: the same turn in native Pi, PageUp after PageUp (measured: 279).
const Scroll: React.FC = () => {
	const f = useCurrentFrame();
	const page = Math.min(screens.scroll.length - 1, Math.floor(interpolate(f, [10, 100], [0, screens.scroll.length - 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.quad) })));
	const shown = Math.round(interpolate(page, [0, screens.scroll.length - 1], [1, screens.scrollCount]));
	return (
		<AbsoluteFill style={{ background: C.bg, alignItems: "center" }}>
			<div style={{ position: "absolute", top: 90, textAlign: "center", width: "100%" }}>
				<Headline lines={["想知道它做了什么？", `往回翻 ${screens.scrollCount} 页。`]} size={60} />
			</div>
			<Terminal width={1300} height={560} style={{ position: "absolute", top: 330 }} title="原生 Pi · 同一轮工作">
				<div style={{ filter: `blur(${page > 2 ? 1.2 : 0}px)` }}>
					{screens.scroll[page].map((l, i) => (
						<div key={i} style={{ minHeight: "1.55em", overflow: "hidden" }}>{l}</div>
					))}
				</div>
			</Terminal>
			<div style={{ position: "absolute", top: 910, fontFamily: MONO, fontSize: 30, color: C.accent, fontVariantNumeric: "tabular-nums" }}>
				PageUp × {shown}
			</div>
		</AbsoluteFill>
	);
};

const Title: React.FC = () => (
	<AbsoluteFill style={{ background: C.bg, alignItems: "center", justifyContent: "center" }}>
		<div style={{ position: "absolute", width: 900, height: 300, borderRadius: 400, background: "radial-gradient(closest-side, rgba(233,179,90,0.14), transparent)" }} />
		<Headline lines={["Pi，看得懂。"]} size={110} style={{ textAlign: "center" }} />
		<div style={{ fontFamily: MONO, color: C.muted, fontSize: 26, marginTop: 28, opacity: useIn(12) }}>pi-activity-view</div>
	</AbsoluteFill>
);

// Color the plain grouped capture the way Pi draws it: header glyphs and counts.
const GroupedLine: React.FC<{ l: string }> = ({ l }) => {
	const m = l.match(/^ ([·✗✓◐]) (.*)$/);
	if (!m) return <div style={{ minHeight: "1.55em", color: l.includes("执行方案") ? C.text : "#bdbcb7", overflow: "hidden" }}>{l}</div>;
	const [, g, rest] = m;
	const fail = rest.match(/(.*?)(最后一步失败：[^·]*)(.*)/);
	return (
		<div style={{ minHeight: "1.55em", overflow: "hidden", background: "rgba(233,179,90,0.06)", margin: "2px -10px", padding: "0 10px", borderRadius: 6 }}>
			<span style={{ color: g === "✗" ? C.error : C.muted }}>{` ${g} `}</span>
			{fail ? (
				<>
					<span style={{ color: C.text, fontWeight: 600 }}>{fail[1]}</span>
					<span style={{ color: C.error }}>{fail[2]}</span>
					<span style={{ color: C.muted }}>{fail[3]}</span>
				</>
			) : (
				<span style={{ color: C.text }}>{rest}</span>
			)}
		</div>
	);
};

const Grouped: React.FC = () => {
	const f = useCurrentFrame();
	return (
		<AbsoluteFill style={{ background: C.bg }}>
			<div style={{ position: "absolute", left: 110, top: 200, width: 560 }}>
				<Headline lines={["235 次调用，", "收成几行段头。"]} size={60} />
				<div style={{ marginTop: 50, fontFamily: SANS, opacity: useIn(30) }}>
					<div style={{ fontSize: 26, color: C.muted }}>同一轮工作，往回翻</div>
					<div style={{ display: "flex", alignItems: "baseline", gap: 24, marginTop: 10 }}>
						<span style={{ fontSize: 64, color: C.dim, textDecoration: "line-through", fontWeight: 300 }}>279 页</span>
						<span style={{ fontSize: 96, color: C.accent, fontWeight: 500 }}>6 页</span>
					</div>
				</div>
			</div>
			<Terminal width={1080} height={780} tilt={-6} style={{ position: "absolute", right: 70, top: 150 }} title="pi + pi-activity-view · 同一轮工作">
				{screens.grouped.map((l, i) => (
					<div key={i} style={{ opacity: interpolate(f, [8 + i * 4, 18 + i * 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
						<GroupedLine l={l.slice(0, 66)} />
					</div>
				))}
			</Terminal>
		</AbsoluteFill>
	);
};

// 5. The plain-language card from the trial run, line by line; the out-of-scope warning is highlighted.
const Card: React.FC = () => {
	const f = useCurrentFrame();
	const warnIdx = screens.card.findIndex((l) => l.includes("&#x26A0;"));
	const focus = interpolate(f, [120, 140], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
	const second = f >= 120;
	return (
		<AbsoluteFill style={{ background: C.bg }}>
			<div style={{ position: "absolute", left: 110, top: 110 }}>
				{!second ? (
					<Headline key="a" lines={["用大白话，", "说清这一轮。"]} sub="另外调一次模型翻译，不进 Agent 的对话。" size={60} />
				) : (
					<Headline key="b" lines={["每一句都有出处。", "多做了什么，替你指出来。"]} sub="方括号里是证据编号，Ctrl+O 看原文。" size={60} delay={120} />
				)}
			</div>
			<Terminal width={1600} height={420} style={{ position: "absolute", left: 160, top: 470 }} title="任务：加 FALL15 折扣码，跑测试" fontSize={27}>
				{screens.card.map((l, i) => {
					const on = interpolate(f, [14 + i * 9, 26 + i * 9], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
					const isWarn = i === warnIdx;
					return (
						<div
							key={i}
							style={{
								opacity: on * (second && !isWarn && i > 0 ? 1 - 0.55 * focus : 1),
								transform: `translateY(${(1 - on) * 8}px)`,
								background: isWarn ? `rgba(233,179,90,${0.16 * focus})` : "transparent",
								boxShadow: isWarn ? `0 0 0 ${2 * focus}px rgba(233,179,90,${0.6 * focus})` : "none",
								borderRadius: 6,
								margin: "0 -10px",
								padding: "0 10px",
							}}
						>
							<Html html={l} style={{ fontSize: isWarn ? 27 + 2 * focus : 27 }} />
						</div>
					);
				})}
			</Terminal>
		</AbsoluteFill>
	);
};

const Key: React.FC<{ label: string; at: number }> = ({ label, at }) => {
	const f = useCurrentFrame();
	const press = interpolate(f, [at, at + 4, at + 10], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
	return (
		<div
			style={{
				fontFamily: SANS,
				fontSize: 34,
				color: C.text,
				background: "linear-gradient(#2a2b30, #1d1e22)",
				border: "1px solid #3a3b40",
				borderRadius: 18,
				padding: "26px 46px",
				boxShadow: `0 ${10 - 8 * press}px 0 #0a0a0c, 0 20px 50px rgba(0,0,0,0.5)`,
				transform: `translateY(${8 * press}px)`,
			}}
		>
			{label}
		</div>
	);
};

const Decide: React.FC = () => {
	const f = useCurrentFrame();
	const typed = f > 52;
	return (
		<AbsoluteFill style={{ background: C.bg, alignItems: "center" }}>
			<div style={{ position: "absolute", top: 120, width: "100%", textAlign: "center" }}>
				<Headline lines={["要你拿主意的，", "放在最后一行。"]} size={60} />
			</div>
			<Terminal width={1600} height={250} style={{ position: "absolute", top: 400 }} title="真实会话 · Agent 停下来等你" fontSize={27}>
				{screens.prefill.map((l, i) => (
					<div key={i} style={{ color: i === 0 ? C.text : C.muted }}>{l}</div>
				))}
				<div style={{ borderTop: "1px solid #2a2b30", marginTop: 14, paddingTop: 10, color: C.text }}>
					{typed ? "继续" : "/reload"}
					<span style={{ opacity: Math.floor(f / 15) % 2 ? 0 : 1, color: C.accent }}>▍</span>
				</div>
			</Terminal>
			<div style={{ position: "absolute", top: 740 }}>
				<Key label="Enter ⏎" at={44} />
			</div>
		</AbsoluteFill>
	);
};

const End: React.FC = () => (
	<AbsoluteFill style={{ background: C.bg, alignItems: "center", justifyContent: "center" }}>
		<div style={{ fontFamily: MONO, fontSize: 64, color: C.text, opacity: useIn(0) }}>pi-activity-view</div>
		<div style={{ fontFamily: SANS, fontSize: 34, color: C.muted, marginTop: 22, opacity: useIn(8) }}>看得懂 Agent 在做什么。</div>
		<div style={{ fontFamily: SANS, fontSize: 22, color: C.dim, marginTop: 40, opacity: useIn(16) }}>Pi 扩展 · 只改显示，不改 Agent 的工作</div>
	</AbsoluteFill>
);

// Short crossfade at both ends of each scene.
const Fade: React.FC<{ len: number; children: React.ReactNode }> = ({ len, children }) => {
	const f = useCurrentFrame();
	const o = interpolate(f, [0, 8, len - 8, len], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
	return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};

export const Promo: React.FC = () => {
	const order: [number, number, React.FC][] = [
		[S.noise, S.scroll, Noise],
		[S.scroll, S.title, Scroll],
		[S.title, S.grouped, Title],
		[S.grouped, S.card, Grouped],
		[S.card, S.decide, Card],
		[S.decide, S.end, Decide],
		[S.end, DURATION, End],
	];
	return (
		<AbsoluteFill style={{ background: C.bg }}>
			{order.map(([from, to, Scene], i) => {
				return (
					<Sequence key={i} from={from} durationInFrames={to - from}>
						<Fade len={to - from}>
							<Scene />
						</Fade>
					</Sequence>
				);
			})}
		</AbsoluteFill>
	);
};

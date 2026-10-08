// Scene "对不对": every plain-language sentence draws a line back to the record it cites.
// Solid line = tool record (checkable fact). Dashed line = the agent's own words (a claim).
// All text below is copied from the real trial run (FALL15 task, session pia2).
import React from "react";
import { AbsoluteFill, Audio, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import T from "./timeline.json";
import { K, SANS, MONO, prog, Reveal, Grain } from "../film/kit";

type Row = { id: string; kind: string; text: string; tone?: "err" | "ok" };
const ROWS: Row[] = [
	{ id: "A1", kind: "Agent 说", text: "Added FALL15 … Fixed an existing rounding bug; npm test passes all 4 tests." },
	{ id: "T9", kind: "edit", text: "src/discount.js" },
	{ id: "T10", kind: "edit", text: "test/discount.test.js" },
	{ id: "T11", kind: "bash", text: "npm test  →  # pass 3  # fail 1", tone: "err" },
	{ id: "T12", kind: "todo", text: "Fix existing rounding failure" },
	{ id: "T13", kind: "edit", text: "src/discount.js" },
	{ id: "T14", kind: "bash", text: "npm test; git diff --stat  →  # pass 4  # fail 0", tone: "ok" },
];
type Sentence = { mark: string; color: string; text: string; refs: string[] };
const SENTENCES: Sentence[] = [
	{ mark: "✓", color: K.ok, text: "新增 FALL15（优惠码）：满30美元减15%，并加入测试。", refs: ["A1", "T9", "T10"] },
	{ mark: "✓", color: K.ok, text: "最后一次测试，四项全部通过。", refs: ["T14"] },
	{ mark: "✗", color: K.err, text: "首次测试有一项取整失败；证据里看不出是不是这次改坏的。", refs: ["T11"] },
	{ mark: "⚠", color: K.warn, text: "你没让它修取整，它也修了：金额计算变了，是否保留由你定。", refs: ["T12", "T13", "A1"] },
];
const WARN = 3;

// Layout (1920x1080).
const PANEL = { x: 110, y: 390, w: 820, rowH: 76, pad: 26 };
const RIGHT = { x: 1040, y: 392, w: 740, gap: 150 };
const rowY = (i: number) => PANEL.y + 38 + PANEL.pad + i * PANEL.rowH + PANEL.rowH / 2;
const sentY = (i: number) => RIGHT.y + i * RIGHT.gap + 26;

export const Verify: React.FC<{ withAudio?: boolean }> = ({ withAudio = true }) => {
	const f = useCurrentFrame();
	const { fps } = useVideoConfig();

	// Camera: slow drift the whole time, then a push toward the out-of-scope sentence on the beat.
	const push = spring({ frame: f - T.push, fps, config: { damping: 30, stiffness: 60, mass: 1.2 } });
	const drift = interpolate(f, [0, T.duration], [0, 1]);
	const scale = 1 + 0.025 * drift + 0.05 * push;
	const focusX = 960, focusY = sentY(WARN) - 60;
	const camera = `translate(0px, ${-(focusY - 540) * 0.22 * push - 8 * drift}px) scale(${scale})`;
	const defocus = 3.2 * push; // shallow depth of field once we push in

	const panelIn = prog(f, T.panelIn, 20);
	const litRows = new Set<string>();
	SENTENCES.forEach((s, i) => {
		if (f >= T.links[i] + 6) s.refs.forEach((r) => litRows.add(r));
	});

	return (
		<AbsoluteFill style={{ background: K.bg, overflow: "hidden" }}>
			{withAudio && <Audio src={staticFile("verify.wav")} />}
			<AbsoluteFill style={{ background: "radial-gradient(1400px 800px at 55% 45%, #15151F 0%, #08080B 70%)" }} />
			<AbsoluteFill style={{ transform: camera, transformOrigin: `${focusX}px ${focusY}px` }}>
				{/* Headline, left-aligned editorial */}
				<div style={{ position: "absolute", left: 120, top: 120, fontFamily: SANS, fontWeight: 600, fontSize: 76, letterSpacing: -1.5, color: K.text, lineHeight: 1.15, filter: `blur(${defocus * 0.6}px)`, opacity: 1 - 0.35 * push }}>
					<div style={{ color: K.muted }}>
						<Reveal text="每一句，" start={T.headline + 2} />
					</div>
					<Reveal text="都连回证据。" start={T.headline + 12} />
				</div>
				<div style={{ position: "absolute", left: 1060, top: 168, fontFamily: SANS, fontSize: 24, color: K.muted, opacity: prog(f, T.sentences[0], 16) * (1 - push) }}>
					<span style={{ color: K.text }}>━</span> 工具记录　<span style={{ color: K.lilac }}>┅</span> Agent 自己说的
				</div>

				{/* Evidence panel: the run's own records */}
				<div
					style={{
						position: "absolute",
						left: PANEL.x,
						top: PANEL.y,
						width: PANEL.w,
						borderRadius: 16,
						background: K.panel,
						border: `1px solid ${K.panelEdge}`,
						boxShadow: "0 60px 140px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.04)",
						opacity: panelIn,
						filter: `blur(${(1 - panelIn) * 12 + defocus * (1 - 0.7 * push)}px)`,
						transform: `perspective(1800px) translateZ(${(1 - panelIn) * -260}px) rotateY(${6 * (1 - panelIn) + 4}deg)`,
						transformOrigin: "left center",
					}}
				>
					<div style={{ height: 38, display: "flex", alignItems: "center", padding: "0 18px", gap: 8, borderBottom: `1px solid ${K.panelEdge}` }}>
						{[0, 1, 2].map((i) => (
							<div key={i} style={{ width: 11, height: 11, borderRadius: 6, background: "#2A2C3D" }} />
						))}
						<div style={{ flex: 1, textAlign: "center", fontFamily: MONO, fontSize: 14, color: "#5E5C76" }}>这一轮的记录 · 加 FALL15 折扣码</div>
					</div>
					<div style={{ padding: PANEL.pad }}>
						{ROWS.map((r) => {
							const lit = litRows.has(r.id);
							const isWarnRow = push > 0 && (r.id === "T12" || r.id === "T13");
							return (
								<div
									key={r.id}
									style={{
										height: PANEL.rowH,
										display: "flex",
										alignItems: "center",
										gap: 18,
										fontFamily: MONO,
										fontSize: 23,
										borderRadius: 8,
										padding: "0 12px",
										margin: "0 -12px",
										background: isWarnRow ? `rgba(233,179,90,${0.12 * push})` : lit ? "rgba(169,163,217,0.07)" : "transparent",
										color: r.tone === "err" ? K.err : r.tone === "ok" ? K.ok : "#C9C8D6",
									}}
								>
									<span style={{ width: 52, color: lit ? K.lilac : "#5E5C76", fontWeight: 500 }}>{r.id}</span>
									<span style={{ width: 120, color: "#6F6D88", whiteSpace: "nowrap" }}>{r.kind}</span>
									<span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1, color: r.id === "A1" ? "#A7A5BA" : undefined, fontStyle: r.id === "A1" ? "italic" : undefined }}>{r.text}</span>
								</div>
							);
						})}
					</div>
				</div>

				{/* Plain-language sentences */}
				{SENTENCES.map((s, i) => {
					const p = prog(f, T.sentences[i], 16);
					const isWarn = i === WARN;
					const dim = isWarn ? 0 : push;
					return (
						<div
							key={i}
							style={{
								position: "absolute",
								left: RIGHT.x,
								top: RIGHT.y + i * RIGHT.gap,
								width: RIGHT.w,
								fontFamily: SANS,
								fontSize: 32,
								lineHeight: 1.4,
								color: K.text,
								opacity: p * (1 - 0.6 * dim),
								filter: `blur(${(1 - p) * 10 + defocus * dim}px)`,
								transform: `translateY(${(1 - p) * 14}px) scale(${isWarn ? 1 + 0.04 * push : 1})`,
								transformOrigin: "left center",
								padding: isWarn ? "10px 18px" : "10px 18px",
								margin: "-10px -18px",
								borderRadius: 12,
								background: isWarn ? `rgba(233,179,90,${0.1 * push})` : "transparent",
								boxShadow: isWarn ? `0 0 0 ${1.5 * push}px rgba(233,179,90,${0.55 * push}), 0 30px 80px rgba(233,179,90,${0.18 * push})` : "none",
							}}
						>
							<span style={{ color: s.color, marginRight: 12 }}>{s.mark}</span>
							{s.text}
							<div style={{ fontFamily: MONO, fontSize: 17, color: K.lilac, marginTop: 4, opacity: prog(f, T.links[i] - 4, 8) }}>[{s.refs.join(" ")}]</div>
						</div>
					);
				})}

				{/* Links from each sentence back to the records it cites */}
				<svg width="1920" height="1080" style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
					<defs>
						<filter id="glow">
							<feGaussianBlur stdDeviation="3" result="b" />
							<feMerge>
								<feMergeNode in="b" />
								<feMergeNode in="SourceGraphic" />
							</feMerge>
						</filter>
					</defs>
					{SENTENCES.flatMap((s, i) =>
						s.refs.map((r, j) => {
							const ri = ROWS.findIndex((x) => x.id === r);
							const x1 = RIGHT.x - 30, y1 = sentY(i);
							const x2 = PANEL.x + PANEL.w + 8, y2 = rowY(ri);
							const d = `M ${x1} ${y1} C ${x1 - 90} ${y1}, ${x2 + 90} ${y2}, ${x2} ${y2}`;
							const draw = prog(f, T.links[i] + j * 3, 14);
							const claim = r.startsWith("A");
							const color = i === WARN ? K.warn : claim ? K.lilac : "#D9D8E6";
							const dim = i === WARN ? 0 : push;
							return (
								<g key={`${i}-${r}`} opacity={draw > 0 ? 1 - 0.75 * dim : 0}>
									<path d={d} pathLength={1} fill="none" stroke={color} strokeWidth={i === WARN ? 2.4 : 1.6} strokeDasharray={claim ? "0.012 0.012" : `${draw} 1`} strokeDashoffset={0} opacity={claim ? draw : 1} filter={i === WARN ? "url(#glow)" : undefined} />
									<circle cx={x2} cy={y2} r={4 * draw} fill={color} />
									<circle cx={x1} cy={y1} r={3 * draw} fill={color} />
								</g>
							);
						})
					)}
				</svg>

				{/* The real change behind T13, rising out of the record */}
				{(() => {
					const p = prog(f, T.diff, 18);
					return (
						<div
							style={{
								position: "absolute",
								left: RIGHT.x - 18,
								top: sentY(WARN) + 92,
								width: 860,
								fontFamily: MONO,
								fontSize: 20,
								lineHeight: 1.7,
								padding: "18px 24px",
								borderRadius: 14,
								background: "#17182A",
								border: "1px solid #34364F",
								boxShadow: "0 50px 120px rgba(0,0,0,0.7)",
								opacity: p,
								transform: `translateY(${(1 - p) * 30}px) scale(${0.96 + 0.04 * p})`,
								filter: `blur(${(1 - p) * 8}px)`,
							}}
						>
							<div style={{ color: "#6F6D88", fontSize: 16, marginBottom: 6 }}>T13 · edit src/discount.js</div>
							<div style={{ color: K.err }}>-  return subtotal - Math.floor((subtotal * percent) / 100);</div>
							<div style={{ color: K.ok }}>+  return subtotal - Math.round((subtotal * percent) / 100);</div>
						</div>
					);
				})()}
			</AbsoluteFill>

			{/* Vignette + grain only when rendered on its own; the film adds them once for every scene */}
			{withAudio && <AbsoluteFill style={{ background: "radial-gradient(1200px 700px at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)", pointerEvents: "none" }} />}
			{withAudio && <Grain />}
		</AbsoluteFill>
	);
};

// Shared look for every scene: fonts, palette, easing, reveal, grain.
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

const { fontFamily: INTER } = loadInter("normal", { weights: ["300", "400", "500", "600"], subsets: ["latin"] });
const { fontFamily: JB } = loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] });
export const SANS = `${INTER}, "PingFang SC", sans-serif`;
export const MONO = `${JB}, "PingFang SC", monospace`;

export const K = {
	bg: "#08080B",
	panel: "#111219",
	panelEdge: "#24263A",
	text: "#EDEDF2",
	muted: "#8E8CA6",
	lilac: "#A9A3D9",
	ok: "#7CC79A",
	err: "#E5675A",
	warn: "#E9B35A",
};

export const ease = Easing.bezier(0.22, 1, 0.36, 1);
export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const prog = (f: number, start: number, len: number) => interpolate(f, [start, start + len], [0, 1], { ...clamp, easing: ease });

// Per-character blur-to-sharp reveal, the way the reference sets its headlines.
export const Reveal: React.FC<{ text: string; start: number; stagger?: number; style?: React.CSSProperties }> = ({ text, start, stagger = 1.6, style }) => {
	const f = useCurrentFrame();
	return (
		<span style={style}>
			{[...text].map((c, i) => {
				const p = prog(f, start + i * stagger, 14);
				return (
					<span key={i} style={{ display: "inline-block", opacity: p, filter: `blur(${(1 - p) * 10}px)`, transform: `translateY(${(1 - p) * 10}px)` }}>
						{c === " " ? " " : c}
					</span>
				);
			})}
		</span>
	);
};

export const Grain: React.FC = () => {
	const f = useCurrentFrame();
	return (
		<AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "overlay", opacity: 0.16 }}>
			<svg width="1920" height="1080">
				<filter id="g">
					<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={f % 12} />
					<feColorMatrix type="saturate" values="0" />
				</filter>
				<rect width="1920" height="1080" filter="url(#g)" />
			</svg>
		</AbsoluteFill>
	);
};


export const Vignette: React.FC = () => (
	<AbsoluteFill style={{ background: "radial-gradient(1200px 700px at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)", pointerEvents: "none" }} />
);
export const Backdrop: React.FC = () => <AbsoluteFill style={{ background: "radial-gradient(1400px 800px at 55% 45%, #15151F 0%, #08080B 70%)" }} />;

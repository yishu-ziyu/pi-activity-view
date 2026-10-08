/**
 * Plain-language explanation of one agent run, for a reader who does not read code.
 *
 * A separate model call reads an evidence digest of the run (the agent's own words A#, tool
 * calls T#, mechanical signals M#) and writes short sentences. Every sentence must cite
 * evidence; the code drops any sentence whose citations do not exist, and any "proven"
 * sentence that cites no tool evidence. The suggested next input must be quoted from the
 * agent's own words. Nothing here enters the agent's context.
 */
import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { uuidv7 } from "@earendil-works/pi-ai";
import { truncateToWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import { failureDetail, okMarkerInFailure, testSummary } from "./signals.ts";

type Evidence = { id: string; label: string; text: string };
type Line = { kind: string; text: string; refs: string[] };
type Explain = {
	lines: Line[];
	next?: { ask: string; steps: string[]; refs: string[] };
	dropped: number;
	evidence: Record<string, Evidence>;
	error?: string;
	/** True only when the editor was read back and holds the first step. */
	prefilled?: boolean;
	/** Mechanical facts for the title line (calls, duration, files). */
	facts?: string;
};

const PLACEHOLDER = /<[^>]*>|＜|【|\{\{|XXX|\.\.\.|…/;

const KINDS: Record<string, { mark: string; color: string; title: string }> = {
	did: { mark: "·", color: "muted", title: "做了什么" },
	proven: { mark: "✓", color: "success", title: "有证据" },
	failed: { mark: "✗", color: "error", title: "没成功" },
	caution: { mark: "⚠", color: "warning", title: "要注意" },
	claim: { mark: "?", color: "muted", title: "只有 Agent 自己说" },
	why: { mark: "·", color: "muted", title: "原因" },
};

function textOf(content: any): string {
	if (typeof content === "string") return content;
	return (content ?? []).filter((c: any) => c?.type === "text").map((c: any) => c.text).join("\n");
}

function oneLine(s: string, n: number) {
	const t = s.replace(/\s+/g, " ").trim();
	return t.length > n ? `${t.slice(0, n)}…` : t;
}

/** Build the evidence digest for the last user turn on the current branch. */
export function digest(ctx: ExtensionContext) {
	const branch = ctx.sessionManager.getBranch() as any[];
	let start = branch.length - 1;
	while (start > 0 && !(branch[start].type === "message" && branch[start].message.role === "user")) start--;
	const turn = branch.slice(start);
	const ev: Evidence[] = [];
	const callIds = new Map<string, { id: string; name: string; args: any }>();
	let a = 0, t = 0, m = 0, request = "";
	let tasks: any[] | undefined;
	for (const e of turn) {
		if (e.type !== "message") continue;
		const msg = e.message;
		if (msg.role === "user") request = textOf(msg.content);
		else if (msg.role === "assistant" && Array.isArray(msg.content)) {
			for (const c of msg.content) {
				if (c.type === "text" && c.text?.trim()) ev.push({ id: `A${++a}`, label: "Agent 说", text: c.text.trim() });
				if (c.type === "toolCall") callIds.set(c.id, { id: `T${++t}`, name: c.name, args: c.arguments });
			}
		} else if (msg.role === "toolResult") {
			const call = callIds.get(msg.toolCallId);
			if (!call) continue;
			if (msg.toolName === "todo" && Array.isArray(msg.details?.tasks)) tasks = msg.details.tasks;
			const out = textOf(msg.content);
			const args = call.args ?? {};
			const target = args.command ?? args.path ?? args.pattern ?? args.query ?? JSON.stringify(args);
			const code = out.match(/exited with code (\d+)/)?.[1];
			const exit = msg.isError ? ` → 失败${code ? `（退出码 ${code}）` : ""}` : " → 成功";
			let body = "";
			if (call.name === "bash" || msg.isError) {
				const tail = out.split("\n").map((l: string) => l.trim()).filter((l: string) => l && !/^Command exited/.test(l)).slice(-4);
				const detail = msg.isError ? failureDetail(out).filter((l) => !tail.includes(l)) : [];
				const summary = testSummary(out).filter((l) => !tail.includes(l));
				body = [...summary, ...detail, ...tail].map((l: string) => oneLine(l, 160)).join(" | ");
			}
			ev.push({ id: call.id, label: call.name, text: `${call.name} ${oneLine(String(target), 160)}${exit}${body ? `\n输出末尾：${body}` : ""}` });
			if (msg.isError && okMarkerInFailure(out)) {
				ev.push({ id: `M${++m}`, label: "矛盾信号", text: `${call.id} 的输出里有成功字样，但命令本身失败了。` });
			}
		}
	}
	if (tasks) {
		const open = tasks.filter((x) => x.status !== "completed" && x.status !== "deleted");
		ev.push({
			id: `M${++m}`,
			label: "待办状态",
			text: `完成 ${tasks.filter((x) => x.status === "completed").length}/${tasks.filter((x) => x.status !== "deleted").length}。未完成：${open.map((x) => `「${x.subject}」(${x.status}${x.activeForm ? `，${x.activeForm}` : ""})`).join("；") || "无"}`,
		});
	}
	return { request, evidence: ev, calls: t };
}

const PROMPT = `你在帮一位不读代码的产品负责人看懂 AI 编程 Agent 刚做完的一轮工作，让他能自己判断，而不是只能相信 Agent。

下面是证据清单。每条有编号：
- A# 是 Agent 自己说的话（这是它的说法，不等于事实）
- T# 是一次工具调用和结果（这是可核对的事实）
- M# 是程序算出来的信号（矛盾、待办状态）

请输出 JSON，不要输出别的：
{"lines":[{"kind":"did|proven|failed|caution|claim|why","text":"...","refs":["T3","A2"]}],
 "next":{"ask":"你要决定的事","steps":["要输入的原文1","原文2"],"refs":["A5"]} 或 null}

规则：
1. 每句 text 不超过 50 个汉字，用日常说法。代码名、文件名、命令名尽量不出现；必须出现时，用括号说明它是什么。
2. 每句必须有 refs，只能引用清单里存在的编号。没有出处的话不要写。
3. proven 只写“成功了、并且有 T# 工具结果支撑”的事。失败的事写 failed，不写 proven。Agent 的说法如果有 T# 支撑，就写成 proven 或 failed，不要写 claim；claim 只留给没有工具结果支撑的说法。
4. Agent 的说法和工具结果对不上、Agent 撤回过结论、有 M# 矛盾信号，都必须写成 caution，并说明对用户意味着什么。
5. 不要猜原因。原因只能来自证据原文。
5b. Agent 事先计划好的失败（例如先跑一次验收、证明问题确实存在）不是“没成功”，写成 did 并说明这是有意的。
6. 按这个顺序：did（最多 2 句）→ proven → failed → caution → claim → why。总共不超过 9 句。
7. next：这一轮留下了需要用户拿主意的事（还有失败没处理、待办没做完、Agent 提出要用户做某事）时填，否则填 null。
   ask 用一句话说清用户在决定什么、两种选择各会怎样，例如“原来就坏的取整测试要不要现在修：修会多改一处代码，不修则测试继续报红”。
   steps 只在 Agent 原话里明确要用户输入某段文字时才填，每项是原文、一字不改；否则 steps 填 []。
8b. 对照用户这轮的指令：Agent 做了指令没要求的事（改了指令以外的代码、修了没让修的问题、删了东西），必须写成 caution，说清它多做了什么、对用户意味着什么（例如“你没让它修取整，它修了：结果变了，要不要保留由你定”）。
8. 失败是这次改动造成的，还是原来就有的？证据能说明时必须写出来（引用证据）；说明不了就写“证据里看不出是不是这次改坏的”。

用户这轮的指令：
<<REQUEST>>

证据清单：
<<EVIDENCE>>`;

function parseJson(s: string): any {
	const i = s.indexOf("{"), j = s.lastIndexOf("}");
	if (i < 0 || j < i) throw new Error("模型没有返回 JSON");
	return JSON.parse(s.slice(i, j + 1));
}

/** Enforce the citation rules in code, not just in the prompt. */
export function validate(raw: any, evidence: Evidence[]): Omit<Explain, "evidence"> {
	const ids = new Set(evidence.map((e) => e.id));
	const lines: Line[] = [];
	let dropped = 0;
	for (const l of raw?.lines ?? []) {
		const refs: string[] = Array.isArray(l?.refs) ? l.refs.filter((r: any) => ids.has(r)) : [];
		const ok =
			typeof l?.text === "string" && l.text.trim() && KINDS[l.kind] && refs.length > 0 && refs.length === (l.refs?.length ?? 0) &&
			(l.kind !== "proven" || refs.some((r) => r.startsWith("T")));
		// A "claim" that cites tool evidence is not unsupported; show it as a plain statement.
		if (ok) lines.push({ kind: l.kind === "claim" && refs.some((r) => r.startsWith("T")) ? "did" : l.kind, text: l.text.trim(), refs });
		else dropped++;
	}
	let next: Explain["next"];
	const n = raw?.next;
	if (n && typeof n.ask === "string" && n.ask.trim() && Array.isArray(n.refs) && n.refs.some((r: string) => ids.has(r))) {
		const quoted = n.refs.filter((r: string) => r.startsWith("A") && ids.has(r)).map((r: string) => evidence.find((e) => e.id === r)!.text).join("\n");
		const steps = (Array.isArray(n.steps) ? n.steps : []).map((s: any) => String(s).trim()).filter(Boolean);
		// Steps to prefill must be the agent's own words; a decision without steps is still shown.
		if (steps.every((s: string) => quoted.includes(s))) next = { ask: n.ask.trim(), steps, refs: n.refs };
		else dropped++;
	}
	return { lines, next, dropped };
}

export async function explainTurn(ctx: ExtensionContext): Promise<Explain> {
	const d = digest(ctx);
	const evidence = Object.fromEntries(d.evidence.map((e) => [e.id, e]));
	const model = ctx.model;
	if (!model) return { lines: [], dropped: 0, evidence, error: "没有可用的模型" };
	const prompt = PROMPT.replace("<<REQUEST>>", d.request).replace("<<EVIDENCE>>", d.evidence.map((e) => `[${e.id}] ${e.label}：${e.text}`).join("\n"));
	try {
		const res = await ctx.modelRegistry.complete(
			model,
			{ messages: [{ role: "user", content: [{ type: "text", text: prompt }], timestamp: Date.now() }] },
			{ reasoningEffort: "medium", cacheRetention: "none", sessionId: uuidv7() } as any,
		);
		const text = res.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
		return { ...validate(parseJson(text), d.evidence), evidence };
	} catch (e: any) {
		return { lines: [], dropped: 0, evidence, error: String(e?.message ?? e) };
	}
}

export function renderExplain(f: Explain, expanded: boolean, theme: Theme) {
	return {
		render(width: number) {
			const out: string[] = ["", ` ${theme.fg("accent", "◆ 这一轮，用大白话说")}${f.facts ? theme.fg("muted", ` · ${f.facts}`) : ""}${theme.fg("dim", expanded ? "  出处已展开 · Ctrl+O 收起" : "  Ctrl+O 看出处")}`];
			if (f.error) out.push(`   ${theme.fg("error", `翻译失败：${f.error}`)}`);
			const wrap = (prefix: string, text: string) => {
				const w = Math.max(20, width - 8);
				wrapTextWithAnsi(text, w).forEach((seg, i) => out.push(truncateToWidth((i ? "     " : prefix) + seg, width)));
			};
			for (const l of f.lines) {
				const k = KINDS[l.kind];
				wrap(`   ${theme.fg(k.color as any, k.mark)} `, `${l.text}${theme.fg("dim", ` [${l.refs.join(" ")}]`)}`);
				if (expanded) {
					for (const r of l.refs) {
						const e = f.evidence[r];
						if (e) wrap("       ", theme.fg("dim", `${r} ${e.label}：${oneLine(e.text, 300)}`));
					}
				}
			}
			if (f.next) {
				out.push("");
				wrap(`   ${theme.fg("accent", "→")} `, `${theme.bold("你要决定：")}${f.next.ask.replace(/^你要决定[：:]?\s*/, "")}`);
				const first = f.next.steps[0];
				if (first === undefined) {
					wrap("     ", theme.fg("muted", "在下面输入框里写下你的决定。"));
				} else {
				// Only /reload has an automatic follow-up (see session_start below); otherwise just say what comes next.
				const rest = f.next.steps.length < 2 ? "" : first === "/reload" ? `重载后会再填：${f.next.steps[1]}` : `之后还要输入：${f.next.steps.slice(1).join("、")}`;
				wrap("     ", theme.fg("muted", f.prefilled
					? `已填入输入框：${first}　按 Enter 执行；不同意就清空，自己写。${rest}`
					: PLACEHOLDER.test(first)
						? `Agent 建议的输入里有要你补全的部分，没有替你填：${first}`
						: `Agent 建议输入：${first}（输入框里已有内容，没有覆盖）`));
				}
			}
			if (f.dropped) out.push(`   ${theme.fg("dim", `另有 ${f.dropped} 句找不到出处，已删去。`)}`);
			return out;
		},
		invalidate() {},
	};
}

export function registerExplain(pi: ExtensionAPI, shouldRun: (ctx: ExtensionContext) => boolean, facts: (ctx: ExtensionContext) => string) {
	let running = false;

	pi.registerEntryRenderer<Explain>("activity-explain", (entry, { expanded }, theme) => (entry.data ? renderExplain(entry.data, expanded, theme) : undefined));

	const run = async (ctx: ExtensionContext) => {
		if (running) return;
		running = true;
		ctx.ui.setStatus("activity-explain", "正在把这一轮翻成大白话…");
		try {
			const f = await explainTurn(ctx);
			f.facts = facts(ctx);
			const first = f.next?.steps[0];
			if (first && !PLACEHOLDER.test(first) && !ctx.ui.getEditorText().trim()) {
				ctx.ui.setEditorText(first);
				f.prefilled = ctx.ui.getEditorText() === first;
			}
			pi.appendEntry("activity-explain", f);
		} finally {
			ctx.ui.setStatus("activity-explain", undefined);
			running = false;
		}
	};

	pi.on("agent_end", async (_e, ctx) => {
		if (shouldRun(ctx)) void run(ctx); // never block the input box
	});
	pi.registerCommand("explain", { description: "用大白话解释上一轮（测试用）", handler: async (_a, ctx) => void run(ctx) });

	// After /reload the extension restarts; carry the remaining steps through the session file.
	pi.on("session_start", async (e, ctx) => {
		if (e.reason !== "reload") return;
		// Only if the user has not sent anything since that explanation; an old one must not refill "继续" on a later /reload.
		const branch = ctx.sessionManager.getBranch() as any[];
		let i = branch.length - 1;
		while (i >= 0 && !(branch[i].type === "custom" && branch[i].customType === "activity-explain")) {
			if (branch[i].type === "message" && branch[i].message.role === "user") return;
			i--;
		}
		const steps: string[] = i >= 0 ? (branch[i].data?.next?.steps ?? []) : [];
		if (steps[0] === "/reload" && steps[1] && !ctx.ui.getEditorText().trim()) ctx.ui.setEditorText(steps[1]);
	});
}

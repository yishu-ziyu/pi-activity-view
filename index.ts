/**
 * Pi Activity View — display-only extension.
 *
 * A: consecutive tool calls (not separated by visible assistant text) collapse into one
 *    group header row. Click the header to list the calls; click a call to see its output.
 *    Ctrl+O still expands everything.
 * C: at the end of each agent run, a result card with mechanical facts only
 *    (call count, duration, changed files, last check command, contradictions, todo progress).
 *    Stored with appendEntry, so it never reaches the model.
 *
 * Nothing here changes tool execution, arguments, results, or model context.
 */
import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import { homedir } from "os";
import { registerExplain } from "./explain.ts";
import { okMarkerInFailure } from "./signals.ts";

type Result = { isError: boolean; text: string };
type Call = { id: string; name: string; args: any; result?: Result; group: Group; ts?: number };
type Group = { id: string; calls: Call[]; phases: string[]; phaseDone?: boolean };

const READ_TOOLS = new Set(["read", "read_symbol", "grep", "find", "ls", "fetch_content", "web_search", "module_report"]);
const EDIT_TOOLS = new Set(["edit", "write"]);
const CHECK_CMD = /\b(test|tests|build|typecheck|check|lint|xcodebuild|pytest|vitest|jest|swift|cargo|tsc|npm run|pnpm|make)\b/i;

const calls = new Map<string, Call>();
const invalidators = new Map<string, () => void>();
const expandedById = new Map<string, boolean>();
let ctxRef: ExtensionContext | undefined;

const lines = (arr: string[]) => ({ render: (w: number) => arr.map((l) => truncateToWidth(l, w)), invalidate() {} });
const EMPTY = lines([]);

function textOf(content: any): string {
	if (typeof content === "string") return content;
	return (content ?? []).filter((c: any) => c?.type === "text").map((c: any) => c.text).join("\n");
}

function shortPath(p: string) {
	const h = homedir();
	return p.startsWith(h) ? `~${p.slice(h.length)}` : p;
}

function argSummary(name: string, args: any): string {
	if (!args) return "";
	const v = args.path ?? args.command ?? args.pattern ?? args.query ?? args.url ?? args.subject;
	if (typeof v === "string") return shortPath(v.split("\n")[0]);
	return JSON.stringify(args).slice(0, 80);
}

function errorKind(text: string) {
	if (/RE-READ|RETRYABLE|PARTIAL APPLY|oldText|Edit target/i.test(text)) return "编辑未对上";
	if (/ENOENT|no such file|not found/i.test(text)) return "找不到文件";
	return "其他";
}

// ---------- grouping, rebuilt from the session branch ----------

function rebuild() {
	if (!ctxRef) return;
	calls.clear();
	let cur: Group | undefined;
	let phase: string | undefined;
	let phaseDone = false;
	for (const e of ctxRef.sessionManager.getBranch() as any[]) {
		if (e.type !== "message") {
			if (e.type === "compaction" || e.type === "custom_message") cur = undefined;
			continue;
		}
		const m = e.message;
		if (m.role === "user") cur = undefined;
		else if (m.role === "assistant") {
			const content = Array.isArray(m.content) ? m.content : [];
			const visibleText = content.some((c: any) => c.type === "text" && c.text?.trim());
			const toolCalls = content.filter((c: any) => c.type === "toolCall");
			// Failed/retried requests ("Error: fetch failed") stay visible but do not split a group.
			if (visibleText) cur = undefined;
			for (const tc of toolCalls) {
				if (!cur) cur = { id: tc.id, calls: [], phases: phase ? [phase] : [], phaseDone };
				const call: Call = { id: tc.id, name: tc.name, args: tc.arguments, group: cur, ts: m.timestamp };
				cur.calls.push(call);
				calls.set(tc.id, call);
			}
		} else if (m.role === "toolResult") {
			const call = calls.get(m.toolCallId);
			if (call) call.result = { isError: !!m.isError, text: textOf(m.content) };
			const tasks = m.toolName === "todo" ? m.details?.tasks : undefined;
			if (Array.isArray(tasks)) {
				const active = tasks.find((t: any) => t.status === "in_progress");
				if (active) {
					phase = active.subject;
					phaseDone = false;
				} else if (phase) {
					phaseDone = tasks.some((t: any) => t.subject === phase && t.status === "completed");
				}
				if (cur) {
					if (phase && cur.phases[cur.phases.length - 1] !== phase) cur.phases.push(phase);
					cur.phaseDone = phaseDone;
				}
			}
		}
	}
}

let pending: ReturnType<typeof setTimeout> | undefined;
function rebuildSoon() {
	if (pending) return;
	pending = setTimeout(() => {
		pending = undefined;
		rebuild();
		for (const inv of invalidators.values()) inv();
	}, 30);
}

// ---------- A: group rows ----------

function groupHeader(g: Group, open: boolean, theme: Theme): string {
	const last = g.calls[g.calls.length - 1];
	const running = g.calls.some((c) => !c.result);
	const glyph = running
		? theme.fg("warning", "◐")
		: last.result?.isError
			? theme.fg("error", "✗")
			: g.phaseDone
				? theme.fg("success", "✓")
				: theme.fg("muted", "·");
	let read = 0, cmd = 0;
	const other = new Map<string, number>();
	const files = new Set<string>();
	const errs = new Map<string, number>();
	for (const c of g.calls) {
		if (c.name === "todo") continue;
		if (READ_TOOLS.has(c.name)) read++;
		else if (c.name === "bash") cmd++;
		else if (EDIT_TOOLS.has(c.name)) files.add(c.args?.path ?? "?");
		else other.set(c.name, (other.get(c.name) ?? 0) + 1);
		if (c.result?.isError) {
			const k = errorKind(c.result.text);
			errs.set(k, (errs.get(k) ?? 0) + 1);
		}
	}
	const parts: string[] = [];
	if (read) parts.push(`读 ${read}`);
	if (cmd) parts.push(`命令 ${cmd}`);
	if (files.size) parts.push(`改 ${files.size} 个文件`);
	if (other.size) {
		const total = [...other.values()].reduce((a, b) => a + b, 0);
		const [topName, topN] = [...other].sort((a, b) => b[1] - a[1])[0];
		parts.push(other.size === 1 ? `${topName} ${topN}` : `其他 ${total}（${topName} ${topN} 等）`);
	}
	const errTotal = [...errs.values()].reduce((a, b) => a + b, 0);
	let errPart = "";
	if (errTotal) {
		const detail = [...errs].map(([k, n]) => `${k} ${n}`).join(" · ");
		errPart = theme.fg(last.result?.isError ? "error" : "muted", `  报错 ${errTotal}（${detail}）`);
	}
	const title = g.phases.length ? theme.bold(g.phases.join(" → ")) + (parts.length ? theme.fg("muted", " · ") : "") : "";
	const lastLine = last.result?.isError ? theme.fg("error", `最后一步失败：${last.name} ${argSummary(last.name, last.args).slice(0, 40)}`) : "";
	// "Last step failed" goes first so a narrow terminal never cuts it off.
	return ` ${glyph} ${title}${lastLine ? lastLine + "  " : ""}${theme.fg("muted", parts.join(" · "))}${errPart}${theme.fg("dim", open ? "  ▾" : "  ▸")}`;
}

function callLine(c: Call, theme: Theme): string {
	const mark = !c.result ? theme.fg("warning", "◐") : c.result.isError ? theme.fg("error", "✗") : theme.fg("dim", "·");
	return `     ${mark} ${theme.fg("toolTitle", c.name)} ${theme.fg("muted", argSummary(c.name, c.args))}`;
}

function isOpen(g: Group) {
	return expandedById.get(g.id) === true;
}

export default function (pi: ExtensionAPI) {
	pi.registerToolRenderer((_toolName, next) => {
		const base = next();
		return {
			renderShell: "self",
			renderCall(args: any, theme: Theme, rc: any) {
				invalidators.set(rc.toolCallId, rc.invalidate);
				const call = calls.get(rc.toolCallId);
				if (!call) {
					// Not yet in the session (streaming). One quiet line until the message is saved.
					return lines([` ${theme.fg("warning", "◐")} ${theme.fg("toolTitle", _toolName)} ${theme.fg("muted", argSummary(_toolName, args))}`]);
				}
				const g = call.group;
				const first = g.calls[0] === call;
				if (first) {
					const was = expandedById.get(call.id);
					expandedById.set(call.id, rc.expanded);
					if (was !== undefined && was !== rc.expanded) {
						for (const c of g.calls.slice(1)) invalidators.get(c.id)?.();
					}
					return lines(rc.expanded ? [groupHeader(g, true, theme), callLine(call, theme)] : [groupHeader(g, false, theme)]);
				}
				expandedById.set(call.id, rc.expanded);
				return isOpen(g) ? lines([callLine(call, theme)]) : EMPTY;
			},
			renderResult(result: any, opts: any, theme: Theme, rc: any) {
				const call = calls.get(rc.toolCallId);
				if (!call) return EMPTY;
				const g = call.group;
				const first = g.calls[0] === call;
				// The first row's click opens the group; its own output shows only when every row is expanded (Ctrl+O).
				const show = first ? g.calls.every((c) => expandedById.get(c.id)) : isOpen(g) && opts.expanded;
				if (!show) return EMPTY;
				if (base?.renderResult) {
					try {
						return base.renderResult(result, { ...opts, expanded: true }, theme, rc);
					} catch {}
				}
				return lines(textOf(result.content).split("\n").map((l) => "       " + theme.fg("toolOutput", l)));
			},
		} as any;
	});

	// ---------- C: result card ----------

	function turnFacts(ctx: ExtensionContext) {
		const branch = ctx.sessionManager.getBranch() as any[];
		let start = branch.length - 1;
		while (start > 0 && !(branch[start].type === "message" && branch[start].message.role === "user")) start--;
		const turn = branch.slice(start);
		const callMap = new Map<string, { name: string; args: any }>();
		const files = new Set<string>();
		const scratch = new Set<string>();
		const cwd = ctx.cwd;
		const checks: { cmd: string; code: string; tail: string }[] = [];
		const contradictions: { cmd: string; snippet: string }[] = [];
		let n = 0, t0 = 0, t1 = 0, tasks: any[] | undefined;
		for (const e of turn) {
			if (e.type !== "message") continue;
			const m = e.message;
			if (m.timestamp) {
				t0 ||= m.timestamp;
				t1 = m.timestamp;
			}
			if (m.role === "assistant" && Array.isArray(m.content)) {
				for (const tc of m.content.filter((c: any) => c.type === "toolCall")) {
					n++;
					callMap.set(tc.id, { name: tc.name, args: tc.arguments });
					if (EDIT_TOOLS.has(tc.name) && tc.arguments?.path) {
						// Files outside the project (e.g. a /tmp check script) are counted apart from project files.
						const p = String(tc.arguments.path);
						(p.startsWith("/") && !p.startsWith(cwd.endsWith("/") ? cwd : `${cwd}/`) ? scratch : files).add(p);
					}
				}
			} else if (m.role === "toolResult") {
				if (m.toolName === "todo" && Array.isArray(m.details?.tasks)) tasks = m.details.tasks;
				const c = callMap.get(m.toolCallId);
				if (!c || c.name !== "bash") continue;
				const cmd = String(c.args?.command ?? "").split("\n")[0];
				const text = textOf(m.content);
				const outLines = text.split("\n").map((l) => l.trim()).filter((l) => l && !/^Command exited with code/.test(l));
				const code = m.isError ? (text.match(/exited with code (\d+)/)?.[1] ?? "错误") : "0";
				if (CHECK_CMD.test(cmd)) checks.push({ cmd, code, tail: outLines[outLines.length - 1] ?? "" });
				if (m.isError) {
					const hit = okMarkerInFailure(text);
					if (hit) contradictions.push({ cmd, snippet: hit });
				}
			}
		}
		const todo = tasks?.filter((t) => t.status !== "deleted");
		return {
			calls: n,
			minutes: t0 && t1 ? Math.round((t1 - t0) / 60000) : undefined,
			files: [...files],
			scratch: [...scratch],
			checks,
			contradictions,
			todoDone: todo?.filter((t) => t.status === "completed").length,
			todoTotal: todo?.length,
			todoActive: todo?.find((t) => t.status === "in_progress")?.subject,
		};
	}

	pi.registerEntryRenderer<ReturnType<typeof turnFacts>>("activity-result", (entry, { expanded }, theme) => {
		const f = entry.data;
		if (!f) return undefined;
		const dur = f.minutes === undefined ? "" : f.minutes < 1 ? " · 不到 1 分" : f.minutes >= 60 ? ` · ${Math.floor(f.minutes / 60)} 小时 ${f.minutes % 60} 分` : ` · ${f.minutes} 分`;
		const out = ["", ` ${theme.fg("accent", "◆ 本轮记录")}${theme.fg("muted", ` · ${f.calls} 次调用${dur} · 改 ${f.files.length} 个文件${f.scratch?.length ? `（另写 ${f.scratch.length} 个项目外临时文件）` : ""}`)}${theme.fg("dim", expanded ? "  ▾" : "  ▸")}`];
		const lastCheck = f.checks[f.checks.length - 1];
		if (lastCheck) {
			// Exit code 0 only says the command ran; no green check, so it is not read as "the work passed".
			const ok = lastCheck.code === "0";
			const failed = f.checks.filter((c) => c.code !== "0").length;
			out.push(`   ${ok ? theme.fg("muted", "·") : theme.fg("error", "✗")} 检查命令 ${f.checks.length} 次${failed ? theme.fg("error", `，失败 ${failed} 次`) : ""}${theme.fg("muted", "。最后一次：")}${theme.fg("muted", lastCheck.cmd.slice(0, 50))} → ${ok ? "退出码 0" : theme.fg("error", `退出码 ${lastCheck.code}`)}${lastCheck.tail ? theme.fg("dim", `：${lastCheck.tail}`) : ""}`);
		}
		if (f.contradictions.length) {
			const c = f.contradictions[f.contradictions.length - 1];
			out.push(`   ${theme.fg("warning", "⚠")} 输出像成功，命令却失败${f.contradictions.length > 1 ? ` ×${f.contradictions.length}` : ""}：${theme.fg("muted", c.cmd.slice(0, 50))} ${theme.fg("dim", `「${c.snippet}」`)}`);
		}
		if (f.todoTotal) {
			out.push(`   ${theme.fg("muted", `待办 ${f.todoDone}/${f.todoTotal}`)}${f.todoActive ? theme.fg("muted", " · 进行中：") + f.todoActive : ""}`);
		}
		if (expanded) {
			if (f.files.length) out.push("", theme.fg("muted", "   改动的文件"), ...f.files.map((p) => `     ${shortPath(p)}`));
			if (f.checks.length) out.push("", theme.fg("muted", "   检查命令（按时间）"), ...f.checks.map((c) => `     ${c.code === "0" ? "✓" : "✗"} ${c.cmd.slice(0, 70)} → ${c.code}`));
			if (f.contradictions.length) out.push("", theme.fg("muted", "   输出像成功、命令却失败"), ...f.contradictions.map((c) => `     ${c.cmd.slice(0, 50)} 「${c.snippet}」`));
		}
		return lines(out);
	});

	// One card per run: the plain-language card when it runs (with these facts in its title line),
	// otherwise this fact card on its own.
	const explainEnabled = process.env.PI_ACTIVITY_EXPLAIN !== "0";
	const wantsExplain = (f: ReturnType<typeof turnFacts>) => explainEnabled && (f.files.length > 0 || (f.todoTotal ?? 0) > (f.todoDone ?? 0));
	const factsLine = (f: ReturnType<typeof turnFacts>) => {
		const dur = f.minutes === undefined ? "" : f.minutes < 1 ? " · 不到 1 分" : f.minutes >= 60 ? ` · ${Math.floor(f.minutes / 60)} 小时 ${f.minutes % 60} 分` : ` · ${f.minutes} 分`;
		return `${f.calls} 次调用${dur} · 改 ${f.files.length} 个文件${f.scratch?.length ? `（另写 ${f.scratch.length} 个项目外临时文件）` : ""}`;
	};

	pi.on("agent_end", async (_e, ctx) => {
		const f = turnFacts(ctx);
		if (f.calls > 0 && !wantsExplain(f)) pi.appendEntry("activity-result", f);
	});

	if (explainEnabled) {
		registerExplain(
			pi,
			(ctx) => wantsExplain(turnFacts(ctx)),
			(ctx) => factsLine(turnFacts(ctx)),
		);
	}

	// ---------- keep grouping in sync ----------
	pi.on("session_start", async (_e, ctx) => {
		ctxRef = ctx;
		rebuild();
		for (const inv of invalidators.values()) inv();
	});
	pi.on("message_end", async (_e, ctx) => {
		ctxRef = ctx;
		rebuildSoon();
	});
	pi.on("tool_execution_end", async (_e, ctx) => {
		ctxRef = ctx;
		rebuildSoon();
	});
}

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
const empty = { render: () => [] as string[], invalidate() {} };
export default function (pi: ExtensionAPI) {
	pi.registerToolRenderer((_name, next) => ({ ...(next() ?? {}), renderShell: "self", renderCall: () => empty as any, renderResult: () => empty as any }));
}

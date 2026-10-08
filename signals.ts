/**
 * "Output says success, command failed" — only when the output has a success marker AND no failure marker.
 * A test run printing "# pass 3 / # fail 1" is an ordinary failure, not a contradiction (found in trial 1).
 */
const OK_MARK = /(\b[A-Z_]*EXIT=0\b|exited with code 0\b|BUILD SUCCEEDED|\bPASSED\b|\ball tests passed\b)/i;
const FAIL_MARK = /(#\s*fail\s+[1-9]|\bfail(?:ed|ures?)?\s*[:=]?\s*[1-9]|\bnot ok\b|✖|\b[1-9]\d* failing\b|\bFAILED\b|^\s*Error\b|\bERR!)/im;

export function okMarkerInFailure(output: string): string | undefined {
	if (FAIL_MARK.test(output)) return undefined;
	return output.split("\n").map((l) => l.trim()).find((l) => OK_MARK.test(l));
}

/** Lines that say which check failed, so the explainer sees more than the last summary lines. */
export function failureDetail(output: string, max = 6): string[] {
	const re = /(not ok|✖|\bfail|error|expected|actual|assert|exception)/i;
	return output.split("\n").map((l) => l.trim()).filter((l) => l && re.test(l) && !/^#\s*(fail|pass)\s+\d/i.test(l)).slice(0, max);
}

/** Test-runner summary lines ("# pass 4", "12 passing", "Tests: 3 failed"), kept even when they are not at the end. */
export function testSummary(output: string, max = 4): string[] {
	const re = /^(#\s*(pass|fail|tests?)\s+\d+|\d+\s+(passing|failing|passed|failed|pending)\b|Tests?:\s.*\d)/i;
	return output.split("\n").map((l) => l.trim()).filter((l) => re.test(l)).slice(0, max);
}

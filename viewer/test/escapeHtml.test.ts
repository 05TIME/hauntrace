import { describe, it, expect } from "vitest";
import { escapeHtml, escapeJson } from "../src/escapeHtml.js";
import { formatTime, ruleLabel } from "../src/scrubberState.js";
import { formatAction } from "../src/formatAction.js";

describe("escapeHtml", () => {
  it("escapes every HTML metacharacter", () => {
    expect(escapeHtml(`& < > " ' \``)).toBe("&amp; &lt; &gt; &quot; &#39; &#96;");
  });

  it("escapes ampersands first (no double-decoding tricks)", () => {
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });

  it("neutralises malicious markup", () => {
    const evil = `<img src=x onerror="alert(1)"><script>alert('x')</script>`;
    const out = escapeHtml(evil);
    expect(out).not.toMatch(/[<>"']/);
    expect(out).toContain("&lt;script&gt;");
  });

  it("leaves normal values and Unicode untouched", () => {
    for (const s of ["Event nearby: Halloween (+35%)", "日本語 🎃 naïve", "", "a-b_c 123"]) {
      expect(escapeHtml(s)).toBe(s);
    }
  });

  it("converts non-strings", () => {
    expect(escapeHtml(42)).toBe("42");
    expect(escapeHtml(null)).toBe("null");
    expect(escapeHtml(undefined)).toBe("undefined");
  });
});

describe("escapeJson", () => {
  it("escapes markup inside JSON values and keys", () => {
    const out = escapeJson({ "<b>": "</pre><script>alert(1)</script>", n: 1 }, 2);
    expect(out).not.toMatch(/[<>]/);
    expect(out).toContain("&lt;/pre&gt;");
    expect(out).toContain("&quot;n&quot;: 1");
  });

  it("matches plain JSON for normal values after unescaping quotes", () => {
    const v = { price: 120, tags: ["a", "日本語"], ok: true, none: null };
    expect(escapeJson(v).replace(/&quot;/g, '"')).toBe(JSON.stringify(v));
  });

  it("never throws or returns undefined", () => {
    expect(escapeJson(undefined)).toBe("undefined");
    const cyc: Record<string, unknown> = {};
    cyc["self"] = cyc;
    expect(typeof escapeJson(cyc)).toBe("string");
    expect(typeof escapeJson(() => 1)).toBe("string");
  });
});

describe("trace-controlled display helpers stay safe once escaped", () => {
  it("ruleLabel / formatAction output escapes cleanly", () => {
    const rule = `<svg onload=alert(1)>`;
    expect(escapeHtml(ruleLabel(rule))).not.toContain("<");
    expect(escapeHtml(formatAction({ mood: "<b>x</b>" }))).not.toContain("<");
    expect(escapeHtml(formatAction("</span><script>"))).not.toContain("<");
  });

  it("formatTime does not throw on out-of-range times", () => {
    expect(formatTime(1e20)).toBe("t=100000000000000000000ms");
    expect(formatTime(0)).toBe("1970-01-01 00:00:00 UTC");
  });
});

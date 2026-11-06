import { describe, it, expect } from "vitest";
import { selectStartup } from "../src/startupSelection.js";
import { buildShareUrl, encodeTrace, decodeTrace, ShareLinkError } from "../src/shareLink.js";
import exampleNpcRaw from "../src/example-trace-npc.json";
import type { TraceFile } from "../src/types.js";

describe("selectStartup", () => {
  it("loads nothing for a bare URL", () => {
    expect(selectStartup("", "")).toEqual({ kind: "none" });
  });

  it("loads a built-in example (with whatif) when there is no payload", () => {
    expect(selectStartup("?example=npc&whatif=lantern", "")).toEqual({
      kind: "example",
      key: "npc",
      whatif: "lantern",
    });
    expect(selectStartup("?example=1", "")).toEqual({ kind: "example", key: "1", whatif: undefined });
  });

  it("ignores unknown example keys", () => {
    expect(selectStartup("?example=zzz", "")).toEqual({ kind: "none" });
  });

  it("a #t= payload wins over ?example and ?whatif", () => {
    expect(selectStartup("?example=1&whatif=x", "#t=p.abc")).toEqual({ kind: "share", payload: "p.abc" });
    expect(selectStartup("?example=npc", "#t=z.abc")).toEqual({ kind: "share", payload: "z.abc" });
  });

  it("empty or malformed payloads still select share (error path, never a sample)", () => {
    expect(selectStartup("?example=1", "#t=")).toEqual({ kind: "share", payload: "" });
    expect(selectStartup("?example=npc", "#t=%%%")).toEqual({ kind: "share", payload: "%%%" });
  });

  it("other fragments do not count as a share payload", () => {
    expect(selectStartup("?example=1", "#section")).toMatchObject({ kind: "example" });
  });

  it("empty and malformed selected payloads are rejected by decodeTrace", async () => {
    for (const hash of ["#t=", "#t=%%%", "#t=q.abcd"]) {
      const c = selectStartup("?example=1", hash);
      expect(c.kind).toBe("share");
      if (c.kind === "share") {
        await expect(decodeTrace(c.payload)).rejects.toBeInstanceOf(ShareLinkError);
      }
    }
  });

  it("a link made while viewing an example opens the shared run, not the example", async () => {
    const file = exampleNpcRaw as unknown as TraceFile;
    const url = buildShareUrl("https://x.test/?example=1", await encodeTrace(file));
    const u = new URL(url);
    const c = selectStartup(u.search, u.hash);
    expect(c.kind).toBe("share");
    if (c.kind === "share") expect(await decodeTrace(c.payload)).toEqual(file);
  });
});

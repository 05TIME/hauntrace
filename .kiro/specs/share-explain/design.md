# Design: share-explain

## Files

- `viewer/src/shareLink.ts`: async share-link API (req 1–7). `encodeTrace(file, {compress?})` → payload; `decodeTrace(payload)` → validated `TraceFile` (via `parseTraceFile`); `extractPayload(hash)`, `buildShareUrl(baseHref, payload)`; `ShareLinkError`; limits `MAX_PAYLOAD_CHARS` (200 000) and `MAX_DECODED_BYTES` (2 MiB). Async because `CompressionStream` is stream based; callers `await`.
- `packages/core/src/explain.ts`: pure, import-free `explainRun(trace, verify)` → `{ intro, steps[], closing }` and `explainText()` (req 8–11). Uses structural types (`ExplainTrace`, `ExplainVerify`) so both core and viewer `Trace` shapes fit. Exported from core `index.ts`.
- `packages/core/src/explain-cli.ts`: `explainJson(json)` (wrapped file or bare trace, validated with `importTrace`, verified with core `verifyChain`) and a `main` that runs only when executed directly (req 13). Not exported from `index.ts` because it touches `node:fs`.
- `viewer/src/explainRun.ts`: re-export of the core module for the viewer. `viewer/vitest.config.ts` aliases `explain.ts` like the other core files.
- `viewer/src/main.ts`, `viewer/index.html`, `viewer/src/style.css`: share button, `#t=` startup load, collapsible `<details id="explain-section">` panel.
- `package.json`: script `explain` = build, then `node dist/packages/core/src/explain-cli.js`.

## Payload format

```
#t=z.<base64url(deflate-raw(utf8(JSON.stringify(traceFile))))>
#t=p.<base64url(utf8(JSON.stringify(traceFile)))>     (no CompressionStream)
```

Decode order: check prefix → length cap → base64url charset/length check → decompress with a running byte cap (cancel the reader when exceeded) → strict UTF-8 → `parseTraceFile`. Every failure throws `ShareLinkError` with a user-facing message.

Encode order: `JSON.stringify` → UTF-8 → reject if over `MAX_DECODED_BYTES` (before any compression) → try `CompressionStream("deflate-raw")`; if it is missing, throws on construction, or the stream fails, use the plain `p.` payload → reject if the payload is over `MAX_PAYLOAD_CHARS`.

## Security and trust

- Decoding validates structure only. Hash verification stays in `loadTrace`, so a tampered link shows the broken badge and the explanation says BROKEN (req 4, 9).
- The decompressed size cap defends against decompression bombs; the payload cap bounds work before decoding.
- Rendering uses `textContent` for the explanation and meta bar; every trace value in `innerHTML` templates is passed through `escapeHtml`/`escapeJson` (`viewer/src/escapeHtml.ts`); no network calls anywhere.

## Startup flow

```
init(): selectStartup(search, hash)   (viewer/src/startupSelection.ts, pure)
        #t=… present (even empty/malformed) → decodeTrace → loadTrace(JSON) → reverifyAndRender → badge + haunted marks + explain panel
                                              (error → message in #drop-error; never a sample)
        else ?example=1|npc[&whatif=…]       → load bundled trace
        else                                 → nothing (drop zone)
button  "Copy share link" → encodeTrace(shareableFile(state.trace)) → buildShareUrl(location.href) → clipboard
```

## Composition with tamper and live what-if (merge integration)

`state.trace` is the single source of truth for what is displayed, verified, explained and shared. `viewer/src/runState.ts` holds two pure helpers used by `main.ts`: `shareableFile(trace)` (a copy wrapped as a schemaVersion 1 file) and `verifyAndExplain(trace)` (tamper's `analyzeTrace` plus `explainRun` on that same result).

- Tamper sets `state.trace` to a tampered copy of `state.original`; Exorcise sets it to a copy of `state.original`. Both call `reverifyAndRender`, which refreshes badge, haunted marks and the story, and drops results whose trace instance is no longer current.
- Sharing reads `state.trace` at click time, so it carries the tampered or restored run exactly. `state.original` is the file as loaded: an already-broken file is restored as loaded.
- Live edits (`state.live`) and scenarios are overlays derived from `state.trace`; they are not part of it and never reach `shareableFile` or `explainRun`.

## Explanation shape

```
Agent "demo" v1 ran 3 steps with seed 5.
Step 1 at 2026-10-31 00:00:00 UTC: rule "big" fired because n=12 is large. It chose the action {"label":"alert"}.
Step 3 at …: no rule matched, so the fallback decided because nothing matched. It chose the action {…}.
The hash chain verifies: all 3 steps are intact and linked to head hash 1a2b3c4d5e6f.
```

Actions are printed as key-sorted JSON truncated to 160 chars. Times use `new Date(timeMs)` (argument given, so deterministic).

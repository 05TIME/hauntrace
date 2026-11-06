# Tasks: share-explain

- [x] 1. Core explain module — `packages/core/src/explain.ts`, exported from `index.ts` (req 8–11)
- [x] 2. Explain CLI — `explain-cli.ts` and `npm run explain -- <trace.json>` with exit codes (req 13)
- [x] 3. Share link codec — `viewer/src/shareLink.ts` encode/decode, limits, `ShareLinkError` (req 1, 2, 5, 7)
- [x] 4. Viewer wiring — `#t=` startup load after `?example`, verification on load, "Copy share link" button (req 3, 4, 6)
- [x] 5. Explain panel — `viewer/src/explainRun.ts` re-export, collapsible panel in `index.html`/`main.ts`/`style.css` (req 11, 12)
- [x] 6. Tests — round trip (both bundled traces + 25 seeded random traces), malformed/oversized/bomb rejected, tampered link breaks the chain, explanation deterministic and complete, tampered explanation says BROKEN, CLI helper (req 1–13)
- [x] 7. Docs — README section for share links and `npm run explain`
- [x] 8. Encoder hardening — reject JSON over `MAX_DECODED_BYTES` before compressing; fall back to plain `p.` when `deflate-raw` is unsupported; clear error when a `z.` link cannot be decompressed (req 5, 5a)
- [x] 9. Robustness tests — oversize-before-compress, both fallback paths, decompressor-unavailable error, garbage-payload fuzz, explanation edge cases (key order, truncation, invalid times, unicode, singular wording) (req 5, 5a, 10)
- [x] 10. Docs — README privacy (whole trace is in the link), size limits, browser support; `KIRO_USAGE.md` entry
- [x] 11. Startup precedence fix — `viewer/src/startupSelection.ts` (`selectStartup`): a `#t=` payload always wins over `?example`/`?whatif`; empty/malformed payload shows an error, never a sample; `viewer/test/startupSelection.test.ts` (req 3)
- [x] 12. Security review: HTML injection — shared traces are untrusted. Every trace-controlled value interpolated into `innerHTML` in `viewer/src/main.ts` (badge, timeline, step detail incl. reason/JSON blocks/hashes, what-if cards) goes through the pure `escapeHtml`/`escapeJson` in `viewer/src/escapeHtml.ts`; `renderMeta` and the story use `textContent`; `formatTime` no longer throws on out-of-range `timeMs`; `viewer/test/escapeHtml.test.ts` (req 12, 15)

# Requirements: live-whatif-editor (Séance viewer, Feature A)

1. The Séance viewer SHALL let the user edit the observation of the currently selected step in a text field pre-filled with that step's observation as pretty-printed JSON.
2. WHEN the user clicks "Haunt this step", the viewer SHALL parse and validate the text, and IF valid SHALL re-run the loaded trace's agent in-browser over the observations with the edited step replaced, using the trace's own `seed`, `startMs` and `stepMs`.
3. IF the text is not valid JSON, is not a JSON object, contains a non-finite number, or does not match the shape of the original observation (a key present in the original is missing, or has a different primitive type; `null` is compatible with any type), THEN the viewer SHALL NOT re-run the agent and SHALL show a specific validation error next to the editor.
4. WHEN the edited observation is deep-equal to the original, the result SHALL contain zero diffs.
5. The result SHALL list every step at or after the edited step whose `ruleId` or `action` differs from the original; steps before the edited step SHALL never differ.
6. Changed steps SHALL be highlighted on the timeline, and each diff SHALL be rendered with the existing diff cards (`formatDiffCard`).
7. The re-run SHALL be deterministic: the same trace, step and edited observation SHALL always yield identical results. The logic SHALL use no clock, randomness, network or hashing beyond what `agentRunner` already does.
8. IF the trace's agent is not in the `agentRunner` registry, THEN the viewer SHALL show a message that live what-if is unavailable for that agent and SHALL NOT alter the timeline.
9. A "Reset" button SHALL discard the live edit, restore the editor text to the original observation, clear timeline highlights and clear the diff list.
10. Selecting a built-in scenario SHALL clear any live edit, and running a live edit SHALL set the scenario selector to "none", so only one what-if is active at a time.
11. The live what-if logic SHALL live in a pure module (`viewer/src/liveWhatIf.ts`) with no DOM access, covered by vitest tests: unedited input ⟹ zero diffs, determinism, invalid JSON rejected.
12. Displayed trace content SHALL be HTML-escaped; validation errors SHALL be announced via `role="alert"`.

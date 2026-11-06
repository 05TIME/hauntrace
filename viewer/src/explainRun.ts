/**
 * "Explain this run" for the viewer. The logic lives in core
 * (packages/core/src/explain.ts, dependency-free) so the CLI shares it.
 */
export {
  explainRun,
  explainText,
  type Explanation,
} from "../../packages/core/src/explain.js";

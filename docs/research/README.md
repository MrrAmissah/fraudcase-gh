# Research documents (advisory)

These files are **source research and design input**. They are **not** the operational source of truth for FraudCase GH production work.

The active source of truth is:

- [`docs/PRODUCTION_PLAN.md`](../PRODUCTION_PLAN.md) — architecture, threat model, roadmap
- [`docs/AGENT_PLAYBOOK.md`](../AGENT_PLAYBOOK.md) — how agents implement safely
- [`docs/PRODUCTION_DEFINITION_OF_DONE.md`](../PRODUCTION_DEFINITION_OF_DONE.md) — launch criteria
- The codebase, tests, security rules, and release checklist

When research and production docs disagree, follow the production plan and definition of done. Research may have been written with MVP/portfolio scope; production work deliberately raises the bar.

## Imported files

| File | Origin | Contribution |
|---|---|---|
| [`2026-06-21-ai-studio-multimodal-feedback.md`](./2026-06-21-ai-studio-multimodal-feedback.md) | Google AI Studio research session | Operational profile, Ghana fraud vectors, two-pass OCR/redaction pipeline, public vs private capability table, multimodal prompts/schema ideas, verification UI wireframe |
| [`2026-06-21-fraudcase-multimodal-evidence-research.md`](./2026-06-21-fraudcase-multimodal-evidence-research.md) | Internal multimodal design research | `VisualEvidenceExtraction` schema, deterministic grounding validation, Gemini vs Vision/Document AI tradeoffs, security risk matrix, phased commit plan, test matrix |
| [`2026-06-21-fraudcase-production-path.md`](./2026-06-21-fraudcase-production-path.md) | Production hardening research brief | Primary blockers (App Check, WAF, shared rate store, billing alerts), CI/security gates, agent orchestration, pre-push audit commands |

## How to use these documents

1. Read for context and options — not as a task list to copy verbatim.
2. Cross-check proposals against current code (`server.ts`, Firestore/Storage rules, redaction, upload validation).
3. Promote accepted decisions into `PRODUCTION_PLAN.md` and implement with tests.
4. Leave contradictions documented in the production plan rather than silently picking one research doc.

## Import date

Research imported and organized: **2026-06-21**.

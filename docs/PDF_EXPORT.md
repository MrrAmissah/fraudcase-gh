# Case Report PDF Export (Phase 5)

Adds a real **Download PDF** action to the private case report (`ReportPreview`), alongside the
existing native Print.

## Library / approach
- **jsPDF** (`jspdf@4.x`), client-side. Generates a **text-based, selectable** PDF programmatically
  — not an `html2canvas`/screenshot raster. Text stays selectable and searchable.
- Why jsPDF: smallest stable, well-supported option for this Vite/React stack; one dependency; no
  server, no headless Chromium. (`@react-pdf/renderer` was the alternative but is heavier and adds a
  parallel component model.)
- **Lazy-loaded**: both the generator (`src/lib/pdf/generateReportPdf.ts`) and jsPDF itself are
  loaded via dynamic `import()` only when the user clicks Download, so they stay out of the main
  bundle (jsPDF becomes its own chunk).
- Builder is split into `buildReportPdf()` (returns the doc, unit-testable in Node) and
  `generateReportPdf()` (builds + triggers the browser download).

## What is included
Logo/wordmark + "AI-ASSISTED CASE REPORT", report title, Case ID, generated date, case status,
risk signal (level + score), scam category, confidence, executive summary, **evidence inventory**,
extracted entities, possible fraud indicators, reconstructed timeline, completeness checklist,
recommended next steps, and the safety/disclaimer block. Page numbers and a subtle diagonal
"CONFIDENTIAL" watermark on every page.

## What is intentionally excluded
- Raw uploaded files (images/PDFs/screenshots) — **not embedded**.
- Raw `originalText` — the evidence inventory uses only `redactedText`/`extractedText`.
- Anything the redaction guard masks (see below).

## Privacy boundaries (core safeguard)
**Every free-text value written to the PDF is passed through `redactPIIAndSecrets` first.** So:
- phone numbers → partially masked (e.g. `0244***456`),
- emails → `[EMAIL-REDACTED]`,
- card/account/PIN/secret patterns → masked,
- the Ghana cedi sign `₵` (outside jsPDF's WinAnsi font) → normalized to `GHS`.

This holds even if the underlying analysis stored a raw value — verified: a raw `0244123456` placed
in the description *and* the extracted entities came out masked in the PDF. Wording stays
non-accusatory ("possible fraud indicators", "risk signal", "AI-assisted", "review before acting").

## Filename
`fraudcase-report-{caseId}-{YYYY-MM-DD}.pdf` — the case id is sanitized to
`[a-z0-9_-]`. Any case title shown inside the document is redaction-guarded, not used in the
filename.

## Error handling
PDF generation runs in a `try/catch`. On failure the report page shows a calm inline message
("Could not generate the PDF. You can still use Print…") and the page keeps working — **Print
remains available** as a fallback.

## Known limitations
- Layout is a single-column flow with automatic page breaks; section blocks can break across a page
  boundary (no "keep-together"). Acceptable for an evidence summary.
- Standard Helvetica (WinAnsi) font — non-Latin glyphs beyond the cedi normalization aren't embedded.
- Entity phone numbers are shown masked (privacy-first), which is slightly more redacted than the
  on-screen report.
- Not yet included (future): embedded redacted thumbnails, custom fonts, digital signing.

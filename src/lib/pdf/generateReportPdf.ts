import type { jsPDF } from "jspdf";
import { FraudCase } from "../../types/fraudCase";
import { getRiskLevel, getScamCategoryLabel } from "../utils/risk";
import { formatDate } from "../utils/dates";
import { redactPIIAndSecrets } from "../security/redaction";

/**
 * Client-side case-report PDF generator (jsPDF, text-based / selectable — not a raster
 * screenshot). jsPDF is lazy-imported so it stays out of the main bundle.
 *
 * Privacy: EVERY piece of free text written to the PDF is passed through the redaction
 * guard first, so passwords/PINs/cards/accounts/emails are masked and phone numbers are
 * partially masked. Raw uploaded files and raw `originalText` are never embedded — only
 * already-redacted text (redactedText/extractedText).
 */

const NAVY: [number, number, number] = [15, 23, 42];
const CYAN: [number, number, number] = [8, 145, 178];
const SLATE: [number, number, number] = [51, 65, 85];
const SLATE_LT: [number, number, number] = [120, 130, 145];
const AMBER_TX: [number, number, number] = [146, 64, 14];

// jsPDF standard fonts use WinAnsi (CP1252). Replace the Ghana cedi sign (not in CP1252).
function toLatin(text: string): string {
  return text.replace(/₵/g, "GHS ");
}

function safe(text?: string): string {
  if (!text) return "";
  return toLatin(redactPIIAndSecrets(text).redactedText);
}

function sanitizeFilenamePart(s: string): string {
  return (s || "")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48)
    .toLowerCase();
}

export function reportPdfFilename(fraudCase: FraudCase, when: Date = new Date()): string {
  const datePart = when.toISOString().slice(0, 10);
  const idPart = sanitizeFilenamePart(fraudCase.id) || "case";
  return `fraudcase-report-${idPart}-${datePart}.pdf`;
}

/** Builds the PDF document (no save) — separated so it is unit-testable in Node. */
export async function buildReportPdf(fraudCase: FraudCase): Promise<jsPDF> {
  const mod = await import("jspdf");
  const JsPDF = (mod as any).jsPDF || (mod as any).default;
  const doc: jsPDF = new JsPDF({ unit: "pt", format: "a4" });

  const PAGE_W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const MARGIN = 48;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const BOTTOM_LIMIT = PAGE_H - 56;

  const analysis = fraudCase.analysis;
  const generatedAt = new Date();
  let y = 0;
  let pageNum = 0;

  function drawPageChrome() {
    pageNum += 1;
    // top accent stripe
    doc.setFillColor(...CYAN);
    doc.rect(0, 0, PAGE_W, 4, "F");
    // subtle diagonal CONFIDENTIAL watermark (drawn first; content overlays it)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(70);
    doc.setTextColor(233, 236, 241);
    doc.text("CONFIDENTIAL", PAGE_W / 2, PAGE_H / 2, { align: "center", angle: 30 });
    // footer
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...SLATE_LT);
    doc.text("FraudCase GH · AI-assisted case report · Confidential", MARGIN, PAGE_H - 28);
    doc.text(`Page ${pageNum}`, PAGE_W - MARGIN, PAGE_H - 28, { align: "right" });
  }

  function newPage() {
    doc.addPage();
    drawPageChrome();
    y = MARGIN + 8;
  }

  function ensure(space: number) {
    if (y + space > BOTTOM_LIMIT) newPage();
  }

  function sectionHeading(text: string) {
    ensure(36);
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...NAVY);
    doc.text(text.toUpperCase(), MARGIN, y);
    y += 6;
    doc.setDrawColor(...CYAN);
    doc.setLineWidth(1.2);
    doc.line(MARGIN, y, MARGIN + CONTENT_W, y);
    y += 14;
  }

  function paragraph(text: string, size = 10, color: [number, number, number] = SLATE, gap = 5) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, CONTENT_W) as string[];
    for (const line of lines) {
      ensure(size + 4);
      doc.text(line, MARGIN, y);
      y += size + 4;
    }
    y += gap;
  }

  function keyValueRow(label: string, value: string) {
    const size = 10;
    const labelW = 132;
    doc.setFontSize(size);
    const valueLines = doc.splitTextToSize(value || "—", CONTENT_W - labelW) as string[];
    const blockH = Math.max(size + 4, valueLines.length * (size + 3));
    ensure(blockH + 2);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...SLATE_LT);
    doc.text(label, MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...SLATE);
    let vy = y;
    for (const line of valueLines) {
      doc.text(line, MARGIN + labelW, vy);
      vy += size + 3;
    }
    y += blockH + 2;
  }

  function bullet(text: string) {
    const size = 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, CONTENT_W - 16) as string[];
    ensure(lines.length * (size + 3) + 3);
    doc.setTextColor(...CYAN);
    doc.text("•", MARGIN, y);
    doc.setTextColor(...SLATE);
    let by = y;
    for (const line of lines) {
      doc.text(line, MARGIN + 16, by);
      by += size + 3;
    }
    y += lines.length * (size + 3) + 3;
  }

  function subLabel(text: string) {
    ensure(16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...SLATE_LT);
    doc.text(text, MARGIN, y);
    y += 13;
  }

  // ---- Page 1 header ----
  drawPageChrome();
  y = MARGIN + 12;

  // brand badge (navy rounded square + cyan check)
  doc.setFillColor(...NAVY);
  doc.roundedRect(MARGIN, y - 12, 26, 26, 5, 5, "F");
  doc.setDrawColor(...CYAN);
  doc.setLineWidth(2.4);
  doc.line(MARGIN + 7, y + 1, MARGIN + 11, y + 6);
  doc.line(MARGIN + 11, y + 6, MARGIN + 20, y - 5);

  // wordmark
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...NAVY);
  doc.text("FraudCase", MARGIN + 36, y + 2);
  const fcW = doc.getTextWidth("FraudCase");
  doc.setTextColor(...CYAN);
  doc.text(" GH", MARGIN + 36 + fcW, y + 2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...SLATE_LT);
  doc.text("AI-ASSISTED CASE REPORT", MARGIN + 36, y + 13);

  // right-aligned reference + generated date
  doc.setFontSize(8.5);
  doc.setTextColor(...SLATE_LT);
  doc.text(`Case ID: ${toLatin(fraudCase.id).toUpperCase()}`, PAGE_W - MARGIN, y - 5, { align: "right" });
  doc.text(`Generated: ${formatDate(generatedAt.toISOString())}`, PAGE_W - MARGIN, y + 8, { align: "right" });

  y += 28;
  doc.setDrawColor(225, 228, 233);
  doc.setLineWidth(1);
  doc.line(MARGIN, y, MARGIN + CONTENT_W, y);
  y += 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...NAVY);
  doc.text("Fraud Case Evidence Report", MARGIN, y);
  y += 6;

  // ---- Overview ----
  sectionHeading("Case Information & Overview");
  keyValueRow("Case title", safe(fraudCase.title));
  keyValueRow("Case status", fraudCase.status ? fraudCase.status.charAt(0).toUpperCase() + fraudCase.status.slice(1) : "—");
  keyValueRow("Registered", formatDate(fraudCase.createdAt));
  keyValueRow("Incident date", fraudCase.incidentDate ? formatDate(fraudCase.incidentDate) : "Not specified");
  if (analysis) {
    const risk = getRiskLevel(analysis.riskScore);
    keyValueRow("Possible scam category", getScamCategoryLabel(analysis.scamCategory));
    keyValueRow("Risk signal", `${risk.label} (${analysis.riskScore}/100)`);
    keyValueRow("Model confidence", `${analysis.confidence} (AI-assisted)`);
  }
  if (fraudCase.description) {
    y += 2;
    subLabel("Background details");
    paragraph(safe(fraudCase.description));
  }

  // ---- Executive summary ----
  if (analysis?.shortSummary) {
    sectionHeading("Executive Summary");
    paragraph(safe(analysis.shortSummary));
  }

  // ---- Evidence inventory ----
  sectionHeading("Evidence Inventory");
  const items = fraudCase.evidenceItems || [];
  if (items.length === 0) {
    paragraph("No evidence items were attached to this case.", 10, SLATE_LT);
  } else {
    items.forEach((it, i) => {
      const fileNote = it.fileName ? `  · file: ${safe(it.fileName)}` : "";
      const headLine = `${i + 1}. ${safe(it.title)}  [${it.type}]${fileNote}`;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...NAVY);
      const hLines = doc.splitTextToSize(headLine, CONTENT_W) as string[];
      ensure(hLines.length * 13 + 4);
      for (const l of hLines) {
        doc.text(l, MARGIN, y);
        y += 13;
      }
      // Redacted excerpt only (never raw originalText)
      const excerptSrc = safe(it.redactedText || it.extractedText || "");
      if (excerptSrc) {
        const excerpt = excerptSrc.length > 300 ? `${excerptSrc.slice(0, 300)}…` : excerptSrc;
        paragraph(excerpt, 9, SLATE_LT, 6);
      } else {
        y += 4;
      }
    });
  }

  // ---- Extracted entities ----
  if (analysis?.extractedEntities) {
    const e = analysis.extractedEntities;
    sectionHeading("Extracted Case Evidence Details");
    const rows: [string, string[] | undefined][] = [
      ["Claimed aliases", e.names],
      ["Impersonated orgs", e.organizations],
      ["Phone numbers", e.phoneNumbers],
      ["External links", e.urls],
      ["Monetary elements", e.amounts],
      ["Transaction refs", e.transactionReferences],
      ["Locations", e.locations],
      ["Dates", e.dates],
    ];
    let any = false;
    for (const [label, arr] of rows) {
      if (arr && arr.length > 0) {
        any = true;
        keyValueRow(label, arr.map((v) => safe(String(v))).join(", "));
      }
    }
    if (!any) paragraph("No specific entities were parsed.", 10, SLATE_LT);
  }

  // ---- Timeline ----
  if (analysis?.timeline && analysis.timeline.length > 0) {
    sectionHeading("Case Event Timeline");
    for (const ev of analysis.timeline) {
      const date = ev.date ? formatDate(ev.date) : "Situational";
      const src = ev.source ? ` · Source: ${safe(ev.source)}` : "";
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...SLATE_LT);
      ensure(12);
      doc.text(`${date}${src}`, MARGIN, y);
      y += 11;
      paragraph(safe(ev.event), 9.5, SLATE, 6);
    }
  }

  // ---- Completeness checklist ----
  if (analysis?.evidenceChecklist && analysis.evidenceChecklist.length > 0) {
    sectionHeading("Completeness Checklist");
    for (const c of analysis.evidenceChecklist) {
      const status = c.status.charAt(0).toUpperCase() + c.status.slice(1);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...NAVY);
      const line = `${safe(c.item)} — ${status}`;
      const lines = doc.splitTextToSize(line, CONTENT_W) as string[];
      ensure(lines.length * 12 + 2);
      for (const l of lines) {
        doc.text(l, MARGIN, y);
        y += 12;
      }
      if (c.note) paragraph(safe(c.note), 8.5, SLATE_LT, 5);
    }
  }

  // ---- Recommended next steps ----
  if (analysis?.recommendedNextSteps && analysis.recommendedNextSteps.length > 0) {
    sectionHeading("Recommended Actions & Protective Steps");
    for (const s of analysis.recommendedNextSteps) bullet(safe(s));
  }

  // ---- Disclaimer (amber block) ----
  sectionHeading("Safety & Privacy Notice");
  const disc =
    safe(analysis?.disclaimer) ||
    "This report is AI-assisted and may be incomplete. It does not determine guilt, provide legal advice, or replace an official investigation. Review before acting.";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const discLines = doc.splitTextToSize(disc, CONTENT_W - 24) as string[];
  const boxH = discLines.length * 12 + 18;
  ensure(boxH + 4);
  doc.setFillColor(254, 243, 199);
  doc.setDrawColor(252, 211, 77);
  doc.setLineWidth(1);
  doc.roundedRect(MARGIN, y, CONTENT_W, boxH, 5, 5, "FD");
  doc.setTextColor(...AMBER_TX);
  let dy = y + 14;
  for (const l of discLines) {
    doc.text(l, MARGIN + 12, dy);
    dy += 12;
  }
  y += boxH + 6;

  return doc;
}

/** Builds and triggers a browser download of the case-report PDF. */
export async function generateReportPdf(fraudCase: FraudCase): Promise<void> {
  const doc = await buildReportPdf(fraudCase);
  doc.save(reportPdfFilename(fraudCase));
}

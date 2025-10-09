// src/lib/pdf/invoice.ts
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'node:fs/promises';
import path from 'node:path';

export type InvoiceRow = {
  id: string;
  org_id: string;
  bill_month: string; // ISO
  plan_code: string;
  plan_percent: number;
  gross_revenue_cents: number | null;
  expenses_cents: number | null;
  pm_fee_cents: number | null;
  amount_due_cents: number | null;
  status: 'due' | 'paid' | 'void';
  invoice_number?: string | null;
};

export type BrandOptions = {
  companyName: string;              // e.g., "TruHost"
  logoPath?: string;                // e.g., "public/logo.png" (optional)
  primary?: string;                 // hex, e.g., "#0ea5e9"
  accent?: string;                  // hex, e.g., "#111827"
  contactLines?: string[];          // lines in the footer
  billToName?: string;              // client's org name (optional)
};

function hexToRgb(hex?: string) {
  const h = (hex ?? '#0ea5e9').replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}
const money = (c?: number | null) => `$${(((c ?? 0) as number) / 100).toFixed(2)} CAD`;

async function loadLogoBytes(logoPath?: string): Promise<Uint8Array | undefined> {
  if (!logoPath) return undefined;
  try {
    // allow absolute, public/, or relative to project root
    const p = logoPath.startsWith('public')
      ? path.join(process.cwd(), logoPath)
      : path.isAbsolute(logoPath)
      ? logoPath
      : path.join(process.cwd(), 'public', logoPath);
    const buf = await fs.readFile(p);
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  } catch {
    // silently ignore if not found
    return undefined;
  }
}

export async function buildBrandedInvoicePDF(
  row: InvoiceRow,
  brand: BrandOptions
): Promise<ArrayBuffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const { height } = page.getSize();
  const margin = 50;

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const primary = hexToRgb(brand.primary ?? '#0ea5e9');
  const accent = hexToRgb(brand.accent ?? '#111827');
  const lightGray = rgb(0.92, 0.94, 0.96);
  const dark = rgb(0.15, 0.17, 0.2);

  // Header band
  const headerH = 90;
  page.drawRectangle({ x: 0, y: height - headerH, width: page.getWidth(), height: headerH, color: primary });

  // Logo (optional)
  const logoBytes = await loadLogoBytes(brand.logoPath);
  if (logoBytes) {
    try {
      // try png then jpg
      let img;
      try { img = await pdf.embedPng(logoBytes); } catch { img = await pdf.embedJpg(logoBytes); }
      const scale = 0.25;
      const imgDims = img.scale(scale);
      page.drawImage(img, {
        x: margin,
        y: height - headerH / 2 - imgDims.height / 2,
        width: imgDims.width,
        height: imgDims.height,
      });
    } catch { /* ignore logo errors */ }
  }

  // Company name in header
  page.drawText(brand.companyName, {
    x: margin + 200,
    y: height - 55,
    size: 22,
    font: bold,
    color: rgb(1, 1, 1),
  });

  // Title
  let y = height - headerH - 20;
  page.drawText('INVOICE', { x: margin, y, size: 16, font: bold, color: accent });
  y -= 8;

  // Meta two-column layout
  const monthLabel = new Date(row.bill_month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const metaLeft = [
    ['Bill To', brand.billToName ?? 'Member'],
    ['Plan', `${String(row.plan_code).toUpperCase()} (${row.plan_percent}%)`],
    ['Status', String(row.status).toUpperCase()],
  ];
  const metaRight = [
    ['Invoice #', row.invoice_number ?? row.id],
    ['Bill Month', monthLabel],
    ['Issued', new Date().toLocaleDateString()],
  ];

  const drawMeta = (pairs: string[][], startX: number) => {
    let my = y;
    pairs.forEach(([k, v]) => {
      page.drawText(k.toUpperCase(), { x: startX, y: my, size: 9, font: bold, color: dark });
      page.drawText(String(v), { x: startX, y: my - 14, size: 11, font, color: dark });
      my -= 32;
    });
    return my;
  };
  const rightX = page.getWidth() / 2 + 10;
  const leftBottom = drawMeta(metaLeft, margin);
  const rightBottom = drawMeta(metaRight, rightX);
  y = Math.min(leftBottom, rightBottom) - 10;

  // Line items table
  const rows: Array<[string, string]> = [
    ['Gross Revenue', money(row.gross_revenue_cents)],
    ['Expenses', money(row.expenses_cents)],
    [`PM Fee (${row.plan_percent}%)`, money(row.pm_fee_cents)],
  ];

  // Table header
  const tableX = margin;
  const tableW = page.getWidth() - margin * 2;
  const descW = Math.floor(tableW * 0.65);
  const amtW = tableW - descW;

  page.drawRectangle({ x: tableX, y: y - 24, width: tableW, height: 24, color: lightGray });
  page.drawText('Description', { x: tableX + 10, y: y - 16, size: 10, font: bold, color: dark });
  page.drawText('Amount', { x: tableX + descW + 10, y: y - 16, size: 10, font: bold, color: dark });
  y -= 24;

  // Table rows
  rows.forEach(([d, a], idx) => {
    const rowH = 22;
    const rowY = y - rowH;
    if (idx % 2 === 1) {
      page.drawRectangle({ x: tableX, y: rowY, width: tableW, height: rowH, color: rgb(0.98, 0.985, 0.99) });
    }
    page.drawText(d, { x: tableX + 10, y: rowY + 6, size: 11, font, color: dark });
    page.drawText(a, { x: tableX + descW + 10, y: rowY + 6, size: 11, font, color: dark });
    y -= rowH;
  });

  // Total box
  y -= 14;
  const totalBoxH = 40;
  page.drawRectangle({ x: tableX + descW, y: y - totalBoxH, width: amtW, height: totalBoxH, color: rgb(1, 1, 1), borderColor: accent, borderWidth: 1 });
  page.drawText('Amount Due', { x: tableX + descW + 10, y: y - 12, size: 10, font: bold, color: accent });
  page.drawText(money(row.amount_due_cents), { x: tableX + descW + 10, y: y - 26, size: 14, font: bold, color: accent });
  y -= totalBoxH + 16;

  // Footer
  const footer = brand.contactLines?.length
    ? brand.contactLines.join('  •  ')
    : `${brand.companyName} — thank you for your business.`;
  page.drawText(footer, { x: margin, y: 30, size: 9, font, color: rgb(0.4, 0.45, 0.5) });

  const bytes = await pdf.save(); // Uint8Array
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

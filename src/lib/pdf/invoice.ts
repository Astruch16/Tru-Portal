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
  const { height, width } = page.getSize();
  const margin = 50;

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Sage green theme colors
  const sageGreen = hexToRgb(brand.primary ?? '#9db896');
  const lightSage = hexToRgb(brand.accent ?? '#E1ECDB');
  const warmWhite = rgb(0.97, 0.96, 0.95); // #F8F6F2
  const darkGray = rgb(0.17, 0.17, 0.17); // #2c2c2c
  const mediumGray = rgb(0.35, 0.35, 0.35);

  // Elegant header with gradient effect (simulated with layers)
  const headerH = 100;
  // Base layer - darker sage
  page.drawRectangle({
    x: 0,
    y: height - headerH,
    width: width,
    height: headerH,
    color: sageGreen
  });
  // Subtle accent band at top
  page.drawRectangle({
    x: 0,
    y: height - 8,
    width: width,
    height: 8,
    color: hexToRgb('#6b9b7a') // darker sage accent
  });

  // Logo (optional) - centered and smaller
  const logoBytes = await loadLogoBytes(brand.logoPath);
  if (logoBytes) {
    try {
      // try png then jpg
      let img;
      try { img = await pdf.embedPng(logoBytes); } catch { img = await pdf.embedJpg(logoBytes); }
      const scale = 0.15; // Smaller logo
      const imgDims = img.scale(scale);
      // Center the logo horizontally
      const logoX = (width - imgDims.width) / 2;
      page.drawImage(img, {
        x: logoX,
        y: height - headerH / 2 - imgDims.height / 2,
        width: imgDims.width,
        height: imgDims.height,
      });
    } catch { /* ignore logo errors */ }
  }

  // Decorative line below header
  page.drawRectangle({
    x: 0,
    y: height - headerH - 2,
    width: width,
    height: 2,
    color: lightSage
  });

  // Title with elegant spacing
  let y = height - headerH - 30;
  page.drawText('INVOICE', {
    x: margin,
    y,
    size: 24,
    font: bold,
    color: sageGreen,
    opacity: 0.9
  });
  y -= 15;

  // Meta two-column layout
  // Parse bill_month as YYYY-MM-DD and extract year/month to avoid timezone issues
  const [year, month] = row.bill_month.split('-').map(Number);
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const statusDisplay = row.status === 'paid' ? 'PAID' : row.status === 'void' ? 'VOID' : 'DUE';
  const statusColor = row.status === 'paid' ? rgb(0.13, 0.54, 0.13) : row.status === 'void' ? rgb(0.6, 0.6, 0.6) : rgb(0.8, 0.27, 0.13);

  const metaLeft = [
    ['Bill To', brand.billToName ?? 'Member'],
    ['Plan', `${String(row.plan_code).toUpperCase()} Plan (${row.plan_percent}% Management Fee)`],
    ['Status', statusDisplay],
  ];
  const metaRight = [
    ['Invoice #', row.invoice_number ?? row.id.slice(0, 13) + '...'],
    ['Bill Month', monthLabel],
    ['Issued', new Date().toLocaleDateString()],
  ];

  const drawMeta = (pairs: string[][], startX: number) => {
    let my = y;
    pairs.forEach(([k, v], idx) => {
      page.drawText(k.toUpperCase(), {
        x: startX,
        y: my,
        size: 9,
        font: bold,
        color: mediumGray
      });
      // Use special color for status
      const valueColor = (k === 'Status') ? statusColor : darkGray;
      const valueFont = (k === 'Status') ? bold : font;
      page.drawText(String(v), {
        x: startX,
        y: my - 16,
        size: 12,
        font: valueFont,
        color: valueColor
      });
      my -= 38;
    });
    return my;
  };
  const rightX = page.getWidth() / 2 + 10;
  const leftBottom = drawMeta(metaLeft, margin);
  const rightBottom = drawMeta(metaRight, rightX);
  y = Math.min(leftBottom, rightBottom) - 10;

  // Line items table - more detailed breakdown
  const rows: Array<[string, string, boolean?]> = [
    ['Gross Revenue', money(row.gross_revenue_cents)],
    ['Management Fee (' + row.plan_code.toUpperCase() + ' Plan - ' + row.plan_percent + '%)', money(row.pm_fee_cents)],
    ['Expenses', money(row.expenses_cents)],
    ['', '', true], // separator
    ['TOTAL AMOUNT DUE', money(row.amount_due_cents), true],
  ];

  // Table header - elegant sage green
  const tableX = margin;
  const tableW = width - margin * 2;
  const descW = Math.floor(tableW * 0.65);
  const amtW = tableW - descW;

  y -= 10;
  page.drawRectangle({
    x: tableX,
    y: y - 28,
    width: tableW,
    height: 28,
    color: lightSage
  });
  page.drawText('DESCRIPTION', {
    x: tableX + 12,
    y: y - 18,
    size: 10,
    font: bold,
    color: darkGray
  });
  page.drawText('AMOUNT', {
    x: tableX + descW + 12,
    y: y - 18,
    size: 10,
    font: bold,
    color: darkGray
  });
  y -= 28;

  // Table rows - alternating subtle colors
  rows.forEach(([d, a, isTotalRow], idx) => {
    const rowH = isTotalRow ? 32 : 26;
    const rowY = y - rowH;

    if (isTotalRow && d) {
      // Total row - sage green background
      page.drawRectangle({
        x: tableX,
        y: rowY,
        width: tableW,
        height: rowH,
        color: sageGreen,
        opacity: 0.15
      });
      page.drawRectangle({
        x: tableX,
        y: rowY,
        width: tableW,
        height: rowH,
        borderColor: sageGreen,
        borderWidth: 2
      });
      page.drawText(d, {
        x: tableX + 12,
        y: rowY + 10,
        size: 13,
        font: bold,
        color: sageGreen
      });
      page.drawText(a, {
        x: tableX + descW + 12,
        y: rowY + 10,
        size: 15,
        font: bold,
        color: sageGreen
      });
    } else if (!d) {
      // Separator row
      page.drawRectangle({
        x: tableX,
        y: rowY + rowH / 2,
        width: tableW,
        height: 1,
        color: lightSage
      });
    } else {
      // Regular row
      if (idx % 2 === 0) {
        page.drawRectangle({
          x: tableX,
          y: rowY,
          width: tableW,
          height: rowH,
          color: warmWhite
        });
      }
      page.drawText(d, {
        x: tableX + 12,
        y: rowY + 8,
        size: 11,
        font,
        color: darkGray
      });
      page.drawText(a, {
        x: tableX + descW + 12,
        y: rowY + 8,
        size: 11,
        font,
        color: darkGray
      });
    }
    y -= rowH;
  });

  // Remove old total box (now integrated in table)
  y -= 10;

  // Elegant footer with decorative line
  page.drawRectangle({
    x: margin,
    y: 60,
    width: width - margin * 2,
    height: 1,
    color: lightSage
  });

  const footer = brand.contactLines?.length
    ? brand.contactLines.join('  •  ')
    : `${brand.companyName} — Thank you for your business.`;
  page.drawText(footer, {
    x: margin,
    y: 40,
    size: 9,
    font,
    color: mediumGray
  });

  // Powered by text
  page.drawText('Powered by TruHost Property Management Ltd.', {
    x: margin,
    y: 25,
    size: 8,
    font,
    color: rgb(0.6, 0.6, 0.6)
  });

  const bytes = await pdf.save(); // Uint8Array
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

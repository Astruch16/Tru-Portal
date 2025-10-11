import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format cents to CAD currency with proper separators and styling
 * Example: 123456 cents → $1,234.56
 */
export function formatMoney(cents: number | null | undefined, options?: { showCurrency?: boolean; compact?: boolean }): string {
  const { showCurrency = true, compact = false } = options || {};
  const amount = (cents ?? 0) / 100;

  if (compact && Math.abs(amount) >= 1000) {
    const k = amount / 1000;
    return showCurrency ? `$${k.toFixed(1)}k` : `${k.toFixed(1)}k`;
  }

  const formatted = new Intl.NumberFormat('en-CA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return showCurrency ? `$${formatted}` : formatted;
}

/**
 * Format a number with thousand separators
 * Example: 12345 → 12,345
 */
export function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat('en-CA').format(value ?? 0);
}

/**
 * Format a percentage with one decimal place
 * Example: 0.8547 → 85.5%
 */
export function formatPercent(value: number | null | undefined, decimals: number = 1): string {
  const percent = ((value ?? 0) * 100).toFixed(decimals);
  return `${percent}%`;
}

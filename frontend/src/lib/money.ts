export const DEFAULT_CURRENCY = 'INR';
export const DEFAULT_LOCALE = 'en-IN';

const currencyFormatter = new Intl.NumberFormat(DEFAULT_LOCALE, {
  style: 'currency',
  currency: DEFAULT_CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format decimal string or number as currency string (e.g., "19.99" -> "₹19.99")
 */
export function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return currencyFormatter.format(0);
  }
  const numeric = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(numeric)) {
    return currencyFormatter.format(0);
  }
  return currencyFormatter.format(numeric);
}

/**
 * Safe display summation for values already returned by API.
 * Avoids binary floating point artifacts like 0.1 + 0.2 = 0.30000000000000004
 * by working in integer minor units (paise/cents).
 */
export function sumMoneyStrings(values: (string | null | undefined)[]): string {
  let totalPaise = 0;
  for (const v of values) {
    if (!v) continue;
    const clean = v.trim();
    if (!clean) continue;
    const parts = clean.split('.');
    const whole = parseInt(parts[0] || '0', 10);
    const frac = parts[1] ? parts[1].padEnd(2, '0').slice(0, 2) : '00';
    const paise = whole * 100 + parseInt(frac, 10);
    totalPaise += paise;
  }
  return (totalPaise / 100).toFixed(2);
}

/**
 * Validates whether a string is a valid non-negative decimal money value with up to 2 decimal places.
 */
export function isValidMoneyString(val: string): boolean {
  return /^\d+(\.\d{1,2})?$/.test(val.trim());
}

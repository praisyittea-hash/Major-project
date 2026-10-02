function integer(name, fallback, min, max) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new Error(`Invalid ${name}`);
  return value;
}
export function paymentConfig() {
  return {
    currency: 'INR',
    platformFeeBps: integer('PLATFORM_FEE_BPS', 0, 0, 10000),
    gstBps: integer('GST_BPS', 0, 0, 10000),
    holdMinutes: integer('BOOKING_HOLD_MINUTES', 20, 5, 120),
    packageCounts: [3, 6, 12],
    packageExpiryDays: integer('PACKAGE_EXPIRY_DAYS', 90, 1, 730),
    invoiceBusinessName: process.env.INVOICE_BUSINESS_NAME || 'Unfazed',
    invoiceAddress: process.env.INVOICE_ADDRESS || '',
    invoiceGstin: process.env.INVOICE_GSTIN || '',
  };
}
export function moneyBreakdown(amount) {
  if (!Number.isSafeInteger(amount) || amount < 1)
    throw new Error('Amount must be positive integer paise');
  const config = paymentConfig();
  const platformFee = Math.round((amount * config.platformFeeBps) / 10000),
    tax = Math.round((amount * config.gstBps) / (10000 + config.gstBps));
  return {
    amount,
    platform_fee: platformFee,
    net_amount: amount - platformFee,
    tax,
    subtotal: amount - tax,
    currency: config.currency,
  };
}

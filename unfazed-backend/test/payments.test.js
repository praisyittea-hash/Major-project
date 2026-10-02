import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { razorpayConfig } from '../src/config/razorpay.js';
import { matchesSignature } from '../src/services/paymentGateway.js';
import { moneyBreakdown } from '../src/config/payments.js';
test('Razorpay configuration rejects live or missing credentials', () => {
  assert.throws(() => razorpayConfig({}));
  assert.throws(() =>
    razorpayConfig({ RAZORPAY_KEY_ID: 'rzp_live_not_allowed', RAZORPAY_KEY_SECRET: 'fixture' }),
  );
  assert.equal(
    razorpayConfig({ RAZORPAY_KEY_ID: 'rzp_test_fixture', RAZORPAY_KEY_SECRET: 'fixture' }).key_id,
    'rzp_test_fixture',
  );
});
test('HMAC verification uses exact raw bytes and constant-time comparison', () => {
  const body = Buffer.from('{"event":"test"}'),
    secret = 'fixture-secret',
    signature = createHmac('sha256', secret).update(body).digest('hex');
  assert.ok(matchesSignature(body, signature, secret));
  assert.ok(!matchesSignature(Buffer.from('{ "event":"test"}'), signature, secret));
  assert.ok(!matchesSignature(body, 'invalid', secret));
});
test('money values are paise; fees and tax are configuration driven', () => {
  process.env.PLATFORM_FEE_BPS = '250';
  process.env.GST_BPS = '1800';
  const result = moneyBreakdown(118000);
  assert.equal(result.platform_fee, 2950);
  assert.equal(result.tax, 18000);
  assert.equal(result.net_amount, 115050);
  delete process.env.PLATFORM_FEE_BPS;
  delete process.env.GST_BPS;
});
import mongoose from 'mongoose';
import Payment from '../src/models/Payment.js';
test('Payment persists transaction ownership and monetary breakdown', () => {
  const payment = new Payment({
    therapist: new mongoose.Types.ObjectId(),
    client: new mongoose.Types.ObjectId(),
    purchaseKey: 'session-fixture',
    ...moneyBreakdown(150000),
  });
  assert.equal(payment.validateSync(), undefined);
  assert.equal(payment.status, 'created');
  assert.ok(new Payment({ amount: 1.5 }).validateSync());
});
import { generateInvoice } from '../src/services/invoiceService.js';
import { writeFile, mkdir } from 'node:fs/promises';
test('GST-style invoice PDF generates only for a captured payment snapshot', async () => {
  assert.throws(() => generateInvoice({}));
  const payment = {
    invoiceNumber: 'UF-2030-FIXTURE',
    capturedAt: new Date(),
    invoiceSnapshot: {
      supplier: 'Unfazed',
      address: '42 Sample Road, Bengaluru, Karnataka',
      gstin: '',
      therapist: 'Dr Meera Sharma',
      client: 'Ananya Rao',
      clientEmail: 'ananya@example.test',
      description: '6-session care package',
      amount: 840000,
      subtotal: 840000,
      tax: 0,
      currency: 'INR',
      transaction: 'pay_fixture_invoice',
      issuedAt: '2030-01-01T00:00:00Z',
    },
  };
  const pdf = await generateInvoice(payment);
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
  assert.ok(pdf.length > 1000);
  await mkdir('../.artifacts', { recursive: true });
  await writeFile('../.artifacts/invoice-fixture.pdf', pdf);
});

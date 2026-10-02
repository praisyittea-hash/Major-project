import PDFDocument from 'pdfkit';
import Client from '../models/Client.js';
import Therapist from '../models/Therapist.js';
import { paymentConfig } from '../config/payments.js';
import { HttpError } from '../middleware/errorHandler.js';
export async function invoiceSnapshot(payment, transaction) {
  const [client, therapist] = await Promise.all([
    Client.findById(payment.client).session(transaction),
    Therapist.findById(payment.therapist).session(transaction),
  ]);
  const config = paymentConfig();
  return {
    supplier: config.invoiceBusinessName,
    address: config.invoiceAddress,
    gstin: config.invoiceGstin,
    therapist: therapist.name,
    client: client.name,
    clientEmail: client.email,
    description: payment.packageSnapshot
      ? `${payment.packageSnapshot.name} (${payment.packageSnapshot.sessionCount} sessions)`
      : 'Individual therapy session',
    amount: payment.amount,
    subtotal: payment.subtotal,
    tax: payment.tax,
    currency: payment.currency,
    transaction: payment.gateway_transaction_id,
    issuedAt: payment.capturedAt,
  };
}
const inr = (value) => `INR ${(value / 100).toFixed(2)}`;
export function generateInvoice(payment) {
  if (!payment.invoiceSnapshot || !payment.invoiceNumber || !payment.capturedAt)
    throw new HttpError(409, 'Invoice is available after webhook confirmation');
  const data = payment.invoiceSnapshot;
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
        size: 'A4',
        margin: 48,
        info: { Title: `Invoice ${payment.invoiceNumber}`, Author: data.supplier },
      }),
      chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.rect(0, 0, 595, 14).fill('#245e50');
    doc
      .fillColor('#183a36')
      .font('Helvetica-Bold')
      .fontSize(26)
      .text(data.supplier, 48, 48, { width: 300 });
    doc.fontSize(12).text('PAYMENT INVOICE', 360, 54, { width: 187, align: 'right' });
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#536a61')
      .text(`Practice: ${data.therapist}`, 48, 92, { width: 300 });
    if (data.address) doc.text(data.address, 48, 112, { width: 300, height: 55 });
    doc.text(data.gstin ? `GSTIN: ${data.gstin}` : 'GSTIN: not configured', 48, 174);
    doc
      .fillColor('#183a36')
      .font('Helvetica-Bold')
      .fontSize(11)
      .text('Invoice number', 48, 210)
      .text('Issued on', 360, 210);
    doc
      .font('Helvetica')
      .fontSize(10)
      .text(payment.invoiceNumber, 48, 229, { width: 290 })
      .text(new Date(data.issuedAt).toISOString().slice(0, 10), 360, 229);
    doc.font('Helvetica-Bold').fontSize(11).text('Billed to', 48, 274);
    doc
      .font('Helvetica')
      .fontSize(11)
      .text(data.client, 48, 294, { width: 450, height: 30 })
      .fontSize(10)
      .text(data.clientEmail, 48, 330, { width: 450 });
    doc.rect(48, 376, 499, 32).fill('#e7efe9');
    doc
      .fillColor('#183a36')
      .font('Helvetica-Bold')
      .fontSize(10)
      .text('Description', 60, 388)
      .text('Amount', 425, 388, { width: 110, align: 'right' });
    doc
      .font('Helvetica')
      .text(data.description, 60, 424, { width: 340, height: 60 })
      .text(inr(data.subtotal), 425, 424, { width: 110, align: 'right' });
    doc.moveTo(48, 492).lineTo(547, 492).strokeColor('#dce6df').stroke();
    doc
      .text('Subtotal', 340, 510)
      .text(inr(data.subtotal), 425, 510, { width: 110, align: 'right' });
    doc
      .text('GST (inclusive)', 340, 535)
      .text(inr(data.tax), 425, 535, { width: 110, align: 'right' });
    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .text('Total paid', 340, 571)
      .text(inr(data.amount), 420, 571, { width: 115, align: 'right' });
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#536a61')
      .text(`Gateway transaction: ${data.transaction}`, 48, 642, { width: 490 });
    doc.text('Payment received through Razorpay test mode.', 48, 666, { width: 490 });
    doc.text(
      'This GST-style payment receipt uses the tax and supplier details configured by the practice.',
      48,
      692,
      { width: 490 },
    );
    doc.text('UNFAZED | Care, connected.', 48, 758, { width: 499, align: 'center' });
    doc.end();
  });
}

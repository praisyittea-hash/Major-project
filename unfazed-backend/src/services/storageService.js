import Payment from '../models/Payment.js';
// Private invoice storage interface. The current adapter persists PDFs in MongoDB
// in the capture transaction; a future private S3 adapter can implement this API.
export const invoiceStorage = {
  put: async (payment, bytes) => {
    payment.invoicePdf = bytes;
  },
  get: async (paymentId) => (await Payment.findById(paymentId).select('+invoicePdf'))?.invoicePdf,
};

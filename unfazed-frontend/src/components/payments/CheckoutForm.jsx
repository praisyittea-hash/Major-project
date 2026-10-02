import { useEffect, useRef, useState } from 'react';
import api, { messageOf } from '../../api/axiosInstance.js';
import { loadRazorpay } from '../../utils/razorpayCheckout.js';
import InvoiceView from './InvoiceView.jsx';
export default function CheckoutForm({
  sessionId,
  token,
  client = api,
  onPaid,
  orderPath,
  orderBody = {},
  description = 'Therapy session',
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [payment, setPayment] = useState(null),
    [waiting, setWaiting] = useState(false);
  const timer = useRef(null);
  const options = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  useEffect(() => () => clearInterval(timer.current), []);
  function poll(id) {
    clearInterval(timer.current);
    setWaiting(true);
    timer.current = setInterval(async () => {
      try {
        const { data } = await client.get(`/payments/${id}`, options);
        setPayment(data.payment);
        if (data.payment.status === 'captured') {
          clearInterval(timer.current);
          setWaiting(false);
          setBusy(false);
          onPaid?.(data.payment);
        } else if (
          ['failed', 'order_error', 'refund_required', 'refunded'].includes(data.payment.status)
        ) {
          clearInterval(timer.current);
          setWaiting(false);
          setBusy(false);
          setError(
            data.payment.status === 'refund_required'
              ? 'Payment received after this reservation expired. Contact the practice for a refund.'
              : 'Payment was not completed. You can retry while the reservation remains active.',
          );
        }
      } catch (e) {
        setError(messageOf(e));
      }
    }, 3000);
  }
  async function checkout() {
    setBusy(true);
    setError('');
    try {
      const { data } = await client.post(
        orderPath || `/payments/session/${sessionId}/orders`,
        orderBody,
        options,
      );
      setPayment(data.payment);
      await loadRazorpay();
      const checkout = new window.Razorpay({
        key: data.key,
        order_id: data.payment.gateway_order_id,
        amount: data.payment.amount,
        currency: data.payment.currency,
        name: 'Unfazed',
        description: `${description} · test mode`,
        handler: async (result) => {
          try {
            await client.post(`/payments/${data.payment._id}/verify`, result, options);
            poll(data.payment._id);
          } catch (e) {
            setError(messageOf(e));
            setBusy(false);
          }
        },
        modal: {
          ondismiss: () => {
            setBusy(false);
            setError('Checkout closed. Your reservation remains active until its expiry.');
          },
        },
      });
      checkout.on('payment.failed', (event) => {
        setError(event.error?.description || 'Payment failed. Please try again.');
        setBusy(false);
      });
      checkout.open();
    } catch (e) {
      setError(messageOf(e));
      setBusy(false);
    }
  }
  return (
    <section className="card">
      <h2>Complete your booking</h2>
      <p>
        Pay in advance through Razorpay test mode. Your session is confirmed after the payment
        gateway webhook reaches the practice.
      </p>
      {payment && (
        <p>
          INR {(payment.amount / 100).toFixed(2)} · {payment.status}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {waiting && (
        <p role="status">
          Waiting for secure payment confirmation… You can check the payment status again later.
        </p>
      )}
      {payment?.status === 'captured' ? (
        <div className="success">
          <p>Payment confirmed.</p>
          <InvoiceView payment={payment} client={client} token={token} />
        </div>
      ) : (
        <button disabled={busy} onClick={checkout}>
          {busy ? 'Processing…' : 'Pay with Razorpay'}
        </button>
      )}
    </section>
  );
}

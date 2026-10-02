import { useParams } from 'react-router-dom';
import CheckoutForm from '../../components/payments/CheckoutForm.jsx';
import clientApi from '../../api/clientApi.js';
export default function Payment() {
  const { id } = useParams();
  return (
    <main>
      <p className="eyebrow">SECURE CHECKOUT</p>
      <h1>Your session payment</h1>
      <CheckoutForm sessionId={id} client={clientApi} />
    </main>
  );
}

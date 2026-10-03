import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
const Login = lazy(() => import('../pages/auth/Login.jsx'));
const Register = lazy(() => import('../pages/auth/Register.jsx'));
const Dashboard = lazy(() => import('../pages/therapist/Dashboard.jsx'));
const Profile = lazy(() => import('../pages/therapist/Profile.jsx'));
const PublicProfile = lazy(() => import('../pages/client/PublicProfile.jsx'));
const Schedule = lazy(() => import('../pages/therapist/Schedule.jsx'));
const BookingPage = lazy(() => import('../pages/client/BookingPage.jsx'));
const Clients = lazy(() => import('../pages/therapist/Clients.jsx'));
const ClientProfile = lazy(() => import('../pages/therapist/ClientProfile.jsx'));
const ClientPortal = lazy(() => import('../pages/client/ClientPortal.jsx'));
const Payment = lazy(() => import('../pages/client/Payment.jsx'));
const Subscription = lazy(() => import('../pages/therapist/Subscription.jsx'));
const Billing = lazy(() => import('../pages/therapist/Billing.jsx'));
function Protected({ children }) {
  const { therapist, loading } = useAuth();
  if (loading) return <main aria-busy="true">Loading your practice…</main>;
  return therapist ? children : <Navigate to="/login" replace />;
}
export default function AppRoutes() {
  return (
    <Suspense fallback={<main aria-busy="true">Loading your space…</main>}>
      <Routes>
        <Route
          path="/"
          element={
            <main>
              <p className="eyebrow">CARE, CONNECTED</p>
              <h1>
                Your practice.
                <br />A little calmer.
              </h1>
              <p>A connected space for your clients, appointments and care.</p>
              <a className="button" href="/register">
                Start your practice
              </a>
            </main>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/dashboard"
          element={
            <Protected>
              <Dashboard />
            </Protected>
          }
        />
        <Route
          path="/profile"
          element={
            <Protected>
              <Profile />
            </Protected>
          }
        />
        <Route path="/:slug/book" element={<BookingPage />} />
        <Route path="/:slug" element={<PublicProfile />} />
        <Route
          path="/schedule"
          element={
            <Protected>
              <Schedule />
            </Protected>
          }
        />
        <Route
          path="/clients"
          element={
            <Protected>
              <Clients />
            </Protected>
          }
        />
        <Route
          path="/clients/:id"
          element={
            <Protected>
              <ClientProfile />
            </Protected>
          }
        />
        <Route path="/portal" element={<ClientPortal />} />
        <Route path="/payment/:id" element={<Payment />} />
        <Route
          path="/billing"
          element={
            <Protected>
              <Billing />
            </Protected>
          }
        />
        <Route
          path="/subscription"
          element={
            <Protected>
              <Subscription />
            </Protected>
          }
        />
        <Route path="*" element={<main>Page not found.</main>} />
      </Routes>
    </Suspense>
  );
}
export { Protected };

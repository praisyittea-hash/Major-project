import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
export default function Navbar() {
  const { therapist, signOut } = useAuth();
  return (
    <nav>
      <Link className="brand" to="/">
        UNFAZED<span className="muted"> · practice</span>
      </Link>
      {therapist ? (
        <>
          <Link to="/dashboard">Overview</Link>
          <Link to="/clients">Clients</Link>
          <Link to="/schedule">Schedule</Link>
          <Link to="/billing">Billing</Link>
          <Link to="/profile">Profile</Link>
          <button className="secondary" onClick={signOut}>
            Sign out
          </button>
        </>
      ) : (
        <>
          <Link to="/login">Sign in</Link>
          <Link className="button" to="/register">
            Get started
          </Link>
        </>
      )}
    </nav>
  );
}

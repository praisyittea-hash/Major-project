import {Routes,Route,Navigate} from 'react-router-dom';
import {useAuth} from '../context/AuthContext.jsx';
import Login from '../pages/auth/Login.jsx';
import Register from '../pages/auth/Register.jsx';
import Dashboard from '../pages/therapist/Dashboard.jsx';
import Profile from '../pages/therapist/Profile.jsx';
import PublicProfile from '../pages/client/PublicProfile.jsx';
import Schedule from '../pages/therapist/Schedule.jsx';
import BookingPage from '../pages/client/BookingPage.jsx';
import Clients from '../pages/therapist/Clients.jsx';
import ClientProfile from '../pages/therapist/ClientProfile.jsx';
function Protected({children}){const {therapist,loading}=useAuth();if(loading)return <main aria-busy="true">Loading your practice…</main>;return therapist?children:<Navigate to="/login" replace/>;}
export default function AppRoutes(){return <Routes><Route path="/" element={<main><p className="eyebrow">CARE, CONNECTED</p><h1>Your practice.<br/>A little calmer.</h1><p>A connected space for your clients, appointments and care.</p><a className="button" href="/register">Start your practice</a></main>}/><Route path="/login" element={<Login/>}/><Route path="/register" element={<Register/>}/><Route path="/dashboard" element={<Protected><Dashboard/></Protected>}/><Route path="/profile" element={<Protected><Profile/></Protected>}/><Route path="/:slug/book" element={<BookingPage/>}/><Route path="/:slug" element={<PublicProfile/>}/><Route path="/schedule" element={<Protected><Schedule/></Protected>}/><Route path="/clients" element={<Protected><Clients/></Protected>}/><Route path="/clients/:id" element={<Protected><ClientProfile/></Protected>}/><Route path="*" element={<main>Page not found.</main>}/></Routes>;}
export {Protected};

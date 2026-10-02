import {Link} from 'react-router-dom';
import {useAuth} from '../../context/AuthContext.jsx';
export default function Dashboard(){const {therapist}=useAuth();return <main><p className="eyebrow">YOUR PRACTICE AT A GLANCE</p><h1>Hello, {therapist.name}.</h1><div className="card"><h2>Make yourself at home.</h2><p>Set up your profile so clients can find and connect with you.</p><Link className="button" to="/profile">Edit your profile</Link></div></main>;}

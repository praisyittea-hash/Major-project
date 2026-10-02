import {BrowserRouter} from 'react-router-dom';
import {AuthProvider} from './context/AuthContext.jsx';
import Navbar from './components/common/Navbar.jsx';
import AppRoutes from './routes/AppRoutes.jsx';
export default function App(){return <BrowserRouter><AuthProvider><Navbar/><AppRoutes/></AuthProvider></BrowserRouter>;}

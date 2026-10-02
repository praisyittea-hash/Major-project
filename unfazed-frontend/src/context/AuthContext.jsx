import {createContext,useContext,useEffect,useState} from 'react';
import api from '../api/axiosInstance.js';
const AuthContext=createContext(null);
export function AuthProvider({children}){
 const [therapist,setTherapist]=useState(null),[loading,setLoading]=useState(true);
 useEffect(()=>{if(!sessionStorage.getItem('unfazed-token')){setLoading(false);return;}api.get('/auth/me').then(({data})=>setTherapist(data.therapist)).catch(()=>sessionStorage.removeItem('unfazed-token')).finally(()=>setLoading(false));},[]);
 function signIn(data){sessionStorage.setItem('unfazed-token',data.token);setTherapist(data.therapist);}
 function signOut(){sessionStorage.removeItem('unfazed-token');setTherapist(null);}
 return <AuthContext.Provider value={{therapist,setTherapist,loading,signIn,signOut}}>{children}</AuthContext.Provider>;
}
export const useAuth=()=>useContext(AuthContext);

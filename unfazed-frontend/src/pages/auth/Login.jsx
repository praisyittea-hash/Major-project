import {useState} from 'react';
import {useForm} from 'react-hook-form';
import {Link,useNavigate} from 'react-router-dom';
import api,{messageOf} from '../../api/axiosInstance.js';
import {useAuth} from '../../context/AuthContext.jsx';
export default function Login({registering=false}){
 const {register,handleSubmit,formState:{isSubmitting}}=useForm();
 const [error,setError]=useState('');const {signIn}=useAuth();const navigate=useNavigate();
 async function submit(values){setError('');try{const {data}=await api.post(`/auth/${registering?'register':'login'}`,values);signIn(data);navigate('/dashboard');}catch(e){setError(messageOf(e));}}
 return <main className="narrow"><p className="eyebrow">A SPACE FOR YOUR PRACTICE</p><h1>{registering?'Start with Unfazed.':'Welcome back.'}</h1><div className="card"><form onSubmit={handleSubmit(submit)}>{registering&&<label>Your name<input {...register('name',{required:true})} minLength={2} maxLength={100} required autoComplete="name"/></label>}<label>Email<input type="email" {...register('email',{required:true})} required autoComplete="email"/></label><label>Password<input type="password" {...register('password',{required:true})} required minLength={registering?10:1} maxLength={72} autoComplete={registering?'new-password':'current-password'}/></label>{error&&<p role="alert" className="error">{error}</p>}<button disabled={isSubmitting}>{isSubmitting?'Please wait…':registering?'Create account':'Sign in'}</button></form><p><Link to={registering?'/login':'/register'}>{registering?'Already have an account? Sign in':'Create your practice account'}</Link></p></div></main>;
}

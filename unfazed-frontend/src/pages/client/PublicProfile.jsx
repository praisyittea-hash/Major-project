import {useEffect,useState} from 'react';
import {useParams} from 'react-router-dom';
import api,{messageOf} from '../../api/axiosInstance.js';
import Hero from '../../components/profile/Hero.jsx';
import About from '../../components/profile/About.jsx';
import ServiceCard from '../../components/profile/ServiceCard.jsx';
import useProfileMetadata from '../../hooks/useProfileMetadata.js';
export default function PublicProfile(){const {slug}=useParams();const [therapist,setTherapist]=useState(null),[error,setError]=useState('');useProfileMetadata(therapist);useEffect(()=>{setTherapist(null);setError('');let active=true;api.get(`/public/${slug}`).then(({data})=>{if(active)setTherapist(data.therapist);}).catch(e=>{if(active)setError(messageOf(e));});return ()=>{active=false;};},[slug]);if(error)return <main><p className="error" role="alert">{error}</p></main>;if(!therapist)return <main aria-busy="true">Loading practice…</main>;return <main><Hero therapist={therapist}/><About therapist={therapist}/><h2>Find the right space for you</h2><div className="grid">{therapist.services.length?therapist.services.map(service=><ServiceCard key={service._id} service={service} slug={slug}/>):<p>No services published yet.</p>}</div><p className="muted">Powered by Unfazed · Care, connected.</p></main>;}

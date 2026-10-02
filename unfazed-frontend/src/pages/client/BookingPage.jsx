import {useEffect,useState} from 'react';
import {useParams,useSearchParams} from 'react-router-dom';
import {addDays,format} from 'date-fns';
import api,{messageOf} from '../../api/axiosInstance.js';
import Calendar from '../../components/scheduling/Calendar.jsx';
import SlotPicker from '../../components/scheduling/SlotPicker.jsx';
export default function BookingPage(){
 const {slug}=useParams(),[search]=useSearchParams();
 const [profile,setProfile]=useState(null),[serviceId,setServiceId]=useState(search.get('service')||''),[slots,setSlots]=useState([]),[selected,setSelected]=useState(null),[date,setDate]=useState(new Date()),[from,setFrom]=useState(format(new Date(),'yyyy-MM-dd')),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone;
 const service=profile?.services.find(s=>s._id===serviceId);
 useEffect(()=>{api.get(`/public/${slug}`).then(({data})=>{setProfile(data.therapist);setServiceId(id=>id||data.therapist.services[0]?._id||'');}).catch(e=>{setError(messageOf(e));setLoading(false);});},[slug]);
 useEffect(()=>{if(!service)return;let active=true;setLoading(true);setSelected(null);api.get(`/public/${slug}/slots`,{params:{from,to:format(addDays(new Date(`${from}T12:00:00`),14),'yyyy-MM-dd'),duration:service.duration}}).then(({data})=>{if(active){setSlots(data.slots);setError('');}}).catch(e=>{if(active)setError(messageOf(e));}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[slug,from,service]);
 function navigate(value){setDate(value);setFrom(format(value,'yyyy-MM-dd'));}
 return <main><p className="eyebrow">YOUR NEXT STEP</p><h1>Book a session{profile?` with ${profile.name}`:''}</h1>{error&&<p className="error" role="alert">{error}</p>}<div className="grid"><label>Service<select value={serviceId} onChange={e=>setServiceId(e.target.value)}>{profile?.services.map(s=><option value={s._id} key={s._id}>{s.name} · {s.duration} minutes</option>)}</select></label><label>Starting date<input type="date" value={from} onChange={e=>{setFrom(e.target.value);setDate(new Date(`${e.target.value}T12:00:00`));}}/></label></div><p className="muted">Your local timezone: {timezone}. Showing 14 days from the selected date.</p>{loading?<p aria-busy="true">Finding available times…</p>:<><Calendar events={slots.map(slot=>({...slot,start:new Date(slot.start),end:new Date(slot.end),title:'Available'}))} onSelect={event=>setSelected({start:event.start.toISOString(),end:event.end.toISOString(),duration:service.duration})} date={date} onNavigate={navigate}/><SlotPicker slots={slots} selected={selected} onSelect={setSelected} timezone={timezone}/></>}{selected&&<div className="card"><h2>Your selected time</h2><p>{new Date(selected.start).toLocaleString()} · {service?.duration} minutes</p><p>Booking confirmation will appear here.</p></div>}</main>;
}

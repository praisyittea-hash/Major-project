import {useEffect,useState} from 'react';
import {addDays,format} from 'date-fns';
import clientApi from '../../api/clientApi.js';
import api,{messageOf} from '../../api/axiosInstance.js';
import SlotPicker from './SlotPicker.jsx';
import CheckoutForm from '../payments/CheckoutForm.jsx';
export default function PortalBooking({services,slug,clientPackage,onBooked}){
 const [serviceId,setServiceId]=useState(clientPackage?.serviceId||services[0]?._id||''),[date,setDate]=useState(format(new Date(),'yyyy-MM-dd')),[slots,setSlots]=useState([]),[selected,setSelected]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[session,setSession]=useState(null);
 const service=services.find(s=>s._id===serviceId),timezone=Intl.DateTimeFormat().resolvedOptions().timeZone;
 useEffect(()=>{if(!service||!date)return;let active=true;setSelected(null);api.get(`/public/${slug}/slots`,{params:{from:date,to:format(addDays(new Date(`${date}T12:00:00`),7),'yyyy-MM-dd'),duration:service.duration}}).then(({data})=>{if(active)setSlots(data.slots);}).catch(e=>{if(active)setError(messageOf(e));});return()=>{active=false;};},[service,slug,date]);
 async function book(){setBusy(true);setError('');try{const {data}=await clientApi.post('/portal/book',{serviceId,start:selected.start,...(clientPackage?{clientPackage:clientPackage._id}:{})});setSession(data.session);setSelected(null);setSlots([]);onBooked?.();}catch(e){setError(messageOf(e));}finally{setBusy(false);}}
 return <section className="card"><h3>{clientPackage?`Use ${clientPackage.name}`:'Book your next session'}</h3><div className="grid"><label>Service<select value={serviceId} disabled={!!clientPackage} onChange={e=>setServiceId(e.target.value)}>{services.map(s=><option key={s._id} value={s._id}>{s.name}</option>)}</select></label><label>From date<input type="date" value={date} onChange={e=>setDate(e.target.value)} required/></label></div>{error&&<p className="error">{error}</p>}{!session&&<SlotPicker slots={slots} selected={selected} onSelect={setSelected} timezone={timezone}/>} {selected&&<button disabled={busy} onClick={book}>{busy?'Booking…':clientPackage?'Book using package credit':'Reserve session'}</button>}{session&&<p className="success">{session.status==='confirmed'?'Session confirmed':'Time reserved'} · {new Date(session.start).toLocaleString()}</p>}{session?.status==='pending_payment'&&<CheckoutForm sessionId={session._id} client={clientApi} onPaid={()=>{setSession(s=>({...s,status:'confirmed'}));onBooked?.();}}/>}</section>;
}

import {useEffect,useState} from 'react';
import clientApi,{acceptPortalLink} from '../../api/clientApi.js';
import {messageOf} from '../../api/axiosInstance.js';
import IntakeForm from '../../components/crm/IntakeForm.jsx';
import ClientPackages from '../../components/payments/ClientPackages.jsx';
export default function ClientPortal(){
 const [history,setHistory]=useState(null);
 useEffect(()=>{acceptPortalLink();clientApi.get('/portal/history').then(({data})=>setHistory(data)).catch(e=>setError(messageOf(e)));},[]);
 const [template,setTemplate]=useState(null);
 const [client,setClient]=useState(null),[error,setError]=useState(''),[saved,setSaved]=useState('');
 useEffect(()=>{acceptPortalLink();clientApi.get('/portal/me').then(({data})=>{setClient(data.client);setTemplate(data.template);}).catch(e=>setError(messageOf(e)));},[]);
 async function submit(values){setError('');try{const {data}=await clientApi.post('/portal/intake',values);setClient(data.client);setSaved('Your intake has been securely saved.');}catch(e){setError(messageOf(e));}}
 if(!client)return <main><h1>Your client space</h1>{error?<p className="error" role="alert">{error}. Ask your therapist for a current portal link.</p>:<p>Opening your portal…</p>}<section className="card"><h2>Your sessions</h2>{history?.sessions.length?history.sessions.map(s=><p key={s._id}>{new Date(s.start).toLocaleString()} · {s.status} {s.paymentStatus==='pending'&&<a className="button" href={`/payment/${s._id}`}>Pay for session</a>}</p>):<p>No sessions yet.</p>}</section><section className="card"><h2>Shared reflections</h2>{history?.notes.length?history.notes.map(n=><p key={n._id} style={{whiteSpace:'pre-wrap'}}>{n.sharedContent}</p>):<p>No shared notes yet.</p>}</section></main>;
 return <main><p className="eyebrow">A SPACE FOR YOUR CARE</p><h1>Hello, {client.name}.</h1>{error&&<p className="error" role="alert">{error}</p>}{saved&&<p className="success" role="status">{saved}</p>}<ClientPackages/><IntakeForm onSubmit={submit} intake={client.intake} template={template}/><section className="card"><h2>Your sessions</h2>{history?.sessions.length?history.sessions.map(s=><p key={s._id}>{new Date(s.start).toLocaleString()} · {s.status} {s.paymentStatus==='pending'&&<a className="button" href={`/payment/${s._id}`}>Pay for session</a>}</p>):<p>No sessions yet.</p>}</section><section className="card"><h2>Shared reflections</h2>{history?.notes.length?history.notes.map(n=><p key={n._id} style={{whiteSpace:'pre-wrap'}}>{n.sharedContent}</p>):<p>No shared notes yet.</p>}</section></main>;
}

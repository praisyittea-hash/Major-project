import {useEffect,useState} from 'react';
import clientApi,{acceptPortalLink} from '../../api/clientApi.js';
import {messageOf} from '../../api/axiosInstance.js';
import IntakeForm from '../../components/crm/IntakeForm.jsx';
export default function ClientPortal(){
 const [template,setTemplate]=useState(null);
 const [client,setClient]=useState(null),[error,setError]=useState(''),[saved,setSaved]=useState('');
 useEffect(()=>{acceptPortalLink();clientApi.get('/portal/me').then(({data})=>{setClient(data.client);setTemplate(data.template);}).catch(e=>setError(messageOf(e)));},[]);
 async function submit(values){setError('');try{const {data}=await clientApi.post('/portal/intake',values);setClient(data.client);setSaved('Your intake has been securely saved.');}catch(e){setError(messageOf(e));}}
 if(!client)return <main><h1>Your client space</h1>{error?<p className="error" role="alert">{error}. Ask your therapist for a current portal link.</p>:<p>Opening your portal…</p>}</main>;
 return <main><p className="eyebrow">A SPACE FOR YOUR CARE</p><h1>Hello, {client.name}.</h1>{error&&<p className="error" role="alert">{error}</p>}{saved&&<p className="success" role="status">{saved}</p>}<IntakeForm onSubmit={submit} intake={client.intake} template={template}/></main>;
}

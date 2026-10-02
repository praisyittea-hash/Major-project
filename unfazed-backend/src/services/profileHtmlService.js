import {readFile} from 'node:fs/promises';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function profileHtml(therapist){
 let html;try{html=await readFile(new URL('../../../unfazed-frontend/dist/index.html',import.meta.url),'utf8');}catch{html=await readFile(new URL('../../../unfazed-frontend/index.html',import.meta.url),'utf8');}
 const title=`${therapist.name} | Unfazed`,description=therapist.bio.slice(0,200)||`Book a session with ${therapist.name}`;
 const url=`${process.env.PUBLIC_BASE_URL||'http://localhost:5173'}/${therapist.slug}`;
 html=html.replace(/<title>.*?<\/title>/,`<title>${escape(title)}</title>`).replace(/<meta name="description"[^>]*\/>/, '');
 return html.replace('</head>',`<meta name="description" content="${escape(description)}"/><meta property="og:title" content="${escape(title)}"/><meta property="og:description" content="${escape(description)}"/><meta property="og:type" content="profile"/><meta property="og:url" content="${escape(url)}"/><meta property="og:site_name" content="Unfazed"/><meta name="twitter:card" content="summary"/></head>`);
}

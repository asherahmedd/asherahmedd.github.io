// Cloudflare Worker + D1 for privacy-conscious portfolio analytics.
const origin='https://asherahmedd.github.io';
const cors={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization','Vary':'Origin'};
const events=new Set(['page_view','scroll_depth','section_view','section_time','project_open','blog_open','filter_click','outbound_click','session_active']);
const reply=(obj,status=200,headers={})=>new Response(JSON.stringify(obj),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...headers}});
const safe=(v,n=160)=>typeof v==='string'?v.replace(/[<>]/g,'').slice(0,n):'';
function check(v){
 if(!v||!events.has(v.event))return null;
 let visitor=safe(v.visitor,64),session=safe(v.session,64),path=safe(v.path,180);
 if(!/^[0-9a-f-]{20,64}$/i.test(visitor)||!/^[0-9a-f-]{20,64}$/i.test(session)||!path.startsWith('/')||path.startsWith('//')||path.includes('\\'))return null;
 let depth=Number(v.depth),ms=Number(v.active_ms);
 return {event:v.event,visitor,session,path,section:safe(v.section,80),item:safe(v.item,150),referrer:safe(v.referrer,100),device:['mobile','tablet','desktop'].includes(v.device)?v.device:'other',depth:v.event==='scroll_depth'&&[25,50,75,90].includes(depth)?depth:0,active_ms:['section_time','session_active'].includes(v.event)&&Number.isFinite(ms)?Math.max(0,Math.min(60000,Math.round(ms))):0};
}
function secretOkay(req,secret){
 const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
 if(!secret||token.length!==secret.length||token.length<20)return false;
 let diff=0;for(let i=0;i<token.length;i++)diff|=token.charCodeAt(i)^secret.charCodeAt(i);return diff===0;
}
async function report(db,days){
 const since=new Date(Date.now()-days*86400000).toISOString();
 const sql={
 summary:"SELECT COUNT(DISTINCT CASE WHEN event='page_view' THEN visitor END) visitors,COUNT(DISTINCT CASE WHEN event='page_view' THEN session END) sessions,SUM(CASE WHEN event='page_view' THEN 1 ELSE 0 END) pageviews,SUM(CASE WHEN event='project_open' THEN 1 ELSE 0 END) project_opens,SUM(CASE WHEN event='blog_open' THEN 1 ELSE 0 END) blog_opens,COALESCE(SUM(active_ms),0) active_ms FROM events WHERE ts>=?",
 daily:"SELECT substr(ts,1,10) day,COUNT(*) pageviews,COUNT(DISTINCT visitor) visitors FROM events WHERE ts>=? AND event='page_view' GROUP BY day ORDER BY day",
 pages:"SELECT path,COUNT(*) views,COUNT(DISTINCT visitor) visitors FROM events WHERE ts>=? AND event='page_view' GROUP BY path ORDER BY views DESC LIMIT 12",
 sections:"SELECT section,SUM(active_ms) active_ms,COUNT(DISTINCT session) sessions FROM events WHERE ts>=? AND event='section_time' AND section<>'' GROUP BY section ORDER BY active_ms DESC LIMIT 15",
 projects:"SELECT item,COUNT(*) opens FROM events WHERE ts>=? AND event='project_open' AND item<>'' GROUP BY item ORDER BY opens DESC LIMIT 15",
 countries:"SELECT country,COUNT(*) views FROM events WHERE ts>=? AND event='page_view' GROUP BY country ORDER BY views DESC LIMIT 12",
 devices:"SELECT device,COUNT(*) views FROM events WHERE ts>=? AND event='page_view' GROUP BY device ORDER BY views DESC",
 referrers:"SELECT referrer,COUNT(*) views FROM events WHERE ts>=? AND event='page_view' AND referrer<>'' GROUP BY referrer ORDER BY views DESC LIMIT 10",
 filters:"SELECT item,COUNT(*) clicks FROM events WHERE ts>=? AND event='filter_click' GROUP BY item ORDER BY clicks DESC LIMIT 10",
 scroll:"SELECT depth,COUNT(DISTINCT session) sessions FROM events WHERE ts>=? AND event='scroll_depth' AND depth>0 GROUP BY depth ORDER BY depth"};
 const keys=Object.keys(sql),rs=await Promise.all(keys.map(k=>db.prepare(sql[k]).bind(since).all()));
 return Object.fromEntries(keys.map((k,i)=>[k,k==='summary'?(rs[i].results[0]||{}):rs[i].results]));
}
export default {
 async fetch(req,env){
  const path=new URL(req.url).pathname;
  if(path==='/health')return reply({status:'ok',service:'portfolio-insights'});
  if(path==='/track'||path==='/stats'){
   if(req.headers.get('Origin')!==origin)return reply({error:'origin_not_allowed'},403);
   if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
   if(path==='/track'){
    if(req.method!=='POST')return reply({error:'method_not_allowed'},405,cors);
    if(Number(req.headers.get('Content-Length')||0)>2048)return reply({error:'payload_too_large'},413,cors);
    let body;try{body=await req.json()}catch{return reply({error:'invalid_json'},400,cors)}
    const e=check(body);if(!e)return reply({error:'invalid_event'},400,cors);
    const country=safe(req.cf?.country||'Unknown',2)||'Unknown';
    await env.DB.prepare('INSERT INTO events (ts,event,visitor,session,path,section,item,depth,active_ms,country,referrer,device) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(new Date().toISOString(),e.event,e.visitor,e.session,e.path,e.section,e.item,e.depth,e.active_ms,country,e.referrer,e.device).run();
    return new Response(null,{status:204,headers:cors});
   }
   if(req.method!=='GET')return reply({error:'method_not_allowed'},405,cors);
   if(!secretOkay(req,env.ADMIN_TOKEN))return reply({error:'unauthorized'},401,cors);
   const q=Number(new URL(req.url).searchParams.get('days')||30);const days=[7,30,90].includes(q)?q:30;
   try{return reply({days,generated_at:new Date().toISOString(),...await report(env.DB,days)},200,cors)}
   catch{return reply({error:'storage_unavailable'},503,cors)}
  }
  return reply({error:'not_found'},404);
 },
 async scheduled(event,env){const cutoff=new Date(Date.now()-90*86400000).toISOString();await env.DB.prepare('DELETE FROM events WHERE ts<?').bind(cutoff).run()}
};
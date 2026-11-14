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
/* Only consented browser identifiers reach this route. Store a one-way digest
   rather than the browser's raw identifier. This remains pseudonymous data. */
async function identityHash(id,secret){
 const bytes=new TextEncoder().encode(String(secret)+':'+id);
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
async function recordIdentity(db,id,secret){
 const hash=await identityHash(id,secret);
 const now=new Date().toISOString();
 const prior=await db.prepare('SELECT first_seen FROM identity_visitors WHERE visitor_hash=?').bind(hash).first();
 await db.prepare('INSERT INTO identity_visitors(visitor_hash,first_seen,last_seen,visits) VALUES(?,?,?,1) ON CONFLICT(visitor_hash) DO UPDATE SET last_seen=excluded.last_seen,visits=visits+1').bind(hash,now,now).run();
 await db.prepare('INSERT INTO identity_visits(ts,visitor_hash,is_returning) VALUES(?,?,?)').bind(now,hash,prior?1:0).run();
}
async function report(db,hours){
 const since=new Date(Date.now()-hours*3600000).toISOString();
 const bucket=hours===1?"strftime('%Y-%m-%d %H:',ts) || printf('%02d', CAST(CAST(strftime('%M',ts) AS INTEGER)/5 AS INTEGER)*5)":hours<=72?"substr(ts,1,13)":"substr(ts,1,10)";
 const sql={
 summary:"SELECT COUNT(DISTINCT CASE WHEN event='page_view' THEN visitor END) visitors,COUNT(DISTINCT CASE WHEN event='page_view' THEN session END) sessions,SUM(CASE WHEN event='page_view' THEN 1 ELSE 0 END) pageviews,SUM(CASE WHEN event='project_open' THEN 1 ELSE 0 END) project_opens,SUM(CASE WHEN event='blog_open' THEN 1 ELSE 0 END) blog_opens,COALESCE(SUM(CASE WHEN event='session_active' THEN active_ms ELSE 0 END),0) active_ms FROM events WHERE ts>=?",
 daily:`SELECT ${bucket} day,COUNT(*) pageviews,COUNT(DISTINCT visitor) visitors FROM events WHERE ts>=? AND event='page_view' GROUP BY day ORDER BY day`,
 pages:"SELECT path,COUNT(*) views,COUNT(DISTINCT visitor) visitors FROM events WHERE ts>=? AND event='page_view' GROUP BY path ORDER BY views DESC LIMIT 12",
 sections:"SELECT section,SUM(active_ms) active_ms,COUNT(DISTINCT session) sessions FROM events WHERE ts>=? AND event='section_time' AND section<>'' GROUP BY section ORDER BY active_ms DESC LIMIT 15",
 projects:"SELECT item,COUNT(*) opens FROM events WHERE ts>=? AND event='project_open' AND item<>'' GROUP BY item ORDER BY opens DESC LIMIT 15",
 countries:"SELECT country,COUNT(*) views FROM events WHERE ts>=? AND event='page_view' GROUP BY country ORDER BY views DESC LIMIT 12",
 devices:"SELECT device,COUNT(*) views FROM events WHERE ts>=? AND event='page_view' GROUP BY device ORDER BY views DESC",
 referrers:"SELECT referrer,COUNT(*) views FROM events WHERE ts>=? AND event='page_view' AND referrer<>'' GROUP BY referrer ORDER BY views DESC LIMIT 10",
 filters:"SELECT item,COUNT(*) clicks FROM events WHERE ts>=? AND event='filter_click' GROUP BY item ORDER BY clicks DESC LIMIT 10",
 scroll:"SELECT depth,COUNT(DISTINCT session) sessions FROM events WHERE ts>=? AND event='scroll_depth' AND depth>0 GROUP BY depth ORDER BY depth"};
 const keys=Object.keys(sql),rs=await Promise.all(keys.map(k=>db.prepare(sql[k]).bind(since).all()));
 let repeat={consented_visits:0,new_browsers:0,returning_visits:0,distinct_consented_browsers:0};
 try{repeat=await db.prepare('SELECT COUNT(*) AS consented_visits, COALESCE(SUM(CASE WHEN is_returning=0 THEN 1 ELSE 0 END),0) AS new_browsers, COALESCE(SUM(CASE WHEN is_returning=1 THEN 1 ELSE 0 END),0) AS returning_visits, COUNT(DISTINCT visitor_hash) AS distinct_consented_browsers FROM identity_visits WHERE ts>=?').bind(since).first()||repeat}catch{/* Migration not yet applied: baseline reports remain available. */}
 return {...Object.fromEntries(keys.map((k,i)=>[k,k==='summary'?(rs[i].results[0]||{}):rs[i].results])),repeat:repeat||{} };
}
export default {
 async fetch(req,env){
  const path=new URL(req.url).pathname;
  if(path==='/health')return reply({status:'ok',service:'portfolio-insights',features:{repeat_visits:true}},200,cors);
  if(path==='/track'||path==='/stats'||path==='/identity'){
   if(req.headers.get('Origin')!==origin)return reply({error:'origin_not_allowed'},403);
   if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
   if(path==='/identity'){
    if(req.method!=='POST')return reply({error:'method_not_allowed'},405,cors);
    if(Number(req.headers.get('Content-Length')||0)>512)return reply({error:'payload_too_large'},413,cors);
    let data;try{data=await req.json()}catch{return reply({error:'invalid_json'},400,cors)}
    if(data?.consent!==true||typeof data?.persistent_id!=='string'||!/^[0-9a-f-]{36}$/i.test(data.persistent_id))return reply({error:'invalid_consented_id'},400,cors);
    try{await recordIdentity(env.DB,data.persistent_id,env.ADMIN_TOKEN);return new Response(null,{status:204,headers:cors})}
    catch{return reply({error:'identity_storage_unavailable'},503,cors)}
   }
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
   const url=new URL(req.url);
   const hoursParam=url.searchParams.get('hours');
   const legacyDays=Number(url.searchParams.get('days')||30);
   const hours=hoursParam!==null&&[1,24,72,168,720].includes(Number(hoursParam))?Number(hoursParam):([7,30,90].includes(legacyDays)?legacyDays*24:720);
   try{return reply({hours,days:hours/24,generated_at:new Date().toISOString(),...await report(env.DB,hours)},200,cors)}
   catch{return reply({error:'storage_unavailable'},503,cors)}
  }
  return reply({error:'not_found'},404);
 },
 async scheduled(event,env){const cutoff=new Date(Date.now()-90*86400000).toISOString();await env.DB.prepare('DELETE FROM events WHERE ts<?').bind(cutoff).run();await env.DB.prepare('DELETE FROM identity_visits WHERE ts<?').bind(cutoff).run();await env.DB.prepare('DELETE FROM identity_visitors WHERE last_seen<?').bind(cutoff).run()}
};
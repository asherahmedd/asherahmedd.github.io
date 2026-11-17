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
function clientPlatform(ua){
 const s=String(ua||'').slice(0,350);
 const os=/android/i.test(s)?'Android':/iphone|ipad|ipod/i.test(s)?'iOS':/windows/i.test(s)?'Windows':/macintosh|mac os/i.test(s)?'macOS':/linux/i.test(s)?'Linux':'Other';
 const browser=/edg\//i.test(s)?'Edge':/firefox\//i.test(s)?'Firefox':/crios\/|chrome\//i.test(s)?'Chrome':/safari\//i.test(s)?'Safari':'Other';
 return {os,browser};
}
async function recordContext(db,req,data){
 const cf=req.cf||{},platform=clientPlatform(req.headers.get('user-agent'));
 const asn=Number(cf.asn),values=[
  new Date().toISOString(),safe(cf.country||'Unknown',2)||'Unknown',
  safe(cf.region||'Unknown',60)||'Unknown',safe(cf.city||'Unknown',60)||'Unknown',
  safe(cf.timezone||'Unknown',50)||'Unknown',safe(cf.asOrganization||'Unknown',100)||'Unknown',
  Number.isSafeInteger(asn)&&asn>=0?asn:0,
  ['mobile','tablet','desktop'].includes(data.device)?data.device:'other',
  platform.os,platform.browser,safe(data.referrer||'',100)
 ];
 await db.prepare('INSERT INTO visitor_context(ts,country,region,city,timezone,network_org,asn,device,os,browser,referrer) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(...values).run();
}
async function recordIdentity(db,id,secret){
 const hash=await identityHash(id,secret);
 const now=new Date().toISOString();
 const prior=await db.prepare('SELECT first_seen FROM identity_visitors WHERE visitor_hash=?').bind(hash).first();
 await db.prepare('INSERT INTO identity_visitors(visitor_hash,first_seen,last_seen,visits) VALUES(?,?,?,1) ON CONFLICT(visitor_hash) DO UPDATE SET last_seen=excluded.last_seen,visits=visits+1').bind(hash,now,now).run();
 await db.prepare('INSERT INTO identity_visits(ts,visitor_hash,is_returning) VALUES(?,?,?)').bind(now,hash,prior?1:0).run();
}
async function recordJourney(req,env){
 const data=await req.json();
 if(data?.consent!==true||typeof data.journey_id!=='string'||!/^[0-9a-f-]{36}$/i.test(data.journey_id)||typeof data.page_id!=='string'||!/^[0-9a-f-]{36}$/i.test(data.page_id))return reply({error:'invalid_journey'},400,cors);
 const hash=await identityHash(data.journey_id,env.ADMIN_TOKEN);
 const path=safe(data.path,180);
 if(!path.startsWith('/')||path.startsWith('//')||path.includes('\\'))return reply({error:'invalid_path'},400,cors);
 if(data.action==='start'){
  const source=safe(data.source||'',100),device=['mobile','tablet','desktop'].includes(data.device)?data.device:'other';
  await env.DB.prepare('INSERT OR IGNORE INTO visitor_journey_pages(journey_hash,page_id,path,started_at,source,device) VALUES(?,?,?,?,?,?)').bind(hash,data.page_id,path,new Date().toISOString(),source,device).run();
  // Link only explicitly consented browser IDs to tab journeys, using one-way digests.
  // The optional mapping table is created by the returning-analysis migration.
  if(typeof data.browser_id==='string'&&/^[0-9a-f-]{36}$/i.test(data.browser_id)){
   const browserHash=await identityHash(data.browser_id,env.ADMIN_TOKEN);
   try{await env.DB.prepare('INSERT OR IGNORE INTO visitor_journey_owner(journey_hash,browser_hash,first_seen) VALUES(?,?,?)').bind(hash,browserHash,new Date().toISOString()).run()}catch{/* Migration not applied: preserve existing journeys. */}
  }
 }else if(data.action==='end'){
  const duration=Number(data.active_ms);
  if(!Number.isFinite(duration))return reply({error:'invalid_duration'},400,cors);
  const activeMs=Math.min(1800000,Math.max(0,Math.round(duration)));
  await env.DB.prepare('UPDATE visitor_journey_pages SET active_ms=MAX(active_ms,?), ended_at=? WHERE page_id=? AND journey_hash=? AND path=?').bind(activeMs,new Date().toISOString(),data.page_id,hash,path).run();
 }else return reply({error:'invalid_action'},400,cors);
 return new Response(null,{status:204,headers:cors});
}
async function reportJourney(db,since,until){
 const empty={sessions:0,page_steps:0,avg_pages_per_session:0,pages:[],transitions:[],recent:[]};
 try{
  const rows=(await db.prepare('SELECT journey_hash,path,started_at,ended_at,active_ms,source,device FROM visitor_journey_pages WHERE started_at>=? AND started_at<? ORDER BY started_at DESC LIMIT 1500').bind(since,until).all()).results||[];
  if(!rows.length)return empty;
  const groups=new Map(),byPath=new Map(),transitions=new Map();
  for(const r of rows){
   if(!groups.has(r.journey_hash))groups.set(r.journey_hash,[]);
   groups.get(r.journey_hash).push(r);
   const entry=byPath.get(r.path)||{path:r.path,views:0,total_ms:0,completed:0};
   entry.views++;
   if(r.ended_at){entry.total_ms+=Math.max(0,Number(r.active_ms)||0);entry.completed++;}
   byPath.set(r.path,entry);
  }
  const recent=[];
  for(const list of groups.values()){
   list.sort((a,b)=>a.started_at.localeCompare(b.started_at));
   for(let i=1;i<list.length;i++){
    const key=list[i-1].path+'\u0001'+list[i].path;
    const t=transitions.get(key)||{from:list[i-1].path,to:list[i].path,count:0};
    t.count++;transitions.set(key,t);
   }
   recent.push({started_at:list[0].started_at,source:list[0].source||'Direct / unknown',device:list[0].device,steps:list.slice(0,20).map(x=>({path:x.path,started_at:x.started_at,active_ms:x.ended_at?x.active_ms:null}))});
  }
  recent.sort((a,b)=>b.started_at.localeCompare(a.started_at));
  return {sessions:groups.size,page_steps:rows.length,avg_pages_per_session:Number((rows.length/groups.size).toFixed(1)),
   pages:[...byPath.values()].map(p=>({...p,avg_active_ms:p.completed?Math.round(p.total_ms/p.completed):null})).sort((a,b)=>b.total_ms-a.total_ms).slice(0,12),
   transitions:[...transitions.values()].sort((a,b)=>b.count-a.count).slice(0,12),recent:recent.slice(0,12),limited:rows.length===1500};
 }catch{return empty}
}
/* Returning-browser analysis is restricted to consented, hashed journeys.
   A browser can contain multiple people; never expose stable hashes to the dashboard. */
async function reportReturning(db,since,until){
 const empty={available:false,returning_sessions:0,returning_browsers:0,median_hours:null,avg_pages:null,intervals:[],popular_pages:[],recent:[],limited:false};
 try{
  // Retrieve a 90-day lookback to calculate intervals even when a shorter period is selected.
  const lookback=new Date(Math.max(Date.parse(since)-90*86400000,Date.parse(until)-90*86400000)).toISOString();
  const rows=(await db.prepare(
   'SELECT m.browser_hash,p.journey_hash,p.path,p.started_at,p.active_ms,p.source FROM visitor_journey_pages p JOIN visitor_journey_owner m ON m.journey_hash=p.journey_hash WHERE p.started_at>=? AND p.started_at<? ORDER BY p.started_at ASC LIMIT 5000'
  ).bind(lookback,until).all()).results||[];
  const sessions=new Map();
  for(const r of rows){
   let s=sessions.get(r.journey_hash);
   if(!s){s={browser:r.browser_hash,id:r.journey_hash,start:r.started_at,source:r.source||'',paths:[],active:0};sessions.set(r.journey_hash,s)}
   s.paths.push(r.path);s.active+=Math.max(0,Number(r.active_ms)||0);
  }
  const byBrowser=new Map();
  for(const s of sessions.values()){
   if(!byBrowser.has(s.browser))byBrowser.set(s.browser,[]);
   byBrowser.get(s.browser).push(s);
  }
  const intervals=[{label:'Under 24 hours',count:0},{label:'1–7 days',count:0},{label:'8–30 days',count:0},{label:'Over 30 days',count:0}];
  const gaps=[],recent=[],pages=new Map(),returningBrowsers=new Set();
  let returningSessions=0,pageSteps=0;
  for(const [browser,list] of byBrowser){
   list.sort((a,b)=>a.start.localeCompare(b.start));
   for(let i=1;i<list.length;i++){
    const previous=list[i-1],current=list[i];
    if(current.start<since||current.start>=until)continue;
    const hours=(Date.parse(current.start)-Date.parse(previous.start))/3600000;
    if(!Number.isFinite(hours)||hours<0)continue;
    gaps.push(hours);
    intervals[hours<24?0:hours<=168?1:hours<=720?2:3].count++;
    returningSessions++;returningBrowsers.add(browser);pageSteps+=current.paths.length;
    for(const path of current.paths)pages.set(path,(pages.get(path)||0)+1);
    recent.push({at:current.start,after_hours:Math.round(hours*10)/10,visit_number:i+1,source:current.source||'Direct / unknown',previous_paths:previous.paths.slice(0,12),paths:current.paths.slice(0,12),active_ms:current.active});
   }
  }
  gaps.sort((a,b)=>a-b);recent.sort((a,b)=>b.at.localeCompare(a.at));
  const median=gaps.length?(gaps.length%2?gaps[(gaps.length-1)/2]:(gaps[gaps.length/2-1]+gaps[gaps.length/2])/2):null;
  return {available:true,returning_sessions:returningSessions,returning_browsers:returningBrowsers.size,median_hours:median===null?null:Math.round(median*10)/10,avg_pages:returningSessions?Math.round(pageSteps/returningSessions*10)/10:null,intervals,popular_pages:[...pages].map(([path,views])=>({path,views})).sort((a,b)=>b.views-a.views).slice(0,10),recent:recent.slice(0,10),limited:rows.length===5000};
 }catch{return empty}
}
async function report(db,range){
 const {from:since,to:until,hours,kind}=range;
 const bucket=kind==='all_time'?"substr(ts,1,7)":hours<=1?"strftime('%Y-%m-%d %H:',ts) || printf('%02d', CAST(CAST(strftime('%M',ts) AS INTEGER)/5 AS INTEGER)*5)":hours<=72?"substr(ts,1,13)":"substr(ts,1,10)";
 const sql={
 summary:"SELECT COUNT(DISTINCT CASE WHEN event='page_view' THEN visitor END) visitors,COUNT(DISTINCT CASE WHEN event='page_view' THEN session END) sessions,SUM(CASE WHEN event='page_view' THEN 1 ELSE 0 END) pageviews,SUM(CASE WHEN event='project_open' THEN 1 ELSE 0 END) project_opens,SUM(CASE WHEN event='blog_open' THEN 1 ELSE 0 END) blog_opens,COALESCE(SUM(CASE WHEN event='session_active' THEN active_ms ELSE 0 END),0) active_ms FROM events WHERE ts>=? AND ts<?",
 daily:`SELECT ${bucket} day,COUNT(*) pageviews,COUNT(DISTINCT visitor) visitors FROM events WHERE ts>=? AND ts<? AND event='page_view' GROUP BY day ORDER BY day`,
 pages:"SELECT path,COUNT(*) views,COUNT(DISTINCT visitor) visitors FROM events WHERE ts>=? AND ts<? AND event='page_view' GROUP BY path ORDER BY views DESC LIMIT 12",
 sections:"SELECT section,SUM(active_ms) active_ms,COUNT(DISTINCT session) sessions FROM events WHERE ts>=? AND ts<? AND event='section_time' AND section<>'' GROUP BY section ORDER BY active_ms DESC LIMIT 15",
 projects:"SELECT item,COUNT(*) opens FROM events WHERE ts>=? AND ts<? AND event='project_open' AND item<>'' GROUP BY item ORDER BY opens DESC LIMIT 15",
 countries:"SELECT country,COUNT(*) views FROM events WHERE ts>=? AND ts<? AND event='page_view' GROUP BY country ORDER BY views DESC LIMIT 12",
 devices:"SELECT device,COUNT(*) views FROM events WHERE ts>=? AND ts<? AND event='page_view' GROUP BY device ORDER BY views DESC",
 referrers:"SELECT referrer,COUNT(*) views FROM events WHERE ts>=? AND ts<? AND event='page_view' AND referrer<>'' GROUP BY referrer ORDER BY views DESC LIMIT 10",
 filters:"SELECT item,COUNT(*) clicks FROM events WHERE ts>=? AND ts<? AND event='filter_click' GROUP BY item ORDER BY clicks DESC LIMIT 10",
 scroll:"SELECT depth,COUNT(DISTINCT session) sessions FROM events WHERE ts>=? AND ts<? AND event='scroll_depth' AND depth>0 GROUP BY depth ORDER BY depth"};
 const keys=Object.keys(sql),rs=await Promise.all(keys.map(k=>db.prepare(sql[k]).bind(since,until).all()));
 let repeat={consented_visits:0,new_browsers:0,returning_visits:0,distinct_consented_browsers:0};
 const context={consented_context_visits:0,cities:[],regions:[],networks:[],timezones:[],browsers:[],operating_systems:[],devices:[],referrers:[]};
 try{
  const qs={
   cities:"SELECT city, country, COUNT(*) AS visits FROM visitor_context WHERE ts>=? AND ts<? AND city<>'Unknown' GROUP BY city,country ORDER BY visits DESC LIMIT 15",
   regions:"SELECT region, country, COUNT(*) AS visits FROM visitor_context WHERE ts>=? AND ts<? AND region<>'Unknown' GROUP BY region,country ORDER BY visits DESC LIMIT 15",
   networks:"SELECT network_org, asn, COUNT(*) AS visits FROM visitor_context WHERE ts>=? AND ts<? AND network_org<>'Unknown' GROUP BY network_org,asn ORDER BY visits DESC LIMIT 15",
   timezones:"SELECT timezone, COUNT(*) AS visits FROM visitor_context WHERE ts>=? AND ts<? AND timezone<>'Unknown' GROUP BY timezone ORDER BY visits DESC LIMIT 10",
   browsers:"SELECT browser,COUNT(*) AS visits FROM visitor_context WHERE ts>=? AND ts<? GROUP BY browser ORDER BY visits DESC",
   operating_systems:"SELECT os,COUNT(*) AS visits FROM visitor_context WHERE ts>=? AND ts<? GROUP BY os ORDER BY visits DESC",
   devices:"SELECT device,COUNT(*) AS visits FROM visitor_context WHERE ts>=? AND ts<? GROUP BY device ORDER BY visits DESC",
   referrers:"SELECT referrer,COUNT(*) AS visits FROM visitor_context WHERE ts>=? AND ts<? AND referrer<>'' GROUP BY referrer ORDER BY visits DESC LIMIT 10"
  };
  const entries=Object.entries(qs);
  const results=await Promise.all(entries.map(([,query])=>db.prepare(query).bind(since,until).all()));
  for(let i=0;i<entries.length;i++)context[entries[i][0]]=results[i].results||[];
  const total=await db.prepare('SELECT COUNT(*) AS visits FROM visitor_context WHERE ts>=? AND ts<?').bind(since,until).first();
  context.consented_context_visits=total?.visits||0;
 }catch{/* Feature not deployed: preserve baseline analytics. */}
 try{repeat=await db.prepare('SELECT COUNT(*) AS consented_visits, COALESCE(SUM(CASE WHEN is_returning=0 THEN 1 ELSE 0 END),0) AS new_browsers, COALESCE(SUM(CASE WHEN is_returning=1 THEN 1 ELSE 0 END),0) AS returning_visits, COUNT(DISTINCT visitor_hash) AS distinct_consented_browsers FROM identity_visits WHERE ts>=? AND ts<?').bind(since,until).first()||repeat}catch{/* Migration not yet applied: baseline reports remain available. */}
 const journey=await reportJourney(db,since,until);
 const returning=await reportReturning(db,since,until);
 return {...Object.fromEntries(keys.map((k,i)=>[k,k==='summary'?(rs[i].results[0]||{}):rs[i].results])),repeat:repeat||{},context,journey,returning};
}
export default {
 async fetch(req,env){
  const path=new URL(req.url).pathname;
  if(path==='/health')return reply({status:'ok',service:'portfolio-insights',features:{repeat_visits:true}},200,cors);
  if(path==='/track'||path==='/stats'||path==='/identity'||path==='/journey'){
   if(req.headers.get('Origin')!==origin)return reply({error:'origin_not_allowed'},403);
   if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
   if(path==='/journey'){
    if(req.method!=='POST')return reply({error:'method_not_allowed'},405,cors);
    if(Number(req.headers.get('Content-Length')||0)>1024)return reply({error:'payload_too_large'},413,cors);
    try{return await recordJourney(req,env)}catch{return reply({error:'journey_storage_unavailable'},503,cors)}
   }
   if(path==='/identity'){
    if(req.method!=='POST')return reply({error:'method_not_allowed'},405,cors);
    if(Number(req.headers.get('Content-Length')||0)>512)return reply({error:'payload_too_large'},413,cors);
    let data;try{data=await req.json()}catch{return reply({error:'invalid_json'},400,cors)}
    if(data?.consent!==true||typeof data?.persistent_id!=='string'||!/^[0-9a-f-]{36}$/i.test(data.persistent_id))return reply({error:'invalid_consented_id'},400,cors);
    try{await recordIdentity(env.DB,data.persistent_id,env.ADMIN_TOKEN);try{await recordContext(env.DB,req,data)}catch{/* Old database: repeat visit logging remains active. */}return new Response(null,{status:204,headers:cors})}
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
   const fromInput=url.searchParams.get('from'),toInput=url.searchParams.get('to');
   const hoursParam=url.searchParams.get('hours'),legacyDays=url.searchParams.get('days');
   const now=Date.now();
   let range;
   if(fromInput!==null||toInput!==null){
    if(!fromInput||!toInput||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(fromInput)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(toInput))return reply({error:'invalid_custom_dates'},400,cors);
    const fromMs=Date.parse(fromInput),toMs=Date.parse(toInput);
    if(!Number.isFinite(fromMs)||!Number.isFinite(toMs)||fromMs>=toMs||toMs>now+60000||toMs-fromMs>90*86400000)return reply({error:'invalid_custom_range',max_days:90},400,cors);
    range={from:new Date(fromMs).toISOString(),to:new Date(toMs).toISOString(),hours:(toMs-fromMs)/3600000,kind:'custom'};
   }else{
    let hours=720;
    if(hoursParam!==null){
     if(!/^\d+$/.test(hoursParam)||![0,1,3,6,12,24,72,168,336,720,2160].includes(Number(hoursParam)))return reply({error:'invalid_range',allowed_hours:[0,1,3,6,12,24,72,168,336,720,2160]},400,cors);
     hours=Number(hoursParam);
    }else if(legacyDays!==null){
     if(!/^(7|30|90)$/.test(legacyDays))return reply({error:'invalid_range'},400,cors);
     hours=Number(legacyDays)*24;
    }
    range={from:hours===0?'1970-01-01T00:00:00.000Z':new Date(now-hours*3600000).toISOString(),to:new Date(now).toISOString(),hours,kind:hours===0?'all_time':'rolling'};
   }
   try{return reply({hours:range.kind==='custom'?null:range.hours,period:range.kind,days:range.kind==='all_time'?null:range.hours/24,generated_at:new Date().toISOString(),range:{from:range.from,to:range.to,kind:range.kind},...await report(env.DB,range)},200,cors)}
   catch{return reply({error:'storage_unavailable'},503,cors)}
  }
  return reply({error:'not_found'},404);
 },
 async scheduled(event,env){const cutoff=new Date(Date.now()-90*86400000).toISOString();await env.DB.prepare('DELETE FROM events WHERE ts<?').bind(cutoff).run();await env.DB.prepare('DELETE FROM identity_visits WHERE ts<?').bind(cutoff).run();await env.DB.prepare('DELETE FROM identity_visitors WHERE last_seen<?').bind(cutoff).run();try{await env.DB.prepare('DELETE FROM visitor_context WHERE ts<?').bind(cutoff).run()}catch{};try{await env.DB.prepare('DELETE FROM visitor_journey_pages WHERE started_at<?').bind(cutoff).run()}catch{};try{await env.DB.prepare('DELETE FROM visitor_journey_owner WHERE first_seen<?').bind(cutoff).run()}catch{}}
};
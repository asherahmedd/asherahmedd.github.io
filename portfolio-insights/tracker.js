/* Portfolio Insights. Cookieless, memory-only first-party measurement. No persistent tracking IDs. */
(()=>{'use strict';
const tag=document.currentScript,base=tag?.getAttribute('data-endpoint')?.replace(/\/$/,'');
if(!base||!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(base))return;
if(navigator.globalPrivacyControl||navigator.doNotTrack==='1')return;
const consentKey='portfolio_analytics_consent';
let enabled=false,visitor='',session='',visibleSection='',sectionStarted=0,lastInput=Date.now();
const fresh=()=>crypto.randomUUID();
/* Ephemeral per-page IDs: support page-local event grouping, not recognition across pages. */
function transmit(event,data={}){if(!enabled)return;const payload={event,visitor,session,path:location.pathname,device:innerWidth<700?'mobile':innerWidth<1000?'tablet':'desktop',referrer:(()=>{try{return new URL(document.referrer).hostname}catch{return''}})(),...data};fetch(base+'/track',{method:'POST',mode:'cors',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),keepalive:true}).catch(()=>{});}
function sectionEnd(){if(visibleSection&&sectionStarted){const ms=Math.min(60000,Date.now()-sectionStarted);if(ms>400)transmit('section_time',{section:visibleSection,active_ms:ms});sectionStarted=0}}
function begin(){
 if(enabled)return;enabled=true;visitor=fresh();session=fresh();transmit('page_view');
 const sent=new Set(),marks=[25,50,75,90];
 function scrollCheck(){const max=document.documentElement.scrollHeight-innerHeight;const pct=max?100*scrollY/max:100;marks.forEach(n=>{if(pct>=n&&!sent.has(n)){sent.add(n);transmit('scroll_depth',{depth:n})}})}
 addEventListener('scroll',scrollCheck,{passive:true});scrollCheck();
 document.addEventListener('click',e=>{const path=typeof e.composedPath==='function'?e.composedPath():[e.target];const find=(selector)=>path.find(n=>n&&n.nodeType===1&&typeof n.matches==='function'&&n.matches(selector));const filter=find('[data-filter]');if(filter)transmit('filter_click',{item:filter.dataset.filter});const a=find('a[href]');if(!a)return;try{const u=new URL(a.href,location.href);if(u.origin!==location.origin){transmit('outbound_click',{item:u.hostname});return}if(u.pathname.startsWith('/projects/'))transmit('project_open',{item:u.pathname.split('/').pop().replace('.html','')});if(u.pathname.startsWith('/blog/'))transmit('blog_open',{item:u.pathname.split('/').pop().replace('.html','')})}catch{}});
 const els=[...document.querySelectorAll('main section[id], section[id]')];
 if('IntersectionObserver'in window){const obs=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){transmit('section_view',{section:e.target.id});sectionEnd();visibleSection=e.target.id;sectionStarted=Date.now()}})},{threshold:.35});els.forEach(el=>obs.observe(el))}
 document.addEventListener('visibilitychange',()=>{if(document.hidden)sectionEnd();else if(visibleSection)sectionStarted=Date.now()});
 addEventListener('pagehide',sectionEnd);
 ['keydown','pointerdown','touchstart','scroll'].forEach(t=>document.addEventListener(t,()=>lastInput=Date.now(),{passive:true}));
 setInterval(()=>{if(!document.hidden&&Date.now()-lastInput<45000)transmit('session_active',{active_ms:15000})},15000);
}
/* Optional recognition of returning browsers. This is entirely separate from
   baseline, memory-only analytics and never runs until the user opts in. */
const repeatChoice='portfolio_visitor_details_consent_v2',repeatId='portfolio_repeat_id_v1';
const cookieName='portfolio_returning_browser';
const repeatPrivacy='/portfolio-insights/privacy.html';
const repeatRead=key=>{try{return localStorage.getItem(key)}catch{return null}};
function readRepeatCookie(){
 const entry=document.cookie.split('; ').find(v=>v.startsWith(cookieName+'='));
 return entry?decodeURIComponent(entry.slice(cookieName.length+1)):'';
}
function clearRepeat(){
 document.cookie=cookieName+'=; Max-Age=0; Path=/; SameSite=Lax; Secure';
 try{localStorage.removeItem(repeatId)}catch{}
}
function writeRepeatCookie(id){
 document.cookie=cookieName+'='+encodeURIComponent(id)+'; Max-Age=7776000; Path=/; SameSite=Lax; Secure';
 return readRepeatCookie()===id;
}
function identityVisit(){
 if(repeatRead(repeatChoice)!=='yes')return;
 let id=readRepeatCookie();
 if(!id||!/^[0-9a-f-]{36}$/i.test(id)){
  id=fresh();
  if(!writeRepeatCookie(id))return;
 }
 try{localStorage.removeItem(repeatId)}catch{}
 fetch(base+'/identity',{method:'POST',mode:'cors',headers:{'Content-Type':'application/json'},body:JSON.stringify({persistent_id:id,consent:true,device:innerWidth<700?'mobile':innerWidth<1000?'tablet':'desktop',referrer:(()=>{try{return new URL(document.referrer).hostname}catch{return''}})()}),keepalive:true}).catch(()=>{});
}
async function offerRepeatChoice(){
 try{const response=await fetch(base+'/health',{mode:'cors'});if(!response.ok||(await response.json())?.features?.repeat_visits!==true)return}catch{return}
 if(repeatRead(repeatChoice)==='yes'){identityVisit();return}
 if(repeatRead(repeatChoice)==='no')return;
 const show=()=>{
  if(document.getElementById('portfolio-repeat-choice'))return;
  const host=document.createElement('aside');host.id='portfolio-repeat-choice';
  host.setAttribute('aria-label','Analytics cookie preferences');
  host.style.cssText='position:fixed;bottom:17px;left:17px;right:17px;z-index:100000;max-width:430px;background:#fff;color:#20252c;border:1px solid #dce2e9;border-radius:15px;box-shadow:0 12px 35px #18243b26;padding:17px 18px;font:13px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif';
  const heading=document.createElement('strong');heading.textContent='Allow analytics cookies?';
  const p=document.createElement('p');p.style.cssText='margin:7px 0 12px;color:#566272';p.textContent='Basic visit statistics run without cookies. If you allow optional analytics cookies, we can count repeat visits and summarize approximate city, region, internet network provider, browser and device. We do not identify you by name, employer or LinkedIn profile.';
  const actions=document.createElement('div');actions.style.cssText='display:flex;gap:9px;flex-wrap:wrap;align-items:center';
  const yes=document.createElement('button'),no=document.createElement('button'),link=document.createElement('a');
  yes.type='button';no.type='button';yes.textContent='Allow analytics cookies';no.textContent='Reject optional cookies';link.href=repeatPrivacy;link.textContent='Cookie details';
  for(const b of [yes,no])b.style.cssText='border:1px solid #d6dde6;border-radius:8px;background:#fff;color:#283b52;padding:8px 11px;cursor:pointer;font:600 12px sans-serif';
  yes.style.background='#0071e3';yes.style.borderColor='#0071e3';yes.style.color='#fff';
  link.style.cssText='font-size:12px;color:#056fca';
  yes.addEventListener('click',()=>{try{localStorage.setItem(repeatChoice,'yes')}catch{}host.remove();identityVisit()});
  no.addEventListener('click',()=>{try{localStorage.setItem(repeatChoice,'no')}catch{}clearRepeat();host.remove()});
  actions.append(yes,no,link);host.append(heading,p,actions);document.body.append(host);
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',show,{once:true});else show();
}
/* Baseline remains cookieless; optional identification requires explicit consent. */
function disable(){
 enabled=false;
 try{localStorage.setItem(repeatChoice,'no')}catch{}
 clearRepeat();
 document.getElementById('portfolio-repeat-choice')?.remove();
 try{localStorage.setItem(consentKey,'no');localStorage.removeItem('portfolio_visitor_v1');sessionStorage.removeItem('portfolio_session_v1')}catch{}
}
window.PortfolioInsights={disable};
try{
 const optedOut=localStorage.getItem(consentKey)==='no';
 if(!optedOut){begin();offerRepeatChoice()}
}catch{begin();offerRepeatChoice()}
})();

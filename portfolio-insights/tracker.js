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
/* Opt-out is honored across pages. No consent popup, cookies, persistent IDs or fingerprinting. */
function disable(){
 enabled=false;
 try{localStorage.setItem(consentKey,'no');localStorage.removeItem('portfolio_visitor_v1');sessionStorage.removeItem('portfolio_session_v1')}catch{}
}
window.PortfolioInsights={disable};
try{
 const optedOut=localStorage.getItem(consentKey)==='no';
 if(!optedOut)begin();
}catch{begin()}
})();

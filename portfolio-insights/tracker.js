/* Portfolio Insights. Opt-in only; no IPs, typed questions, or personal details. */
(()=>{'use strict';
const tag=document.currentScript,base=tag?.getAttribute('data-endpoint')?.replace(/\/$/,'');
if(!base||!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(base))return;
if(navigator.globalPrivacyControl||navigator.doNotTrack==='1')return;
const consentKey='portfolio_analytics_consent',visitorKey='portfolio_visitor_v1',sessionKey='portfolio_session_v1';
let enabled=false,visitor='',session='',visibleSection='',sectionStarted=0,lastInput=Date.now();
const fresh=()=>crypto.randomUUID();
function id(key,storage){try{let v=storage.getItem(key);if(!v){v=fresh();storage.setItem(key,v)}return v}catch{return fresh()}}
function transmit(event,data={}){if(!enabled)return;const payload={event,visitor,session,path:location.pathname,device:innerWidth<700?'mobile':innerWidth<1000?'tablet':'desktop',referrer:(()=>{try{return new URL(document.referrer).hostname}catch{return''}})(),...data};fetch(base+'/track',{method:'POST',mode:'cors',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),keepalive:true}).catch(()=>{});}
function sectionEnd(){if(visibleSection&&sectionStarted){const ms=Math.min(60000,Date.now()-sectionStarted);if(ms>400)transmit('section_time',{section:visibleSection,active_ms:ms});sectionStarted=0}}
function begin(){
 if(enabled)return;enabled=true;visitor=id(visitorKey,localStorage);session=id(sessionKey,sessionStorage);transmit('page_view');
 const sent=new Set(),marks=[25,50,75,90];
 function scrollCheck(){const max=document.documentElement.scrollHeight-innerHeight;const pct=max?100*scrollY/max:100;marks.forEach(n=>{if(pct>=n&&!sent.has(n)){sent.add(n);transmit('scroll_depth',{depth:n})}})}
 addEventListener('scroll',scrollCheck,{passive:true});scrollCheck();
 document.addEventListener('click',e=>{const filter=e.target.closest('[data-filter]');if(filter)transmit('filter_click',{item:filter.dataset.filter});const a=e.target.closest('a[href]');if(!a)return;try{const u=new URL(a.href,location.href);if(u.origin!==location.origin){transmit('outbound_click',{item:u.hostname});return}if(u.pathname.startsWith('/projects/'))transmit('project_open',{item:u.pathname.split('/').pop().replace('.html','')});if(u.pathname.startsWith('/blog/'))transmit('blog_open',{item:u.pathname.split('/').pop().replace('.html','')})}catch{}});
 const els=[...document.querySelectorAll('main section[id], section[id]')];
 if('IntersectionObserver'in window){const obs=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){transmit('section_view',{section:e.target.id});sectionEnd();visibleSection=e.target.id;sectionStarted=Date.now()}})},{threshold:.35});els.forEach(el=>obs.observe(el))}
 document.addEventListener('visibilitychange',()=>{if(document.hidden)sectionEnd();else if(visibleSection)sectionStarted=Date.now()});
 addEventListener('pagehide',sectionEnd);
 ['keydown','pointerdown','touchstart','scroll'].forEach(t=>document.addEventListener(t,()=>lastInput=Date.now(),{passive:true}));
 setInterval(()=>{if(!document.hidden&&Date.now()-lastInput<45000)transmit('session_active',{active_ms:15000})},15000);
}
function enable(){try{localStorage.setItem(consentKey,'yes')}catch{}begin()}
function disable(){enabled=false;try{localStorage.setItem(consentKey,'no');localStorage.removeItem(visitorKey);sessionStorage.removeItem(sessionKey)}catch{}}
window.PortfolioInsights={enable,disable};
function banner(){
 try{if(localStorage.getItem(consentKey))return}catch{}
 const box=document.createElement('div');box.setAttribute('role','dialog');box.setAttribute('aria-label','Portfolio analytics consent');
 box.style.cssText='position:fixed;bottom:16px;left:16px;right:16px;margin:auto;max-width:440px;z-index:99998;background:white;color:#253449;border:1px solid #dfe5ec;border-radius:14px;padding:15px;box-shadow:0 15px 35px #24384b36;font:12px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif';
 const title=document.createElement('b');title.textContent='Portfolio analytics';title.style.fontSize='13px';
 const copy=document.createElement('p');copy.textContent='Allow anonymous tracking of visits, scrolls and project clicks? No typed questions or personal details are collected.';copy.style.cssText='margin:7px 0 12px;color:#67788a';
 const actions=document.createElement('div');actions.style.cssText='display:flex;gap:8px;align-items:center';
 function btn(text,primary,cb){const el=document.createElement('button');el.textContent=text;el.type='button';el.style.cssText='background:'+(primary?'#0071e3':'#fff')+';color:'+(primary?'#fff':'#253449')+';border:1px solid #dce2eb;border-radius:8px;padding:7px 11px;font:inherit;cursor:pointer';el.addEventListener('click',()=>{box.remove();cb()});return el}
 actions.append(btn('Allow analytics',true,enable),btn('Decline',false,disable));
 const more=document.createElement('a');more.href='/portfolio-insights/privacy.html';more.textContent='Privacy';more.style.cssText='color:#0071e3;text-decoration:none;margin-left:auto';actions.append(more);box.append(title,copy,actions);document.body.append(box);
}
try{const saved=localStorage.getItem(consentKey);if(saved==='yes')begin();else if(!saved){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',banner,{once:true});else banner()}}catch{}
})();
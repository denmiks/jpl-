const $=id=>document.getElementById(id);
let hm='all',folders=[],photos=[],cur=null,mode='week',isOpen=false,pending=[],db=null;
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const uid=()=>Date.now()+'-'+Math.random().toString(36).slice(2,7);
$('pdate').value=today();$('fdate').value=today();
const plural=n=>n+' photo'+(n===1?'':'s');
const inCur=()=>photos.filter(p=>p.fid===cur);
const esc=s=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const hash=s=>[...s].reduce((a,c)=>(a*31+c.charCodeAt(0))|0,7);
const say=m=>{const s=$('status');if(s)s.textContent=m||''};

/* storage: shared Supabase when configured, IndexedDB as the offline fallback */
const SB={url:'PASTE_SUPABASE_URL',key:'PASTE_SUPABASE_ANON_KEY',bucket:'photos'};
const sb=(SB.url.startsWith('PASTE')||typeof supabase==='undefined')?null:supabase.createClient(SB.url,SB.key);
const sbAll=async t=>{const r=await sb.from(t).select('*');if(r.error)throw r.error;return r.data||[]};
const sbDel=(t,id)=>sb.from(t).delete().eq('id',id);
const sbRm=paths=>sb.storage.from(SB.bucket).remove(paths).then(()=>{});
const objURL=p=>sb.storage.from(SB.bucket).getPublicUrl(p).data.publicUrl;

async function saveFolder(f){
 if(sb){const e=await sb.from('folders').insert(f);if(e.error)throw e.error}
 else dbPut('f',f);
 return f}
async function dropFolder(f){
 const mine=photos.filter(p=>p.fid===f.id);
 await Promise.all(mine.map(p=>dropPhoto(p)));
 if(sb){const e=await sbDel('folders',f.id);if(e.error)throw e.error}else dbDel('f',f.id)}
async function savePhoto(p,blob){
 if(sb){const path=p.fid+'/'+p.id+'.jpg';
  const up=await sb.storage.from(SB.bucket).upload(path,blob,{contentType:'image/jpeg',upsert:true});
  if(up.error)throw up.error;
  const e=await sb.from('photos').insert({id:p.id,fid:p.fid,title:p.title,date:p.date,created:p.created||0,path});
  if(e.error)throw e.error;p.path=path;p.src=objURL(path)}
 else{p.src=await blobURL(blob);dbPut('p',p)}
 return p}
async function dropPhoto(p){
 if(sb){await sbRm(p.path||p.fid+'/'+p.id+'.jpg');await sbDel('photos',p.id)}
 else dbDel('p',p.id)}

/* IndexedDB fallback */
function openDB(){return new Promise(res=>{try{const r=indexedDB.open('photo-folder',2);
 r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('p'))d.createObjectStore('p',{keyPath:'id'});if(!d.objectStoreNames.contains('f'))d.createObjectStore('f',{keyPath:'id'})};
 r.onsuccess=()=>{db=r.result;res()};r.onerror=()=>res()}catch(e){res()}})}
const dbAll=s=>new Promise(res=>{if(!db)return res([]);try{const q=db.transaction(s).objectStore(s).getAll();q.onsuccess=()=>res(q.result||[]);q.onerror=()=>res([])}catch(e){res([])}});
const dbPut=(s,o)=>{try{db&&db.transaction(s,'readwrite').objectStore(s).put(o)}catch(e){}};
const dbDel=(s,id)=>{try{db&&db.transaction(s,'readwrite').objectStore(s).delete(id)}catch(e){}};
const blobURL=b=>new Promise(r=>{if(!b)return r(null);const fr=new FileReader();fr.onload=()=>r(fr.result);fr.onerror=()=>r(null);fr.readAsDataURL(b)});

/* resize to a shareable jpeg blob */
function shrink(file){return new Promise(res=>{const fr=new FileReader();fr.onload=()=>{const im=new Image();im.onload=()=>{
  const s=Math.min(1,1200/Math.max(im.width,im.height));const c=document.createElement('canvas');
  c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);c.getContext('2d').drawImage(im,0,0,c.width,c.height);
  c.toBlob?c.toBlob(b=>res(b),'image/jpeg',.85):res(null)};
 im.onerror=()=>res(null);im.src=fr.result};fr.onerror=()=>res(null);fr.readAsDataURL(file)})}

/* dates */
const D=s=>{const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const fmt=(d,o)=>d.toLocaleDateString(undefined,o);
function keyOf(date,m){const d=D(date);
 if(m==='year')return[d.getFullYear(),String(d.getFullYear())];
 if(m==='month')return[d.getFullYear()*100+d.getMonth(),fmt(d,{month:'long',year:'numeric'})];
 const s=new Date(d);s.setDate(d.getDate()-((d.getDay()+6)%7));
 const e=new Date(s);e.setDate(s.getDate()+6);
 return[+s,fmt(s,{month:'short',day:'numeric'})+' – '+fmt(e,{month:'short',day:'numeric',year:'numeric'})]}

const PETS=['cat','cat2','cat3','dog','dog2','dog3','dog4'];
/* home */
const card=f=>{const ps=photos.filter(p=>p.fid===f.id),last=ps[ps.length-1];
 return `<div class="fw"><button class="folder mini" data-id="${f.id}" aria-label="Open folder ${esc(f.name)}"><div class="back"></div><svg class="pet" aria-hidden="true"><use href="#${PETS[Math.abs(hash(f.id))%PETS.length]}"/></svg><div class="sheets"><i></i><i></i><i style="${last?`background:url(${last.src}) center/cover`:''}"></i></div><div class="front"><b>${esc(f.name)}</b><span>${plural(ps.length)}</span></div></button><button class="rm" data-rm="${f.id}">Delete folder</button></div>`};
function renderHome(){
 if(!folders.length){$('folders').innerHTML='<p class="empty">No folders yet. Open the Upload tab to make one.</p>';return}
 const g={};folders.forEach(f=>{const[k,l]=hm==='all'?[0,'']:keyOf(f.date,hm);(g[k]=g[k]||{l,a:[]}).a.push(f)});
 $('folders').innerHTML=Object.keys(g).sort((a,b)=>b-a).map(k=>{const x=g[k];
  return `<section class="group">${x.l?`<h2>${esc(x.l)}<small>${x.a.length} folder${x.a.length>1?'s':''}</small></h2>`:''}<div class="folders">${x.a.sort((a,b)=>b.created-a.created).map(card).join('')}</div></section>`}).join('');fillPick()}
function fillPick(){const s=$('pfid'),v=s.value;
 s.innerHTML='<option value="">Choose a folder</option>'+folders.map(f=>`<option value="${f.id}">${esc(f.name)}</option>`).join('');
 if(folders.some(f=>f.id===v))s.value=v}
document.querySelectorAll('#htabs button').forEach(b=>b.onclick=()=>{hm=b.dataset.h;document.querySelectorAll('#htabs button').forEach(x=>x.setAttribute('aria-pressed',x===b));renderHome()});
let fpend=[];
$('fpick').onclick=()=>$('ffile').click();
$('ffile').onchange=e=>{fpend=[...e.target.files];$('fhint').textContent=fpend.length?plural(fpend.length)+' ready. Type a title, then press Create folder.':''};
$('mk').onclick=async()=>{const n=$('fname').value.trim();
 if(!n){$('fhint').textContent='Type a title for this entry first.';return}
 if(!fpend.length){$('fhint').textContent='Choose at least one photo first.';return}
 const d=$('fdate').value||today(),f={id:uid(),name:n,date:d,created:Date.now()};
 const made=[];let bad=null;
 for(const file of fpend){const blob=await shrink(file);if(!blob)continue;
  const p={id:uid(),fid:f.id,title:n,date:d,created:Date.now()};
  try{photos.push(await savePhoto(p,blob));made.push(p);}catch(e){bad=e}}
 if(!made.length){$('fhint').textContent=bad?'Upload failed: '+bad.message:'Those files could not be read as images.';return}
 folders.push(f);
 try{await saveFolder(f)}
 catch(e){await Promise.all(made.map(p=>dropPhoto(p)));photos=photos.filter(p=>p.fid!==f.id);
  $('fhint').textContent='Could not create the folder: '+e.message;return}
 fpend=[];$('ffile').value='';$('fname').value='';$('fhint').textContent='';renderHome();show(f.id)};
$('fname').onkeydown=e=>{if(e.key==='Enter')$('mk').click()};
$('folders').onclick=async e=>{
 const r=e.target.closest('.rm');
 if(r){if(!r.classList.contains('arm')){r.classList.add('arm');r.textContent='Tap again to delete';setTimeout(()=>{r.classList.remove('arm');r.textContent='Delete folder'},3000);return}
  const id=r.dataset.rm,f=folders.find(x=>x.id===id);
  await dropFolder(f);photos=photos.filter(p=>p.fid!==id);folders=folders.filter(x=>x.id!==id);
  if(cur===id)closeFolder();renderHome();return}
 const b=e.target.closest('.folder');if(b)show(b.dataset.id)};

/* opening a folder inside the gallery */
function show(id){
 cur=id;const f=folders.find(x=>x.id===id);
 if($('home').hidden)setView('gallery');
 $('gfolders').hidden=true;$('gview').hidden=false;
 $('gname').textContent=f.name;$('bigname').textContent=f.name;$('ghint').textContent='';
 isOpen=false;$('folder').classList.remove('open');$('tabs').classList.remove('show');$('board').classList.remove('show');
 render();window.scrollTo(0,0);
 if(inCur().length)setTimeout(()=>{if(cur===id&&!isOpen)setOpen(true)},500)}
function closeFolder(){
 cur=null;isOpen=false;$('gview').hidden=true;$('gfolders').hidden=false;
 document.querySelectorAll('.pol').forEach(c=>{c.style.transitionDelay='0ms';c.classList.remove('in')});
 renderHome();window.scrollTo(0,0)}
$('gclose').onclick=closeFolder;

/* adding photos to an existing folder, from the upload tab */
$('ppick').onclick=()=>$('pfile').click();
$('pfile').onchange=e=>{pending=[...e.target.files];$('phint').textContent=pending.length?plural(pending.length)+' ready. Add a title, then press Add to folder.':''};
$('padd').onclick=async()=>{
 const fid=$('pfid').value;
 if(!fid){$('phint').textContent='Pick a folder to add to first.';return}
 if(!pending.length){$('phint').textContent='Choose at least one photo first.';return}
 const t=$('ptitle').value.trim(),d=$('pdate').value||today();let n=0,bad=null;
 for(const f of pending){const blob=await shrink(f);if(!blob)continue;
  const p={id:uid(),fid,title:t||f.name.replace(/\.[^.]+$/,''),date:d,created:Date.now()};
  try{photos.push(await savePhoto(p,blob));n++}catch(e){bad=e}}
 pending=[];$('pfile').value='';$('ptitle').value='';
 $('phint').textContent=bad?'Uploaded '+n+', then failed: '+bad.message:n?n+' added.':'Those files could not be read as images.';
 if(cur===fid)update();
 renderHome();fillPick()};

/* polaroid board */
function render(){
 const list=inCur();$('count').textContent=plural(list.length);
 const g={};list.forEach(p=>{const[k,l]=keyOf(p.date,mode);(g[k]=g[k]||{l,a:[]}).a.push(p)});
 const keys=Object.keys(g).sort((a,b)=>b-a);
 $('board').innerHTML=keys.length?keys.map(k=>{const x=g[k];x.a.sort((a,b)=>a.date<b.date?-1:1);
  return `<section class="group"><h2>${esc(x.l)}<small>${plural(x.a.length)}</small></h2><div class="grid">`+
  x.a.map(p=>`<figure class="pol" style="--r:${(hash(p.id)%9)-4}deg"><button class="del" data-id="${p.id}" aria-label="Delete ${esc(p.title)}">×</button><img src="${p.src}" alt="${esc(p.title)}"><figcaption>${esc(p.title)}<small>${fmt(D(p.date),{month:'short',day:'numeric',year:'numeric'})}</small></figcaption></figure>`).join('')+
  `</div></section>`}).join(''):'<p class="empty">This folder is empty. Add a photo above.</p>'}
function spread(){
 const cards=[...document.querySelectorAll('.pol')];
 cards.forEach(c=>{c.style.transition='none';c.classList.remove('in');c.style.setProperty('--dx','0px');c.style.setProperty('--dy','0px')});
 const fr=$('folder').getBoundingClientRect(),cx=fr.left+fr.width/2,cy=fr.top+fr.height/2;
 const pos=cards.map(c=>{const r=c.getBoundingClientRect();return[cx-(r.left+r.width/2),cy-(r.top+r.height/2)]});
 cards.forEach((c,i)=>{c.style.setProperty('--dx',pos[i][0]+'px');c.style.setProperty('--dy',pos[i][1]+'px');c.style.transitionDelay=Math.min(i*70,900)+'ms'});
 void document.body.offsetHeight;
 cards.forEach(c=>{c.style.transition='';c.classList.add('in')})}
function update(){render();if(isOpen)requestAnimationFrame(spread)}
function setOpen(v){
 if(v&&!inCur().length){const f=$('folder');f.classList.remove('shake');void f.offsetWidth;f.classList.add('shake');$('ghint').textContent='This folder is empty. Add photos from the Upload tab.';return}
 isOpen=v;$('folder').classList.toggle('open',v);$('folder').setAttribute('aria-expanded',v);
 $('folder').setAttribute('aria-label',v?'Close folder':'Open folder');$('tabs').classList.toggle('show',v);
 if(v){$('board').classList.add('show');render();requestAnimationFrame(()=>{spread();$('tabs').scrollIntoView({behavior:'smooth',block:'start'})})}
 else{document.querySelectorAll('.pol').forEach(c=>{c.style.transitionDelay='0ms';c.classList.remove('in')});
  setTimeout(()=>{if(!isOpen)$('board').classList.remove('show')},900)}}
$('folder').onclick=()=>setOpen(!isOpen);
document.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>{
 mode=b.dataset.m;document.querySelectorAll('#tabs button').forEach(x=>x.setAttribute('aria-pressed',x===b));update()});
$('board').onclick=async e=>{const b=e.target.closest('.del');if(!b)return;
 const p=photos.find(x=>x.id===b.dataset.id);
 try{await dropPhoto(p)}catch(err){}
 photos=photos.filter(x=>x.id!==b.dataset.id);
 if(!inCur().length)setOpen(false);else update();$('count').textContent=plural(inCur().length);renderHome()};

/* photobooth */
const COLORS=['#ffffff','#1e1e1e','#f4a7b9','#ffd166','#7ac7a0','#8ecae6','#b79ced','#e0653d'];
let stickers=[],pickSt='🐱',frame='#f4a7b9',stream=null,busy=false,shots=[null,null,null,null],imgs=[null,null,null,null];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const loadImg=src=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=src});
function renderSw(){$('sw').innerHTML=COLORS.map(c=>`<button class="sw" data-c="${c}" style="background:${c}" aria-label="Frame color ${c}" aria-pressed="${c===frame}"></button>`).join('')+`<input type="color" id="bcol" value="${frame}" aria-label="Custom frame color">`;
 $('bcol').oninput=e=>{frame=e.target.value;drawStrip();document.querySelectorAll('#sw .sw').forEach(b=>b.setAttribute('aria-pressed',false))}}
$('sw').onclick=e=>{const b=e.target.closest('.sw');if(!b)return;frame=b.dataset.c;renderSw();drawStrip()};
function renderSlots(){$('slots').innerHTML=shots.map((s,i)=>`<button class="slot" data-i="${i}" aria-label="Retake shot ${i+1}">${s?`<img src="${s}" alt="">`:i+1}</button>`).join('')}
function cover(x,im,dx,dy,dw,dh){const sc=Math.max(dw/im.width,dh/im.height),sw=dw/sc,sh=dh/sc;x.drawImage(im,(im.width-sw)/2,(im.height-sh)/2,sw,sh,dx,dy,dw,dh)}
function drawStrip(){const c=$('strip'),x=c.getContext('2d'),W=400,pad=24,w=352,h=264,gap=14,H=pad+4*h+3*gap+96;
 c.width=W;c.height=H;x.fillStyle=frame;x.fillRect(0,0,W,H);
 for(let i=0;i<4;i++){const y=pad+i*(h+gap);x.save();x.beginPath();x.roundRect?x.roundRect(pad,y,w,h,6):x.rect(pad,y,w,h);x.clip();
  if(imgs[i])cover(x,imgs[i],pad,y,w,h);else{x.fillStyle='rgba(0,0,0,.14)';x.fillRect(pad,y,w,h);x.fillStyle='rgba(0,0,0,.4)';x.font='700 40px Nunito, sans-serif';x.textAlign='center';x.fillText(i+1,W/2,y+h/2+14)}
  x.restore()}
 const n=parseInt(frame.slice(1),16),lum=(.299*(n>>16)+.587*((n>>8)&255)+.114*(n&255))/255;
 x.fillStyle=lum<.5?'#fff':'#2f2a25';x.textAlign='center';
 x.font='700 46px Caveat, cursive';x.fillText($('bcap').value.trim()||'Photobooth',W/2,H-46);
 x.font='16px Nunito, sans-serif';x.fillText(new Date().toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}),W/2,H-20);x.font='54px sans-serif';x.textAlign='center';x.textBaseline='middle';stickers.forEach(s=>x.fillText(s.e,s.x,s.y));x.textBaseline='alphabetic'}
async function setShot(i,src){shots[i]=src;imgs[i]=await loadImg(src);renderSlots();drawStrip()}
function snap(){const v=$('vid'),c=document.createElement('canvas');c.width=640;c.height=480;const x=c.getContext('2d');
 const sc=Math.max(640/v.videoWidth,480/v.videoHeight),sw=640/sc,sh=480/sc;
 x.translate(640,0);x.scale(-1,1);x.drawImage(v,(v.videoWidth-sw)/2,(v.videoHeight-sh)/2,sw,sh,0,0,640,480);return c.toDataURL('image/jpeg',.85)}
async function countdown(){for(let n=3;n>0;n--){$('cd').textContent=n;await wait(900)}$('cd').textContent='';$('cam').classList.remove('flash');void $('cam').offsetWidth;$('cam').classList.add('flash');shutter()}
async function takeAll(){if(!stream){$('bhint').textContent='Start the camera first, or use Upload photos.';return}
 if(busy)return;busy=true;shots=[null,null,null,null];imgs=[null,null,null,null];renderSlots();drawStrip();
 for(let i=0;i<4;i++){$('bhint').textContent='Shot '+(i+1)+' of 4';await countdown();await setShot(i,snap());await wait(400)}
 $('bhint').textContent='Done. Pick a frame color, then download.';busy=false}
async function takeOne(i){if(!stream||busy)return;busy=true;$('bhint').textContent='Retaking shot '+(i+1);await countdown();await setShot(i,snap());$('bhint').textContent='';busy=false}
async function startCam(){
 if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){$('bhint').textContent='The camera is not available here. Use Upload photos instead.';return}
 try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false});$('vid').srcObject=stream;$('camoff').hidden=true;$('bcam').textContent='Stop camera';$('bhint').textContent='Camera is on. Press Take 4 shots.'}
 catch(e){$('bhint').textContent='Camera blocked or unavailable. Allow camera access, or use Upload photos.'}}
function stopCam(){if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;$('vid').srcObject=null;$('camoff').hidden=false;$('bcam').textContent='Start camera'}
$('bcam').onclick=()=>stream?stopCam():startCam();
$('btake').onclick=takeAll;
$('slots').onclick=e=>{const b=e.target.closest('.slot');if(b)takeOne(+b.dataset.i)};
$('bup').onclick=()=>$('bfile').click();
$('bfile').onchange=async e=>{const fs=[...e.target.files].slice(0,4);let k=0;
 for(let i=0;i<fs.length;i++){const src=await shrink(fs[i]);if(src){await setShot(i,src);k++}}
 $('bfile').value='';$('bhint').textContent=k?k+' photo'+(k>1?'s':'')+' added.'+(k<4?' Retake the empty slots with the camera, or upload 4 photos.':''):'Those files could not be read as images.'};
$('bclr').onclick=()=>{stickers=[];shots=[null,null,null,null];imgs=[null,null,null,null];renderSlots();drawStrip();$('bhint').textContent=''};
$('bcap').oninput=drawStrip;
function stripName(){const c=$('bcap').value.trim().replace(/[^\w\- ]+/g,'').replace(/\s+/g,'-');
 return 'JPL-Folder-'+(c||'photobooth-strip')+'-'+today()+'.png'}
$('dl').onclick=async()=>{
 if(!shots.some(Boolean)){$('bhint').textContent='Take or upload at least one photo first.';return}
 const blob=await new Promise(r=>$('strip').toBlob(r,'image/png'));
 if(!blob){$('bhint').textContent='Could not build the strip. Try again.';return}
 const dn=window.claude&&await window.claude.use('downloads').catch(()=>null);
 if(dn){try{await dn.save({filename:stripName(),data:blob});$('bhint').textContent='Saved.';return}
  catch(e){if(!e||e.code!=='declined'){}}}
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=stripName();document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),4000);
 $('bhint').textContent='Downloaded '+stripName();};
/* section nav */
function setView(v){
 $('home').hidden=v!=='gallery';$('upload').hidden=v!=='upload';$('booth').hidden=v!=='booth';
 if(v!=='gallery'&&cur)closeFolder();
 if(v!=='booth')stopCam();
 if(v==='gallery')renderHome();
 if(v==='booth')drawStrip();
 markNav(v);window.scrollTo(0,0)}
function markNav(v){document.querySelectorAll('#nav button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===v))}
$('nav').onclick=e=>{const b=e.target.closest('button');if(b)setView(b.dataset.v)};
document.querySelector('.brand').onclick=e=>{e.preventDefault();setView('gallery')};
/* stickers + shutter sound */
const STK=['🐱','🐶','🐾','❤️','⭐','🎀','🌸','✨'];
function renderStk(){$('stk').innerHTML=STK.map(e=>`<button class="sw stk1" data-e="${e}" aria-pressed="${e===pickSt}" aria-label="Sticker ${e}">${e}</button>`).join('')}
$('stk').onclick=e=>{const b=e.target.closest('.stk1');if(b){pickSt=b.dataset.e;renderStk();$('bhint').textContent='Now tap the strip to place the sticker.'}};
$('strip').onclick=e=>{const c=$('strip'),r=c.getBoundingClientRect(),k=c.width/r.width;stickers.push({e:pickSt,x:(e.clientX-r.left)*k,y:(e.clientY-r.top)*k});drawStrip()};
$('undo').onclick=()=>{stickers.pop();drawStrip()};
function shutter(){try{const a=new(window.AudioContext||window.webkitAudioContext)(),o=a.createOscillator(),g=a.createGain();o.type='square';o.frequency.value=1200;g.gain.setValueAtTime(.15,a.currentTime);g.gain.exponentialRampToValueAtTime(.001,a.currentTime+.12);o.connect(g);g.connect(a.destination);o.start();o.stop(a.currentTime+.12)}catch(e){}}
renderSw();renderStk();renderSlots();drawStrip();if(document.fonts)document.fonts.load('700 46px Caveat').then(drawStrip);

/* load: shared when configured, otherwise this device. Old loose photos and the old
   "Earlier photos" folder are split into one folder per entry. Anything already on this
   device gets pushed to the shared wall once, so an existing library is not lost. */
const splitLoose=async()=>{
 const legacy=folders.filter(f=>f.name==='Earlier photos'),ids=new Set(legacy.map(f=>f.id));
 const loose=photos.filter(p=>!p.fid||ids.has(p.fid));
 if(loose.length||legacy.length){const by={};loose.forEach(p=>{const k=p.title+'|'+p.date;(by[k]=by[k]||[]).push(p)});
  for(const a of Object.values(by)){const f={id:uid(),name:a[0].title,date:a[0].date,created:Date.now()};folders.push(f);await saveFolder(f);
   for(const p of a){p.fid=f.id;if(sb)await sb.from('photos').update({fid:f.id}).eq('id',p.id);else dbPut('p',p)}}
  for(const f of legacy){if(sb)await sbDel('folders',f.id);else dbDel('f',f.id)}
  folders=folders.filter(f=>!ids.has(f.id))}
 for(const f of folders){if(!f.date){const ps=photos.filter(p=>p.fid===f.id);f.date=ps[0]?ps[0].date:today();
  if(sb)await sb.from('folders').update({date:f.date}).eq('id',f.id);else dbPut('f',f)}}};
const pushLocal=async()=>{
 const lf=await dbAll('f'),lp=await dbAll('p');
 if(!lf.length&&!lp.length)return;
 $('fhint').textContent='Moving this device library to the shared wall…';
 const have=new Set(folders.map(f=>f.id));
 for(const f of lf.filter(f=>!have.has(f.id)))try{await saveFolder(f);folders.push(f)}catch(e){}
 for(const p of lp){if(!p.src)continue;
  try{const blob=await (await fetch(p.src)).blob();
   await savePhoto({id:p.id,fid:p.fid,title:p.title,date:p.date,created:p.created||0},blob);
   photos.push(Object.assign({},p,{src:objURL(p.fid+'/'+p.id+'.jpg')}))}catch(e){}}};
async function boot(){
 if(sb){try{
   folders=await sbAll('folders');photos=await sbAll('photos');
   photos.forEach(p=>{if(!p.src&&p.path)p.src=objURL(p.path)});
   if(localStorage.getItem('jpl-migrated')!=='1'){localStorage.setItem('jpl-migrated','1');await pushLocal()}
   await splitLoose()}
  catch(e){say('Shared library could not load: '+e.message)}}
 else{await openDB();folders=await dbAll('f');photos=await dbAll('p');await splitLoose()}
 folders.sort((a,b)=>a.created-b.created);fillPick();renderHome()}
renderHome();
boot();

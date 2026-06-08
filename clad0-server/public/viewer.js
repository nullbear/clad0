

try{ if(new URLSearchParams(location.search).has('editor')) document.documentElement.classList.add('detached-editor-window'); }catch(_){}

const TLABELS={biolum:"Bioluminescent",mineral:"Mineral-adapted",electro:"Electroreceptive",
  aquatic:"Aquatic",aerial:"Aerial",nadir:"Nadir zone",chemo:"Chemosynthetic",
  detrit:"Detritivore",mega:"Megafaunal"};

const KC={Fiends:"#7a1c1c",Celestials:"#3a5e8a",Fey:"#4e2e6e",
  Elementals:"#2e5a2a",Unlife:"#2e2e52",Plants:"#286428",Fungi:"#5a4a14",
  Beasts:"#4a381a",Monstrosities:"#5e2e0e",Aberrations:"#1a4a4a",
  "Dominion Minds":"#1a4a4a",
  "Ocular Sovereigns":"#1a4a4a",
  "Dream Lures":"#1a4a4a",
  "Choral Amorphs":"#1a4a4a",
  "Stoneborn":"#1a4a4a",
  "Rooted Maws":"#1a4a4a",
  "Abolethids":"#1a4a4a",
  Humanoids:"#303070",Giants:"#483010",Dragons:"#6e3808",
  Constructs:"#1a4840","Transformation Category":"#3e1a40",
  Undead:"#3e1a40","Primordial Vestige":"#18183a"};

let ROOT=null,sel=null,nodeMap={},kgColor={};
let PROJECT_SETTINGS={appearance:{theme:'parchment',customThemePath:'',mediaDisplay:'standard'},features:{allowEdits:true,sunburstEnabled:true,statsEnabled:true,mediaEnabled:true,staleTrackingEnabled:true},templates:[]};
let sG=true,sC=true,sT=true,sCu=true,searchQ="";
let expanded=new Set(),pgLeft=1,pgRight=2;
let dragId=null;
let META={}; // id -> { chunked, bytes, stats, img } (filesystem-derived indicators)

// Prose-size quality bands (bytes). <15kb = stub, 15–45kb = healthy, >45kb = heavy.
const PROSE_STUB_MAX=15*1024;
const PROSE_HEAVY_MIN=45*1024;
function proseBand(b){ if(!b) return 'empty'; if(b<PROSE_STUB_MAX) return 'stub'; if(b>PROSE_HEAVY_MIN) return 'heavy'; return 'ok'; }
const BANNER_IDEAL_WIDTH=1442;

// Automatic staleness: an entry not revised within this window is flagged for
// review, unless the author has set staleExempt. `revised` is stamped server-side.
const STALE_MS=72*3600*1000; // 72 hours
function projectFeature(name){ return !PROJECT_SETTINGS.features || PROJECT_SETTINGS.features[name] !== false; }
function allowEdits(){ return projectFeature('allowEdits'); }
function inDesktopShell(){ return !!(window.clad0Desktop && window.clad0Desktop.isShell); }
function revisedStamp(n){ const v=n&&n.revised; if(v===''||v==null) return 0; const x=Number(v); return Number.isFinite(x)?x:0; }
function hasProperRevised(n){ return revisedStamp(n)>0; }
function isStale(n){ if(!projectFeature('staleTrackingEnabled') || !n || n.staleExempt) return false; const rv=revisedStamp(n); return rv===0 || (Date.now()-rv > STALE_MS); }
function fmtDateTime(ts){ const x=Number(ts); if(!Number.isFinite(x)||x<=0) return 'Unknown / never saved'; try{return new Date(x).toLocaleString();}catch(_){return 'Unknown / never saved';} }
let SHELL_THEME='parchment';
function shellEditorCss(){
  const m={
    'wiki-whitepage':'.edit-card,.modal-overlay .edit-card,#edit-panel .edit-card{color:#202122;background:#fff;border-color:#a2a9b1;border-radius:2px;box-shadow:none;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif}.edit-card input,.edit-card textarea,.edit-card select,.rank-style-button{color:#202122;background:#fff;border-color:#a2a9b1;border-radius:2px}.edit-card button{border-radius:2px}.edit-card .rank-stamp,.edit-card .tag-stamp,.edit-card .ebadge{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif!important;border-radius:2px!important;letter-spacing:.02em!important;text-transform:none!important}.edit-card .rank-style-list{background:#fff;border-color:#a2a9b1;box-shadow:0 2px 8px rgba(0,0,0,.18)}.edit-card .rank-style-option:hover{background:#eaecf0!important}',
    'discord-dark':'.edit-card,.modal-overlay .edit-card,#edit-panel .edit-card{color:#f2f3f5;background:#2b2d31;border-color:#3f4147;box-shadow:0 18px 48px rgba(0,0,0,.35);font-family:Inter,Segoe UI,system-ui,sans-serif}.edit-card input,.edit-card textarea,.edit-card select,.rank-style-button{color:#f2f3f5;background:#1e1f22;border-color:#4e5058}.edit-card button{background:#5865f2;color:#fff;border-color:#5865f2}.edit-card .rank-stamp,.edit-card .tag-stamp,.edit-card .ebadge{font-family:Inter,Segoe UI,system-ui,sans-serif!important;border-radius:8px!important;letter-spacing:.01em!important;text-transform:none!important}.edit-card .rank-style-list{background:#1e1f22;border-color:#4e5058;box-shadow:0 12px 32px rgba(0,0,0,.45)}.edit-card .rank-style-option:hover{background:#404249!important}',
    'scifi-solar':'.edit-card,.modal-overlay .edit-card,#edit-panel .edit-card{color:#eee8d5;background:#073642;border-color:#0f4b5a;box-shadow:0 0 32px rgba(38,139,210,.16);font-family:Segoe UI,system-ui,sans-serif}.edit-card input,.edit-card textarea,.edit-card select,.rank-style-button{color:#eee8d5;background:#002b36;border-color:#0f4b5a}.edit-card button{background:#268bd2;color:#fdf6e3;border-color:#2aa198}.edit-card .rank-stamp,.edit-card .tag-stamp,.edit-card .ebadge{font-family:Segoe UI,system-ui,sans-serif!important;border-radius:999px!important}.edit-card .rank-style-list{background:#073642;border-color:#0f4b5a;box-shadow:0 0 32px rgba(38,139,210,.18)}.edit-card .rank-style-option:hover{background:rgba(38,139,210,.18)!important}',
    'parchment':'.edit-card,.modal-overlay .edit-card,#edit-panel .edit-card{color:#2b1c0f;background:#fff8ec;border-color:#b98a52}.edit-card input,.edit-card textarea,.edit-card select,.rank-style-button{color:#22170c;background:#fffdf8}.edit-card .rank-stamp,.edit-card .tag-stamp,.edit-card .ebadge{font-family:Cinzel,serif!important;border-radius:999px!important}'
  };
  return m[SHELL_THEME]||m.parchment;
}
function ensureShellOverrideStyle(){ let st=document.getElementById('app-shell-override-css'); if(!st){ st=document.createElement('style'); st.id='app-shell-override-css'; document.head.appendChild(st); } st.textContent=shellEditorCss(); document.head.appendChild(st); }
async function loadShellTheme(){ try{ if(inDesktopShell()&&window.clad0Desktop.getShellTheme){ SHELL_THEME=await window.clad0Desktop.getShellTheme()||'parchment'; ensureShellOverrideStyle(); } }catch(e){ ensureShellOverrideStyle(); } }

function loadThemeLink(href){ let l=document.getElementById('project-theme-css'); if(!href){ if(l) l.remove(); } else { if(!l){ l=document.createElement('link'); l.id='project-theme-css'; l.rel='stylesheet'; document.head.appendChild(l); } l.href=href; } if(inDesktopShell()) ensureShellOverrideStyle(); else { const st=document.getElementById('app-shell-override-css'); if(st) st.remove(); } }
function applyProjectSettings(){ const a=PROJECT_SETTINGS.appearance||{}, f=PROJECT_SETTINGS.features||{}; document.body.classList.toggle('feature-readonly', f.allowEdits===false); document.body.classList.toggle('feature-sunburst-off', f.sunburstEnabled===false); document.body.classList.toggle('feature-stats-off', f.statsEnabled===false); document.body.classList.toggle('feature-media-off', f.mediaEnabled===false); document.body.classList.toggle('feature-stale-off', f.staleTrackingEnabled===false); if(a.theme==='custom') loadThemeLink('/api/custom-theme.css'); else if(a.theme) loadThemeLink('/themes/'+encodeURIComponent(a.theme)+'.css'); else loadThemeLink(''); const sb=document.getElementById('btn-sunburst'); if(sb) sb.disabled = f.sunburstEnabled===false; document.querySelectorAll('[data-edit-action]').forEach(function(b){ b.disabled = f.allowEdits===false; }); if(f.sunburstEnabled===false && sunburstOn) setSunburst(false); }
async function loadProjectSettings(){ try{ const r=await fetch('/api/project-settings'); if(r.ok){ const d=await r.json(); PROJECT_SETTINGS=d.settings||PROJECT_SETTINGS; applyProjectSettings(); } }catch(e){} }
window.addEventListener('project-settings:updated', loadProjectSettings);
window.addEventListener('entry:saved', function(ev){
  const id=ev.detail&&ev.detail.id;
  if(!id || (sel && sel.id===id)) reloadTreeAndSelect(id || (sel&&sel.id));
});


// Mirror of the server's DETAIL_KEYS, for estimating prose size of un-chunked nodes.
const CLIENT_DETAIL_KEYS=['summary','tax','ap','eco','ecology','beh','behavior',
  'traitsText','traits','abilities','abil','bg','background','g','note'];

function fmtBytes(b){
  if(!b) return '';
  if(b<1024) return b+'b';
  if(b<1024*1024) return Math.round(b/1024)+'kb';
  return (b/1048576).toFixed(1)+'mb';
}

// Best-effort prose size for a node: the chunked file size if known, else the
// JSON length of any prose still inline on the tree node (legacy/un-chunked).
function proseBytes(n){
  const m=META[n.id];
  if(m&&m.chunked) return m.bytes||0;
  let b=0;
  for(const k of CLIENT_DETAIL_KEYS){ if(k in n && n[k]!=null) b+=JSON.stringify(n[k]).length; }
  return b;
}
function isChunked(n){ const m=META[n.id]; return !!(m&&m.chunked); }

function cssEscape(s){ return (window.CSS && CSS.escape) ? CSS.escape(String(s)) : String(s).replace(/["\\\]]/g,'\\$&'); }

async function loadMeta(){
  try{ const r=await fetch('/api/meta'); if(r.ok) META=await r.json(); }
  catch(e){ /* indicators degrade to inline estimates */ }
}

// Flags: a single string of human labels separated by ';' (or ','). Each becomes
// its own chip with a stable colour derived from its slug. Legacy `css` honoured.
function flagSlug(s){ return String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }
function flagHue(slug){ let h=0; for(let i=0;i<slug.length;i++) h=(h*31+slug.charCodeAt(i))%360; return h; }
function parseFlags(n){
  const raw=(n.flags!=null?n.flags:(n.css||''));
  return String(raw).split(/[;,]/).map(s=>s.trim()).filter(Boolean).map(label=>{
    const slug=flagSlug(label)||'flag';
    return { label, slug, hue:flagHue(slug) };
  });
}

const RANK_ORDER=['Domain','Kingdom','Phylum','Class','Order','Family','Genus','Species','Subspecies'];
const RANK_STYLE_OPTIONS=[
  {id:'style-1',label:'Plum'},
  {id:'style-2',label:'Rust'},
  {id:'style-3',label:'Amber'},
  {id:'style-4',label:'Moss'},
  {id:'style-5',label:'Teal'},
  {id:'style-6',label:'Steel'},
  {id:'style-7',label:'Indigo'},
  {id:'style-8',label:'Violet'}
];
function normalizeRankStyle(v){
  const x=String(v||'').trim();
  const legacy={Domain:'style-1',Kingdom:'style-2',Phylum:'style-3',Class:'style-4',Order:'style-5',Family:'style-6',Genus:'style-7',Species:'style-8',Subspecies:'style-8'};
  return legacy[x] || x || 'style-8';
}
function rankStyleLabel(v){ const x=normalizeRankStyle(v); const o=RANK_STYLE_OPTIONS.find(r=>r.id===x); return o?o.label:'Style'; }
// Deific section ranks — gods are not "genera" and pantheons are not "phyla".
const DEIFIC_RANKS=['Pantheon','Major Deity','Deity','Minor Deity','Demigod',
  'Archdevil','Archdemon','Archangel','Archfey','Avatar','Divine Servitor'];
const ALL_RANKS=[...RANK_ORDER, ...DEIFIC_RANKS];
function rankIndex(r){const i=ALL_RANKS.indexOf(r);return i===-1?ALL_RANKS.length:i;}
function isDeific(r){ return DEIFIC_RANKS.indexOf(r)!==-1; }
// Legal options for the rank dropdown; preserves any unusual existing value.
function rankOptions(current){
  const opts=[...RANK_ORDER, ...DEIFIC_RANKS];
  if(current==null) current='';
  if(opts.indexOf(current)===-1) opts.unshift(current);
  return opts;
}

function indexTree(n,kg,path){
  const myKg=n.r==="Kingdom"?n.n:kg;
  n._kg=myKg;n._path=path||[];
  if(myKg&&KC[myKg]) kgColor[n.id]=KC[myKg];
  else if(n.r==="Primordial Vestige") kgColor[n.id]="#18183a";
  nodeMap[n.id]=n;
  (n.c||[]).forEach(ch=>indexTree(ch,myKg,[...n._path,{id:n.id,n:n.n}]));
}

function vis(n){
  if(!sG&&n.gorge) return false;
  if(!sC&&n.ctx) return false;
  if(!sT&&n.theorized) return false;
  if(!sCu&&n.curse) return false;
  if(searchQ){const q=searchQ.toLowerCase();
    if(n.n&&n.n.toLowerCase().includes(q)) return true;
    if((n.sn||"").toLowerCase().includes(q)) return true;
    if((n.tag||"").toLowerCase().includes(q)) return true;
    return parseFlags(n).some(f=>f.label.toLowerCase().includes(q));}
  return true;
}
function anyVis(n){if(vis(n)) return true;return (n.c||[]).some(ch=>anyVis(ch));}

function rankClass(r){
  const v=String(r||'').trim();
  if(/^style-[0-9]+$/i.test(v)) return 'rank-'+v.toLowerCase();
  return 'rank-'+String(v||'style-8').toLowerCase().replace(/[^a-z0-9]+/g,'-');
}
function tagClass(t){
  return 'tag-'+String(t||'reference').toLowerCase().replace(/[^a-z0-9]+/g,'-');
}
function rankStyleValue(n){
  return normalizeRankStyle((n && n.rankStyle) || 'style-8');
}
function displayClass(n){
  return n.tag ? tagClass(n.tag) : rankClass(rankStyleValue(n));
}
function displayLabel(n){
  if(n.tag){const t=String(n.tag);return t==='Reference'?'ref':t==='Catalogue'?'cat':t.substring(0,5).toLowerCase();}
  return String(n.r||'entry').slice(0,16);
}
function displayType(n){return n.tag||n.r||'Entry';}


/* ── TREE BUILD ── */
const TI=document.getElementById('tree-inner');

function buildNode(n,depth){
  if(!anyVis(n)) return null;
  const wrap=document.createElement('div');
  const row=document.createElement('div');
  const _hasSheet=(META[n.id]&&META[n.id].stats);
  // Custom flags are intentionally NOT shown in the tree (kept for search only).
  row.className='trow'+(_hasSheet?' has-statsheet':'')+(isStale(n)?' is-stale':'');
  row.dataset.id=n.id;

  for(let i=0;i<depth;i++){
    const d=document.createElement('div');d.className='tind';row.appendChild(d);
  }
  const hasKids=(n.c||[]).filter(ch=>anyVis(ch)).length>0;
  const car=document.createElement('div');
  car.className='tcar'+(expanded.has(n.id)?' open':'')+(hasKids?'':' leaf');
  car.innerHTML='&#9654;';
  row.appendChild(car);

  const lbl=document.createElement('div');lbl.className='tlbl';
  const rk=n.r||'';
  const rkEl=document.createElement('span');rkEl.className='trank '+displayClass(n)+(n.theorized?' inferred':'');
  rkEl.textContent=displayLabel(n);
  rkEl.title=n.tag ? ('Tree marker: '+n.tag) : ('Rank: '+rk+'; style: '+rankStyleLabel(rankStyleValue(n)));
  lbl.appendChild(rkEl);

  const nm=document.createElement('span');
  let nc='tname '+rankClass(rankStyleValue(n)||rk);
  if(n.tag==='Reference'||n.tag==='Catalogue') nc+=' ref';
  else if(rk==='Domain'||rk==='Kingdom') nc+=' kg';
  else if(rk==='Species') nc+=' sp';
  if(n.fossil&&!n.theorized) nc+=' ext';
  if(n.theorized) nc+=' theo';
  if(n.ctx) nc+=' ctx';
  nm.className=nc;
  nm.appendChild(document.createTextNode(namePrefixText(n)+n.n));
  if(searchQ&&n.n.toLowerCase().includes(searchQ.toLowerCase())) row.classList.add('hl');
  lbl.appendChild(nm);

  // status dots
  const dots=document.createElement('div');dots.className='tdots';
  const kc=kgColor[n.id];
  if(n.gorge){const d=document.createElement('div');d.className='tdot';d.style.background=kc||'#aa8640';d.title='Present in Gorge';dots.appendChild(d);}
  if(n.curse){const d=document.createElement('div');d.className='tdot';d.style.background='#8b3a6a';d.title='Curse/transformation';dots.appendChild(d);}
  if(n.conv){const d=document.createElement('div');d.className='tdot';d.style.background='#2a6a8a';d.title='Convergent morphology';dots.appendChild(d);}
  lbl.appendChild(dots);

  // automatic stale flag (system flag — shown in the tree; custom flags are not)
  if(isStale(n)){
    const st=document.createElement('span');st.className='tstale';st.textContent='stale';
    st.title='No revision in 72h — due for revision';
    lbl.appendChild(st);
  }

  // attachment / chunk indicators
  const ind=document.createElement('div');ind.className='tind-marks';
  const m=META[n.id]||{};
  if(projectFeature('statsEnabled') && m.stats){const s=document.createElement('span');s.className='tmark tmark-stats';s.textContent='▤';s.title='Has monster stat sheet';ind.appendChild(s);}
  if(projectFeature('mediaEnabled') && m.img){const im=document.createElement('span');im.className='tmark tmark-img';im.textContent='◳';im.title='Has species image graphic';ind.appendChild(im);}
  // Deprecated hardcoded banner markers are no longer rendered; use image custom fields instead.
  const chunk=document.createElement('span');
  chunk.className='tmark tmark-chunk '+(isChunked(n)?'is-chunked':'not-chunked');
  chunk.textContent=isChunked(n)?'◆':'◇';
  chunk.title=isChunked(n)?'Prose chunked to its own file':'Prose not yet chunked (inline)';
  ind.appendChild(chunk);
  lbl.appendChild(ind);

  // prose size pill (banded), then separate image/banner size pills
  const sz=proseBytes(n);
  if(sz){const z=document.createElement('span');z.className='tsize band-'+proseBand(sz);z.textContent=fmtBytes(sz);z.title='Prose size';lbl.appendChild(z);}
  else {const z=document.createElement('span');z.className='tsize band-empty';z.textContent='—';z.title='No prose yet';lbl.appendChild(z);}
  if(projectFeature('mediaEnabled') && m.imgBytes){const z=document.createElement('span');z.className='tsize tsize-img';z.textContent='◳'+fmtBytes(m.imgBytes);z.title='Species image size';lbl.appendChild(z);}
  // Deprecated hardcoded banner size pills are no longer rendered; use image custom fields instead.

  row.appendChild(lbl);

  const cw=document.createElement('div');
  cw.className='tchildren'+(expanded.has(n.id)?' open':'');

  row.addEventListener('click',e=>{
    e.stopPropagation();
    selectNode(n);
    if(hasKids){
      if(expanded.has(n.id)){expanded.delete(n.id);car.classList.remove('open');cw.classList.remove('open');}
      else{expanded.add(n.id);car.classList.add('open');cw.classList.add('open');}
    }
  });

  // ── drag & drop: reorder among siblings (top/bottom edge) or reparent (middle) ──
  row.draggable=true;
  row.addEventListener('dragstart',e=>{
    e.stopPropagation();
    dragId=n.id;
    e.dataTransfer.effectAllowed='move';
    try{e.dataTransfer.setData('text/plain',n.id);}catch(_){}
    row.classList.add('dragging');
  });
  row.addEventListener('dragend',()=>{
    row.classList.remove('dragging');
    clearDropMarks();
    dragId=null;
  });
  row.addEventListener('dragover',e=>{
    if(!dragId||dragId===n.id) return;
    if(clientIsDescendant(nodeMap[dragId],n.id)) return; // can't drop into own subtree
    e.preventDefault();e.stopPropagation();
    e.dataTransfer.dropEffect='move';
    const zone=dropZone(e,row);
    row.classList.remove('drop-before','drop-inside','drop-after');
    row.classList.add('drop-'+zone);
  });
  row.addEventListener('dragleave',()=>{
    row.classList.remove('drop-before','drop-inside','drop-after');
  });
  row.addEventListener('drop',e=>{
    if(!dragId||dragId===n.id) return;
    e.preventDefault();e.stopPropagation();
    const zone=dropZone(e,row);
    const from=dragId;
    row.classList.remove('drop-before','drop-inside','drop-after');
    performTreeDrop(from,n.id,zone);
  });

  wrap.appendChild(row);
  (n.c||[]).forEach(ch=>{
    if(!anyVis(ch)) return;
    const cv=buildNode(ch,depth+1);
    if(cv) cw.appendChild(cv);
  });
  wrap.appendChild(cw);
  return wrap;
}

function rerenderTree(){
  TI.innerHTML='';
  const r=buildNode(ROOT,0);
  if(r) TI.appendChild(r);
  // update node count
  let v=0;function cv2(n){if(vis(n))v++;(n.c||[]).forEach(cv2);}cv2(ROOT);
}

/* ── DETAIL RENDER ── */
// FIFO client cache for loaded prose. Long sessions can open hundreds of
// entries; once the total cached prose exceeds the budget, the oldest entries'
// bulk fields are dropped (their light tree fields stay), to be refetched on
// demand. The currently-open entry is never evicted.
let _detailCache = [];
let _detailCacheBytes = 0;
const DETAIL_CACHE_BUDGET = 2 * 1024 * 1024; // ~2 MB of prose
function nodeProseKeys(n){
  const ks = CLIENT_DETAIL_KEYS.slice();
  if (Array.isArray(n.fields)) for (const f of n.fields) if (f && f.type === 'prose' && f.key) ks.push(f.key);
  return ks;
}
function nodeProseBytes(n){
  let b = 0;
  for (const k of nodeProseKeys(n)) if (k in n && n[k] != null) b += JSON.stringify(n[k]).length;
  return b;
}
function evictDetailCache(){
  let guard = _detailCache.length;
  while (_detailCacheBytes > DETAIL_CACHE_BUDGET && _detailCache.length > 1 && guard-- > 0) {
    const old = _detailCache.shift();
    const node = nodeMap[old.id];
    if (node && sel && sel.id === old.id) { _detailCache.push(old); continue; } // keep the open entry
    _detailCacheBytes -= old.bytes;
    if (node) {
      for (const k of nodeProseKeys(node)) delete node[k];
      node._detailLoaded = false;
    }
  }
}

async function ensureDetailLoaded(n){
  if(!n||n._detailLoaded) return;
  try{
    const res=await fetch('/api/node/'+encodeURIComponent(n.id));
    if(res.ok){
      const data=await res.json();
      for(const [k,v] of Object.entries(data)){
        if(k==='c'||k.charAt(0)==='_') continue; // keep tree structure & computed fields
        n[k]=v;
      }
    }
  }catch(e){ /* offline: render whatever is already in memory */ }
  n._detailLoaded=true;
  const bytes = nodeProseBytes(n);
  _detailCache.push({ id: n.id, bytes });
  _detailCacheBytes += bytes;
  evictDetailCache();
}

function selectNode(n){
  sel=n;

  document.querySelectorAll('.trow.sel').forEach(r=>r.classList.remove('sel'));

  const row=document.querySelector(`.trow[data-id="${n.id}"]`);
  if(row) row.classList.add('sel');

  // Render immediately from what we have; if prose isn't loaded yet, fetch the
  // node's detail file and re-render once it arrives.
  renderDetail(n);
  ensureEntryActionButtons();
  if(!n._detailLoaded){
    ensureDetailLoaded(n).then(()=>{
      if(sel!==n) return;
      renderDetail(n);
      ensureEntryActionButtons();
    });
  }
}

function entryNo(n){
  if(n._entryNo) return n._entryNo;
  let h=2166136261;
  const s=String(n.id||n.n||'taxon');
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
  n._entryNo=String(h%100000).padStart(5,'0');
  return n._entryNo;
}
function firstPara(s){return (s&&String(s).trim())?String(s):'';}
function jsArg(s){return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");}

function namePrefixText(n){return (n.theorized?'?  ':'')+(n.fossil&&!n.theorized?'† ':'');}
function escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function flaggedNameHTML(n,prefix){
  return escHtml(prefix||'')+escHtml(n.n||'');
}
/* ── 5e MONSTER STAT BLOCK ──────────────────────────────────────────────── */
// The lore/system is 3.5e/Pathfinder, but stat sheets use 5e formatting.
const SB_SIZES=['Tiny','Small','Medium','Large','Huge','Gargantuan'];
const SB_ABILITIES=[['str','STR'],['dex','DEX'],['con','CON'],['int','INT'],['wis','WIS'],['cha','CHA']];
const SB_LISTS=[['traits','Traits'],['actions','Actions'],['bonus','Bonus Actions'],['reactions','Reactions'],['legendary','Legendary Actions']];
const SB_SPEED_TYPES=['walk','burrow','climb','fly','swim'];
const SB_SAVE_STATES=[['','—'],['prof','proficient'],['expertise','expertise']];
const SB_SKILL_STATES=[['','—'],['half','½ prof'],['prof','proficient'],['expertise','expertise']];
// skill → governing ability
const SB_SKILLS=[
  ['Acrobatics','dex'],['Animal Handling','wis'],['Arcana','int'],['Athletics','str'],
  ['Deception','cha'],['History','int'],['Insight','wis'],['Intimidation','cha'],
  ['Investigation','int'],['Medicine','wis'],['Nature','int'],['Perception','wis'],
  ['Performance','cha'],['Persuasion','cha'],['Religion','int'],['Sleight of Hand','dex'],
  ['Stealth','dex'],['Survival','wis']
];
// indefinite-length inline fields (stored as arrays; legacy strings tolerated)
const SB_INLINE=[
  ['damageVuln','Damage Vulnerabilities'],['damageRes','Damage Resistances'],
  ['damageImm','Damage Immunities'],['condImm','Condition Immunities'],
  ['senses','Senses'],['languages','Languages']
];
// Unique-entity sections (rendered after the action groups).
const SB_UNIQUE_LISTS=[['mythic','Mythic Actions'],['lair','Lair Actions'],['regional','Regional Effects']];
const SB_SPELL_ABILITIES=['INT','WIS','CHA'];
const CR_XP={ '0':10,'1/8':25,'1/4':50,'1/2':100,'1':200,'2':450,'3':700,'4':1100,'5':1800,'6':2300,
  '7':2900,'8':3900,'9':5000,'10':5900,'11':7200,'12':8400,'13':10000,'14':11500,'15':13000,'16':15000,
  '17':18000,'18':20000,'19':22000,'20':25000,'21':33000,'22':41000,'23':50000,'24':62000,'25':75000,
  '26':90000,'27':105000,'28':120000,'29':135000,'30':155000 };
function abilMod(score){ const s=parseInt(score,10); if(isNaN(s)) return null; return Math.floor((s-10)/2); }
function fmtMod(m){ return m==null?'—':(m>=0?'+'+m:''+m); }
function hpAverage(formula){
  if(!formula) return null;
  const m=String(formula).replace(/\s+/g,'').match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if(!m) return null;
  const x=+m[1], y=+m[2], mod=m[3]?+m[3]:0;
  return Math.floor(x*(y+1)/2)+mod;
}
function parseCR(cr){ if(cr==null||cr==='') return null; const s=String(cr).trim();
  if(s==='1/8')return .125; if(s==='1/4')return .25; if(s==='1/2')return .5;
  const v=parseFloat(s); return isNaN(v)?null:v; }
// Derived proficiency bonus from CR (manual `pb` override wins if present).
function profBonus(stats){
  if(stats && stats.pb!=null && String(stats.pb).trim()!==''){ const p=parseInt(stats.pb,10); if(!isNaN(p)) return p; }
  const v=parseCR(stats&&stats.cr); if(v==null||v<1) return 2; return Math.floor((v-1)/4)+2;
}
// Accept an array, or a legacy comma-separated string, → array of strings.
function asList(v){ if(Array.isArray(v)) return v.map(x=>String(x).trim()).filter(Boolean);
  if(v==null||v==='') return []; return String(v).split(/,\s*/).map(s=>s.trim()).filter(Boolean); }
// Normalize a list to [{name,text}], tolerating legacy string entries.
function nameTextList(v){
  if(!Array.isArray(v)) return [];
  return v.map(it=> typeof it==='string' ? {name:it,text:''} : {name:(it&&it.name)||'',text:(it&&it.text)||''})
          .filter(it=> (it.name&&it.name.trim()) || (it.text&&it.text.trim()) );
}
function sbList(items){
  const list=nameTextList(items);
  if(!list.length) return '';
  return list.map(it=>{
    const body=(it.text&&it.text.trim()) ? (' '+renderAbilitiesMarkdown(it.text)) : '';
    return '<div class="sb-entry"><span class="sb-entry-name">'+escHtml(it.name||'')+(it.name?'.':'')+'</span>'+body+'</div>';
  }).join('');
}
function sbProp(label, val){ return val?('<div class="sb-prop"><span class="sb-label">'+label+'</span> '+escHtml(val)+'</div>'):''; }

// Equipment: compact inline list of bare names, or a full section when any
// item carries a description (artifacts, signature gear of unique entities).
function renderEquipment(s){
  const eq=nameTextList(s.equipment);
  if(!eq.length) return {inline:'', section:''};
  const anyText=eq.some(it=>it.text&&it.text.trim());
  if(!anyText) return {inline:sbProp('Equipment', eq.map(it=>it.name).join(', ')), section:''};
  return {inline:'', section:'<div class="sb-section-head">Equipment</div>'+sbList(eq)};
}
function renderWealth(s){
  if(!s.wealth||!String(s.wealth).trim()) return '';
  return '<div class="sb-section-head">Wealth</div><div class="sb-entry">'+renderAbilitiesMarkdown(s.wealth)+'</div>';
}

function renderSpeeds(s){
  if(Array.isArray(s.speeds)&&s.speeds.length){
    return s.speeds.filter(x=>x&&x.value).map(x=>{
      const t=(x.type&&x.type!=='walk')?(x.type+' '):''; return t+x.value;
    }).join(', ');
  }
  return s.speed||'';
}
function renderSaves(s, pb){
  if(s.saves && typeof s.saves==='object' && !Array.isArray(s.saves)){
    const parts=[];
    SB_ABILITIES.forEach(function(p){ const k=p[0], lab=p[1]; const st=s.saves[k];
      if(!st||st==='none'||st==='') return;
      const mod=abilMod(s[k])||0; const add=(st==='expertise')?2*pb:pb;
      parts.push(lab.charAt(0)+lab.slice(1).toLowerCase()+' '+fmtMod(mod+add)); });
    return parts.join(', ');
  }
  return typeof s.saves==='string'?s.saves:'';
}
function renderSkills(s, pb){
  if(Array.isArray(s.skills)){
    return s.skills.filter(x=>x&&x.skill&&x.state&&x.state!=='none'&&x.state!=='').map(function(x){
      const def=SB_SKILLS.find(function(d){return d[0]===x.skill;}); const abil=def?def[1]:'wis';
      const mod=abilMod(s[abil])||0;
      const add=(x.state==='expertise')?2*pb:(x.state==='half')?Math.floor(pb/2):pb;
      return x.skill+' '+fmtMod(mod+add);
    }).join(', ');
  }
  return typeof s.skills==='string'?s.skills:'';
}
function renderSpellcasting(s, pb){
  const sc=s.spellcasting; if(!s.hasSpells||!sc) return '';
  const abilKey=(sc.ability||'INT').toLowerCase(); const mod=abilMod(s[abilKey])||0;
  const dc=8+pb+mod, atk=pb+mod;
  const intro = (sc.note && sc.note.trim()) ? sc.note :
    ('This creature is a'+(sc.level?(' '+sc.level):'')+' spellcaster. Its spellcasting ability is '+
     (sc.ability||'INT')+' (spell save DC '+dc+', '+fmtMod(atk)+' to hit with spell attacks). It has the following spells prepared:');
  let h='<div class="sb-entry"><span class="sb-entry-name">Spellcasting.</span> '+renderAbilitiesMarkdown(intro)+'</div>';
  (Array.isArray(sc.slots)?sc.slots:[]).forEach(function(L){
    if(L&&(L.label||L.spells)) h+='<div class="sb-spell-line"><span class="sb-spell-l">'+escHtml(L.label||'')+':</span> '+escHtml(L.spells||'')+'</div>';
  });
  return h;
}
function renderStatblock(s){
  s=s||{};
  const pb=profBonus(s);
  let h='<div class="sb">';
  // title row — name left, CR floated opposite, right
  h+='<div class="sb-titlerow"><div class="sb-title">'+escHtml(s.name||'Unnamed Creature')+'</div>';
  if(s.cr){ const xp=CR_XP[String(s.cr).trim()];
    h+='<div class="sb-cr"><span class="sb-cr-l">CR</span><span class="sb-cr-v">'+escHtml(''+s.cr)+'</span>'+
       (xp?('<span class="sb-cr-xp">'+xp.toLocaleString()+' XP</span>'):'')+'</div>'; }
  h+='</div>';
  const sub=[s.size,s.type].filter(Boolean).join(' ')+(s.alignment?(', '+s.alignment):'');
  if(sub.trim()) h+='<div class="sb-sub">'+escHtml(sub)+'</div>';
  if(s.epithet&&s.epithet.trim()) h+='<div class="sb-epithet">'+escHtml(s.epithet)+'</div>';
  h+='<div class="sb-rule"></div>';
  if(s.ac) h+=sbProp('Armor Class', s.ac+(s.acNote?(' ('+s.acNote+')'):''));
  if(s.hpFormula||s.hp){ const avg=hpAverage(s.hpFormula); h+=sbProp('Hit Points',(avg!=null?avg:(s.hp||''))+(s.hpFormula?(' ('+s.hpFormula+')'):'')); }
  const sp=renderSpeeds(s); if(sp) h+=sbProp('Speed', sp);
  h+='<div class="sb-rule"></div>';
  h+='<div class="sb-abilities">';
  SB_ABILITIES.forEach(function(pair){
    const k=pair[0], lab=pair[1]; const sc=s[k]; const mod=abilMod(sc);
    h+='<div class="sb-ab"><div class="sb-ab-l">'+lab+'</div><div class="sb-ab-v">'+(sc!=null&&sc!==''?escHtml(''+sc):'—')+' ('+fmtMod(mod)+')</div></div>';
  });
  h+='</div>';
  h+='<div class="sb-rule"></div>';
  const saves=renderSaves(s,pb); if(saves) h+=sbProp('Saving Throws', saves);
  const skills=renderSkills(s,pb); if(skills) h+=sbProp('Skills', skills);
  SB_INLINE.forEach(function(p){ const arr=asList(s[p[0]]); if(arr.length) h+=sbProp(p[1], arr.join(', ')); });
  const equip=renderEquipment(s);
  if(equip.inline) h+=equip.inline;       // bare-name gear sits with the other props
  h+=sbProp('Proficiency Bonus', fmtMod(pb));
  // Wealth + rich (described) equipment as their own blocks
  const wealth=renderWealth(s);
  if(wealth||equip.section) h+='<div class="sb-rule"></div>'+wealth+equip.section;
  // Traits (incl. spellcasting), then the action groups
  const traitBody=sbList(s.traits)+renderSpellcasting(s,pb);
  if(traitBody) h+='<div class="sb-rule"></div>'+traitBody;
  [['actions','Actions'],['bonus','Bonus Actions'],['reactions','Reactions'],['legendary','Legendary Actions']].forEach(function(p){
    const body=sbList(s[p[0]]); if(body){ h+='<div class="sb-section-head">'+p[1]+'</div>'+body; }
  });
  // Unique-entity sections: mythic actions, lair actions, regional effects
  SB_UNIQUE_LISTS.forEach(function(p){
    const body=sbList(s[p[0]]); if(body){ h+='<div class="sb-section-head">'+p[1]+'</div>'+body; }
  });
  h+='</div>';
  return h;
}

function sectionText(n,key){

  const name=n.n||'This entry'; const rank=n.tag?('tagged '+n.tag):(n.r||'entry'); const kg=(!n.tag&&n._kg)?(' in the '+n._kg+' kingdom'):'';
  if(key==='summary') return firstPara(n.summary||n.g)||name+' is recorded as a '+rank+kg+' in this exact branch of the index; the entry should describe this topic only, not neighbouring branches.';
  if(key==='tax') return firstPara(n.tax)||name+' is classified at '+rank+' rank. Add diagnostic ancestry, rank criteria, and differences from neighbouring taxa before treating this entry as settled.';
  if(key==='appearance') return firstPara(n.ap)||'Diagnostic appearance has not yet been fully described. Add silhouette, proportions, skeletal markers, integument, gait, eyeshine, scent, and non-colour traits.';
  if(key==='ecology') return firstPara(n.eco||n.ecology)||name+' ecology should be read from this taxon alone: its habitat, food or energy source, reproduction or formation, life stages, and local range are not borrowed from sibling entries.';
  if(key==='behavior') return firstPara(n.beh||n.behavior)||name+' behaviour belongs to this taxon specifically. Roles, guilds, castes, professions, and combat classes belong here as cultural notes unless they are biologically or metaphysically fixed.';
  if(key==='traits') return firstPara(n.traitsText||n.traits)||name+' traits are the stable characters of this taxon: body plan, senses, intelligence, size, resistances, vulnerabilities, language capacity, and environmental tolerances appropriate to this entry only.';
  if(key==='abilities') return firstPara(n.abilities||n.abil)||name+' abilities are limited to powers inherent to this exact taxon. Similar powers in siblings or parallel branches are not assumed unless this entry names them.';
  if(key==='background') return firstPara(n.bg||n.background)||name+' is included because it clarifies travel, ecology, descent, culture, danger, or comparison in the Throat record; its background remains attached to this topic rather than to a neighbouring taxon.';
  return '';
}
function addSection(title, text, cls=''){
  return '<section class="'+cls+'"><h3>'+title+'</h3>'+renderAbilitiesMarkdown(text)+'</section>';
}
// Configure marked once, if the library has been fetched into /vendor.
if (typeof window !== 'undefined' && window.marked && window.marked.setOptions) {
  window.marked.setOptions({ breaks: true, gfm: true });
}
// Markdown → HTML. Uses the `marked` library when present (sanitised with
// DOMPurify if that is also loaded); otherwise falls back to the built-in
// mini-renderer below, so the app works with or without the vendor libs.
function renderAbilitiesMarkdown(text){
  const src = String(text == null ? '' : text);
  if (!src.trim()) return '';
  if (window.marked) {
    try {
      const parse = window.marked.parse || window.marked;
      // Convert [[ ]] crosslinks to anchors BEFORE markdown — otherwise marked
      // consumes the brackets and the link markup never matches afterwards.
      const html = parse(linkifyCrosslinkMarkup(src));
      return window.DOMPurify ? window.DOMPurify.sanitize(html) : html;
    } catch (_) { /* fall through to the built-in renderer */ }
  }
  return basicMarkdown(src);
}
function basicMarkdown(text){
  let raw = String(text || '').trim();
  if (!raw) return '';

  // Normalize line endings.
  raw = raw.replace(/\r\n/g, '\n');

  // If ability names are written one after another without blank lines,
  // force a paragraph break before each bolded ability after the first.
  raw = raw.replace(/([^\n])\s+(\*\*[^*\n]+?\*\*)/g, '$1\n\n$2');

  return raw
    .split(/\n\s*\n/g)
    .map(block => {
      let safe = escHtml(block.trim());

      safe = safe.replace(/\*\*([^*]+?)\*\*/g, function(_, inner){
        return '<strong>' + inner.trim() + '</strong>';
      });

      safe = safe.replace(/__([^_]+?)__/g, function(_, inner){
        return '<strong>' + inner.trim() + '</strong>';
      });

      safe = safe.replace(/\n/g, '<br>');
      safe = linkifyCrosslinkMarkup(safe);

      return '<p>' + safe + '</p>';
    })
    .join('');
}

function addAbilitiesSection(title, text, cls='abilities-text'){
  return '<section class="'+cls+'"><h3>'+title+'</h3>'+renderAbilitiesMarkdown(text)+'</section>';
}

// ── MANUAL FIELD SCHEMA ──────────────────────────────────────────────────────
// An entry may carry `fields`: an ordered [{key,label,type,options?}] schema.
// When present it replaces the hardcoded taxa/guide layout. Types:
//   prose  → markdown body section      short → italic line in the header (like sn)
//   text   → short labelled body line    check → "Yes" badge line when true
//   select → labelled body line (from options)
const SCHEMA_FIELD_TYPES = [
  ['prose','Prose section'], ['short','Short line (header, italic)'],
  ['text','Short text line'], ['check','Checkbox'], ['select','Select (options)'],
  ['crosslink','Crosslinks (selected entries)'], ['sublinks','Sublinks (child entries)'],
  ['image','Image path/reference'], ['statblock','Statblock placeholder']
];
function hasFieldSchema(n){ return Array.isArray(n.fields); }
function schemaShortFields(n){ return hasFieldSchema(n) ? n.fields.filter(f => f && f.type === 'short') : []; }
// Resolve a stable id (sid) to its current node — crosslinks store the sid so
// they survive slug renames, and display the target's current name.
function nodeBySid(sid){
  if (!sid) return null;
  const clean = String(sid).replace(/^sid:/,'');
  for (const id in nodeMap) { const m = nodeMap[id]; if (m && m.sid === clean) return m; }
  return null;
}
function resolveEntryRef(ref){
  const raw=String(ref||'').trim(); if(!raw) return null;
  if(raw.startsWith('sid:')) return nodeBySid(raw.slice(4));
  return nodeMap[raw] || nodeBySid(raw) || null;
}
function displayRefForEditor(ref){ const n=resolveEntryRef(ref); return n?n.id:String(ref||'').replace(/^sid:/,''); }
function crosslinkSids(v){ return Array.isArray(v) ? v.filter(Boolean) : (v ? [v] : []); }
// Parse a comma-separated list of target slugs or sid: IDs into stable sids (rename-safe).
function crosslinkValueFromInput(str){
  return String(str || '').split(',').map(s => s.trim()).filter(Boolean).map(function(s){
    const node = resolveEntryRef(s);
    return node ? (node.sid || node.id) : s.replace(/^sid:/,'');
  });
}
function crosslinkRefsInMarkdown(text, mode){
  return String(text||'').replace(/\[\[([^\]]+)\]\]/g, function(all, inner){
    const parts=String(inner).split('|');
    const target=parts.shift().trim();
    const alias=parts.join('|').trim();
    const node=resolveEntryRef(target);
    if(mode==='store'){
      const stored=node ? ('sid:'+(node.sid||node.id)) : target;
      return '[['+stored+(alias?' | '+alias:'')+']]';
    }
    if(mode==='edit'){
      const shown=node ? node.id : target.replace(/^sid:/,'');
      return '[['+shown+(alias?' | '+alias:'')+']]';
    }
    return all;
  });
}
function encodeCrosslinkRefsForStorage(text){ return crosslinkRefsInMarkdown(text,'store'); }
function decodeCrosslinkRefsForEditor(text){ return crosslinkRefsInMarkdown(text,'edit'); }
function crosslinkAnchorHTML(target, alias){
  const node=resolveEntryRef(target);
  if(!node) return '<span class="xlink missing">'+escHtml(alias || target.replace(/^sid:/,''))+'</span>';
  const label=alias || node.n || node.id;
  return '<a class="xlink" data-jump="'+escHtml(node.id)+'" data-sid="'+escHtml(node.sid||'')+'">'+escHtml(label)+'</a>';
}
function linkifyCrosslinkMarkup(html){
  return String(html||'').replace(/\[\[([^\]]+)\]\]/g, function(all, inner){
    const parts=String(inner).split('|');
    const target=parts.shift().trim();
    const alias=parts.join('|').trim();
    return crosslinkAnchorHTML(target, alias || '');
  });
}
function crosslinkOptions(prefix, limit){
  const q=String(prefix||'').toLowerCase();
  const arr=Object.values(nodeMap).filter(n=>n&&n.id&&(!q || n.id.toLowerCase().includes(q) || (n.n||'').toLowerCase().includes(q))).slice(0, limit||12);
  return arr.map(n=>({id:n.id,sid:n.sid||'',name:n.n||n.id}));
}
function renderLinkList(nodes, emptyText){
  const list=(nodes||[]).filter(Boolean);
  if(!list.length) return '<div class="sub-list empty">'+escHtml(emptyText||'No linked entries.')+'</div>';
  let out='<div class="sub-list link-list">';
  list.forEach(function(ch){
    const cD=ch.fossil&&!ch.theorized,cT=ch.theorized;
    const cn='sub-name'+((ch.r==='Species'||ch.r==='Subspecies')?' sp':'')+(cD?' ext':'')+(cT?' theo':'');
    const dot='<span class="sub-dot" style="background:'+(kgColor[ch.id]||'#8a6a35')+';'+(ch.ctx?'opacity:.4':'')+'"></span>';
    out+='<div class="sub-item" onclick="jumpTo(\''+jsArg(ch.id)+'\')">'+dot+'<span class="'+cn+'">'+flaggedNameHTML(ch,(cT?'? ':'')+(cD?'† ':''))+'</span><span class="sub-rank">'+displayType(ch)+'</span></div>';
  });
  out+='</div>';
  return out;
}
function fieldLayoutStyle(f){
  const l=(f&&f.layout&&typeof f.layout==='object')?f.layout:{};
  const width=String(l.width||'100%');
  const valid=/^(25|33|34|50|66|67|75|100)%$/.test(width)?width:'100%';
  const overflow=(l.overflow==='scroll')?'auto':'visible';
  const basis = valid==='100%' ? '100%' : 'calc('+valid+' - 6px)';
  return 'flex:0 0 '+basis+';max-width:'+basis+';overflow:'+overflow+';'+(l.sticky?'position:sticky;top:12px;':'');
}
function fieldSectionStart(f, cls){ return '<div class="schema-field '+(cls||'')+'" data-field-key="'+escHtml(f.key||'')+'" style="'+fieldLayoutStyle(f)+'">'; }
function fieldEditButtonHTML(f){ if(!allowEdits() || !f || !f.key || f.type==='check') return ''; return '<button type="button" class="field-inline-edit" data-field-edit="'+escHtml(f.key)+'">Edit</button>'; }
function fieldHeadHTML(f){ return '<div class="e-head"><span>'+escHtml(f.label||f.key)+'</span>'+fieldEditButtonHTML(f)+'</div>'; }
function fieldH3HTML(f){ return '<h3><span>'+escHtml(f.label||f.key)+'</span>'+fieldEditButtonHTML(f)+'</h3>'; }
const FIELD_RENDERERS={};
function registerFieldRenderer(type, fn){ if(type && typeof fn==='function') FIELD_RENDERERS[type]=fn; }
if(typeof window!=='undefined') window.clad0RegisterFieldRenderer=registerFieldRenderer;
registerFieldRenderer('prose', function(n,f,v){ return v && String(v).trim() ? fieldSectionStart(f,'schema-prose')+'<section>'+fieldH3HTML(f)+renderAbilitiesMarkdown(v)+'</section></div>' : ''; });
registerFieldRenderer('check', function(){ return ''; });
registerFieldRenderer('crosslink', function(n,f,v){ const nodes=crosslinkSids(v).map(resolveEntryRef).filter(Boolean); return nodes.length ? fieldSectionStart(f,'schema-crosslink')+'<div class="e-section">'+fieldHeadHTML(f)+renderLinkList(nodes,'No linked entries.')+'</div></div>' : ''; });
registerFieldRenderer('sublinks', function(n,f){ const kids=(n.c||[]).filter(ch=>anyVis(ch)); return kids.length ? fieldSectionStart(f,'schema-sublinks')+'<div class="e-section">'+fieldHeadHTML(f)+renderLinkList(kids,'No child entries.')+'</div></div>' : ''; });
registerFieldRenderer('image', function(n,f,v){ const label=escHtml(f.label||f.key); return (v!=null && String(v).trim()) ? fieldSectionStart(f,'schema-image')+'<div class="e-section">'+fieldHeadHTML(f)+'<img class="schema-image-img" src="'+escHtml(String(v))+'" alt="'+label+'"></div></div>' : ''; });
registerFieldRenderer('statblock', function(n,f){ return fieldSectionStart(f,'schema-statblock')+'<div class="e-section">'+fieldHeadHTML(f)+'<div class="e-line">'+(projectFeature('statsEnabled')?'Uses this entry’s stat sheet.':'Stat sheets are disabled for this project.')+'</div></div></div>'; });
registerFieldRenderer('text', function(n,f,v){ return (v!=null && String(v).trim()) ? fieldSectionStart(f,'schema-line')+'<div class="e-section">'+fieldHeadHTML(f)+'<div class="e-line">'+escHtml(String(v))+'</div></div></div>' : ''; });
registerFieldRenderer('select', FIELD_RENDERERS.text);
function renderSchemaBody(n){
  let h = '<div class="schema-grid">';
  (n.fields || []).forEach(function(f){
    if (!f || !f.key || f.type === 'short') return;
    const renderer=FIELD_RENDERERS[f.type] || FIELD_RENDERERS.text;
    h += renderer(n, f, n[f.key]) || '';
  });
  h += '</div>';
  if (h === '<div class="schema-grid"></div>') h = '<section class="e-empty"><em>No content yet — open Edit to fill in this entry’s fields.</em></section>';
  return h;
}
function renderDetail(n){
  const rk=n.r||'';
  const tag=n.tag||'';
  const isDead=n.fossil&&!n.theorized;
  const isTheo=n.theorized;
  const kc=kgColor[n.id]||KC[n._kg]||'#7a5a28';

  document.getElementById('entry-label').textContent=
    n._path.length?n._path.map(p=>p.n).join(' › '):(tag||rk||'Entry');

  const etEl=document.getElementById('entry-title');
  let tc='entry-title';
  if(rk==='Species') tc+=' sp-name';
  if(isDead) tc+=' fossil-name';
  if(isTheo) tc+=' theo-name';
  etEl.className=tc;
  etEl.innerHTML='';
  etEl.appendChild(document.createTextNode((isTheo?'? ':'')+(isDead?'† ':'')+n.n));

  const erkEl=document.getElementById('entry-rank-line');
  erkEl.innerHTML='';
  const idc=document.createElement('span');idc.className='id-chip';idc.textContent='No. '+entryNo(n);erkEl.appendChild(idc);
  if(tag){
    const ts=document.createElement('span');ts.className='tag-stamp '+tagClass(tag);ts.textContent=tag;erkEl.appendChild(ts);
  } else if(rk){
    const rs=document.createElement('span');
    rs.className='rank-stamp '+rankClass(rankStyleValue(n))+(isTheo?' inferred':'')+(isDead?' fossil':isTheo?' theorized':'');
    rs.textContent=(rk||'entry').slice(0,16);
    erkEl.appendChild(rs);
  }
  const _shorts = hasFieldSchema(n)
    ? schemaShortFields(n).map(function(f){ return { key:f.key, label:f.label, val:n[f.key] }; })
    : (n.sn ? [{ key:'sn', label:'', val:n.sn }] : []);
  _shorts.forEach(function(s){
    if (!s.val) return;
    const sn=document.createElement('span');
    sn.className='entry-subname';
    sn.textContent=(s.key!=='sn' && s.label ? (s.label+': ') : '')+s.val;
    erkEl.appendChild(sn);
  });
  if(isDead){const t=document.createElement('span');t.className='rank-stamp fossil';t.textContent='† Extinct';erkEl.appendChild(t);}
  if(isTheo){const t=document.createElement('span');t.className='rank-stamp theorized';t.textContent='? Inferred — no specimen';erkEl.appendChild(t);}
  if(n.curse){const t=document.createElement('span');t.className='rank-stamp curse-tag';t.textContent='☠ Curse vector';erkEl.appendChild(t);}
  if(!tag&&n._kg&&rk!=='Kingdom'){
    const kg=document.createElement('span');
    kg.className='kg-line';
    kg.innerHTML='— <span class="kg-name">'+escHtml(n._kg)+'</span> Kingdom'; kg.style.setProperty('--kg-color', kc||'var(--muted)');
    erkEl.appendChild(kg);
  }
  document.getElementById('pgnum-left').textContent='Index';
  document.getElementById('pgnum-right').textContent=n.id;
  const rp=document.getElementById('right-page');
  rp.classList.remove('flip'); void rp.offsetWidth; rp.classList.add('flip');

  const _fl=parseFlags(n); const _flcls=_fl.map(f=>'flag-'+f.slug).join(' ');
  let html='<div id="entry-body-inner"'+(_flcls?(' class="'+_flcls+'"'):'')+'>';
  if(n._path&&n._path.length){
    const bc=n._path.map(p=>'<span class="pa" onclick="jumpTo(\''+jsArg(p.id)+'\')">'+p.n+'</span>').join(' › ');
    html+='<div class="e-path">'+bc+' › <strong class="path-current">'+escHtml(n.n)+'</strong></div>';
  }
  let badges='';
  if(tag) badges+='<span class="ebadge ctx">§ '+tag+'</span>';
  if(n.gorge) badges+='<span class="ebadge gorge">🌑 Present in the Gorge</span>';
  if(n.ctx) badges+='<span class="ebadge ctx">◌ Non-Gorge context</span>';
  if(isDead) badges+='<span class="ebadge fossil">† Extinct</span>';
  if(isTheo) badges+='<span class="ebadge theo">? Theorised — no specimen</span>';
  if(n.curse) badges+='<span class="ebadge curse">☠ Curse or transformation vector</span>';
  if(n.conv) badges+='<span class="ebadge conv">⚡ Convergent morphology</span>';
  _fl.forEach(f=>{ badges+='<span class="ebadge flagchip flag-'+f.slug+'" style="--fh:'+f.hue+'">⚑ '+escHtml(f.label)+'</span>'; });
  if(hasFieldSchema(n)){ n.fields.forEach(function(f){ if(f&&f.type==='check'&&n[f.key]) badges+='<span class="ebadge ctx">'+escHtml(f.label||f.key)+'</span>'; }); }
  if(badges) html+='<div class="badge-row">'+badges+'</div>';

  // Deprecated hardcoded banner rendering is intentionally disabled. Use image custom fields instead.
  // species only: monster image (8:11, left) beside the stat sheet (prioritised)
  if(n.r==='Species' && ((projectFeature('mediaEnabled') && n.img) || (projectFeature('statsEnabled') && n.hasStats))){
    html+='<div class="species-block">';
    if(projectFeature('mediaEnabled') && n.img){
      html+='<div class="mon-image"><div class="mon-image-box"><img src="/media/'+encodeURIComponent(n.id)+'.'+escHtml(n.img)+'" alt="'+escHtml(n.n||'')+'"></div></div>';
    }
    if(projectFeature('statsEnabled') && n.hasStats){
      html+='<div class="statsheet" id="statsheet-block"><div class="statsheet-body" id="statsheet-body">Loading…</div></div>';
    }
    html+='</div>';
  }

  const guideEntry = (n.tag==='Reference'||n.tag==='Catalogue');
  if(hasFieldSchema(n)){
    html+=renderSchemaBody(n);
  } else if(guideEntry){
    html+=addSection('1. Purpose', sectionText(n,'summary'));
    html+=addSection('2. Scope & Status', sectionText(n,'tax'), 'tax-text');
    html+=addSection('3. Display Convention', sectionText(n,'appearance'), 'ap-text');
    html+=addSection('4. Use in Review', sectionText(n,'ecology'));
    html+=addSection('5. Common Errors', sectionText(n,'behavior'));
    html+=addSection('6. Quality Criteria', sectionText(n,'traits'));
    html += addAbilitiesSection('7. Abilities', sectionText(n,'abilities'));
    html+=addSection('8. Notes', sectionText(n,'background'));
  } else {
    html+=addSection('1. Summary Description', sectionText(n,'summary'));
    html+=addSection('2. Taxonomic Definition', sectionText(n,'tax'), 'tax-text');
    html+=addSection('3. Physical Appearance', sectionText(n,'appearance'), 'ap-text');
    html+=addSection('4. Ecology', sectionText(n,'ecology'));
    html+=addSection('5. Behavior & Personality', sectionText(n,'behavior'));
    html+=addSection('6. Traits', sectionText(n,'traits'));
    html+=addAbilitiesSection('7. Abilities', sectionText(n,'abilities'));
    html+=addSection('8. Background', sectionText(n,'background'));
  }
  if(n.conv) html+=addSection('Convergent Evolution', n.conv, '');
  if(n.note) html+='<div class="e-section"><div class="e-head">Classification Notes</div><div class="e-note">'+renderAbilitiesMarkdown(n.note)+'</div></div>';
  if(n.t&&n.t.length){
    html+='<div class="e-section"><div class="e-head">Trait Tags</div><div class="trait-row">';
    n.t.forEach(t=>html+='<span class="trait-tag">'+(TLABELS[t]||t)+'</span>');
    html+='</div></div>';
  }
  // Child/subordinate lists are now explicit custom fields: add a field of type `sublinks`.
  html+='</div>';
  const scroll=document.getElementById('right-scroll');
  const body=scroll.querySelector('.entry-body');
  body.innerHTML=html;
  body.querySelectorAll('[data-field-edit]').forEach(function(btn){
    btn.addEventListener('click', function(e){
      e.preventDefault(); e.stopPropagation();
      const key=btn.getAttribute('data-field-edit');
      const f=(sel&&Array.isArray(sel.fields)) ? sel.fields.find(x=>x&&x.key===key) : null;
      if(f) openViewerFieldEditor(f);
    });
  });
  scroll.scrollTop=0;

  if(projectFeature('statsEnabled') && n.hasStats){
    fetch('/api/node/'+encodeURIComponent(n.id)+'/stats')
      .then(r=>r.ok?r.json():null)
      .then(d=>{
        const el=document.getElementById('statsheet-body');
        if(!el) return;
        const s=d&&d.stats;
        if(s==null){ el.textContent='(empty)'; return; }
        if(typeof s==='string'){ el.innerHTML=renderAbilitiesMarkdown(s); return; } // legacy free-text
        el.innerHTML=renderStatblock(s);
      })
      .catch(()=>{ const el=document.getElementById('statsheet-body'); if(el) el.textContent='(failed to load stat sheet)'; });
  }
}

function jumpTo(id){
  const n=nodeMap[id];if(!n) return;
  n._path.forEach(p=>expanded.add(p.id));expanded.add(id);
  rerenderTree();selectNode(n);
  setTimeout(()=>{
    const row=document.querySelector(`.trow[data-id="${id}"]`);
    if(row) row.scrollIntoView({block:'center',behavior:'smooth'});
  },60);
}

/* ── TOGGLES ── */
function tog(id,get,set){
  document.getElementById(id).addEventListener('click',function(){
    set(!get());this.classList.toggle('on');rerenderTree();
  });
}
tog('tg-gorge',()=>sG,v=>sG=v);
tog('tg-ctx',()=>sC,v=>sC=v);
tog('tg-theo',()=>sT,v=>sT=v);
tog('tg-curse',()=>sCu,v=>sCu=v);
document.getElementById('btn-exp').addEventListener('click',()=>{
  function ea(n){expanded.add(n.id);(n.c||[]).forEach(ea);}ea(ROOT);rerenderTree();
});
document.getElementById('btn-col').addEventListener('click',()=>{
  expanded.clear();expanded.add(ROOT.id);rerenderTree();
});
let st=null;
function applyTreeSearch(){
  const field=document.getElementById('search-field');
  searchQ=field.value.trim();
  if(searchQ){
    const q=searchQ.toLowerCase();
    (function em(n){
      const hit=(n.n&&n.n.toLowerCase().startsWith(q))||(n.sn||'').toLowerCase().startsWith(q)||parseFlags(n).some(f=>f.label.toLowerCase().startsWith(q));
      if(hit){ n._path.forEach(p=>expanded.add(p.id)); expanded.add(n.id); }
      (n.c||[]).forEach(em);
    })(ROOT);
  }
  rerenderTree();
}
function clearTreeSearch(){
  const field=document.getElementById('search-field');
  field.value=''; searchQ=''; rerenderTree(); field.focus();
}
document.getElementById('search-field').addEventListener('input',applyTreeSearch);
{ const cb=document.getElementById('btn-clear-search'); if(cb) cb.addEventListener('click',clearTreeSearch); }



/* ── INIT ── */
function init(data){
  ROOT=data;indexTree(ROOT,null,[]);
  expanded.clear();
  expanded.add(ROOT.id); // start collapsed: show only the root's immediate children
  rerenderTree();
  // welcome stats
  let total=0,gorge=0,refs=0,taxa=0;
  function ct(n){total++;if(n.tag) refs++; else taxa++; if(n.gorge) gorge++;(n.c||[]).forEach(ct);}ct(ROOT);
  document.getElementById('wstats').innerHTML=
    `<div><div class="wstat-n">${taxa}</div><span class="wstat-l">Taxonomic Entries</span></div>`+
    `<div><div class="wstat-n">${gorge}</div><span class="wstat-l">Gorge-Present</span></div>`+
    `<div><div class="wstat-n">${refs}</div><span class="wstat-l">Reference Pages</span></div>`;
}


function openInitialViewerFromQuery(){
  const id=new URLSearchParams(location.search).get('entry');
  if(!id) return; const n=nodeMap[id]; if(!n) return; n._path.forEach(p=>expanded.add(p.id)); expanded.add(n.id); rerenderTree(); selectNode(n);
}

function openInitialEditorFromQuery(){
  const qs=new URLSearchParams(location.search);
  const id=qs.get('editor');
  if(!id) return;
  const n=nodeMap[id];
  if(!n) return;
  document.body.classList.add('detached-editor-window');
  n._path.forEach(p=>expanded.add(p.id)); expanded.add(n.id);
  selectNode(n);
  setTimeout(function(){ if(allowEdits()) openEditor(qs.get('editorField')||undefined); }, 50);
}

const EDIT_FIELDS = [
  ['n', 'Name', 'text'],
  ['sn', 'Subname', 'text'],
  ['r', 'RankText', 'select'],
  ['rankStyle', 'RankStyle', 'select'],
  ['summary', 'Summary', 'textarea'],
  ['tax', 'Taxonomic definition', 'textarea'],
  ['ap', 'Physical appearance', 'textarea'],
  ['eco', 'Ecology', 'textarea'],
  ['beh', 'Behavior', 'textarea'],
  ['traitsText', 'Traits', 'textarea'],
  ['abilities', 'Abilities', 'textarea'],
  ['bg', 'Background', 'textarea'],
  ['note', 'Classification notes', 'textarea'],
  ['gorge', 'Present in Gorge', 'checkbox'],
  ['ctx', 'Context entry', 'checkbox'],
  ['theorized', 'Theorized', 'checkbox'],
  ['fossil', 'Fossil / extinct', 'checkbox'],
  ['curse', 'Curse vector', 'checkbox'],
  ['staleExempt', 'Exempt from stale tracking', 'checkbox'],
  ['isTemplate', 'Template', 'checkbox'],
  ['tag', 'Tree marker', 'text'],
  ['flags', 'Viewer flags', 'text']
];
// The built-in prose sections — shown only for entries WITHOUT a custom field
// schema. Schema entries render their own fields instead.
const EDIT_LEGACY_PROSE = new Set(['summary','tax','ap','eco','beh','traitsText','abilities','bg','note']);

// ── LEGACY → CUSTOM FIELD MIGRATION ──────────────────────────────────────────
// The built-in prose sections (tax/ap/eco/…) predate markdown editing and carry
// no special behaviour — they're just hardcoded prose with hardcoded headings.
// This converts an entry's populated sections into ordinary `fields`, after
// which the entry follows the same generic schema path as any custom entry and
// the built-in layout no longer applies to it.
const LEGACY_PROSE_ORDER = ['summary','tax','ap','eco','beh','traitsText','abilities','bg','note'];
const LEGACY_LABELS_TAXON = {
  summary:'Summary Description', tax:'Taxonomic Definition', ap:'Physical Appearance',
  eco:'Ecology', beh:'Behavior & Personality', traitsText:'Traits',
  abilities:'Abilities', bg:'Background', note:'Classification Notes'
};
const LEGACY_LABELS_GUIDE = {
  summary:'Purpose', tax:'Scope & Status', ap:'Display Convention',
  eco:'Use in Review', beh:'Common Errors', traitsText:'Quality Criteria',
  abilities:'Abilities', bg:'Notes', note:'Classification Notes'
};
// Read a legacy key, folding the historical aliases (and the guide-summary key
// `g`) so no older content is lost regardless of which variant it was stored under.
function legacyFieldValue(n, key){
  switch(key){
    case 'summary':    return n.summary || n.g || '';
    case 'eco':        return n.eco || n.ecology || '';
    case 'beh':        return n.beh || n.behavior || '';
    case 'traitsText': return n.traitsText || n.traits || '';
    case 'abilities':  return n.abilities || n.abil || '';
    case 'bg':         return n.bg || n.background || '';
    default:           return n[key] || '';
  }
}
// Convert an entry's populated legacy sections into a prose `fields` schema.
// Empty sections are dropped — they only ever held placeholder guidance — and
// can be re-added through the normal schema editor. Returns the new field count.
function migrateLegacyToSchema(n){
  const labels = (n.tag==='Reference'||n.tag==='Catalogue') ? LEGACY_LABELS_GUIDE : LEGACY_LABELS_TAXON;
  const fields = [];
  LEGACY_PROSE_ORDER.forEach(function(key){
    const v = legacyFieldValue(n, key);
    if (!String(v || '').trim()) return;     // nothing to preserve
    n[key] = v;                              // fold any alias/g content onto the canonical key
    fields.push({ key: key, label: labels[key] || key, type: 'prose' });
  });
  ['ecology','behavior','traits','background','abil','g'].forEach(function(k){ if (k in n) delete n[k]; });
  n.fields = fields;
  return fields.length;
}
// Remove the built-in prose editors from the open editor form (used when an
// entry switches to a schema, so the legacy inputs don't linger alongside it).
function dropLegacyProseRows(form){
  const grp = form.querySelector('.legacy-prose-group');
  if (grp) grp.remove();
  form.querySelectorAll('.edit-row').forEach(function(row){
    const inp = row.querySelector('[name]');
    if (inp && EDIT_LEGACY_PROSE.has(inp.name)) row.remove();
  });
}

function ensureEditorUI() {
  if (document.getElementById('edit-panel')) return;

  const panel = document.createElement('div');
  panel.id = 'edit-panel';
  panel.innerHTML = `
    <div class="edit-card">
      <div class="edit-head">
        <strong>Edit entry</strong>
        <button id="edit-close" type="button">×</button>
      </div>
      <form id="edit-form"></form>
      <div id="edit-extra"></div>
      <div id="edit-meta-bottom"></div>
      <div class="edit-actions">
        <button id="edit-save" type="button">Save to disk</button>
        <button id="edit-cancel" type="button">Cancel</button>
        <span id="edit-status"></span>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  document.getElementById('edit-close').onclick = closeEditor;
  document.getElementById('edit-cancel').onclick = closeEditor;
  document.getElementById('edit-save').onclick = saveEditor;
}

function imgUrl(id, kind, ext){
  return '/media/' + encodeURIComponent(id) + (kind==='banner'?'__banner.':'.') + ext + '?t=' + Date.now();
}

async function uploadImage(kind, file, statusEl, refresh){
  if(!file || !sel) return;
  const ext=(file.name.split('.').pop()||'').toLowerCase();
  statusEl.textContent='Uploading…';
  try{
    const dataUrl=await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=()=>rej(new Error('read failed'));fr.readAsDataURL(file);});
    const r=await fetch('/api/node/'+encodeURIComponent(sel.id)+'/image?kind='+kind,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,ext,filename:file.name,data:dataUrl,_loadedRevised:sel.revised})});
    const d=await r.json();
    if(!r.ok){ statusEl.textContent=d.error||'Upload failed'; return; }
    if(typeof d.revised==='number'){ sel.revised=d.revised; const ls=document.getElementById('edit-last-saved'); if(ls) ls.textContent=fmtDateTime(sel.revised); }
    if(kind==='banner'){ sel.banner=d.ext; statusEl.textContent=d.warn?('Saved — '+(d.w||'?')+'px wide (ideal '+BANNER_IDEAL_WIDTH+'px; review/crop recommended)'):'Banner saved.'; }
    else { sel.img=d.ext; statusEl.textContent='Image saved.'; }
    await loadMeta(); rerenderTree(); restoreSelectionRow();
    if(refresh) refresh();
  }catch(err){ statusEl.textContent='Upload failed: '+err.message; }
}

async function removeImage(kind, statusEl, refresh){
  if(!sel) return;
  statusEl.textContent='Removing…';
  try{
    const r=await fetch('/api/node/'+encodeURIComponent(sel.id)+'/image?kind='+kind,{method:'DELETE'});
    const d=await r.json();
    if(!r.ok){ statusEl.textContent=d.error||'Remove failed'; return; }
    if(typeof d.revised==='number'){ sel.revised=d.revised; const ls=document.getElementById('edit-last-saved'); if(ls) ls.textContent=fmtDateTime(sel.revised); }
    if(kind==='banner') sel.banner=null; else sel.img=null;
    statusEl.textContent='Removed.';
    await loadMeta(); rerenderTree(); restoreSelectionRow();
    if(refresh) refresh();
  }catch(err){ statusEl.textContent='Remove failed: '+err.message; }
}


async function uploadFieldImage(fieldKey, file, statusEl, setValue, forceWrite){
  if(!file || !sel || !fieldKey) return;
  const ext=(file.name.split('.').pop()||'').toLowerCase();
  statusEl.textContent='Uploading…';
  try{
    const dataUrl=await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=()=>rej(new Error('read failed'));fr.readAsDataURL(file);});
    const r=await fetch('/api/node/'+encodeURIComponent(sel.id)+'/field-media?field='+encodeURIComponent(fieldKey),{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ext,filename:file.name,data:dataUrl,_loadedRevised:sel.revised,_forceWrite:!!forceWrite})
    });
    const d=await r.json();
    if(!r.ok){ statusEl.textContent=d.error||'Upload failed'; if(r.status===409) showConflictReview(d, async()=>uploadFieldImage(fieldKey,file,statusEl,setValue,true)); return; }
    if(typeof d.revised==='number'){ sel.revised=d.revised; const ls=document.getElementById('edit-last-saved'); if(ls) ls.textContent=fmtDateTime(sel.revised); }
    if(d.value){ setValue(d.value); sel[fieldKey]=d.value; }
    statusEl.textContent='Image saved.';
    await loadMeta(); rerenderTree(); restoreSelectionRow();
  }catch(err){ statusEl.textContent='Upload failed: '+err.message; }
}

// An image-upload control (monster icon or banner) as a DOM node.
function imageControl(kind, label){
  const wrap=document.createElement('div'); wrap.className='edit-row edit-image-row';
  const title=document.createElement('span'); title.textContent=label; wrap.appendChild(title);
  const box=document.createElement('div'); box.className='edit-image-box';
  const img=document.createElement('img'); img.className='edit-image-preview'+(kind==='banner'?' banner':''); img.alt='';
  const controls=document.createElement('div'); controls.className='edit-image-controls';
  const file=document.createElement('input'); file.type='file'; file.accept='image/png,image/webp,image/jpeg,image/gif,image/svg+xml';
  const rm=document.createElement('button'); rm.type='button'; rm.textContent='Remove';
  const status=document.createElement('span'); status.className='edit-image-status';
  controls.appendChild(file); controls.appendChild(rm); controls.appendChild(status);
  box.appendChild(img); box.appendChild(controls); wrap.appendChild(box);
  function refresh(){
    const ext = kind==='banner' ? sel.banner : sel.img;
    if(ext){ img.src=imgUrl(sel.id,kind,ext); img.style.display=''; rm.disabled=false; }
    else { img.removeAttribute('src'); img.style.display='none'; rm.disabled=true; }
  }
  file.onchange=e=>{ const f=e.target.files&&e.target.files[0]; if(f) uploadImage(kind,f,status,refresh); e.target.value=''; };
  rm.onclick=()=>removeImage(kind,status,refresh);
  refresh();
  return wrap;
}

/* 5e stat-sheet form */
const STAT_FIELDS=[
  ['name','Creature name','text'],['size','Size','select'],['type','Type','text'],['alignment','Alignment','text'],
  ['epithet','Epithet / title (unique entities)','text'],
  ['ac','Armor Class','text'],['acNote','AC note','text'],
  ['hpFormula','Hit Point formula (e.g. 18d10+36)','text'],
  ['str','STR','num'],['dex','DEX','num'],['con','CON','num'],['int','INT','num'],['wis','WIS','num'],['cha','CHA','num'],
  ['cr','Challenge Rating','text'],['pb','Proficiency override (blank = from CR)','num']
];
const STAT_LISTS=[['traits','Traits'],['actions','Actions'],['bonus','Bonus Actions'],['reactions','Reactions'],['legendary','Legendary Actions'],['mythic','Mythic Actions'],['lair','Lair Actions'],['regional','Regional Effects'],['equipment','Equipment & Artifacts']];

function buildStatForm(container, stats){
  stats=stats||{};
  container.innerHTML='';

  // ── core grid ──
  const grid=document.createElement('div'); grid.className='stat-grid';
  STAT_FIELDS.forEach(function(f){
    const key=f[0], label=f[1], type=f[2];
    const row=document.createElement('label'); row.className='edit-row stat-f';
    const t=document.createElement('span'); t.textContent=label; row.appendChild(t);
    let input;
    if(type==='select'){ input=document.createElement('select'); [''].concat(SB_SIZES).forEach(function(o){const op=document.createElement('option');op.value=o;op.textContent=o||'—';input.appendChild(op);}); input.value=stats[key]||''; }
    else { input=document.createElement('input'); input.type=(type==='num'?'number':'text'); input.value=stats[key]!=null?stats[key]:''; }
    input.dataset.statKey=key; row.appendChild(input); grid.appendChild(row);
  });
  container.appendChild(grid);

  const deriv=document.createElement('div'); deriv.className='stat-derived'; deriv.id='stat-derived-pb';
  container.appendChild(deriv);

  // ── speeds (multiple movement types) ──
  const spd=document.createElement('div'); spd.className='stat-block';
  const spdHead=document.createElement('div'); spdHead.className='stat-list-head'; spdHead.textContent='Speed';
  const spdAdd=document.createElement('button'); spdAdd.type='button'; spdAdd.className='stat-add'; spdAdd.textContent='+ add';
  spdHead.appendChild(spdAdd); spd.appendChild(spdHead);
  const spdItems=document.createElement('div'); spdItems.className='stat-speed-items'; spd.appendChild(spdItems);
  function addSpeed(it){
    it=it||{type:'walk',value:''};
    const r=document.createElement('div'); r.className='stat-speed-row';
    const sel=document.createElement('select'); sel.className='stat-speed-type';
    SB_SPEED_TYPES.forEach(function(t){const o=document.createElement('option');o.value=t;o.textContent=t;sel.appendChild(o);}); sel.value=it.type||'walk';
    const val=document.createElement('input'); val.type='text'; val.className='stat-speed-value'; val.placeholder='30 ft.'; val.value=it.value||'';
    const del=document.createElement('button'); del.type='button'; del.className='stat-del'; del.textContent='×'; del.onclick=function(){r.remove();};
    r.appendChild(sel); r.appendChild(val); r.appendChild(del); spdItems.appendChild(r);
  }
  const seedSpeeds=Array.isArray(stats.speeds)?stats.speeds:(stats.speed?[{type:'walk',value:stats.speed}]:[]);
  seedSpeeds.forEach(addSpeed); spdAdd.onclick=function(){addSpeed();};
  container.appendChild(spd);

  // ── saving throws (toggles → derived) ──
  const curSaves=(stats.saves&&typeof stats.saves==='object'&&!Array.isArray(stats.saves))?stats.saves:{};
  const savesSec=document.createElement('div'); savesSec.className='stat-block';
  savesSec.innerHTML='<div class="stat-list-head">Saving Throws <span class="stat-hint">(only proficient shown)</span></div>';
  const savesGrid=document.createElement('div'); savesGrid.className='stat-toggle-grid';
  SB_ABILITIES.forEach(function(p){
    const k=p[0], lab=p[1];
    const row=document.createElement('div'); row.className='stat-toggle';
    const t=document.createElement('span'); t.className='stat-toggle-l'; t.textContent=lab;
    const sel=document.createElement('select'); sel.dataset.save=k;
    SB_SAVE_STATES.forEach(function(o){const op=document.createElement('option');op.value=o[0];op.textContent=o[1];sel.appendChild(op);}); sel.value=curSaves[k]||'';
    const prev=document.createElement('span'); prev.className='stat-save-prev';
    row.appendChild(t); row.appendChild(sel); row.appendChild(prev); savesGrid.appendChild(row);
  });
  savesSec.appendChild(savesGrid); container.appendChild(savesSec);

  // ── skills (none / ½ / proficient / expertise → derived) ──
  const curSkills={}; if(Array.isArray(stats.skills)) stats.skills.forEach(function(x){ if(x&&x.skill) curSkills[x.skill]=x.state; });
  const skillsSec=document.createElement('div'); skillsSec.className='stat-block';
  skillsSec.innerHTML='<div class="stat-list-head">Skills <span class="stat-hint">(only proficient shown)</span></div>';
  const skillsGrid=document.createElement('div'); skillsGrid.className='stat-toggle-grid';
  SB_SKILLS.forEach(function(p){
    const name=p[0], abil=p[1];
    const row=document.createElement('div'); row.className='stat-toggle';
    const t=document.createElement('span'); t.className='stat-toggle-l'; t.textContent=name+' ('+abil+')';
    const sel=document.createElement('select'); sel.dataset.skill=name; sel.dataset.abil=abil;
    SB_SKILL_STATES.forEach(function(o){const op=document.createElement('option');op.value=o[0];op.textContent=o[1];sel.appendChild(op);}); sel.value=curSkills[name]||'';
    const prev=document.createElement('span'); prev.className='stat-skill-prev';
    row.appendChild(t); row.appendChild(sel); row.appendChild(prev); skillsGrid.appendChild(row);
  });
  skillsSec.appendChild(skillsGrid); container.appendChild(skillsSec);

  // ── indefinite-length inline fields (chips) ──
  SB_INLINE.forEach(function(p){
    const key=p[0], label=p[1];
    const sec=document.createElement('div'); sec.className='stat-inline'; sec.dataset.inlineKey=key;
    const head=document.createElement('div'); head.className='stat-list-head'; head.textContent=label;
    const add=document.createElement('button'); add.type='button'; add.className='stat-add'; add.textContent='+ add';
    head.appendChild(add); sec.appendChild(head);
    const items=document.createElement('div'); items.className='stat-inline-items'; sec.appendChild(items);
    function addChip(v){
      const chip=document.createElement('span'); chip.className='stat-chip';
      const inp=document.createElement('input'); inp.type='text'; inp.className='stat-chip-input'; inp.value=v||'';
      const x=document.createElement('button'); x.type='button'; x.className='stat-chip-x'; x.textContent='×'; x.onclick=function(){chip.remove();};
      chip.appendChild(inp); chip.appendChild(x); items.appendChild(chip); if(!v) inp.focus();
    }
    asList(stats[key]).forEach(addChip); add.onclick=function(){addChip('');};
    container.appendChild(sec);
  });

  // ── wealth (markdown) ──
  const wSec=document.createElement('div'); wSec.className='stat-block';
  const wRow=document.createElement('label'); wRow.className='edit-row';
  const wT=document.createElement('span'); wT.textContent='Wealth — hoard, currency, holdings (markdown)';
  const wTa=document.createElement('textarea'); wTa.rows=3; wTa.dataset.wealth='1'; wTa.dataset.md='1'; wTa.value=stats.wealth||'';
  wRow.appendChild(wT); wRow.appendChild(wTa); wSec.appendChild(wRow); container.appendChild(wSec);

  // ── {name,text} lists: traits / actions / bonus / reactions / legendary ──
  STAT_LISTS.forEach(function(L){
    const key=L[0], label=L[1];
    const sec=document.createElement('div'); sec.className='stat-list'; sec.dataset.listKey=key;
    const head=document.createElement('div'); head.className='stat-list-head'; head.textContent=label;
    const add=document.createElement('button'); add.type='button'; add.className='stat-add'; add.textContent='+ add';
    head.appendChild(add); sec.appendChild(head);
    const items=document.createElement('div'); items.className='stat-items'; sec.appendChild(items);
    function addItem(it){
      if(typeof it==='string') it={name:it,text:''};
      it=it||{};
      const r=document.createElement('div'); r.className='stat-item';
      const nm=document.createElement('input'); nm.type='text'; nm.placeholder='name'; nm.className='stat-item-name'; nm.value=it.name||'';
      const tx=document.createElement('textarea'); tx.rows=2; tx.placeholder='text (supports **bold**)'; tx.className='stat-item-text'; tx.dataset.mdLazy='1'; tx.value=it.text||'';
      const del=document.createElement('button'); del.type='button'; del.className='stat-del'; del.textContent='×'; del.onclick=function(){r.remove();};
      r.appendChild(nm); r.appendChild(tx); r.appendChild(del); items.appendChild(r);
      bindLazyMd(tx);
    }
    (Array.isArray(stats[key])?stats[key]:[]).forEach(addItem); add.onclick=function(){addItem();};
    container.appendChild(sec);
  });

  // ── spellcasting (only revealed when "Has spells" is on) ──
  const sc=stats.spellcasting||{};
  const spSec=document.createElement('div'); spSec.className='stat-block';
  const spHead=document.createElement('div'); spHead.className='stat-list-head'; spHead.textContent='Spellcasting';
  spSec.appendChild(spHead);
  const tRow=document.createElement('label'); tRow.className='edit-row';
  const tT=document.createElement('span'); tT.textContent='Has spells';
  const tgl=document.createElement('input'); tgl.type='checkbox'; tgl.id='edit-has-spells'; tgl.checked=!!stats.hasSpells;
  tRow.appendChild(tT); tRow.appendChild(tgl); spSec.appendChild(tRow);
  const spBody=document.createElement('div'); spBody.className='stat-spell-body'; spSec.appendChild(spBody);

  const aRow=document.createElement('label'); aRow.className='edit-row stat-f';
  const aT=document.createElement('span'); aT.textContent='Spellcasting ability';
  const aSel=document.createElement('select'); aSel.dataset.spellAbility='1';
  SB_SPELL_ABILITIES.forEach(function(o){const op=document.createElement('option');op.value=o;op.textContent=o;aSel.appendChild(op);}); aSel.value=sc.ability||'INT';
  aRow.appendChild(aT); aRow.appendChild(aSel); spBody.appendChild(aRow);

  const lRow=document.createElement('label'); lRow.className='edit-row stat-f';
  const lT=document.createElement('span'); lT.textContent='Caster level (e.g. 9th-level)'; const lIn=document.createElement('input'); lIn.type='text'; lIn.dataset.spellLevel='1'; lIn.value=sc.level||'';
  lRow.appendChild(lT); lRow.appendChild(lIn); spBody.appendChild(lRow);

  const nRow=document.createElement('label'); nRow.className='edit-row stat-f';
  const nT=document.createElement('span'); nT.textContent='Intro override (optional)'; const nIn=document.createElement('textarea'); nIn.rows=2; nIn.dataset.spellNote='1'; nIn.dataset.mdLazy='1'; nIn.value=sc.note||'';
  nRow.appendChild(nT); nRow.appendChild(nIn); spBody.appendChild(nRow);

  const spPrev=document.createElement('div'); spPrev.className='stat-derived'; spPrev.id='stat-spell-prev'; spBody.appendChild(spPrev);

  const slots=document.createElement('div'); slots.className='stat-spell-slots';
  const slotsHead=document.createElement('div'); slotsHead.className='stat-list-head'; slotsHead.textContent='Spell levels';
  const slotsAdd=document.createElement('button'); slotsAdd.type='button'; slotsAdd.className='stat-add'; slotsAdd.textContent='+ add';
  slotsHead.appendChild(slotsAdd); slots.appendChild(slotsHead);
  const slotsItems=document.createElement('div'); slotsItems.className='stat-spell-items'; slots.appendChild(slotsItems);
  function addSlot(it){
    it=it||{};
    const r=document.createElement('div'); r.className='stat-spell-slot';
    const lab=document.createElement('input'); lab.type='text'; lab.className='stat-spell-label'; lab.placeholder='Cantrips (at will)'; lab.value=it.label||'';
    const sp=document.createElement('input'); sp.type='text'; sp.className='stat-spell-spells'; sp.placeholder='fire bolt, light, mage hand'; sp.value=it.spells||'';
    const del=document.createElement('button'); del.type='button'; del.className='stat-del'; del.textContent='×'; del.onclick=function(){r.remove();};
    r.appendChild(lab); r.appendChild(sp); r.appendChild(del); slotsItems.appendChild(r);
  }
  (Array.isArray(sc.slots)?sc.slots:[]).forEach(addSlot); slotsAdd.onclick=function(){addSlot();};
  spBody.appendChild(slots);
  function syncSpells(){ spBody.style.display=tgl.checked?'':'none'; }
  tgl.onchange=function(){ syncSpells(); recompute(); };
  container.appendChild(spSec);

  // ── live derived previews ──
  function curScore(k){ const el=container.querySelector('[data-stat-key="'+k+'"]'); return el?el.value:''; }
  function curPB(){
    const ov=container.querySelector('[data-stat-key="pb"]');
    if(ov&&String(ov.value).trim()!==''){ const p=parseInt(ov.value,10); if(!isNaN(p)) return p; }
    const cr=container.querySelector('[data-stat-key="cr"]'); const v=parseCR(cr?cr.value:'');
    if(v==null||v<1) return 2; return Math.floor((v-1)/4)+2;
  }
  function recompute(){
    const pb=curPB();
    const pd=container.querySelector('#stat-derived-pb'); if(pd) pd.textContent='Derived proficiency bonus: '+fmtMod(pb);
    container.querySelectorAll('[data-save]').forEach(function(sel){
      const prev=sel.parentNode.querySelector('.stat-save-prev'); const st=sel.value;
      if(!st){ if(prev) prev.textContent=''; return; }
      const mod=abilMod(curScore(sel.dataset.save))||0; const add=(st==='expertise')?2*pb:pb;
      if(prev) prev.textContent=fmtMod(mod+add);
    });
    container.querySelectorAll('[data-skill]').forEach(function(sel){
      const prev=sel.parentNode.querySelector('.stat-skill-prev'); const st=sel.value;
      if(!st){ if(prev) prev.textContent=''; return; }
      const mod=abilMod(curScore(sel.dataset.abil))||0;
      const add=(st==='expertise')?2*pb:(st==='half')?Math.floor(pb/2):pb;
      if(prev) prev.textContent=fmtMod(mod+add);
    });
    const sp=container.querySelector('[data-spell-ability]'); const spPrevEl=container.querySelector('#stat-spell-prev');
    if(sp&&spPrevEl){ const mod=abilMod(curScore(sp.value.toLowerCase()))||0; spPrevEl.textContent='Spell save DC '+(8+pb+mod)+', '+fmtMod(pb+mod)+' to hit with spell attacks'; }
  }
  container.addEventListener('input', recompute);
  container.addEventListener('change', recompute);
  syncSpells(); recompute();
}

function readStatForm(container){
  const out={};
  container.querySelectorAll('[data-stat-key]').forEach(function(inp){ const v=String(inp.value).trim(); if(v) out[inp.dataset.statKey]=v; });
  const speeds=[];
  container.querySelectorAll('.stat-speed-row').forEach(function(r){
    const type=r.querySelector('.stat-speed-type').value; const value=r.querySelector('.stat-speed-value').value.trim();
    if(value) speeds.push({type:type,value:value});
  });
  if(speeds.length) out.speeds=speeds;
  const saves={}; container.querySelectorAll('[data-save]').forEach(function(sel){ if(sel.value) saves[sel.dataset.save]=sel.value; });
  if(Object.keys(saves).length) out.saves=saves;
  const skills=[]; container.querySelectorAll('[data-skill]').forEach(function(sel){ if(sel.value) skills.push({skill:sel.dataset.skill,state:sel.value}); });
  if(skills.length) out.skills=skills;
  container.querySelectorAll('.stat-inline').forEach(function(sec){
    const arr=[]; sec.querySelectorAll('.stat-chip-input').forEach(function(i){ const v=i.value.trim(); if(v) arr.push(v); });
    if(arr.length) out[sec.dataset.inlineKey]=arr;
  });
  container.querySelectorAll('.stat-list').forEach(function(sec){
    const arr=[];
    sec.querySelectorAll('.stat-item').forEach(function(it){
      const tx=it.querySelector('.stat-item-text');
      const name=it.querySelector('.stat-item-name').value.trim();
      const text=(tx&&tx._mde?tx._mde.value():tx.value).trim();
      if(name||text) arr.push({name:name,text:text});
    });
    if(arr.length) out[sec.dataset.listKey]=arr;
  });
  const wTa=container.querySelector('[data-wealth]');
  if(wTa){ const w=(wTa._mde?wTa._mde.value():wTa.value).trim(); if(w) out.wealth=w; }
  const tgl=container.querySelector('#edit-has-spells');
  if(tgl&&tgl.checked){
    const ab=container.querySelector('[data-spell-ability]'); const lv=container.querySelector('[data-spell-level]'); const nt=container.querySelector('[data-spell-note]');
    const slots=[];
    container.querySelectorAll('.stat-spell-slot').forEach(function(r){
      const label=r.querySelector('.stat-spell-label').value.trim(); const spells=r.querySelector('.stat-spell-spells').value.trim();
      if(label||spells) slots.push({label:label,spells:spells});
    });
    out.hasSpells=true;
    out.spellcasting={ ability: ab?ab.value:'INT', level: lv?lv.value.trim():'', note: (nt?(nt._mde?nt._mde.value():nt.value).trim():''), slots:slots };
  }
  return Object.keys(out).length?out:null;
}

function restoreSelectionRow() {
  if (!sel) return;
  const row = document.querySelector('.trow[data-id="' + cssEscape(sel.id) + '"]');
  if (row) row.classList.add('sel');
}

let _editorHadSchema = false;

function slugifyKey(s){ return String(s||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,''); }
function uniqueFieldKey(fields){
  const used = new Set((fields||[]).map(f=>f&&f.key));
  let i=1, k='field1'; while(used.has(k)){ i++; k='field'+i; } return k;
}

// Build the "Custom fields" editor: per-field value inputs + a definition list

function ensureFieldEditModal(){
  let p=document.getElementById('field-edit-panel');
  if(p) return p;
  p=document.createElement('div'); p.id='field-edit-panel'; p.className='field-edit-panel';
  p.innerHTML='<div class="field-edit-card"><div class="field-edit-head"><strong></strong><button type="button" class="field-edit-close">×</button></div><textarea class="field-edit-text"></textarea><div class="field-edit-actions"><button type="button" class="field-edit-save">Apply</button><button type="button" class="field-edit-cancel">Cancel</button><span class="field-edit-status"></span></div></div>';
  document.body.appendChild(p);
  return p;
}
function openFieldValueEditor(field, values, done){
  const p=ensureFieldEditModal();
  const title=p.querySelector('.field-edit-head strong'); title.textContent='Edit '+(field.label||field.key);
  const ta=p.querySelector('.field-edit-text');
  ta.value=decodeCrosslinkRefsForEditor(values[field.key]||'');
  p.classList.add('open');
  let mde=null;
  if (window.EasyMDE) { try { mde=new EasyMDE({ element: ta, spellChecker:false, status:false, minHeight:'260px', previewRender:function(plain){ return renderAbilitiesMarkdown(plain); } }); if(mde&&mde.codemirror) bindMarkdownCrosslinkAutocompleteForCodeMirror(mde.codemirror); } catch(_){} }
  if (!mde) bindEntryAutocomplete(ta);
  function val(){ return mde ? mde.value() : ta.value; }
  function cleanup(){ if(mde){ try{ mde.toTextArea(); }catch(_){} mde=null; } p.classList.remove('open'); }
  p.querySelector('.field-edit-close').onclick=cleanup;
  p.querySelector('.field-edit-cancel').onclick=cleanup;
  p.querySelector('.field-edit-save').onclick=async function(){
    const nextVal=val();
    values[field.key]=nextVal;
    const result = typeof done==='function' ? done(nextVal) : null;
    if(window.clad0Desktop&&window.clad0Desktop.setEditorDirty) window.clad0Desktop.setEditorDirty(true);
    if(result && typeof result.then==='function'){
      const status=p.querySelector('.field-edit-status'); if(status) status.textContent='Saving…';
      try{ await result; if(status) status.textContent=''; cleanup(); }catch(e){ if(status) status.textContent=(e&&e.message)||'Save failed'; }
    } else cleanup();
  };
}

async function saveSingleFieldValue(field, value, forceWrite){
  if(!sel || !field || !field.key) return;
  const payload={ fields:Array.isArray(sel.fields)?sel.fields:[], _loadedRevised: revisedStamp(sel) };
  if(forceWrite) payload._forceWrite=true;
  payload[field.key] = field.type==='crosslink' ? crosslinkValueFromInput(value) : (field.type==='prose' ? encodeCrosslinkRefsForStorage(value) : value);
  const res=await fetch('/api/node/'+encodeURIComponent(sel.id), { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
  const data=await res.json().catch(()=>({}));
  if(!res.ok){
    if(res.status===409){ showConflictReview(data, function(){ saveSingleFieldValue(field, value, true); }); return; }
    throw new Error(data.error||'Save failed');
  }
  sel[field.key]=payload[field.key];
  if(typeof data.revised==='number') sel.revised=data.revised;
  if(data.id) sel.id=data.id;
  sel._detailLoaded=true;
  renderDetail(sel);
  ensureEntryActionButtons();
  rerenderTree();
  if(inDesktopShell() && window.clad0Desktop && window.clad0Desktop.notifyEntrySaved){ try{ window.clad0Desktop.notifyEntrySaved(sel.id); }catch(_){} }
}
function openViewerFieldEditor(field){
  if(!allowEdits() || !sel || !field || !field.key) return;
  ensureDetailLoaded(sel).then(function(){
    const values={}; values[field.key]=sel[field.key]||'';
    openFieldValueEditor(field, values, function(v){ return saveSingleFieldValue(field, v); });
  });
}

// (key / label / type, add / remove / reorder). Operates on sel.fields in place.
function buildSchemaEditor(form){
  const wrap=document.createElement('div'); wrap.id='edit-schema'; wrap.className='edit-schema-block';
  form.appendChild(wrap);
  const head=document.createElement('div'); head.className='edit-attach-head'; head.textContent='Custom fields'; wrap.appendChild(head);

  if(!hasFieldSchema(sel)){
    const note=document.createElement('div'); note.className='schema-note';
    note.textContent='This entry uses the built-in layout. Add custom fields to give it its own sections (recommended for World / Reference entries).';
    wrap.appendChild(note);
    const btn=document.createElement('button'); btn.type='button'; btn.className='schema-btn';
    btn.textContent='＋ Use custom fields';
    btn.onclick=function(){ sel.fields=[{key:'overview',label:'Overview',type:'prose'}]; _editorHadSchema=true; dropLegacyProseRows(form); wrap.remove(); buildSchemaEditor(form); };
    wrap.appendChild(btn);
    // Convert this entry's built-in tax/ap/eco/… prose into ordinary custom fields,
    // retiring the hardcoded layout for it. Populates the editor for review; the
    // change isn't written until the user Saves (Cancel discards it).
    const mig=document.createElement('button'); mig.type='button'; mig.className='schema-btn schema-btn-migrate';
    mig.textContent='⇪ Convert built-in sections to fields';
    mig.title='Move Summary / Taxonomy / Appearance / … into editable custom fields';
    mig.onclick=function(){
      // Capture any unsaved edits from the legacy textareas before replacing them.
      EDIT_LEGACY_PROSE.forEach(function(key){
        const el = form.elements[key];
        if (el) sel[key] = el._mde ? el._mde.value() : el.value;
      });
      teardownProseEditors();
      const count = migrateLegacyToSchema(sel);
      _editorHadSchema = true;
      dropLegacyProseRows(form);
      wrap.remove(); buildSchemaEditor(form);
      const st=document.getElementById('edit-status');
      if(st) st.textContent = count
        ? ('Converted '+count+' built-in section'+(count===1?'':'s')+' to custom fields — review, then Save.')
        : 'No built-in section content to convert.';
    };
    wrap.appendChild(mig);
    return;
  }

  const values={};
  sel.fields.forEach(f=>{ if(f&&f.key) values[f.key]= (sel[f.key]!=null?sel[f.key]:(f.type==='check'?false:'')); });

  const valuesEl=document.createElement('div'); valuesEl.className='schema-values'; wrap.appendChild(valuesEl);
  const defsHead=document.createElement('div'); defsHead.className='schema-defs-head'; defsHead.textContent='Field definitions (key · label · type)'; wrap.appendChild(defsHead);
  const defsEl=document.createElement('div'); defsEl.className='schema-defs'; wrap.appendChild(defsEl);
  const addBtn=document.createElement('button'); addBtn.type='button'; addBtn.className='schema-btn'; addBtn.textContent='＋ Add field'; wrap.appendChild(addBtn);

  function readValuesFromDom(){
    valuesEl.querySelectorAll('[data-fkey]').forEach(el=>{
      const k=el.dataset.fkey, t=el.dataset.ftype;
      if(t==='check') values[k]=el.checked;
      else if(t==='crosslink') values[k]=crosslinkValueFromInput(el.value);
      else if(el.dataset && Object.prototype.hasOwnProperty.call(el.dataset,'fieldValue')) values[k]=el.dataset.fieldValue;
      else if(el._mde) values[k]=el._mde.value();
      else values[k]=el.value;
    });
  }
  function refresh(skipRead){ if(!skipRead) readValuesFromDom(); renderValues(); renderDefs(); }

  function applyValueLayout(row, f){
    const style = fieldLayoutStyle(f);
    row.setAttribute('style', style);
    row.classList.add('schema-value-field');
    row.draggable = false;
    row.dataset.fieldKey = f.key || '';
    const dh=document.createElement('button'); dh.type='button'; dh.className='field-drag-handle'; dh.title='Drag to reorder'; dh.textContent='↕'; dh.draggable=true;
    dh.addEventListener('dragstart', function(e){ e.dataTransfer.setData('text/plain', f.key || ''); row.classList.add('dragging'); });
    dh.addEventListener('dragend', function(){ row.classList.remove('dragging'); });
    row.appendChild(dh);
    
    row.addEventListener('dragend', function(){ row.classList.remove('dragging'); });
    row.addEventListener('dragover', function(e){ e.preventDefault(); row.classList.add('drag-over'); });
    row.addEventListener('dragleave', function(){ row.classList.remove('drag-over'); });
    row.addEventListener('drop', function(e){
      e.preventDefault(); row.classList.remove('drag-over');
      const key=e.dataTransfer.getData('text/plain'); if(!key || key===f.key) return;
      readValuesFromDom();
      const from=sel.fields.findIndex(x=>x&&x.key===key), to=sel.fields.findIndex(x=>x&&x.key===f.key);
      if(from<0||to<0) return;
      const moved=sel.fields.splice(from,1)[0]; sel.fields.splice(to,0,moved); refresh();
    });
    const rz=document.createElement('button'); rz.type='button'; rz.className='field-resize-handle'; rz.title='Resize field width'; rz.textContent='↔';
    const widths=['25%','33%','50%','66%','75%','100%'];
    rz.onclick=function(e){ e.preventDefault(); const l=f.layout||(f.layout={}); const cur=l.width||'100%'; const i=widths.indexOf(cur); l.width=widths[(i+1)%widths.length]; refresh(); };
    row.appendChild(rz);
  }

  function renderValues(){
    valuesEl.innerHTML='';
    sel.fields.forEach(f=>{
      if(!f||!f.key) return;
      const row=document.createElement('label'); row.className='edit-row';
      applyValueLayout(row, f);
      const t=document.createElement('span'); t.textContent=(f.label||f.key); row.appendChild(t);
      let input;
      if(f.type==='prose'){ input=document.createElement('input'); input.type='hidden'; input.dataset.fieldValue=values[f.key]||''; const preview=document.createElement('div'); preview.className='schema-value-preview'; const pv=decodeCrosslinkRefsForEditor(values[f.key]||'').trim(); preview.textContent=pv || ''; preview.classList.toggle('empty', !pv); if(!pv) preview.setAttribute('aria-label','Empty field'); const edit=document.createElement('button'); edit.type='button'; edit.className='schema-value-edit'; edit.textContent='Edit'; edit.onclick=function(e){ e.preventDefault(); openFieldValueEditor(f, values, function(v){ values[f.key]=v; input.dataset.fieldValue=v; input.value=v; refresh(true); }); }; row.appendChild(preview); row.appendChild(edit); }
      else if(f.type==='check'){ input=document.createElement('input'); input.type='checkbox'; input.checked=!!values[f.key]; }
      else if(f.type==='select'){
        input=document.createElement('select');
        const opts=Array.isArray(f.options)?f.options:String(f.options||'').split(',').map(s=>s.trim()).filter(Boolean);
        const blank=document.createElement('option'); blank.value=''; blank.textContent='—'; input.appendChild(blank);
        opts.forEach(o=>{const op=document.createElement('option');op.value=o;op.textContent=o;input.appendChild(op);});
        input.value=values[f.key]||'';
      }
      else if(f.type==='crosslink'){
        input=document.createElement('input'); input.type='text';
        input.placeholder='target entry slug(s), comma-separated';
        const sids=crosslinkSids(values[f.key]);
        input.value=sids.map(displayRefForEditor).join(', ');
        bindEntryAutocomplete(input);
      }
      else if(f.type==='sublinks'){
        input=document.createElement('input'); input.type='hidden'; input.value='';
        const info=document.createElement('div'); info.className='schema-value-preview'; info.textContent='Renders this entry’s visible child entries.'; row.appendChild(info);
      }
      else if(f.type==='image'){
        const holder=document.createElement('div'); holder.className='schema-image-editor';
        input=document.createElement('input'); input.type='text'; input.value=values[f.key]||''; input.placeholder='/media/... or external image URL';
        const file=document.createElement('input'); file.type='file'; file.accept='image/png,image/webp,image/jpeg,image/gif,image/svg+xml';
        const prev=document.createElement('img'); prev.className='schema-image-edit-preview';
        const status=document.createElement('span'); status.className='edit-image-status';
        function sync(){ const v=input.value.trim(); if(v){ prev.src=v; prev.style.display=''; } else { prev.removeAttribute('src'); prev.style.display='none'; } }
        input.oninput=sync; file.onchange=function(e){ const picked=e.target.files&&e.target.files[0]; if(picked) uploadFieldImage(f.key,picked,status,function(v){ input.value=v; values[f.key]=v; sync(); }); e.target.value=''; };
        holder.appendChild(input); holder.appendChild(file); holder.appendChild(prev); holder.appendChild(status); row.appendChild(holder); sync();
        input.dataset.fkey=f.key; input.dataset.ftype=f.type||'text';
        valuesEl.appendChild(row);
        return;
      }
      else { input=document.createElement('input'); input.type='text'; input.value=values[f.key]||''; }
      input.dataset.fkey=f.key; input.dataset.ftype=f.type||'text';
      row.appendChild(input); valuesEl.appendChild(row);
    });
    enhanceMd(valuesEl);
  }

  function renderDefs(){
    defsEl.innerHTML='';
    sel.fields.forEach((f,i)=>{
      const r=document.createElement('div'); r.className='schema-def'; r.draggable=true; r.dataset.fieldKey=f.key||'';
      r.addEventListener('dragstart', function(e){ e.dataTransfer.setData('text/plain', f.key||''); r.classList.add('dragging'); });
      r.addEventListener('dragend', function(){ r.classList.remove('dragging'); });
      r.addEventListener('dragover', function(e){ e.preventDefault(); r.classList.add('drag-over'); });
      r.addEventListener('dragleave', function(){ r.classList.remove('drag-over'); });
      r.addEventListener('drop', function(e){ e.preventDefault(); r.classList.remove('drag-over'); const key0=e.dataTransfer.getData('text/plain'); if(!key0||key0===f.key) return; readValuesFromDom(); const from=sel.fields.findIndex(x=>x&&x.key===key0), to=sel.fields.findIndex(x=>x&&x.key===f.key); if(from<0||to<0) return; const moved=sel.fields.splice(from,1)[0]; sel.fields.splice(to,0,moved); refresh(); });
      const key=document.createElement('input'); key.type='text'; key.value=f.key||''; key.placeholder='key'; key.className='sd-key';
      const lab=document.createElement('input'); lab.type='text'; lab.value=f.label||''; lab.placeholder='label'; lab.className='sd-label';
      const typ=document.createElement('select'); SCHEMA_FIELD_TYPES.forEach(p=>{const op=document.createElement('option');op.value=p[0];op.textContent=p[1];typ.appendChild(op);}); typ.value=f.type||'prose';
      const up=document.createElement('button'); up.type='button'; up.textContent='↑'; up.className='sd-mv';
      const dn=document.createElement('button'); dn.type='button'; dn.textContent='↓'; dn.className='sd-mv';
      const del=document.createElement('button'); del.type='button'; del.textContent='×'; del.className='sd-del';
      key.onchange=()=>{ readValuesFromDom(); const old=f.key; const nk=slugifyKey(key.value)||old; if(nk!==old){ values[nk]=values[old]; delete values[old]; if(Object.prototype.hasOwnProperty.call(sel, old)){ sel[nk]=sel[old]; delete sel[old]; } f.key=nk; } refresh(); if(window.clad0Desktop&&window.clad0Desktop.setEditorDirty) window.clad0Desktop.setEditorDirty(true); };
      lab.oninput=()=>{ f.label=lab.value; };
      typ.onchange=()=>{ readValuesFromDom(); f.type=typ.value; refresh(); };
      up.onclick=()=>{ if(i>0){ readValuesFromDom(); sel.fields.splice(i-1,0,sel.fields.splice(i,1)[0]); refresh(); } };
      dn.onclick=()=>{ if(i<sel.fields.length-1){ readValuesFromDom(); sel.fields.splice(i+1,0,sel.fields.splice(i,1)[0]); refresh(); } };
      del.onclick=()=>{ readValuesFromDom(); const old=f.key; sel.fields.splice(i,1); if(old){ delete values[old]; delete sel[old]; } if(!sel.fields.length){ sel.fields=null; wrap.remove(); buildSchemaEditor(form); } else refresh(); if(window.clad0Desktop&&window.clad0Desktop.setEditorDirty) window.clad0Desktop.setEditorDirty(true); };
      r.appendChild(key); r.appendChild(lab); r.appendChild(typ);
      if(f.type==='select'){ const opt=document.createElement('input'); opt.type='text'; opt.className='sd-opts'; opt.placeholder='options, comma-separated'; opt.value=Array.isArray(f.options)?f.options.join(', '):(f.options||''); opt.onchange=()=>{ f.options=opt.value.split(',').map(s=>s.trim()).filter(Boolean); }; r.appendChild(opt); }
      const layout=f.layout||(f.layout={});
      const width=document.createElement('select'); width.className='sd-layout'; ['25%','33%','50%','66%','75%','100%'].forEach(function(w){const op=document.createElement('option');op.value=w;op.textContent=w;width.appendChild(op);}); width.value=layout.width||'100%'; width.title='Viewer width'; width.onchange=()=>{ f.layout=f.layout||{}; f.layout.width=width.value; };
      const overflow=document.createElement('select'); overflow.className='sd-layout'; [['visible','grow'],['scroll','scroll']].forEach(function(p){const op=document.createElement('option');op.value=p[0];op.textContent=p[1];overflow.appendChild(op);}); overflow.value=layout.overflow||'visible'; overflow.title='Oversized content'; overflow.onchange=()=>{ f.layout=f.layout||{}; f.layout.overflow=overflow.value; };
      const sticky=document.createElement('label'); sticky.className='sd-sticky'; const stick=document.createElement('input'); stick.type='checkbox'; stick.checked=!!layout.sticky; stick.onchange=()=>{ f.layout=f.layout||{}; f.layout.sticky=stick.checked; }; sticky.appendChild(stick); sticky.appendChild(document.createTextNode('sticky'));
      r.appendChild(width); r.appendChild(overflow); r.appendChild(sticky);
      r.appendChild(up); r.appendChild(dn); r.appendChild(del);
      defsEl.appendChild(r);
    });
  }

  addBtn.onclick=()=>{ readValuesFromDom(); sel.fields.push({key:uniqueFieldKey(sel.fields),label:'New field',type:'prose'}); refresh(); };

  renderValues(); renderDefs();
}


function buildEditorMetaBottom(){
  const meta = document.getElementById('edit-meta-bottom');
  if(!meta || !sel) return;
  meta.innerHTML='';
  meta.className='edit-meta-bottom';
  const idRow = document.createElement('div'); idRow.className = 'edit-row edit-idrow';
  const idT = document.createElement('span'); idT.textContent = 'Slug';
  const idIn = document.createElement('input'); idIn.type = 'text'; idIn.id = 'edit-slug'; idIn.value = sel.id; idIn.autocomplete = 'off'; idIn.spellcheck = false;
  const idMsg = document.createElement('div'); idMsg.className = 'edit-idmsg';
  idRow.appendChild(idT); idRow.appendChild(idIn); idRow.appendChild(idMsg); meta.appendChild(idRow);

  const sidRow = document.createElement('div'); sidRow.className = 'edit-row edit-idrow readonly-meta';
  const sidT = document.createElement('span'); sidT.textContent = 'Stable ID';
  const sidMsg = document.createElement('div'); sidMsg.className = 'edit-idmsg'; sidMsg.textContent = sel.sid || '— assigned on save';
  sidRow.appendChild(sidT); sidRow.appendChild(sidMsg); meta.appendChild(sidRow);

  const savedRow = document.createElement('div'); savedRow.className = 'edit-row edit-idrow readonly-meta';
  const savedT = document.createElement('span'); savedT.textContent = 'Last saved';
  const savedMsg = document.createElement('div'); savedMsg.id = 'edit-last-saved'; savedMsg.className = 'edit-idmsg'; savedMsg.textContent = fmtDateTime(sel.revised);
  savedRow.appendChild(savedT); savedRow.appendChild(savedMsg); meta.appendChild(savedRow);

  function validateSlug(){
    const v = idIn.value.trim();
    const saveBtn = document.getElementById('edit-save');
    let err = '';
    if (!v) err = 'Slug cannot be empty.';
    else if (v !== sel.id && nodeMap[v]) err = 'Slug already in use by another entry.';
    if (err){
      idIn.classList.add('invalid'); idMsg.textContent = err; idMsg.classList.add('err');
      if (saveBtn) saveBtn.disabled = true;
    } else {
      idIn.classList.remove('invalid'); idMsg.classList.remove('err');
      idMsg.textContent = v !== sel.id ? 'will rename files on save' : 'renamable file slug';
      if (saveBtn) saveBtn.disabled = false;
    }
  }
  idIn.addEventListener('input', validateSlug);
  validateSlug();
}

async function openEditor(focusFieldKey) {
  if (!sel || !allowEdits()) return;
  await ensureDetailLoaded(sel);
  ensureEditorUI();

  const form = document.getElementById('edit-form');
  teardownProseEditors();
  form.innerHTML = '';
  const usingSchema = hasFieldSchema(sel);
  // Top identity row: name is implicit; subname is an optional generalized subtitle.
  const nameRow = document.createElement('div'); nameRow.className = 'edit-name-row';
  const nameIn = document.createElement('input'); nameIn.type = 'text'; nameIn.name = 'n'; nameIn.value = sel.n || ''; nameIn.required = true; nameIn.autocomplete = 'off'; nameIn.placeholder = 'Name';
  const snIn = document.createElement('input'); snIn.type = 'text'; snIn.name = 'sn'; snIn.value = sel.sn || ''; snIn.autocomplete = 'off'; snIn.placeholder = 'subname';
  nameRow.appendChild(nameIn); nameRow.appendChild(snIn); form.appendChild(nameRow);

  // Rank text is semantic; RankStyle is visual. They are intentionally separate.
  const rankRow = document.createElement('div'); rankRow.className = 'edit-rank-row';
  const rankTextWrap = document.createElement('div'); rankTextWrap.className = 'edit-row compact unlabeled';
  const rIn = document.createElement('input'); rIn.type='text'; rIn.name = 'r'; rIn.maxLength = 16; rIn.value = sel.r || ''; rIn.placeholder = 'rank text';
  rankTextWrap.appendChild(rIn);
  const rankStyleWrap = document.createElement('div'); rankStyleWrap.className = 'edit-row compact rank-style-row unlabeled';
  const rsIn = document.createElement('input'); rsIn.type='hidden'; rsIn.name = 'rankStyle'; rsIn.value = normalizeRankStyle(sel.rankStyle || 'style-8');
  const rsChooser=document.createElement('div'); rsChooser.className='rank-style-chooser';
  const rsBtn=document.createElement('button'); rsBtn.type='button'; rsBtn.className='rank-style-button';
  const rsList=document.createElement('div'); rsList.className='rank-style-list'; rsList.hidden=true;
  function setRankStyle(v){ rsIn.value=normalizeRankStyle(v); syncRankPreview(); rsList.hidden=true; if(window.clad0Desktop&&window.clad0Desktop.setEditorDirty) window.clad0Desktop.setEditorDirty(true); }
  RANK_STYLE_OPTIONS.forEach(function(o){
    const opt=document.createElement('button'); opt.type='button'; opt.className='rank-style-option';
    const pill=document.createElement('span'); pill.className='rank-stamp '+rankClass(o.id); pill.textContent=o.label;
    opt.appendChild(pill); opt.onclick=function(){ setRankStyle(o.id); }; rsList.appendChild(opt);
  });
  function syncRankPreview(){ const v=normalizeRankStyle(rsIn.value); rsBtn.innerHTML=''; const pill=document.createElement('span'); pill.className='rank-stamp '+rankClass(v); pill.textContent=(rIn.value||'rank').slice(0,16); rsBtn.appendChild(pill); }
  rsBtn.onclick=function(){ rsList.hidden=!rsList.hidden; };
  document.addEventListener('click', function(e){ if(!rsChooser.contains(e.target)) rsList.hidden=true; });
  rIn.addEventListener('input', function(){ syncRankPreview(); if(window.clad0Desktop&&window.clad0Desktop.setEditorDirty) window.clad0Desktop.setEditorDirty(true); });
  rsChooser.appendChild(rsBtn); rsChooser.appendChild(rsList); syncRankPreview();
  rankStyleWrap.appendChild(rsChooser); rankStyleWrap.appendChild(rsIn);
  rankRow.appendChild(rankTextWrap); rankRow.appendChild(rankStyleWrap); form.appendChild(rankRow);

  let legacyGroup = null;
  const flagWrap = document.createElement('div'); flagWrap.className = 'edit-flag-wrap';
  const flagGroup = document.createElement('div'); flagGroup.className = 'edit-flag-grid';
  const flagHead = document.createElement('div'); flagHead.className = 'edit-flag-head'; flagHead.textContent = 'Flags'; flagGroup.appendChild(flagHead);
  const markerGroup = document.createElement('div'); markerGroup.className = 'edit-marker-grid';
  function ensureLegacyGroup(){
    if (legacyGroup) return legacyGroup;
    legacyGroup = document.createElement('details'); legacyGroup.className = 'legacy-prose-group';
    const sm = document.createElement('summary'); sm.textContent = 'Built-in prose sections (legacy)';
    legacyGroup.appendChild(sm);
    return legacyGroup;
  }

  const skipTop = new Set(['n','sn','r','rankStyle','css']);
  for (const [key, label, type] of EDIT_FIELDS) {
    if (skipTop.has(key)) continue;
    if (usingSchema && EDIT_LEGACY_PROSE.has(key)) continue;
    const isLegacyProse = EDIT_LEGACY_PROSE.has(key);
    let row;
    let input;
    if (key === 'tag') {
      row = document.createElement('label'); row.className = 'edit-row edit-flag-row edit-marker-row';
      input = document.createElement('input'); input.type = 'text'; input.name = key; input.value = sel[key] || ''; input.placeholder = 'tree marker';
      row.appendChild(input); markerGroup.appendChild(row); continue;
    }
    if (key === 'flags') {
      row = document.createElement('label'); row.className = 'edit-row edit-flag-row edit-marker-row wide';
      input = document.createElement('input'); input.type = 'text'; input.name = key; input.value = (sel.flags != null ? sel.flags : (sel.css || '')); input.placeholder = 'viewer flags, separated by ;';
      row.appendChild(input); markerGroup.appendChild(row); continue;
    }
    row = document.createElement('label'); row.className = 'edit-row';
    const title = document.createElement('span'); title.textContent = label; row.appendChild(title);
    if (type === 'textarea') { input = document.createElement('textarea'); input.rows = 4; input.value = isLegacyProse ? decodeCrosslinkRefsForEditor(sel[key] || '') : (sel[key] || ''); input.dataset[isLegacyProse ? 'mdLazy' : 'md'] = '1'; }
    else if (type === 'checkbox') { input = document.createElement('input'); input.type = 'checkbox'; input.checked = !!sel[key]; }
    else if (type === 'select') { input = document.createElement('select'); rankOptions(sel[key]).forEach(function(o){ const op=document.createElement('option'); op.value=o; op.textContent=(o===''?'—':o); input.appendChild(op); }); input.value = sel[key] || ''; }
    else { input = document.createElement('input'); input.type = 'text'; input.value = sel[key] || ''; }
    input.name = key; row.appendChild(input);
    if (isLegacyProse) ensureLegacyGroup().appendChild(row);
    else if (type === 'checkbox') { row.classList.add('edit-flag-row'); flagGroup.appendChild(row); }
    else form.appendChild(row);
  }
  if (flagGroup.childNodes.length > 1 || markerGroup.childNodes.length) { flagWrap.appendChild(flagGroup); if(markerGroup.childNodes.length) flagWrap.appendChild(markerGroup); form.appendChild(flagWrap); }
  if (legacyGroup) form.appendChild(legacyGroup);

  buildEditorMetaBottom();

  enhanceMd(form);
  _editorHadSchema = hasFieldSchema(sel);
  buildSchemaEditor(form);

  const extra=document.getElementById('edit-extra');
  extra.innerHTML='';
  const isSpecies = sel.r==='Species';

  // Hardcoded banner upload is deprecated; use image custom fields instead.

  if(isSpecies && (projectFeature('mediaEnabled') || projectFeature('statsEnabled'))){
    if(projectFeature('mediaEnabled')){
      const mHead=document.createElement('div'); mHead.className='edit-attach-head'; mHead.textContent='Species image (8:11 icon, shown beside the stat sheet)';
      extra.appendChild(mHead);
      extra.appendChild(imageControl('monster','Species image'));
    }

    if(projectFeature('statsEnabled')){
    const sHead=document.createElement('div'); sHead.className='edit-attach-head'; sHead.textContent='Monster stat sheet (5e)';
    extra.appendChild(sHead);
    const tRow=document.createElement('label'); tRow.className='edit-row';
    const tT=document.createElement('span'); tT.textContent='Has stat sheet';
    const tgl=document.createElement('input'); tgl.type='checkbox'; tgl.id='edit-has-stats'; tgl.checked=!!sel.hasStats;
    tRow.appendChild(tT); tRow.appendChild(tgl); extra.appendChild(tRow);
    const sform=document.createElement('div'); sform.id='edit-stat-form'; sform.className='stat-form'; extra.appendChild(sform);
    function syncSheet(){ sform.style.display=tgl.checked?'':'none'; }
    tgl.onchange=syncSheet;
    buildStatForm(sform, {});
    fetch('/api/node/'+encodeURIComponent(sel.id)+'/stats').then(r=>r.ok?r.json():null).then(d=>{
      const s=(d&&d.stats&&typeof d.stats==='object')?d.stats:{};
      buildStatForm(sform, s);
      enhanceMd(sform);
    }).catch(()=>{});
    syncSheet();
    }
  } else {
    const note=document.createElement('div'); note.className='edit-attach-note';
    note.textContent='Stat sheet and species image are available only on Species-rank entries.';
    extra.appendChild(note);
  }

  document.getElementById('edit-status').textContent = '';
  form.oninput=function(){ if(window.clad0Desktop&&window.clad0Desktop.setEditorDirty) window.clad0Desktop.setEditorDirty(true); };
  document.getElementById('edit-panel').classList.add('open');
  if(focusFieldKey){ setTimeout(function(){ const el=document.querySelector('[data-fkey="'+cssEscape(focusFieldKey)+'"]'); if(el){ el.focus(); el.scrollIntoView({block:'center'}); } }, 80); }
}

let _mdeInstances = [];
// Turn one textarea into an EasyMDE editor (if the lib is present). Degrades
// silently to a plain textarea when it isn't, or if init throws.
function bindEntryAutocomplete(input){
  if(!input || input._clad0Auto) return; input._clad0Auto=true;
  let box=null;
  function close(){ if(box){ box.remove(); box=null; } }
  function choose(item){
    const val=input.value; const pos=input.selectionStart||val.length;
    const before=val.slice(0,pos), after=val.slice(pos);
    const m=before.match(/(?:^|[,\s]|\[\[)([a-zA-Z0-9_.-]{3,})$/);
    if(!m) return close();
    const start=pos-m[1].length;
    input.value=val.slice(0,start)+item.id+after;
    input.focus(); input.setSelectionRange(start+item.id.length,start+item.id.length);
    close();
  }
  function render(items){
    close(); if(!items.length) return;
    const r=input.getBoundingClientRect(); box=document.createElement('div'); box.className='crosslink-autocomplete';
    box.style.left=(r.left+window.scrollX)+'px'; box.style.top=(r.bottom+window.scrollY+2)+'px'; box.style.minWidth=Math.max(260,r.width)+'px';
    items.forEach(function(it){ const b=document.createElement('button'); b.type='button'; b.innerHTML='<b>'+escHtml(it.id)+'</b><span>'+escHtml(it.name)+'</span>'; b.onclick=function(e){ e.preventDefault(); choose(it); }; box.appendChild(b); });
    document.body.appendChild(box);
  }
  input.addEventListener('input', function(){
    const pos=input.selectionStart||input.value.length; const before=input.value.slice(0,pos);
    const m=before.match(/(?:^|[,\s]|\[\[)([a-zA-Z0-9_.-]{3,})$/);
    if(!m) return close(); render(crosslinkOptions(m[1],10));
  });
  input.addEventListener('blur', function(){ setTimeout(close,180); });
}
function bindMarkdownCrosslinkAutocompleteForCodeMirror(cm){
  if(!cm || cm._clad0CrosslinkAuto) return; cm._clad0CrosslinkAuto=true;
  let box=null;
  function close(){ if(box){ box.remove(); box=null; } }
  function choose(item, from, to){ cm.replaceRange(item.id, from, to); cm.focus(); close(); }
  cm.on('inputRead', function(instance){
    const cur=instance.getCursor(); const line=instance.getLine(cur.line).slice(0,cur.ch);
    const m=line.match(/\[\[([^\]|]{3,})$/); if(!m) return close();
    const opts=crosslinkOptions(m[1],10); if(!opts.length) return close();
    close(); const coords=instance.cursorCoords(cur, 'page'); box=document.createElement('div'); box.className='crosslink-autocomplete'; box.style.left=coords.left+'px'; box.style.top=(coords.bottom+3)+'px'; box.style.minWidth='280px';
    const from={line:cur.line,ch:cur.ch-m[1].length}; const to=cur;
    opts.forEach(function(it){ const b=document.createElement('button'); b.type='button'; b.innerHTML='<b>'+escHtml(it.id)+'</b><span>'+escHtml(it.name)+'</span>'; b.onclick=function(e){e.preventDefault(); choose(it,from,to);}; box.appendChild(b); });
    document.body.appendChild(box);
  });
  cm.on('blur', function(){ setTimeout(close,180); });
}
function enhanceTextarea(ta){
  if (!window.EasyMDE || !ta || ta._mde) return (ta && ta._mde) || null;
  try {
    ta._mde = new EasyMDE({
      element: ta,
      spellChecker: false,
      status: false,
      minHeight: '90px',
      toolbar: ['bold','italic','heading-smaller','|','unordered-list','ordered-list','|','link','preview','guide'],
      previewRender: function(plain){ return renderAbilitiesMarkdown(plain); }
    });
    _mdeInstances.push(ta._mde);
    bindMarkdownCrosslinkAutocompleteForCodeMirror(ta._mde.codemirror);
    return ta._mde;
  } catch (_) { return null; }
}
// Lazy: only build the editor the first time the field is focused. Keeps the
// editor panel fast to open even with many list-item fields (e.g. 30+ traits).
function bindLazyMd(ta){
  if (!ta || ta._mdeLazy) return;
  ta._mdeLazy = true;
  ta.addEventListener('focus', function onFocus(){
    ta.removeEventListener('focus', onFocus);
    const inst = enhanceTextarea(ta);
    if (inst && inst.codemirror) { try { inst.codemirror.focus(); } catch (_) {} }
  });
}
// Eager-enhance [data-md] fields; lazy-bind [data-md-lazy] fields, under a root.
function enhanceMd(root){
  if (!root) return;
  root.querySelectorAll('textarea[data-md]').forEach(function(ta){ enhanceTextarea(ta); bindEntryAutocomplete(ta); });
  root.querySelectorAll('textarea[data-md-lazy]').forEach(function(ta){ bindLazyMd(ta); bindEntryAutocomplete(ta); });
}
function teardownProseEditors(){
  _mdeInstances.forEach(function(mde){ try { mde.toTextArea(); } catch (_) {} });
  _mdeInstances = [];
}

function closeEditor() {
  teardownProseEditors();
  if (document.body.classList.contains('detached-editor-window') && window.clad0Desktop && window.clad0Desktop.closeWindow) { window.clad0Desktop.closeWindow(); return; }
  const panel = document.getElementById('edit-panel');
  if (panel) panel.classList.remove('open');
}


function showConflictReview(data, saveAnyway){
  let panel=document.getElementById('conflict-panel');
  if(!panel){
    panel=document.createElement('div'); panel.id='conflict-panel'; panel.className='conflict-panel';
    panel.innerHTML='<div class="conflict-card"><h3>Entry changed elsewhere</h3><p class="conflict-msg"></p><div class="conflict-meta"></div><div class="conflict-actions"><button class="conflict-reload" type="button">Reload entry</button><button class="conflict-force" type="button">Save anyway</button><button class="conflict-cancel" type="button">Cancel</button></div></div>';
    document.body.appendChild(panel);
  }
  panel.querySelector('.conflict-msg').textContent=(data&&data.error)||'This entry changed after the editor opened.';
  panel.querySelector('.conflict-meta').innerHTML='<div><b>Editor loaded:</b> '+escHtml(fmtDateTime(sel&&sel.revised))+'</div><div><b>Current saved:</b> '+escHtml(fmtDateTime(data&&data.revised))+'</div>'+(data&&data.current&&data.current.n?'<div><b>Current title:</b> '+escHtml(data.current.n)+'</div>':'');
  panel.classList.add('open');
  panel.querySelector('.conflict-cancel').onclick=function(){ panel.classList.remove('open'); };
  panel.querySelector('.conflict-reload').onclick=async function(){ panel.classList.remove('open'); if(sel) await reloadTreeAndSelect(sel.id); closeEditor(); };
  panel.querySelector('.conflict-force').onclick=function(){ panel.classList.remove('open'); if(typeof saveAnyway==='function') saveAnyway(); };
}

async function saveEditor(forceWrite) {
  if (!sel) return;

  const status = document.getElementById('edit-status');
  const form = document.getElementById('edit-form');
  const payload = {};
  payload._loadedRevised = revisedStamp(sel);
  if(forceWrite) payload._forceWrite = true;

  for (const [key, , type] of EDIT_FIELDS) {
    const input = form.elements[key];
    if (!input) continue;

    if (type === 'checkbox') {
      payload[key] = input.checked;
    } else if (input._mde) {
      payload[key] = EDIT_LEGACY_PROSE.has(key) ? encodeCrosslinkRefsForStorage(input._mde.value().trim()) : input._mde.value().trim();
    } else {
      payload[key] = EDIT_LEGACY_PROSE.has(key) ? encodeCrosslinkRefsForStorage(input.value.trim()) : input.value.trim();
    }
  }

  if (payload.rankStyle) payload.rankStyle = normalizeRankStyle(payload.rankStyle);
  if (!payload.n) { status.textContent = 'Name cannot be empty.'; const nIn=form.elements.n; if(nIn) nIn.focus(); return; }
  status.textContent = 'Saving…';

  const slugIn = document.getElementById('edit-slug');
  const newSlug = slugIn ? slugIn.value.trim() : sel.id;
  if (!newSlug || (newSlug !== sel.id && nodeMap[newSlug])) {
    status.textContent = 'Fix the slug before saving.';
    return;
  }
  if (newSlug !== sel.id) payload.id = newSlug;
  const oldId = sel.id;

  // Custom field schema + values
  if (_editorHadSchema || hasFieldSchema(sel)) {
    payload.fields = Array.isArray(sel.fields) ? sel.fields : [];
    const valsEl = document.querySelector('#edit-schema .schema-values');
    if (valsEl) valsEl.querySelectorAll('[data-fkey]').forEach(function(el){
      const k = el.dataset.fkey, t = el.dataset.ftype;
      if (t === 'check') payload[k] = el.checked;
      else if (t === 'crosslink') payload[k] = crosslinkValueFromInput(el.value);
      else if (t === 'sublinks') payload[k] = '';
      else if (t === 'prose') payload[k] = encodeCrosslinkRefsForStorage(Object.prototype.hasOwnProperty.call(el.dataset,'fieldValue') ? el.dataset.fieldValue : (el._mde ? el._mde.value().trim() : el.value || ''));
      else if (el._mde) payload[k] = el._mde.value().trim();
      else payload[k] = ('' + el.value).trim();
    });
  }

  const res = await fetch('/api/node/' + encodeURIComponent(oldId), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  if (!res.ok) {
    if(res.status===409){
      status.textContent = data.error || 'Save conflict.';
      showConflictReview(data, function(){ saveEditor(true); });
      return;
    }
    status.textContent = data.error || 'Save failed';
    return;
  }
  if (data.sid) sel.sid = data.sid;
  if (typeof data.revised === 'number') sel.revised = data.revised;
  const finalId = data.id || newSlug;

  // Persist the 5e stat sheet (species only; toggle off or empty clears it).
  if (sel.r === 'Species' && projectFeature('statsEnabled')) {
    const tgl = document.getElementById('edit-has-stats');
    const sform = document.getElementById('edit-stat-form');
    if (tgl && sform) {
      const stats = tgl.checked ? readStatForm(sform) : null;
      const sres = await fetch('/api/node/' + encodeURIComponent(finalId) + '/stats', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stats: stats || {}, _loadedRevised: sel.revised })
      });
      if (sres.ok) { const sd = await sres.json(); sel.hasStats = !!sd.hasStats; if (typeof sd.revised === 'number') sel.revised = sd.revised; }
    }
  }

  Object.assign(sel, payload);
  sel.id = finalId;

  // Re-index because name/rank/status fields may affect search, labels, colors, etc.
  nodeMap = {};
  kgColor = {};
  await loadMeta();
  indexTree(ROOT, null, []);

  rerenderTree();
  selectNode(nodeMap[sel.id]);

  status.textContent = 'Saved.';
  if(window.clad0Desktop&&window.clad0Desktop.setEditorDirty) window.clad0Desktop.setEditorDirty(false);
  if(inDesktopShell() && window.clad0Desktop && window.clad0Desktop.notifyEntrySaved){ try{ window.clad0Desktop.notifyEntrySaved(sel.id); }catch(_){} }
  setTimeout(closeEditor, 400);
}

/* ── STRUCTURAL TREE EDITING ── */

function ensureEntryActionButtons() {
  if (!sel || !allowEdits()) { const old=document.getElementById('entry-action-tools'); if(old) old.remove(); return; }

  const rankLine = document.getElementById('entry-rank-line');
  if (!rankLine) return;

  let tools = document.getElementById('entry-action-tools');

  if (!tools) {
    tools = document.createElement('span');
    tools.id = 'entry-action-tools';
    tools.className = 'entry-action-tools';

    const editBtn = document.createElement('button');
    editBtn.id = 'entry-edit-btn';
    editBtn.type = 'button';
    editBtn.textContent = 'Edit';
    editBtn.dataset.editAction = 'edit';
    editBtn.onclick = function(){ if(inDesktopShell() && window.clad0Desktop && window.clad0Desktop.openEditorWindow) window.clad0Desktop.openEditorWindow(sel.id); else openEditor(); };

    const addBtn = document.createElement('button');
    addBtn.id = 'entry-add-child-btn';
    addBtn.type = 'button';
    addBtn.textContent = 'Add Child';
    addBtn.dataset.editAction = 'add';
    addBtn.onclick = openAddChildDialog;

    const moveBtn = document.createElement('button');
    moveBtn.id = 'entry-move-btn';
    moveBtn.type = 'button';
    moveBtn.textContent = 'Move';
    moveBtn.dataset.editAction = 'move';
    moveBtn.onclick = openMoveDialog;

    const delBtn = document.createElement('button');
    delBtn.id = 'entry-delete-btn';
    delBtn.type = 'button';
    delBtn.textContent = 'Delete';
    delBtn.dataset.editAction = 'delete';
    delBtn.onclick = deleteSelectedNode;

    const sortBtn = document.createElement('button');
    sortBtn.id = 'entry-sort-btn';
    sortBtn.type = 'button';
    sortBtn.textContent = 'Sort ⇅';
    sortBtn.title = 'Auto-sort children by rank, then name';
    sortBtn.dataset.editAction = 'sort';
    sortBtn.onclick = autosortChildren;

    tools.appendChild(editBtn);
    tools.appendChild(addBtn);
    tools.appendChild(moveBtn);
    tools.appendChild(delBtn);
    tools.appendChild(sortBtn);
  }

  rankLine.appendChild(tools);
  const oldFields=document.getElementById('entry-field-tools'); if(oldFields) oldFields.remove();

  const isRoot = ROOT && sel && sel.id === ROOT.id;
  const moveBtn = document.getElementById('entry-move-btn');
  const delBtn = document.getElementById('entry-delete-btn');
  const sortBtn = document.getElementById('entry-sort-btn');

  if (moveBtn) moveBtn.disabled = isRoot;
  if (delBtn) delBtn.disabled = isRoot;
  if (sortBtn) sortBtn.disabled = !(sel && sel.c && sel.c.length > 1);
}

function clientFindParent(root, targetId) {
  if (!root) return null;

  for (let i = 0; i < (root.c || []).length; i++) {
    const child = root.c[i];

    if (child.id === targetId) {
      return {
        parent: root,
        index: i
      };
    }

    const found = clientFindParent(child, targetId);
    if (found) return found;
  }

  return null;
}

function clientIsDescendant(ancestor, possibleDescendantId) {
  if (!ancestor) return false;

  for (const child of (ancestor.c || [])) {
    if (child.id === possibleDescendantId) return true;
    if (clientIsDescendant(child, possibleDescendantId)) return true;
  }

  return false;
}

function collectNodes(root, out = []) {
  if (!root) return out;

  out.push(root);

  for (const child of (root.c || [])) {
    collectNodes(child, out);
  }

  return out;
}

function nodePathLabel(n) {
  const path = (n._path || []).map(p => p.n).join(' › ');
  return path ? `${path} › ${n.n}` : n.n;
}

async function reloadTreeAndSelect(idToSelect) {
  const res = await fetch('/api/clado');

  if (!res.ok) {
    throw new Error('Failed to reload taxonomy after edit: ' + res.status);
  }

  const data = await res.json();

  ROOT = data;
  nodeMap = {};
  kgColor = {};
  await loadMeta();
  indexTree(ROOT, null, []);

  if (idToSelect && nodeMap[idToSelect]) {
    nodeMap[idToSelect]._path.forEach(p => expanded.add(p.id));
    expanded.add(idToSelect);
  }

  rerenderTree();

  if (idToSelect && nodeMap[idToSelect]) {
    selectNode(nodeMap[idToSelect]);

    setTimeout(() => {
      const row = document.querySelector(`.trow[data-id="${idToSelect}"]`);
      if (row) row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 60);
  } else {
    selectNode(ROOT);
  }

  if (sunburstOn) renderSunburst(idToSelect || (sel && sel.id));
}

function ensureAddChildUI(){
  if(document.getElementById('addchild-panel')) return;
  const p=document.createElement('div'); p.id='addchild-panel'; p.className='modal-overlay';
  p.innerHTML=
    '<div class="edit-card" style="width:min(440px,calc(100vw - 32px))">'+
    '<div class="edit-head"><strong>Add child entry</strong><button id="ac-close" type="button">×</button></div>'+
    '<label class="edit-row"><span>Name</span><input id="ac-name" type="text" autocomplete="off"></label>'+
    '<label class="edit-row"><span>Rank</span><select id="ac-rank"></select></label>'+
    '<div class="edit-actions"><button id="ac-create" type="button">Create</button><button id="ac-cancel" type="button">Cancel</button><span id="ac-status"></span></div>'+
    '</div>';
  document.body.appendChild(p);
  document.getElementById('ac-close').onclick=closeAddChildDialog;
  document.getElementById('ac-cancel').onclick=closeAddChildDialog;
  document.getElementById('ac-create').onclick=submitAddChild;
  document.getElementById('ac-name').addEventListener('keydown',e=>{ if(e.key==='Enter') submitAddChild(); });
  p.addEventListener('mousedown',e=>{ if(e.target===p) closeAddChildDialog(); });
}
function closeAddChildDialog(){ const p=document.getElementById('addchild-panel'); if(p) p.classList.remove('open'); }
let _acParentId = null;
let _acTemplateId = null;
function listTemplates(){
  const out = [];
  (function walk(n){ if (!n) return; if (n.isTemplate) out.push(n); (n.c || []).forEach(walk); })(ROOT);
  (Array.isArray(PROJECT_SETTINGS.templates)?PROJECT_SETTINGS.templates:[]).forEach(function(t,i){ if(t&&t.name) out.push({ id:'config:'+String(t.id||i), n:t.name, _configTemplate:t }); });
  return out;
}
function openAddChildDialog(parentNode, templateId) {
  const parent = parentNode || sel;
  if (!parent) return;
  _acParentId = parent.id;
  _acTemplateId = templateId || null;
  ensureAddChildUI();
  const def=nextLikelyRank(parent.r||'');
  const rs=document.getElementById('ac-rank'); rs.innerHTML='';
  rankOptions(def).forEach(function(o){ const op=document.createElement('option'); op.value=o; op.textContent=(o===''?'—':o); rs.appendChild(op); });
  rs.value=def;
  document.getElementById('ac-name').value='';
  const status=document.getElementById('ac-status');
  const tmpl = _acTemplateId ? (nodeMap[_acTemplateId] || listTemplates().find(t=>t.id===_acTemplateId)) : null;
  status.textContent = tmpl ? ('From template “'+(tmpl.n||tmpl.id)+'” — set this entry’s own name & rank.') : '';
  document.getElementById('addchild-panel').classList.add('open');
  document.getElementById('ac-name').focus();
}
function submitAddChild(){
  const parentId = _acParentId || (sel && sel.id);
  if(!parentId) return;
  const name=document.getElementById('ac-name').value.trim();
  const status=document.getElementById('ac-status');
  if(!name){ status.textContent='Name is required.'; return; }
  const rank=document.getElementById('ac-rank').value.trim();
  const sciName='';
  const templateId=_acTemplateId;
  closeAddChildDialog();
  if(templateId){
    duplicateFromTemplate(templateId, parentId, name, rank, sciName);
    return;
  }
  // Clean, generic entry: an empty custom-field schema (no taxa sections, no
  // inherited flags). The author adds fields via the editor, or uses a template.
  createChildNode({
    parentId,
    node: { n: name, r: rank || 'Entry', fields: [], c: [] }
  });
}
// Instantiate a child by deep-duplicating a template into the parent, then
// applying the chosen identity (rank/sci-name) and clearing the template flag.
async function duplicateFromTemplate(templateId, parentId, name, rank, sciName){
  try{
    if(String(templateId).startsWith('config:')){
      const tmpl=listTemplates().find(t=>t.id===templateId);
      const cfg=tmpl&&tmpl._configTemplate||{};
      const fields=Array.isArray(cfg.fields)?JSON.parse(JSON.stringify(cfg.fields)):[];
      const node={ n:name, r:rank||cfg.rank||'Entry', fields:fields, c:[] };
        await createChildNode({ parentId, node });
      return;
    }
    const overrides={ r: rank||'Entry', isTemplate:false };
    const res = await fetch('/api/node/'+encodeURIComponent(templateId)+'/duplicate', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ parentId, name, overrides })
    });
    const data = await res.json();
    if(!res.ok){ alert(data.error||'Create from template failed.'); return; }
    expanded.add(parentId);
    await reloadTreeAndSelect(data.id);
  }catch(err){ alert('Create from template failed: '+err.message); }
}

function nextLikelyRank(rank) {
  const bio=['Domain','Kingdom','Phylum','Class','Order','Family','Genus','Species','Subspecies'];
  const dei=['Pantheon','Major Deity','Minor Deity','Demigod','Archdevil','Archdemon','Archangel','Archfey','Avatar','Divine Servitor'];
  let i=bio.indexOf(rank); if(i!==-1) return bio[Math.min(i+1,bio.length-1)];
  i=dei.indexOf(rank); if(i!==-1) return dei[Math.min(i+1,dei.length-1)];
  return 'Entry';
}

async function createChildNode(payload) {
  try {
    const res = await fetch('/api/node', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Failed to create child entry.');
      return;
    }

    expanded.add(payload.parentId);
    await reloadTreeAndSelect(data.id);
  } catch (err) {
    alert('Create failed: ' + err.message);
  }
}

function openMoveDialog() {
  if (!sel || !ROOT) return;

  if (sel.id === ROOT.id) {
    alert('Cannot move the root entry.');
    return;
  }

  ensureMovePanel();

  const panel = document.getElementById('move-panel');
  const select = document.getElementById('move-parent-select');
  const status = document.getElementById('move-status');

  select.innerHTML = '';

  const all = collectNodes(ROOT)
    .filter(n => {
      if (!n || !n.id) return false;
      if (n.id === sel.id) return false;
      if (clientIsDescendant(sel, n.id)) return false;
      return true;
    })
    .sort((a, b) => nodePathLabel(a).localeCompare(nodePathLabel(b)));

  for (const n of all) {
    const opt = document.createElement('option');
    opt.value = n.id;
    opt.textContent = `${nodePathLabel(n)} [${n.id}]`;
    select.appendChild(opt);
  }

  const currentParent = clientFindParent(ROOT, sel.id);

  if (currentParent) {
    select.value = currentParent.parent.id;
  }

  status.textContent = '';
  panel.classList.add('open');
}

function ensureMovePanel() {
  if (document.getElementById('move-panel')) return;

  const panel = document.createElement('div');
  panel.id = 'move-panel';

  panel.innerHTML = `
    <div class="edit-card move-card">
      <div class="edit-head">
        <strong>Move entry</strong>
        <button id="move-close" type="button">×</button>
      </div>

      <label class="edit-row">
        <span>New parent</span>
        <select id="move-parent-select"></select>
      </label>

      <div class="edit-actions">
        <button id="move-save" type="button">Move entry</button>
        <button id="move-cancel" type="button">Cancel</button>
        <span id="move-status"></span>
      </div>
    </div>
  `;

  document.body.appendChild(panel);

  document.getElementById('move-close').onclick = closeMovePanel;
  document.getElementById('move-cancel').onclick = closeMovePanel;
  document.getElementById('move-save').onclick = moveSelectedNode;
}

function closeMovePanel() {
  const panel = document.getElementById('move-panel');
  if (panel) panel.classList.remove('open');
}

async function moveSelectedNode() {
  if (!sel) return;

  const select = document.getElementById('move-parent-select');
  const status = document.getElementById('move-status');
  const newParentId = select.value;

  if (!newParentId) {
    status.textContent = 'Choose a parent.';
    return;
  }

  if (newParentId === sel.id) {
    status.textContent = 'Cannot move an entry under itself.';
    return;
  }

  status.textContent = 'Moving…';

  try {
    const res = await fetch('/api/node/' + encodeURIComponent(sel.id) + '/move', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        newParentId
      })
    });

    const data = await res.json();

    if (!res.ok) {
      status.textContent = data.error || 'Move failed.';
      return;
    }

    expanded.add(newParentId);
    closeMovePanel();
    await reloadTreeAndSelect(sel.id);
  } catch (err) {
    status.textContent = 'Move failed: ' + err.message;
  }
}

async function deleteSelectedNode() {
  if (!sel || !ROOT) return;
  if (sel.id === ROOT.id) {
    alert('Cannot delete the root entry.');
    return;
  }

  const loc = clientFindParent(ROOT, sel.id);
  const parentId = loc && loc.parent ? loc.parent.id : ROOT.id;
  const childCount = countSubtree(sel) - 1;

  const warning = childCount > 0
    ? `Delete "${sel.n}" and its ${childCount} subordinate entr${childCount === 1 ? 'y' : 'ies'}?`
    : `Delete "${sel.n}"?`;

  if (!confirm(warning + '\n\nThis writes the deletion to disk.')) return;

  try {
    const res = await fetch('/api/node/' + encodeURIComponent(sel.id), {
      method: 'DELETE'
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Delete failed.');
      return;
    }

    await reloadTreeAndSelect(parentId);
  } catch (err) {
    alert('Delete failed: ' + err.message);
  }
}

async function duplicateSelectedNode() {
  if (!sel || !ROOT) return;
  if (sel.id === ROOT.id) { alert('Cannot duplicate the root entry.'); return; }
  try {
    const res = await fetch('/api/node/' + encodeURIComponent(sel.id) + '/duplicate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: (sel.n || 'Entry') + ' (copy)' })
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Duplicate failed.'); return; }
    await reloadTreeAndSelect(data.id);
  } catch (err) { alert('Duplicate failed: ' + err.message); }
}

// ── BESPOKE RIGHT-CLICK CONTEXT MENU ─────────────────────────────────────────
let _ctxNode = null;
function ensureCtxMenu() {
  let m = document.getElementById('ctx-menu');
  if (m) return m;
  m = document.createElement('div'); m.id = 'ctx-menu'; m.className = 'ctx-menu'; m.hidden = true;
  document.body.appendChild(m);
  document.addEventListener('click', e => { if (!m.contains(e.target)) hideCtxMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hideCtxMenu(); });
  document.addEventListener('scroll', hideCtxMenu, true);
  window.addEventListener('blur', hideCtxMenu);
  return m;
}
function hideCtxMenu() { const m = document.getElementById('ctx-menu'); if (m) { m.hidden = true; m.innerHTML = ''; } _ctxNode = null; }
function downloadText(filename, text, type){ const blob=new Blob([text],{type:type||'text/plain'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();},0); }
function cloneForExport(n){ return JSON.parse(JSON.stringify(n)); }
async function hydrateForExport(n, scope){
  await ensureDetailLoaded(n);
  const out=cloneForExport(n);
  if(scope==='subtree' && Array.isArray(n.c)){
    out.c=[];
    for(const ch of n.c){ out.c.push(await hydrateForExport(ch,'subtree')); }
  } else delete out.c;
  return out;
}
function nodeToMarkdown(n, level){
  level=level||1;
  let md='#'.repeat(Math.min(level,6))+' '+(n.n||n.id)+'\n\n';
  if(n.sn) md+='**Subname:** '+n.sn+'\n\n';
  if(n.r) md+='**Rank:** '+n.r+'\n\n';
  if(Array.isArray(n.fields)){
    n.fields.forEach(function(f){
      if(!f||!f.key||f.type==='check') return;
      const v=n[f.key];
      if(v!=null&&String(v).trim()) md+='## '+(f.label||f.key)+'\n\n'+String(v)+'\n\n';
    });
  } else ['summary','tax','ap','eco','beh','traits','abilities','bg','note'].forEach(function(k){
    if(n[k]) md+='## '+k+'\n\n'+n[k]+'\n\n';
  });
  if(Array.isArray(n.c)) n.c.forEach(function(ch){ md+='\n'+nodeToMarkdown(ch, level+1); });
  return md;
}
function exportHtmlDocument(out){
  const title=escHtml(out.n||out.id||'Entry');
  const body=renderExportHtml(out,1);
  return '<!doctype html><html><head><meta charset="utf-8"><title>'+title+'</title><style>body{font-family:Georgia,serif;line-height:1.45;margin:36px;color:#24180d}h1{font-size:28px;margin:0 0 8px}h2{margin-top:24px;border-bottom:1px solid #ddd;padding-bottom:4px}.meta{color:#666;font-size:12px;margin-bottom:18px}.child{margin-left:18px;border-left:2px solid #ddd;padding-left:14px}.field{margin:12px 0}.field-label{font-weight:bold}.xlink{color:#0645ad;text-decoration:underline}</style></head><body>'+body+'</body></html>';
}
function renderExportHtml(n, depth){
  let h='<section class="export-entry"><h'+Math.min(depth,3)+'>'+escHtml(n.n||n.id)+'</h'+Math.min(depth,3)+'><div class="meta">'+escHtml(n.id||'')+(n.r?' · '+escHtml(n.r):'')+'</div>';
  if(Array.isArray(n.fields)&&n.fields.length){ n.fields.forEach(function(f){ if(!f||!f.key||f.type==='check') return; const v=n[f.key]; if(f.type==='prose'&&v) h+='<div class="field"><div class="field-label">'+escHtml(f.label||f.key)+'</div>'+renderAbilitiesMarkdown(v)+'</div>'; else if(f.type==='crosslink') h+='<div class="field"><div class="field-label">'+escHtml(f.label||f.key)+'</div>'+renderLinkList(crosslinkSids(v).map(resolveEntryRef).filter(Boolean),'No links')+'</div>'; else if(f.type==='sublinks') h+='<div class="field"><div class="field-label">'+escHtml(f.label||f.key)+'</div>'+renderLinkList((n.c||[]).filter(anyVis),'No child entries')+'</div>'; else if(v) h+='<div class="field"><span class="field-label">'+escHtml(f.label||f.key)+':</span> '+escHtml(String(v))+'</div>'; }); }
  else { ['summary','tax','ap','eco','beh','traitsText','abilities','bg','note'].forEach(function(k){ if(n[k]) h+='<div class="field">'+renderAbilitiesMarkdown(n[k])+'</div>'; }); }
  if(Array.isArray(n.c)&&n.c.length){ h+='<div class="children">'; n.c.forEach(ch=>{ h+='<div class="child">'+renderExportHtml(ch,depth+1)+'</div>'; }); h+='</div>'; }
  return h+'</section>';
}
async function exportNode(node, format, scope){ scope=scope||'entry'; const out=await hydrateForExport(node, scope); const suffix=scope==='subtree'?'-subtree':''; if(format==='json'){ downloadText((node.id||'entry')+suffix+'.json', JSON.stringify(out,null,2), 'application/json'); return; } if(format==='pdf'){ const html=exportHtmlDocument(out); const filename=(node.id||'entry')+suffix+'.pdf'; if(inDesktopShell()&&window.clad0Desktop&&window.clad0Desktop.exportPdf){ await window.clad0Desktop.exportPdf({html,filename,title:out.n||node.id}); return; } const w=window.open('','_blank'); if(w){ w.document.write(html); w.document.close(); w.focus(); w.print(); } return; } downloadText((node.id||'entry')+suffix+'.md', nodeToMarkdown(out,1), 'text/markdown'); }
// Action list. Designed to be extended (Pass 4 adds "Create child from template").
function ctxItems(node) {
  const isRoot = node.id === (ROOT && ROOT.id);
  const editable = allowEdits();
  const items = [];
  if (editable) {
    items.push({ label: 'Edit entry', fn: () => { selectNode(node); openEditor(); } });
    if (inDesktopShell()) items.push({ label: 'Open in Editor Window', fn: () => window.clad0Desktop.openEditorWindow(node.id) });
    if (inDesktopShell()) items.push({ label: 'Open in New Viewer Window', fn: () => window.clad0Desktop.openViewerWindow(node.id) });
    items.push({ label: 'Add child', fn: () => { selectNode(node); openAddChildDialog(node, null); } });
    items.push({ label: 'New child from template', submenu: ctxTemplateSubmenu(node) });
    items.push({ label: 'Duplicate (with subtree)', fn: () => { selectNode(node); duplicateSelectedNode(); } });
    items.push({ sep: true });
  }
  items.push({ label: 'Export as…', submenu: [
    { label: 'JSON (entry)', fn: () => exportNode(node, 'json', 'entry') },
    { label: 'Markdown (entry)', fn: () => exportNode(node, 'markdown', 'entry') },
    { label: 'PDF (entry)', fn: () => exportNode(node, 'pdf', 'entry') },
    { label: 'JSON (subtree)', fn: () => exportNode(node, 'json', 'subtree') },
    { label: 'Markdown (subtree)', fn: () => exportNode(node, 'markdown', 'subtree') },
    { label: 'PDF (subtree)', fn: () => exportNode(node, 'pdf', 'subtree') }
  ] });
  if (editable && !isRoot) items.push({ sep: true }, { label: 'Delete…', danger: true, fn: () => { selectNode(node); deleteSelectedNode(); } });
  return items;
}
// Always offers a generic "Empty entry" plus every entry flagged isTemplate.
function ctxTemplateSubmenu(node) {
  const sub = [{ label: 'Empty entry', fn: () => { openAddChildDialog(node, null); } }];
  listTemplates().forEach(t => sub.push({ label: t.n || t.id, fn: () => { openAddChildDialog(node, t.id); } }));
  return sub;
}
function showCtxMenu(node, x, y) {
  const m = ensureCtxMenu(); m.innerHTML = ''; _ctxNode = node;
  const title = document.createElement('div'); title.className = 'ctx-title';
  title.textContent = node.n || node.id; m.appendChild(title);
  ctxItems(node).forEach(it => {
    if (it.sep) { const s = document.createElement('div'); s.className = 'ctx-sep'; m.appendChild(s); return; }
    const b = document.createElement('button'); b.type = 'button';
    b.className = 'ctx-item' + (it.danger ? ' danger' : '') + (it.submenu ? ' has-sub' : '');
    b.textContent = it.label + (it.submenu ? ' ▸' : '');
    if (it.submenu) {
      const sub = document.createElement('div'); sub.className = 'ctx-sub';
      it.submenu.forEach(s => {
        const sb = document.createElement('button'); sb.type = 'button'; sb.className = 'ctx-item'; sb.textContent = s.label;
        sb.onclick = e => { e.stopPropagation(); hideCtxMenu(); s.fn && s.fn(); };
        sub.appendChild(sb);
      });
      b.appendChild(sub);
    } else {
      b.onclick = e => { e.stopPropagation(); hideCtxMenu(); it.fn && it.fn(); };
    }
    m.appendChild(b);
  });
  m.hidden = false;
  const vw = window.innerWidth, vh = window.innerHeight, r = m.getBoundingClientRect();
  let px = x, py = y;
  if (px + r.width > vw - 8) px = vw - r.width - 8;
  if (py + r.height > vh - 8) py = vh - r.height - 8;
  m.style.left = Math.max(8, px) + 'px';
  m.style.top = Math.max(8, py) + 'px';
}

function countSubtree(n) {
  let total = 1;

  for (const child of (n.c || [])) {
    total += countSubtree(child);
  }

  return total;
}

/* ── DRAG & DROP / AUTOSORT ─────────────────────────────────────────────── */

function dropZone(e, row){
  const r = row.getBoundingClientRect();
  const y = e.clientY - r.top;
  if (y < r.height * 0.30) return 'before';
  if (y > r.height * 0.70) return 'after';
  return 'inside';
}

function clearDropMarks(){
  document.querySelectorAll('.trow.drop-before,.trow.drop-inside,.trow.drop-after')
    .forEach(el => el.classList.remove('drop-before','drop-inside','drop-after'));
}

async function performTreeDrop(draggedId, targetId, zone){
  if (draggedId === targetId) return;

  const dragged = nodeMap[draggedId];
  const target  = nodeMap[targetId];
  if (!dragged || !target) return;

  // Never drop a node into its own subtree.
  if (clientIsDescendant(dragged, targetId)) return;

  let payload;

  if (zone === 'inside') {
    payload = { newParentId: targetId };          // become last child of target
  } else {
    const loc = clientFindParent(ROOT, targetId);
    if (!loc) return;                             // target is root → no sibling slot
    const newParentId = loc.parent.id;
    if (clientIsDescendant(dragged, newParentId)) return;
    payload = zone === 'before'
      ? { newParentId, beforeId: targetId }
      : { newParentId, afterId:  targetId };
  }

  try {
    const res = await fetch('/api/node/' + encodeURIComponent(draggedId) + '/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Move failed.');
      return;
    }

    if (payload.newParentId) expanded.add(payload.newParentId);
    await reloadTreeAndSelect(draggedId);
  } catch (err) {
    alert('Move failed: ' + err.message);
  }
}

async function autosortChildren(){
  if (!sel || !(sel.c && sel.c.length > 1)) return;

  const order = [...sel.c]
    .sort((a, b) => {
      const ra = rankIndex(a.r), rb = rankIndex(b.r);
      if (ra !== rb) return ra - rb;
      return String(a.n || '').localeCompare(String(b.n || ''));
    })
    .map(ch => ch.id);

  try {
    const res = await fetch('/api/node/' + encodeURIComponent(sel.id) + '/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Sort failed.');
      return;
    }

    expanded.add(sel.id);
    await reloadTreeAndSelect(sel.id);
  } catch (err) {
    alert('Sort failed: ' + err.message);
  }
}

// ── SUNBURST MODE ──────────────────────────────────────────────────────────
// A zoomable D3 sunburst that replaces the book view. Editing reuses the same
// modal editor / add-child dialog as the tree (they're body-level overlays).
let sunburstOn = false;
let sbState = null;
const SB_MAXY = 5;   // show 4 generations below the focus (rings span y 1..SB_MAXY)

function notifySunburstState(){
  if (window.clad0Desktop && typeof window.clad0Desktop.setSunburstState === 'function') {
    window.clad0Desktop.setSunburstState(!!sunburstOn);
  }
}

function setSunburst(on){
  if(on && !projectFeature('sunburstEnabled')){ sunburstOn=false; notifySunburstState(); return false; }
  sunburstOn = !!on;
  const v = document.getElementById('sunburst-view');
  const btn = document.getElementById('btn-sunburst');
  if (sunburstOn){
    v.hidden = false;
    if (btn) btn.classList.add('on');
    renderSunburst(sel && sel.id);
  } else {
    v.hidden = true;
    if (btn) btn.classList.remove('on');
  }
  notifySunburstState();
  return sunburstOn;
}

function toggleSunburst(){
  return setSunburst(!sunburstOn);
}

window.clad0SetSunburst = setSunburst;
window.clad0GetSunburst = function(){ return !!sunburstOn; };

function sbUpdateBar(node){
  const crumbs = document.getElementById('sb-crumbs');
  const editBtn = document.getElementById('sb-edit');
  const addBtn = document.getElementById('sb-add');
  if (!crumbs) return;
  crumbs.innerHTML = '';
  const chain = node.ancestors().reverse();
  chain.forEach((d, i) => {
    if (i) { const sep = document.createElement('span'); sep.className = 'sb-sep'; sep.textContent = '›'; crumbs.appendChild(sep); }
    const a = document.createElement('button');
    a.className = 'sb-crumb' + (i === chain.length - 1 ? ' current' : '');
    a.textContent = d.data.n || d.data.id || '(unnamed)';
    a.onclick = () => sbZoom(d, true);
    crumbs.appendChild(a);
  });
  const node0 = nodeMap[node.data.id];
  if (node0) sel = node0;
  const isRoot = node === sbState.root;
  if (editBtn) editBtn.disabled = isRoot || !node0;
  if (addBtn) addBtn.disabled = !node0;
}

function sbZoom(p, animate){
  if (!sbState) return;
  const { root, path, label, arc, radius, g, parent } = sbState;
  sbState.focus = p;
  parent.datum(p.parent || root);
  const node0 = nodeMap[p.data.id];
  if (node0) sel = node0;
  sbUpdateBar(p);

  root.each(d => d.target = {
    x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
    x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
    y0: Math.max(0, d.y0 - p.depth),
    y1: Math.max(0, d.y1 - p.depth)
  });

  const arcVisible = d => d.y1 <= SB_MAXY && d.y0 >= 1 && d.x1 > d.x0;
  const labelVisible = d => d.y1 <= SB_MAXY && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.045;
  const labelTransform = d => {
    const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
    const y = (d.y0 + d.y1) / 2 * radius;
    return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
  };
  const op = d => arcVisible(d) ? (d.children ? 0.9 : 0.7) : 0;

  // Labels never tween (a transform tween on ~1k <text> nodes tanks the frame
  // rate); they're hidden now and snapped + faded in once geometry settles.
  label.interrupt().attr('opacity', 0);
  const place = () => {
    label.attr('transform', d => labelTransform(d.current));
    label.filter(d => labelVisible(d.current)).transition().duration(180).attr('opacity', 1);
  };

  // Count arcs in the visible band. Near the root that's hundreds, and tweening
  // every arc's path each frame is the remaining lag — so above a threshold we
  // snap to the target instead of animating. Deeper zooms (few arcs) still
  // animate smoothly.
  let nVis = 0; root.each(d => { if (arcVisible(d.target)) nVis++; });
  if (!animate || nVis > 240) {
    root.each(d => d.current = d.target);
    path.interrupt()
      .attr('fill-opacity', d => op(d.current))
      .attr('stroke-opacity', d => arcVisible(d.current) ? 0.9 : 0)
      .attr('pointer-events', d => arcVisible(d.current) ? 'auto' : 'none')
      .attr('d', d => arc(d.current));
    place();
    return;
  }

  const t = g.transition().duration(600);
  path.transition(t).tween('data', d => { const i = d3.interpolate(d.current, d.target); return tt => d.current = i(tt); })
    .filter(function(d){ return +this.getAttribute('fill-opacity') || arcVisible(d.target); })
    .attr('fill-opacity', d => op(d.target))
    .attr('stroke-opacity', d => arcVisible(d.target) ? 0.9 : 0)
    .attr('pointer-events', d => arcVisible(d.target) ? 'auto' : 'none')
    .attrTween('d', d => () => arc(d.current));
  if (t.end) t.end().then(place, () => {}); else place();
}

function renderSunburst(focusId){
  const canvas = document.getElementById('sunburst-canvas');
  if (!canvas) return;
  canvas.innerHTML = '';
  if (!window.d3){
    canvas.innerHTML = '<div class="sb-msg">D3 could not be loaded (it is fetched from a CDN and needs internet). The sunburst view is unavailable offline — the tree and search still work.</div>';
    return;
  }

  const size = Math.max(280, Math.min(canvas.clientWidth || 800, canvas.clientHeight || 800));
  const radius = (size / 2) / SB_MAXY;

  const root = d3.hierarchy(ROOT, d => d.c)
    .sum(d => (d.c && d.c.length) ? 0 : 1)
    .sort((a, b) => b.value - a.value);
  d3.partition().size([2 * Math.PI, root.height + 1])(root);
  root.each(d => d.current = d);

  // Stable hierarchical hue intervals: each node owns a hue range and divides it
  // evenly among its children, so a node's children fan out around its colour
  // (a purple parent → children spanning blue→red) and colours stay fixed as you
  // zoom — they depend on tree position, never on the current focus.
  root.hue0 = 0; root.hue1 = 360;
  (function assignHues(node){
    const kids = node.children || [];
    const span = node.hue1 - node.hue0;
    kids.forEach((k, i) => {
      k.hue0 = node.hue0 + (span * i) / kids.length;
      k.hue1 = node.hue0 + (span * (i + 1)) / kids.length;
      assignHues(k);
    });
  })(root);
  const colorOf = d => {
    const hue = ((d.hue0 + d.hue1) / 2) % 360;
    const light = Math.min(78, 46 + d.depth * 6);   // deeper rings a touch lighter
    return `hsl(${hue.toFixed(1)}, 58%, ${light}%)`;
  };

  const arc = d3.arc()
    .startAngle(d => d.x0).endAngle(d => d.x1)
    .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005)).padRadius(radius * 1.5)
    .innerRadius(d => d.y0 * radius)
    .outerRadius(d => Math.max(d.y0 * radius, d.y1 * radius - 1));

  const arcVisible = d => d.y1 <= SB_MAXY && d.y0 >= 1 && d.x1 > d.x0;
  const labelVisible = d => d.y1 <= SB_MAXY && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.045;
  const labelTransform = d => {
    const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
    const y = (d.y0 + d.y1) / 2 * radius;
    return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
  };

  const svg = d3.create('svg')
    .attr('viewBox', [-size / 2, -size / 2, size, size])
    .attr('width', '100%').attr('height', '100%')
    .style('max-width', '100%').style('max-height', '100%')
    .style('font', '10px "EB Garamond", Georgia, serif');
  const g = svg.append('g');

  const path = g.append('g').selectAll('path')
    .data(root.descendants().slice(1))
    .join('path')
      .attr('fill', d => colorOf(d))
      .attr('fill-opacity', d => arcVisible(d.current) ? (d.children ? 0.9 : 0.7) : 0)
      .attr('pointer-events', d => arcVisible(d.current) ? 'auto' : 'none')
      .attr('stroke', '#f7eed6').attr('stroke-width', 1)
      .attr('stroke-opacity', d => arcVisible(d.current) ? 0.9 : 0)
      .attr('d', d => arc(d.current));
  path.style('cursor', 'pointer').on('click', (event, d) => sbZoom(d, true));
  path.on('contextmenu', (event, d) => {
    event.preventDefault();
    const node = nodeMap[d.data.id];
    if (node) showEntryContext(node, event);
  });
  path.append('title').text(d => d.ancestors().map(a => a.data.n).reverse().join(' › ') + (d.data.r ? ('\n' + d.data.r) : ''));

  const label = g.append('g')
      .attr('pointer-events', 'none').attr('text-anchor', 'middle').style('user-select', 'none')
    .selectAll('text').data(root.descendants().slice(1)).join('text')
      .attr('class', 'sb-label')
      .attr('dy', '0.35em')
      .attr('opacity', d => +labelVisible(d.current))
      .attr('transform', d => labelTransform(d.current))
      .text(d => d.data.n || '');

  const parent = g.append('circle')
      .datum(root)
      .attr('r', radius).attr('fill', 'none').attr('pointer-events', 'all')
      .style('cursor', 'pointer')
      .on('click', () => { const f = sbState.focus; if (f && f.parent) sbZoom(f.parent, true); });
  const centerLabel = g.append('text')
      .attr('class', 'sb-center').attr('text-anchor', 'middle').attr('dy', '0.35em')
      .attr('pointer-events', 'none').text('');

  canvas.appendChild(svg.node());
  sbState = { root, path, label, arc, radius, g, parent, focus: root, centerLabel };

  let focusNode = root;
  if (focusId){ const f = root.descendants().find(d => d.data.id === focusId); if (f) focusNode = f; }
  if (focusNode !== root) sbZoom(focusNode, false);
  else sbUpdateBar(root);
}

// sunburst wiring
{
  const sb = document.getElementById('btn-sunburst');
  if (sb) sb.addEventListener('click', function(){ if(projectFeature('sunburstEnabled')) toggleSunburst(); });
  notifySunburstState();
  const ex = document.getElementById('sb-exit');
  if (ex) ex.addEventListener('click', () => { if (sunburstOn) toggleSunburst(); });
  const ed = document.getElementById('sb-edit');
  if (ed) ed.addEventListener('click', () => { if (sel) openEditor(); });
  const ad = document.getElementById('sb-add');
  if (ad) ad.addEventListener('click', () => { if (sel) openAddChildDialog(); });
  let rt = null;
  window.addEventListener('resize', () => {
    if (!sunburstOn) return;
    clearTimeout(rt);
    rt = setTimeout(() => renderSunburst(sbState && sbState.focus && sbState.focus.data.id), 200);
  });
}


function shellContextPayload(node){
  return {
    id: node.id,
    name: node.n || node.id,
    isRoot: ROOT && node.id === ROOT.id,
    allowEdits: allowEdits(),
    templates: listTemplates().map(t => ({ id: t.id, name: t.n || t.id }))
  };
}
function showEntryContext(node, event){
  if(!node || !event) return;
  event.preventDefault();
  selectNode(node);
  if(inDesktopShell() && window.clad0Desktop.showEntryContextMenu){
    window.clad0Desktop.showEntryContextMenu(shellContextPayload(node));
  } else {
    showCtxMenu(node, event.clientX, event.clientY);
  }
}
async function handleEntryContextAction(d){
  if(!d || !d.id) return;
  const node=nodeMap[d.id]; if(!node) return;
  selectNode(node);
  if(d.action==='edit') return openEditor();
  if(d.action==='addChild') return openAddChildDialog(node, null);
  if(d.action==='addFromTemplate') return openAddChildDialog(node, d.templateId || null);
  if(d.action==='duplicate') return duplicateSelectedNode();
  if(d.action==='delete') return deleteSelectedNode();
  if(d.action==='export') return exportNode(node, d.format || 'json', d.scope || 'entry');
}
window.addEventListener('entry:contextAction', function(e){ handleEntryContextAction(e.detail); });

// right-click context menu on tree rows
{
  const ti = document.getElementById('tree-inner');
  if (ti) ti.addEventListener('contextmenu', function(e){
    const row = e.target.closest && e.target.closest('.trow');
    if (!row) return;
    const node = nodeMap[row.dataset.id];
    if (!node) return;
    showEntryContext(node, e);
  });
}

// crosslink navigation in the entry body
{
  const eb = document.querySelector('#right-scroll .entry-body');
  if (eb) eb.addEventListener('click', function(e){
    const a = e.target.closest && e.target.closest('.xlink[data-jump]');
    if (a) { e.preventDefault(); jumpTo(a.dataset.jump); }
  });
}

// ── BOOTSTRAP ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  fetch('/api/clado')
    .then(r => {
      if (!r.ok) throw new Error('Failed to load clado: ' + r.status);
      return r.json();
    })
    .then(async data => { await loadShellTheme(); await loadProjectSettings(); await loadMeta(); init(data); applyProjectSettings(); openInitialViewerFromQuery();
  openInitialEditorFromQuery(); })
    .catch(err => {
      document.body.innerHTML =
        '<div style="padding:2rem;color:#c00;font-family:monospace">' +
        '<b>clad0 load error:</b><br>' + err.message + '</div>';
    });
});

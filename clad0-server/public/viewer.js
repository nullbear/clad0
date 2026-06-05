

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
function isStale(n){ return !n.staleExempt && typeof n.revised==='number' && (Date.now()-n.revised > STALE_MS); }

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
    if(n.n&&n.n.toLowerCase().startsWith(q)) return true;
    if((n.sn||"").toLowerCase().startsWith(q)) return true;
    return parseFlags(n).some(f=>f.label.toLowerCase().startsWith(q));}
  return true;
}
function anyVis(n){if(vis(n)) return true;return (n.c||[]).some(ch=>anyVis(ch));}

function rankClass(r){
  return 'rank-'+String(r||'species').toLowerCase().replace(/[^a-z0-9]+/g,'-');
}
function tagClass(t){
  return 'tag-'+String(t||'reference').toLowerCase().replace(/[^a-z0-9]+/g,'-');
}
function displayClass(n){
  return n.tag ? tagClass(n.tag) : rankClass(n.r);
}
function displayLabel(n){
  if(n.tag){const t=String(n.tag);return t==='Reference'?'ref':t==='Catalogue'?'cat':t.substring(0,5).toLowerCase();}
  const rk=n.r||'';
  if(rk==='Pantheon') return 'panth'; if(rk==='Major Deity') return 'mjr.d'; if(rk==='Deity') return 'deity';
  if(rk==='Minor Deity') return 'mnr.d'; if(rk==='Demigod') return 'demi';
  if(rk==='Archdevil') return 'a.dvl'; if(rk==='Archdemon') return 'a.dmn';
  if(rk==='Archangel') return 'a.ang'; if(rk==='Archfey') return 'a.fey';
  if(rk==='Avatar') return 'avtr'; if(rk==='Divine Servitor') return 'serv';
  return rk==='Domain'?'dom':rk==='Kingdom'?'kgdm':rk==='Phylum'?'phyl':rk==='Class'?'class':rk==='Order'?'ordr':
    rk==='Family'?'fam':rk==='Genus'?'gen':rk==='Species'?'sp':rk.substring(0,5).toLowerCase();
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
  row.className='trow'+(n.rankMismatch?' rank-mismatch':'')+(_hasSheet?' has-statsheet':'')+(isStale(n)?' is-stale':'');
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
  rkEl.title=n.tag ? ('Non-taxonomic tag: '+n.tag) : ('Taxonomic rank: '+rk);
  lbl.appendChild(rkEl);

  const nm=document.createElement('span');
  let nc='tname '+rankClass(rk);
  if(n.tag==='Reference'||n.tag==='Catalogue') nc+=' ref';
  else if(rk==='Domain'||rk==='Kingdom') nc+=' kg';
  else if(rk==='Species') nc+=' sp';
  if(n.fossil&&!n.theorized) nc+=' ext';
  if(n.theorized) nc+=' theo';
  if(n.ctx) nc+=' ctx';
  nm.className=nc+(n.rankMismatch?' rank-mismatch-name':'');
  if(n.rankMismatch){nm.title=mismatchTitle(n);nm.appendChild(mismatchBang());}
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
  if(m.stats){const s=document.createElement('span');s.className='tmark tmark-stats';s.textContent='▤';s.title='Has monster stat sheet';ind.appendChild(s);}
  if(m.img){const im=document.createElement('span');im.className='tmark tmark-img';im.textContent='◳';im.title='Has species image graphic';ind.appendChild(im);}
  if(m.banner){const b=document.createElement('span');b.className='tmark tmark-banner'+(m.bannerWarn?' warn':'');b.textContent=m.bannerWarn?'▭!':'▭';b.title=m.bannerWarn?('Banner image — width '+(m.bannerW||'?')+'px ≠ '+BANNER_IDEAL_WIDTH+'px ideal; review/crop recommended'):'Banner image';ind.appendChild(b);}
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
  if(m.imgBytes){const z=document.createElement('span');z.className='tsize tsize-img';z.textContent='◳'+fmtBytes(m.imgBytes);z.title='Species image size';lbl.appendChild(z);}
  if(m.bannerBytes){const z=document.createElement('span');z.className='tsize tsize-banner'+(m.bannerWarn?' warn':'');z.textContent='▭'+fmtBytes(m.bannerBytes);z.title='Banner image size'+(m.bannerW?(' ('+m.bannerW+'px)'):'');lbl.appendChild(z);}

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
function mismatchTitle(n){return n.rankMismatch ? ('Rank/position mismatch: expected '+(n.expectedRank||'next hierarchical rank')+', marked '+(n.r||'unranked')) : ''; }
function mismatchBang(){
  const b=document.createElement('span');
  b.className='rank-mismatch-bang';
  b.textContent='!';
  b.title='Taxological rank does not match hierarchical position';
  return b;
}
function escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function flaggedNameHTML(n,prefix){
  return (n.rankMismatch?'<span class="rank-mismatch-bang" title="Taxological rank does not match hierarchical position">!</span>':'')+escHtml(prefix||'')+escHtml(n.n||'');
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
      const html = parse(src);
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
  ['crosslink','Crosslink (to another entry)']
];
function hasFieldSchema(n){ return Array.isArray(n.fields); }
function schemaShortFields(n){ return hasFieldSchema(n) ? n.fields.filter(f => f && f.type === 'short') : []; }
// Resolve a stable id (sid) to its current node — crosslinks store the sid so
// they survive slug renames, and display the target's current name.
function nodeBySid(sid){
  if (!sid) return null;
  for (const id in nodeMap) { const m = nodeMap[id]; if (m && m.sid === sid) return m; }
  return null;
}
function crosslinkSids(v){ return Array.isArray(v) ? v.filter(Boolean) : (v ? [v] : []); }
// Parse a comma-separated list of target slugs into stable sids (rename-safe).
function crosslinkValueFromInput(str){
  return String(str || '').split(',').map(s => s.trim()).filter(Boolean).map(function(s){
    const node = nodeMap[s];
    return node ? (node.sid || s) : s;
  });
}
function renderSchemaBody(n){
  let h = '';
  (n.fields || []).forEach(function(f){
    if (!f || !f.key || f.type === 'short') return;   // short fields live in the header
    const v = n[f.key];
    const label = escHtml(f.label || f.key);
    if (f.type === 'prose') {
      if (v && String(v).trim()) h += '<section><h3>' + label + '</h3>' + renderAbilitiesMarkdown(v) + '</section>';
    } else if (f.type === 'check') {
      return;   // boolean fields render as a labelled badge in the badge row, not a body line
    } else if (f.type === 'crosslink') {
      const sids = crosslinkSids(v);
      if (sids.length) {
        const links = sids.map(function(sid){
          const t = nodeBySid(sid);
          return t ? '<a class="xlink" data-jump="' + escHtml(t.id) + '">' + escHtml(t.n || t.id) + '</a>'
                   : '<span class="xlink missing">(unresolved link)</span>';
        }).join(', ');
        h += '<div class="e-section"><div class="e-head">' + label + '</div><div class="e-line">' + links + '</div></div>';
      }
    } else { // text / select
      if (v != null && String(v).trim()) h += '<div class="e-section"><div class="e-head">' + label + '</div><div class="e-line">' + escHtml(String(v)) + '</div></div>';
    }
  });
  if (!h) h = '<section class="e-empty"><em>No content yet — open Edit to fill in this entry’s fields.</em></section>';
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
  etEl.className=tc+(n.rankMismatch?' rank-mismatch-name':'');
  etEl.innerHTML='';
  if(n.rankMismatch){etEl.title=mismatchTitle(n);etEl.appendChild(mismatchBang());}
  etEl.appendChild(document.createTextNode((isTheo?'? ':'')+(isDead?'† ':'')+n.n));

  const erkEl=document.getElementById('entry-rank-line');
  erkEl.innerHTML='';
  const idc=document.createElement('span');idc.className='id-chip';idc.textContent='No. '+entryNo(n);erkEl.appendChild(idc);
  if(tag){
    const ts=document.createElement('span');ts.className='tag-stamp '+tagClass(tag);ts.textContent=tag;erkEl.appendChild(ts);
  } else if(rk){
    const rs=document.createElement('span');
    rs.className='rank-stamp '+rankClass(rk)+(isTheo?' inferred':'')+(rk==='Kingdom'?' kingdom':isDead?' fossil':isTheo?' theorized':'');
    if(rk==='Domain'||rk==='Kingdom') rs.style.background=kc;
    rs.textContent=rk;
    erkEl.appendChild(rs);
  }
  const _shorts = hasFieldSchema(n)
    ? schemaShortFields(n).map(function(f){ return { key:f.key, label:f.label, val:n[f.key] }; })
    : (n.sn ? [{ key:'sn', label:'', val:n.sn }] : []);
  _shorts.forEach(function(s){
    if (!s.val) return;
    const sn=document.createElement('span');
    sn.style.cssText='font-style:italic;font-size:14px;color:#6a4a20;font-family:EB Garamond,serif';
    sn.textContent=(s.key!=='sn' && s.label ? (s.label+': ') : '')+s.val;
    erkEl.appendChild(sn);
  });
  if(isDead){const t=document.createElement('span');t.className='rank-stamp fossil';t.textContent='† Extinct';erkEl.appendChild(t);}
  if(isTheo){const t=document.createElement('span');t.className='rank-stamp theorized';t.textContent='? Inferred — no specimen';erkEl.appendChild(t);}
  if(n.curse){const t=document.createElement('span');t.className='rank-stamp curse-tag';t.textContent='☠ Curse vector';erkEl.appendChild(t);}
  if(!tag&&n._kg&&rk!=='Kingdom'){
    const kg=document.createElement('span');
    kg.className='kg-line';
    kg.innerHTML='— <span style="color:'+kc+'">'+n._kg+'</span> Kingdom';
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
    html+='<div class="e-path">'+bc+' › <strong style="color:#1a1208">'+n.n+'</strong></div>';
  }
  let badges='';
  if(tag) badges+='<span class="ebadge ctx">§ '+tag+'</span>';
  if(n.gorge) badges+='<span class="ebadge gorge">🌑 Present in the Gorge</span>';
  if(n.ctx) badges+='<span class="ebadge ctx">◌ Non-Gorge context</span>';
  if(isDead) badges+='<span class="ebadge fossil">† Extinct</span>';
  if(isTheo) badges+='<span class="ebadge theo">? Theorised — no specimen</span>';
  if(n.curse) badges+='<span class="ebadge curse">☠ Curse or transformation vector</span>';
  if(n.rankMismatch) badges+='<span class="ebadge curse"><span class="rank-mismatch-bang">!</span> Rank/position mismatch: expected '+escHtml(n.expectedRank||'next rank')+', marked '+escHtml(rk||'unranked')+'</span>';
  if(n.conv) badges+='<span class="ebadge conv">⚡ Convergent morphology</span>';
  _fl.forEach(f=>{ badges+='<span class="ebadge flagchip flag-'+f.slug+'" style="--fh:'+f.hue+'">⚑ '+escHtml(f.label)+'</span>'; });
  if(hasFieldSchema(n)){ n.fields.forEach(function(f){ if(f&&f.type==='check'&&n[f.key]) badges+='<span class="ebadge ctx">'+escHtml(f.label||f.key)+'</span>'; }); }
  if(badges) html+='<div class="badge-row">'+badges+'</div>';

  // banner image (any entry) — full width, above summary & stat sheet, below meta
  if(n.banner){
    html+='<div class="e-banner"><img src="/media/'+encodeURIComponent(n.id)+'__banner.'+escHtml(n.banner)+'" alt="'+escHtml(n.n||'')+' banner"></div>';
  }
  // species only: monster image (8:11, left) beside the stat sheet (prioritised)
  if(n.r==='Species' && (n.img || n.hasStats)){
    html+='<div class="species-block">';
    if(n.img){
      html+='<div class="mon-image"><div class="mon-image-box"><img src="/media/'+encodeURIComponent(n.id)+'.'+escHtml(n.img)+'" alt="'+escHtml(n.n||'')+'"></div></div>';
    }
    if(n.hasStats){
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
  const kids=(n.c||[]).filter(ch=>anyVis(ch));
  if(kids.length){
    html+='<div class="e-section"><div class="e-head">Subordinate Taxa ('+kids.length+')</div><div class="sub-list">';
    kids.forEach(ch=>{
      const cD=ch.fossil&&!ch.theorized,cT=ch.theorized;
      const cn='sub-name'+((ch.r==='Species'||ch.r==='Subspecies')?' sp':'')+(cD?' ext':'')+(cT?' theo':'');
      const dot='<span class="sub-dot" style="background:'+(kgColor[ch.id]||kc)+';'+(ch.ctx?'opacity:.4':'')+'"></span>';
      html+='<div class="sub-item" onclick="jumpTo(\''+jsArg(ch.id)+'\')">'+dot+'<span class="'+cn+(ch.rankMismatch?' rank-mismatch-name':'')+'"'+(ch.rankMismatch?' title="'+escHtml(mismatchTitle(ch))+'"':'')+'>'+flaggedNameHTML(ch,(cT?'? ':'')+(cD?'† ':''))+'</span><span class="sub-rank">'+displayType(ch)+'</span></div>';
    });
    html+='</div></div>';
  }
  html+='</div>';
  const scroll=document.getElementById('right-scroll');
  const body=scroll.querySelector('.entry-body');
  body.innerHTML=html;
  scroll.scrollTop=0;

  if(n.hasStats){
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

const EDIT_FIELDS = [
  ['n', 'Name', 'text'],
  ['sn', 'Scientific name', 'text'],
  ['r', 'Rank', 'select'],
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
  ['isTemplate', 'Template (a prototype to duplicate from)', 'checkbox'],
  ['tag', 'Reference tag (e.g. Reference / Catalogue)', 'text'],
  ['rankMismatch', 'Rank-position mismatch flag', 'checkbox'],
  ['expectedRank', 'Expected rank (if mismatched)', 'text'],
  ['css', 'Flags (separate with ; — e.g. To Do; New Content)', 'text']
];
// The built-in prose sections — shown only for entries WITHOUT a custom field
// schema. Schema entries render their own fields instead.
const EDIT_LEGACY_PROSE = new Set(['summary','tax','ap','eco','beh','traitsText','abilities','bg','note']);

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
    const r=await fetch('/api/node/'+encodeURIComponent(sel.id)+'/image?kind='+kind,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,ext,filename:file.name,data:dataUrl})});
    const d=await r.json();
    if(!r.ok){ statusEl.textContent=d.error||'Upload failed'; return; }
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
    if(kind==='banner') sel.banner=null; else sel.img=null;
    statusEl.textContent='Removed.';
    await loadMeta(); rerenderTree(); restoreSelectionRow();
    if(refresh) refresh();
  }catch(err){ statusEl.textContent='Remove failed: '+err.message; }
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
    btn.onclick=function(){ sel.fields=[{key:'overview',label:'Overview',type:'prose'}]; wrap.remove(); buildSchemaEditor(form); };
    wrap.appendChild(btn);
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
      else if(el._mde) values[k]=el._mde.value();
      else values[k]=el.value;
    });
  }
  function refresh(){ readValuesFromDom(); renderValues(); renderDefs(); }

  function renderValues(){
    valuesEl.innerHTML='';
    sel.fields.forEach(f=>{
      if(!f||!f.key) return;
      const row=document.createElement('label'); row.className='edit-row';
      const t=document.createElement('span'); t.textContent=(f.label||f.key); row.appendChild(t);
      let input;
      if(f.type==='prose'){ input=document.createElement('textarea'); input.rows=4; input.dataset.mdLazy='1'; input.value=values[f.key]||''; }
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
        input.value=sids.map(function(sid){ const t=nodeBySid(sid); return t?t.id:sid; }).join(', ');
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
      const r=document.createElement('div'); r.className='schema-def';
      const key=document.createElement('input'); key.type='text'; key.value=f.key||''; key.placeholder='key'; key.className='sd-key';
      const lab=document.createElement('input'); lab.type='text'; lab.value=f.label||''; lab.placeholder='label'; lab.className='sd-label';
      const typ=document.createElement('select'); SCHEMA_FIELD_TYPES.forEach(p=>{const op=document.createElement('option');op.value=p[0];op.textContent=p[1];typ.appendChild(op);}); typ.value=f.type||'prose';
      const up=document.createElement('button'); up.type='button'; up.textContent='↑'; up.className='sd-mv';
      const dn=document.createElement('button'); dn.type='button'; dn.textContent='↓'; dn.className='sd-mv';
      const del=document.createElement('button'); del.type='button'; del.textContent='×'; del.className='sd-del';
      key.onchange=()=>{ readValuesFromDom(); const old=f.key; const nk=slugifyKey(key.value)||old; if(nk!==old){ values[nk]=values[old]; delete values[old]; f.key=nk; } refresh(); };
      lab.oninput=()=>{ f.label=lab.value; };
      typ.onchange=()=>{ readValuesFromDom(); f.type=typ.value; refresh(); };
      up.onclick=()=>{ if(i>0){ readValuesFromDom(); sel.fields.splice(i-1,0,sel.fields.splice(i,1)[0]); refresh(); } };
      dn.onclick=()=>{ if(i<sel.fields.length-1){ readValuesFromDom(); sel.fields.splice(i+1,0,sel.fields.splice(i,1)[0]); refresh(); } };
      del.onclick=()=>{ readValuesFromDom(); sel.fields.splice(i,1); if(!sel.fields.length){ sel.fields=null; wrap.remove(); buildSchemaEditor(form); } else refresh(); };
      r.appendChild(key); r.appendChild(lab); r.appendChild(typ);
      if(f.type==='select'){ const opt=document.createElement('input'); opt.type='text'; opt.className='sd-opts'; opt.placeholder='options, comma-separated'; opt.value=Array.isArray(f.options)?f.options.join(', '):(f.options||''); opt.onchange=()=>{ f.options=opt.value.split(',').map(s=>s.trim()).filter(Boolean); }; r.appendChild(opt); }
      r.appendChild(up); r.appendChild(dn); r.appendChild(del);
      defsEl.appendChild(r);
    });
  }

  addBtn.onclick=()=>{ readValuesFromDom(); sel.fields.push({key:uniqueFieldKey(sel.fields),label:'New field',type:'prose'}); refresh(); };

  renderValues(); renderDefs();
}

async function openEditor() {
  if (!sel) return;
  await ensureDetailLoaded(sel);
  ensureEditorUI();

  const form = document.getElementById('edit-form');
  teardownProseEditors();
  form.innerHTML = '';
  const usingSchema = hasFieldSchema(sel);
  for (const [key, label, type] of EDIT_FIELDS) {
    if (usingSchema && EDIT_LEGACY_PROSE.has(key)) continue;   // schema replaces these
    const row = document.createElement('label'); row.className = 'edit-row';
    const title = document.createElement('span'); title.textContent = label; row.appendChild(title);
    let input;
    if (type === 'textarea') { input = document.createElement('textarea'); input.rows = 4; input.value = sel[key] || ''; input.dataset.md = '1'; }
    else if (type === 'checkbox') { input = document.createElement('input'); input.type = 'checkbox'; input.checked = !!sel[key]; }
    else if (type === 'select') {
      input = document.createElement('select');
      (key === 'r' ? rankOptions(sel.r) : []).forEach(function(o){ const op=document.createElement('option'); op.value=o; op.textContent=(o===''?'—':o); input.appendChild(op); });
      input.value = sel[key] || '';
    }
    else { input = document.createElement('input'); input.type = 'text'; input.value = sel[key] || ''; }
    input.name = key; row.appendChild(input); form.appendChild(row);
  }

  // Renamable slug (id) + immutable stable id (sid). Renaming moves the
  // slug-named files server-side; crosslinks (which use the sid) are unaffected.
  const idRow = document.createElement('div'); idRow.className = 'edit-row edit-idrow';
  const idT = document.createElement('span'); idT.textContent = 'ID / slug (renamable)';
  const idIn = document.createElement('input'); idIn.type = 'text'; idIn.id = 'edit-slug';
  idIn.value = sel.id; idIn.autocomplete = 'off'; idIn.spellcheck = false;
  const idMsg = document.createElement('div'); idMsg.className = 'edit-idmsg';
  idRow.appendChild(idT); idRow.appendChild(idIn); idRow.appendChild(idMsg);
  form.insertBefore(idRow, form.firstChild);
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
      idMsg.textContent = (v !== sel.id ? 'will rename files · ' : '') + 'stable id: ' + (sel.sid || '— (assigned on save)');
      if (saveBtn) saveBtn.disabled = false;
    }
  }
  idIn.addEventListener('input', validateSlug);
  validateSlug();

  enhanceMd(form);
  _editorHadSchema = hasFieldSchema(sel);
  buildSchemaEditor(form);

  const extra=document.getElementById('edit-extra');
  extra.innerHTML='';
  const isSpecies = sel.r==='Species';

  const bHead=document.createElement('div'); bHead.className='edit-attach-head';
  bHead.textContent='Banner image (any entry — full-width header, ideal '+BANNER_IDEAL_WIDTH+'px wide)';
  extra.appendChild(bHead);
  extra.appendChild(imageControl('banner','Banner image'));

  if(isSpecies){
    const mHead=document.createElement('div'); mHead.className='edit-attach-head'; mHead.textContent='Species image (8:11 icon, shown beside the stat sheet)';
    extra.appendChild(mHead);
    extra.appendChild(imageControl('monster','Species image'));

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
  } else {
    const note=document.createElement('div'); note.className='edit-attach-note';
    note.textContent='Stat sheet and species image are available only on Species-rank entries.';
    extra.appendChild(note);
  }

  document.getElementById('edit-status').textContent = '';
  document.getElementById('edit-panel').classList.add('open');
}

let _mdeInstances = [];
// Turn one textarea into an EasyMDE editor (if the lib is present). Degrades
// silently to a plain textarea when it isn't, or if init throws.
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
  root.querySelectorAll('textarea[data-md]').forEach(enhanceTextarea);
  root.querySelectorAll('textarea[data-md-lazy]').forEach(bindLazyMd);
}
function teardownProseEditors(){
  _mdeInstances.forEach(function(mde){ try { mde.toTextArea(); } catch (_) {} });
  _mdeInstances = [];
}

function closeEditor() {
  teardownProseEditors();
  const panel = document.getElementById('edit-panel');
  if (panel) panel.classList.remove('open');
}

async function saveEditor() {
  if (!sel) return;

  const status = document.getElementById('edit-status');
  const form = document.getElementById('edit-form');
  const payload = {};

  for (const [key, , type] of EDIT_FIELDS) {
    const input = form.elements[key];
    if (!input) continue;

    if (type === 'checkbox') {
      payload[key] = input.checked;
    } else if (input._mde) {
      payload[key] = input._mde.value().trim();
    } else {
      payload[key] = input.value.trim();
    }
  }

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
    status.textContent = data.error || 'Save failed';
    return;
  }
  if (data.sid) sel.sid = data.sid;
  const finalId = data.id || newSlug;

  // Persist the 5e stat sheet (species only; toggle off or empty clears it).
  if (sel.r === 'Species') {
    const tgl = document.getElementById('edit-has-stats');
    const sform = document.getElementById('edit-stat-form');
    if (tgl && sform) {
      const stats = tgl.checked ? readStatForm(sform) : null;
      const sres = await fetch('/api/node/' + encodeURIComponent(finalId) + '/stats', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stats: stats || {} })
      });
      if (sres.ok) { const sd = await sres.json(); sel.hasStats = !!sd.hasStats; }
    }
  }

  Object.assign(sel, payload);

  // Re-index because name/rank/status fields may affect search, labels, colors, etc.
  nodeMap = {};
  kgColor = {};
  await loadMeta();
  indexTree(ROOT, null, []);

  rerenderTree();
  selectNode(nodeMap[sel.id]);

  status.textContent = 'Saved.';
  setTimeout(closeEditor, 400);
}

/* ── STRUCTURAL TREE EDITING ── */

function ensureEntryActionButtons() {
  if (!sel) return;

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
    editBtn.onclick = openEditor;

    const addBtn = document.createElement('button');
    addBtn.id = 'entry-add-child-btn';
    addBtn.type = 'button';
    addBtn.textContent = 'Add Child';
    addBtn.onclick = openAddChildDialog;

    const moveBtn = document.createElement('button');
    moveBtn.id = 'entry-move-btn';
    moveBtn.type = 'button';
    moveBtn.textContent = 'Move';
    moveBtn.onclick = openMoveDialog;

    const delBtn = document.createElement('button');
    delBtn.id = 'entry-delete-btn';
    delBtn.type = 'button';
    delBtn.textContent = 'Delete';
    delBtn.onclick = deleteSelectedNode;

    const sortBtn = document.createElement('button');
    sortBtn.id = 'entry-sort-btn';
    sortBtn.type = 'button';
    sortBtn.textContent = 'Sort ⇅';
    sortBtn.title = 'Auto-sort children by rank, then name';
    sortBtn.onclick = autosortChildren;

    tools.appendChild(editBtn);
    tools.appendChild(addBtn);
    tools.appendChild(moveBtn);
    tools.appendChild(delBtn);
    tools.appendChild(sortBtn);
  }

  rankLine.appendChild(tools);

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
  const _acsn=document.getElementById('ac-sn'); if(_acsn) _acsn.value='';
  const status=document.getElementById('ac-status');
  const tmpl = _acTemplateId ? nodeMap[_acTemplateId] : null;
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
  const snEl=document.getElementById('ac-sn');
  const sciName=snEl?snEl.value.trim():'';
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
    const overrides={ r: rank||'Entry', isTemplate:false };
    if(sciName) overrides.sn=sciName;     // only override sci-name if explicitly given
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
// Action list. Designed to be extended (Pass 4 adds "Create child from template").
function ctxItems(node) {
  const isRoot = node.id === (ROOT && ROOT.id);
  const items = [
    { label: 'Edit entry', fn: () => { selectNode(node); openEditor(); } },
    { label: 'Add child', fn: () => { selectNode(node); openAddChildDialog(node, null); } },
    { label: 'New child from template', submenu: ctxTemplateSubmenu(node) },
    { label: 'Duplicate (with subtree)', fn: () => { selectNode(node); duplicateSelectedNode(); } }
  ];
  if (!isRoot) items.push({ sep: true }, { label: 'Delete…', danger: true, fn: () => { selectNode(node); deleteSelectedNode(); } });
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

function toggleSunburst(){
  sunburstOn = !sunburstOn;
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
}

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
    if (node) showCtxMenu(node, event.clientX, event.clientY);
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
  if (sb) sb.addEventListener('click', toggleSunburst);  const ex = document.getElementById('sb-exit');
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

// right-click context menu on tree rows
{
  const ti = document.getElementById('tree-inner');
  if (ti) ti.addEventListener('contextmenu', function(e){
    const row = e.target.closest && e.target.closest('.trow');
    if (!row) return;
    const node = nodeMap[row.dataset.id];
    if (!node) return;
    e.preventDefault();
    showCtxMenu(node, e.clientX, e.clientY);
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
    .then(async data => { await loadMeta(); init(data); })
    .catch(err => {
      document.body.innerHTML =
        '<div style="padding:2rem;color:#c00;font-family:monospace">' +
        '<b>clad0 load error:</b><br>' + err.message + '</div>';
    });
});

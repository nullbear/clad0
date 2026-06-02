

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

const TABS=[
  {label:"Rules", id:"default-entry-rules", abbr:"RULE"},
  {label:"Grading", id:"ref-entry-quality-grading", abbr:"GRD"},
  {label:"Transformations", id:"mutagenic-transformations", abbr:"TRN"},
  {label:"All Taxa",  id:null,          abbr:"ALL"},
  {label:"Fiends",    id:"k-fiends",    abbr:"FND"},
  {label:"Celestials",id:"k-celestials",abbr:"CEL"},
  {label:"Fey",       id:"k-fey",       abbr:"FEY"},
  {label:"Elementals",id:"k-elementals",abbr:"ELM"},
  {label:"Unlife",    id:"k-unlife",    abbr:"UNL"},
  {label:"Plants",    id:"k-plants",    abbr:"PLT"},
  {label:"Fungi",     id:"k-fungi",     abbr:"FNG"},
  {label:"Beasts",    id:"k-beasts",    abbr:"BST"},
  {label:"Monstrosities", id:"k-monst", abbr:"MON"},
  {label:"Far Realm", id:"far-realm-outside-existence",   abbr:"FAR"},
  {label:"Humanoids", id:"k-humanoids", abbr:"HUM"},
  {label:"Giants",    id:"k-giants",    abbr:"GNT"},
  {label:"Dragons",   id:"k-dragons",   abbr:"DRG"},
  {label:"Constructs",id:"k-constructs",abbr:"CON"},
  {label:"Undead",    id:"ud-undead-section",abbr:"UND"},
  {label:"The Nadir", id:"nadir-presence",   abbr:"NDR"},
];

let ROOT=null,sel=null,nodeMap={},kgColor={};
let sG=true,sC=true,sT=true,sCu=true,searchQ="";
let expanded=new Set(),pgLeft=1,pgRight=2;

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
    return n.n.toLowerCase().includes(q)||(n.sn||"").toLowerCase().includes(q);}
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
  row.className='trow'+(n.rankMismatch?' rank-mismatch':'');row.dataset.id=n.id;

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
function selectNode(n){
  sel=n;
  document.querySelectorAll('.trow.sel').forEach(r=>r.classList.remove('sel'));
  const row=document.querySelector(`.trow[data-id="${n.id}"]`);
  if(row) row.classList.add('sel');
  renderDetail(n);
  let editBtn = document.getElementById('entry-edit-btn');
if (!editBtn) {
  editBtn = document.createElement('button');
  editBtn.id = 'entry-edit-btn';
  editBtn.type = 'button';
  editBtn.textContent = 'Edit';
  editBtn.onclick = openEditor;

  const rankLine = document.getElementById('entry-rank-line');
  rankLine.appendChild(editBtn);
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
  return '<div class="e-section"><div class="e-head">'+title+'</div><p class="e-text '+cls+'">'+text+'</p></div>';
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
  if(n.sn){const sn=document.createElement('span');sn.style.cssText='font-style:italic;font-size:14px;color:#6a4a20;font-family:EB Garamond,serif';sn.textContent=n.sn;erkEl.appendChild(sn);}
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
  document.getElementById('pgnum-right').textContent='No. '+entryNo(n);
  const rp=document.getElementById('right-page');
  rp.classList.remove('flip'); void rp.offsetWidth; rp.classList.add('flip');

  let html='<div id="entry-body-inner">';
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
  if(badges) html+='<div class="badge-row">'+badges+'</div>';

  const guideEntry = (n.tag==='Reference'||n.tag==='Catalogue');
  if(guideEntry){
    html+=addSection('1. Purpose', sectionText(n,'summary'));
    html+=addSection('2. Scope & Status', sectionText(n,'tax'), 'tax-text');
    html+=addSection('3. Display Convention', sectionText(n,'appearance'), 'ap-text');
    html+=addSection('4. Use in Review', sectionText(n,'ecology'));
    html+=addSection('5. Common Errors', sectionText(n,'behavior'));
    html+=addSection('6. Quality Criteria', sectionText(n,'traits'));
    html+=addSection('7. Editorial Action', sectionText(n,'abilities'));
    html+=addSection('8. Notes', sectionText(n,'background'));
  } else {
    html+=addSection('1. Summary Description', sectionText(n,'summary'));
    html+=addSection('2. Taxonomic Definition', sectionText(n,'tax'), 'tax-text');
    html+=addSection('3. Physical Appearance', sectionText(n,'appearance'), 'ap-text');
    html+=addSection('4. Ecology', sectionText(n,'ecology'));
    html+=addSection('5. Behavior & Personality', sectionText(n,'behavior'));
    html+=addSection('6. Traits', sectionText(n,'traits'));
    html+=addSection('7. Abilities', sectionText(n,'abilities'));
    html+=addSection('8. Background', sectionText(n,'background'));
  }
  if(n.conv) html+=addSection('Convergent Evolution', n.conv, '');
  if(n.note) html+='<div class="e-section"><div class="e-head">Classification Notes</div><div class="e-note">'+n.note+'</div></div>';
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

/* ── THUMBHOLE TABS ── */
function buildTabs(){
  const col=document.getElementById('tab-col');
  col.innerHTML='';
  TABS.forEach((tab,i)=>{
    const el=document.createElement('div');
    el.className='thumbtab';el.dataset.tabid=tab.id||'all';
    el.title=tab.label;
    const lbl=document.createElement('div');lbl.className='thumbtab-label';lbl.textContent=tab.abbr;
    const tabNode=tab.id?nodeMap[tab.id]:null;
    const color=tab.id==='default-entry-rules'?'#8a6a2a':(tabNode?(kgColor[tab.id]||KC[tabNode.n]||KC[tabNode._kg]):'#8a7040');
    el.style.borderColor=color;
    el.style.boxShadow='inset 9px 0 0 '+color+', inset 2px 0 5px rgba(255,255,255,.25), 0 1px 2px rgba(0,0,0,.15)';
    el.appendChild(lbl);
    el.addEventListener('click',()=>tabClick(tab,el));
    col.appendChild(el);
  });
}

function tabClick(tab,el){
  document.querySelectorAll('.thumbtab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  if(!tab.id){rerenderTree();return;}
  const n=nodeMap[tab.id];if(!n) return;
  n._path.forEach(p=>expanded.add(p.id));expanded.add(tab.id);
  rerenderTree();selectNode(n);
  setTimeout(()=>{
    const row=document.querySelector(`.trow[data-id="${tab.id}"]`);
    if(row) row.scrollIntoView({block:'start',behavior:'smooth'});
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
document.getElementById('search-field').addEventListener('input',e=>{
  clearTimeout(st);
  st=setTimeout(()=>{
    searchQ=e.target.value.trim();
    if(searchQ){
      function em(n){
        if(n.n.toLowerCase().includes(searchQ.toLowerCase())||(n.sn||'').toLowerCase().includes(searchQ.toLowerCase())){
          n._path.forEach(p=>expanded.add(p.id));expanded.add(n.id);
        }(n.c||[]).forEach(em);
      }em(ROOT);
    }
    rerenderTree();
  },200);
});



/* ── INIT ── */
function init(data){
  ROOT=data;indexTree(ROOT,null,[]);
  expanded.clear();
  expanded.add(ROOT.id); // start collapsed: show only the root's immediate children
  buildTabs();
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
  ['r', 'Rank', 'text'],
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
  ['curse', 'Curse vector', 'checkbox']
];

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

function openEditor() {
  if (!sel) return;
  ensureEditorUI();

  const form = document.getElementById('edit-form');
  form.innerHTML = '';

  for (const [key, label, type] of EDIT_FIELDS) {
    const row = document.createElement('label');
    row.className = 'edit-row';

    const title = document.createElement('span');
    title.textContent = label;
    row.appendChild(title);

    let input;
    if (type === 'textarea') {
      input = document.createElement('textarea');
      input.rows = 4;
      input.value = sel[key] || '';
    } else if (type === 'checkbox') {
      input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = !!sel[key];
    } else {
      input = document.createElement('input');
      input.type = 'text';
      input.value = sel[key] || '';
    }

    input.name = key;
    row.appendChild(input);
    form.appendChild(row);
  }

  document.getElementById('edit-status').textContent = '';
  document.getElementById('edit-panel').classList.add('open');
}

function closeEditor() {
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
    } else {
      payload[key] = input.value.trim();
    }
  }

  status.textContent = 'Saving…';

  const res = await fetch('/api/node/' + encodeURIComponent(sel.id), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  if (!res.ok) {
    status.textContent = data.error || 'Save failed';
    return;
  }

  Object.assign(sel, payload);

  // Re-index because name/rank/status fields may affect search, labels, colors, etc.
  nodeMap = {};
  kgColor = {};
  indexTree(ROOT, null, []);

  rerenderTree();
  selectNode(nodeMap[sel.id]);

  status.textContent = 'Saved.';
  setTimeout(closeEditor, 400);
}

// ── BOOTSTRAP ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  fetch('/api/clado')
    .then(r => {
      if (!r.ok) throw new Error('Failed to load clado: ' + r.status);
      return r.json();
    })
    .then(data => init(data))
    .catch(err => {
      document.body.innerHTML =
        '<div style="padding:2rem;color:#c00;font-family:monospace">' +
        '<b>clad0 load error:</b><br>' + err.message + '</div>';
    });
});

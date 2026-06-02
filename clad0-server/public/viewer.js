

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
  ensureEntryActionButtons();
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
  return '<section class="'+cls+'"><h3>'+title+'</h3><p>'+text+'</p></section>';
}
function renderAbilitiesMarkdown(text){
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

    tools.appendChild(editBtn);
    tools.appendChild(addBtn);
    tools.appendChild(moveBtn);
    tools.appendChild(delBtn);
  }

  rankLine.appendChild(tools);

  const isRoot = ROOT && sel && sel.id === ROOT.id;
  const moveBtn = document.getElementById('entry-move-btn');
  const delBtn = document.getElementById('entry-delete-btn');

  if (moveBtn) moveBtn.disabled = isRoot;
  if (delBtn) delBtn.disabled = isRoot;
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
  indexTree(ROOT, null, []);

  if (idToSelect && nodeMap[idToSelect]) {
    nodeMap[idToSelect]._path.forEach(p => expanded.add(p.id));
    expanded.add(idToSelect);
  }

  rerenderTree();
  buildTabs();

  if (idToSelect && nodeMap[idToSelect]) {
    selectNode(nodeMap[idToSelect]);

    setTimeout(() => {
      const row = document.querySelector(`.trow[data-id="${idToSelect}"]`);
      if (row) row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 60);
  } else {
    selectNode(ROOT);
  }
}

function openAddChildDialog() {
  if (!sel) return;

  const name = prompt('New child name:');

  if (!name || !name.trim()) return;

  const rank = prompt('Rank for new child:', nextLikelyRank(sel.r || '') || 'Entry');

  if (rank === null) return;

  const sciName = prompt('Scientific name, optional:', '');

  if (sciName === null) return;

  createChildNode({
    parentId: sel.id,
    node: {
      n: name.trim(),
      sn: sciName.trim(),
      r: rank.trim() || 'Entry',
      summary: '',
      tax: '',
      ap: '',
      eco: '',
      beh: '',
      traitsText: '',
      abilities: '',
      bg: '',
      note: '',
      gorge: !!sel.gorge,
      ctx: !!sel.ctx,
      theorized: false,
      fossil: false,
      curse: false,
      c: []
    }
  });
}

function nextLikelyRank(rank) {
  const order = [
    'Domain',
    'Kingdom',
    'Phylum',
    'Class',
    'Order',
    'Family',
    'Genus',
    'Species',
    'Subspecies'
  ];

  const idx = order.indexOf(rank);

  if (idx === -1) return 'Entry';
  return order[Math.min(idx + 1, order.length - 1)];
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

function countSubtree(n) {
  let total = 1;

  for (const child of (n.c || [])) {
    total += countSubtree(child);
  }

  return total;
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

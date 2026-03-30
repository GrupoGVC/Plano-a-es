// Each item uses fortnight slots 1-12  (1=Mar 1ª, 2=Mar 2ª, 3=Abr 1ª, ... 12=Ago 2ª)
const MONTHS = ['Mar/26','Abr/26','Mai/26','Jun/26','Jul/26','Ago/26'];
const FORT_OPTIONS = [
  'Mar – 1ª quinzena','Mar – 2ª quinzena',
  'Abr – 1ª quinzena','Abr – 2ª quinzena',
  'Mai – 1ª quinzena','Mai – 2ª quinzena',
  'Jun – 1ª quinzena','Jun – 2ª quinzena',
  'Jul – 1ª quinzena','Jul – 2ª quinzena',
  'Ago – 1ª quinzena','Ago – 2ª quinzena'
];
const COLORS = ['blue','teal','purple','amber','coral'];
const STATUS_OPTIONS = [
  {value:'not-started', label:'Não iniciado',   badge:'badge-not-started'},
  {value:'planning',    label:'Em planejamento', badge:'badge-planning'},
  {value:'progress',    label:'Em andamento',    badge:'badge-progress'},
  {value:'delayed',     label:'Atrasado',        badge:'badge-delayed'},
  {value:'done',        label:'Concluído',        badge:'badge-done'},
  {value:'cancelled',   label:'Cancelado',        badge:'badge-cancelled'},
];

// start/end in fortnight slots (1-12)
let items = [];  // loaded from Supabase on DOMContentLoaded

let nextId = 10, editMode = false, activeFilter = 'all';

function fortLabel(f) { return FORT_OPTIONS[f-1] || ''; }
function progClass(p) {
  if (p===0) return 'prog-0';
  if (p<30)  return 'prog-low';
  if (p<70)  return 'prog-mid';
  if (p<100) return 'prog-high';
  return 'prog-done';
}
function updateSummary() {
  const total = items.length;
  const done  = items.filter(i=>i.progress===100).length;
  const inprog= items.filter(i=>i.progress>0&&i.progress<100).length;
  const pend  = items.filter(i=>i.progress===0).length;
  const avg   = total ? Math.round(items.reduce((s,i)=>s+i.progress,0)/total) : 0;
  document.getElementById('summaryFill').style.width = avg+'%';
  document.getElementById('summaryPct').textContent  = avg+'%';
  document.getElementById('statTotal').textContent   = total;
  document.getElementById('statDone').textContent    = done;
  document.getElementById('statProg').textContent    = inprog;
  document.getElementById('statPend').textContent    = pend;
}
function statusLabel(s) {
  const opt = STATUS_OPTIONS.find(o => o.value === s) || STATUS_OPTIONS[0];
  return `<span class="status-badge ${opt.badge}">${opt.label}</span>`;
}
function ce() { return editMode ? 'contenteditable="true"' : 'contenteditable="false"'; }

function buildListItems(arr, cls, itemId, section, doneArr) {
  return arr.map((t,i) => {
    const isDone = section === 'actions' && doneArr && doneArr[i];
    const isAction = section === 'actions';
    return `
    <li draggable="${editMode}"
        ondragstart="dragStart(event)" ondragover="dragOver(event)" ondragleave="dragLeave(event)" ondrop="dropItem(event)" ondragend="dragEnd(event)">
      ${editMode ? `<span class="drag-handle" title="Arrastar para reordenar">⠿</span>` : ''}
      ${isAction
        ? `<div class="action-check ${isDone?'checked':''}" onclick="toggleAction(${itemId},${i},this)" title="Marcar como concluída"></div>`
        : `<span class="di ${cls}"></span>`
      }
      <span ${ce()} data-field="text" class="${isAction && isDone ? 'action-text done' : 'action-text'}">${t}</span>
      ${editMode ? `<button class="remove-btn" onclick="removeListItem(this)">×</button>` : ''}
    </li>`;
  }).join('');
}

function renderDetail(item) {
  const startLbl = fortLabel(item.start);
  const endLbl   = fortLabel(item.end);
  return `
    <div class="detail-panel" id="detail-${item.id}">
      <div class="detail-meta">
        <span>Responsável: <span ${ce()} data-item="${item.id}" data-field="resp">${item.resp}</span></span>
        <span>${startLbl} → ${endLbl}</span>
        ${editMode?`<span>Status:<select onchange="updateStatus(${item.id},this.value)" style="font-family:var(--font);font-size:12px;border:none;background:transparent;cursor:pointer;">
          ${STATUS_OPTIONS.map(o=>`<option value="${o.value}"${item.status===o.value?' selected':''}>${o.label}</option>`).join('')}
        </select></span>`:''}
      </div>
      <div class="detail-grid">
        <div><div class="detail-title">Ações</div>
          <ul class="detail-list" data-item="${item.id}" data-section="actions">${buildListItems(item.actions,'di-action',item.id,'actions',item.actionsDone)}</ul>
          ${editMode?`<button class="btn" style="margin-top:8px;font-size:11px;padding:4px 10px" onclick="addListItem(${item.id},'actions')">+ Ação</button>`:''}
        </div>
        <div><div class="detail-title">KPIs de sucesso</div>
          <ul class="detail-list" data-item="${item.id}" data-section="kpis">${buildListItems(item.kpis,'di-kpi',item.id,'kpis',null)}</ul>
          ${editMode?`<button class="btn" style="margin-top:8px;font-size:11px;padding:4px 10px" onclick="addListItem(${item.id},'kpis')">+ KPI</button>`:''}
        </div>
        <div><div class="detail-title">Riscos e dependências</div>
          <ul class="detail-list" data-item="${item.id}" data-section="risks">${buildListItems(item.risks,'di-risk',item.id,'risks',null)}</ul>
          ${editMode?`<button class="btn" style="margin-top:8px;font-size:11px;padding:4px 10px" onclick="addListItem(${item.id},'risks')">+ Risco</button>`:''}
        </div>
      </div>
      ${editMode?`
      <div class="fort-range-editor visible" style="margin-top:16px;">
        <label>Início:</label>
        <select onchange="updateFort(${item.id},'start',this.value)">
          ${FORT_OPTIONS.map((o,i)=>`<option value="${i+1}"${item.start===i+1?' selected':''}>${o}</option>`).join('')}
        </select>
        <label>Fim:</label>
        <select onchange="updateFort(${item.id},'end',this.value)">
          ${FORT_OPTIONS.map((o,i)=>`<option value="${i+1}"${item.end===i+1?' selected':''}>${o}</option>`).join('')}
        </select>
        <label style="margin-left:10px">Cor:</label>
        <select onchange="updateColor(${item.id},this.value)">
          ${COLORS.map(c=>`<option value="${c}"${item.color===c?' selected':''}>${c}</option>`).join('')}
        </select>
        <button class="btn" style="margin-left:8px;color:var(--coral-600);border-color:var(--coral-100);font-size:11px;padding:3px 10px" onclick="removeItem(${item.id})">Remover</button>
      </div>`:''}
    </div>`;
}

function renderItems(filter) {
  const container = document.getElementById('itemsContainer');
  container.innerHTML = '';
  const filtered = filter==='all' ? items : items.filter(i=>i.category===filter);

  filtered.forEach(item => {
    const block = document.createElement('div');
    block.className = 'item-block';

    const pc = progClass(item.progress);
    let progCell = `<div class="item-prog"${editMode?' onclick="event.stopPropagation()"':''}>
      <div class="${pc}" style="width:100%;display:flex;flex-direction:column;align-items:center;gap:3px;">
        <div class="prog-track" style="width:90%"><div class="prog-fill" style="width:${item.progress}%"></div></div>
        <span class="prog-pct">${item.progress}%</span>
      </div>
      ${editMode?`<div style="font-size:10px;color:var(--text-muted);margin-top:2px;text-align:center;">calculado pelas ações</div>`:''}
    </div>`;

    // Build 12 fortnight cells
    let cells = '';
    for (let f = 1; f <= 12; f++) {
      const inRange  = f >= item.start && f <= item.end;
      const isStart  = f === item.start;
      const isEnd    = f === item.end;
      const isMonthStart = (f % 2 === 1); // odd = 1st fortnight of a month
      const cellClass = 'item-cell' + (isMonthStart ? ' month-start' : '');

      let barHtml = '';
      if (inRange) {
        let spanClass = 'span-mid';
        if (isStart && isEnd) spanClass = 'span-only';
        else if (isStart)     spanClass = 'span-start';
        else if (isEnd)       spanClass = 'span-end';
        barHtml = `<div class="bar ${item.color} ${spanClass}"></div>`;
      }
      cells += `<div class="${cellClass}">${barHtml}</div>`;
    }

    block.dataset.itemId = item.id;
    if (editMode) {
      block.draggable = true;
      block.addEventListener('dragstart', rowDragStart);
      block.addEventListener('dragover',  rowDragOver);
      block.addEventListener('dragleave', rowDragLeave);
      block.addEventListener('drop',      rowDrop);
      block.addEventListener('dragend',   rowDragEnd);
    }
    block.innerHTML = `
      <div class="item-row" id="row-${item.id}" onclick="toggleDetail(${item.id})">
        <div class="item-info" style="display:flex;align-items:center;gap:0;">
          ${editMode?`<span class="row-drag-handle" title="Arrastar para reordenar">⠿</span>`:''}
          <div style="flex:1;">
          <div class="item-name">
            ${editMode?`<button class="remove-btn" onclick="event.stopPropagation();removeItem(${item.id})">×</button>`:''}
            <span ${ce()} data-item="${item.id}" data-field="name" onclick="event.stopPropagation()">${item.name}</span>
            ${statusLabel(item.status)}
          </div>
          <div class="item-resp"><span ${ce()} data-item="${item.id}" data-field="resp-inline" onclick="event.stopPropagation()">${item.resp}</span></div>
          </div>
        </div>
        ${progCell}
        ${cells}
      </div>
      ${renderDetail(item)}`;
    container.appendChild(block);
  });

  document.getElementById('addItemBtn').className = editMode ? 'add-item-btn visible' : 'add-item-btn';
  syncEditableListeners();
  updateSummary();
}

function toggleDetail(id) {
  const panel = document.getElementById(`detail-${id}`);
  const row   = document.getElementById(`row-${id}`);
  const isOpen= panel.classList.contains('open');
  document.querySelectorAll('.detail-panel').forEach(p=>p.classList.remove('open'));
  document.querySelectorAll('.item-row').forEach(r=>r.classList.remove('expanded'));
  if (!isOpen) { panel.classList.add('open'); row.classList.add('expanded'); }
}
function filterItems(cat,btn) {
  activeFilter=cat;
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderItems(cat);
}
function toggleEditMode() {
  editMode=!editMode;
  document.body.classList.toggle('edit-mode-on',editMode);
  document.getElementById('editToggle').textContent=editMode?'✓ Concluir':'✎ Editar';
  document.getElementById('editHint').className=editMode?'edit-hint visible':'edit-hint';
  document.getElementById('doc-title').contentEditable=editMode?'true':'false';
  document.getElementById('doc-subtitle').contentEditable=editMode?'true':'false';
  renderItems(activeFilter);
  if (editMode) {
    document.querySelectorAll('.detail-panel').forEach(p=>p.classList.add('open'));
    document.querySelectorAll('.item-row').forEach(r=>r.classList.add('expanded'));
  }
}
// ── ROW REORDERING ───────────────────────────────────
let rowDragSrcBlock = null;

function rowDragStart(e) {
  // only trigger if dragging from the handle
  rowDragSrcBlock = e.currentTarget;
  rowDragSrcBlock.classList.add('row-dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain','');
  e.stopPropagation();
}
function rowDragOver(e) {
  if (!rowDragSrcBlock) return;
  e.preventDefault();
  e.stopPropagation();
  const target = e.currentTarget;
  if (target === rowDragSrcBlock) return;
  // clear all indicators
  document.querySelectorAll('.item-block').forEach(b => {
    b.classList.remove('row-drag-over-top','row-drag-over-bottom');
  });
  const rect = target.getBoundingClientRect();
  const mid  = rect.top + rect.height / 2;
  if (e.clientY < mid) target.classList.add('row-drag-over-top');
  else                 target.classList.add('row-drag-over-bottom');
}
function rowDragLeave(e) {
  e.currentTarget.classList.remove('row-drag-over-top','row-drag-over-bottom');
}
function rowDragEnd(e) {
  document.querySelectorAll('.item-block').forEach(b => {
    b.classList.remove('row-dragging','row-drag-over-top','row-drag-over-bottom');
  });
  rowDragSrcBlock = null;
}
function rowDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  const target = e.currentTarget;
  target.classList.remove('row-drag-over-top','row-drag-over-bottom');
  if (!rowDragSrcBlock || rowDragSrcBlock === target) return;

  const fromId = parseInt(rowDragSrcBlock.dataset.itemId);
  const toId   = parseInt(target.dataset.itemId);
  const fromIdx = items.findIndex(i => i.id === fromId);
  const toIdx   = items.findIndex(i => i.id === toId);
  if (fromIdx === -1 || toIdx === -1) return;

  const rect = target.getBoundingClientRect();
  const mid  = rect.top + rect.height / 2;
  const insertAfter = e.clientY >= mid;

  const [moved] = items.splice(fromIdx, 1);
  const newIdx  = items.findIndex(i => i.id === toId);
  items.splice(insertAfter ? newIdx + 1 : newIdx, 0, moved);

  renderItems(activeFilter);
}

// ── DRAG & DROP REORDERING ──────────────────────────
let dragSrcEl = null;

function dragStart(e) {
  dragSrcEl = e.currentTarget;
  dragSrcEl.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', ''); // required for Firefox
}
function dragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const li = e.currentTarget;
  if (li !== dragSrcEl) li.classList.add('drag-over');
}
function dragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}
function dragEnd(e) {
  document.querySelectorAll('.detail-list li').forEach(li => {
    li.classList.remove('dragging','drag-over');
  });
  dragSrcEl = null;
}
function dropItem(e) {
  e.preventDefault();
  const target = e.currentTarget;
  target.classList.remove('drag-over');
  if (!dragSrcEl || dragSrcEl === target) return;

  const ul = target.closest('ul');
  if (!ul || dragSrcEl.closest('ul') !== ul) return; // only same list

  const itemId  = parseInt(ul.dataset.item);
  const section = ul.dataset.section;
  const item    = items.find(i => i.id === itemId);
  if (!item) return;

  const liNodes = Array.from(ul.children);
  const fromIdx = liNodes.indexOf(dragSrcEl);
  const toIdx   = liNodes.indexOf(target);
  if (fromIdx === -1 || toIdx === -1) return;

  // Reorder the data array
  const arr = item[section];
  const [moved] = arr.splice(fromIdx, 1);
  arr.splice(toIdx, 0, moved);

  // Re-render keeping panels open
  renderItems(activeFilter);
  setTimeout(() => {
    document.getElementById(`detail-${itemId}`)?.classList.add('open');
    document.getElementById(`row-${itemId}`)?.classList.add('expanded');
  }, 10);
}

function syncEditableListeners() {
  document.querySelectorAll('[data-field="name"]').forEach(el=>{
    el.addEventListener('blur',function(){const it=items.find(i=>i.id===parseInt(this.dataset.item));if(it)it.name=this.innerText.trim();});
  });
  document.querySelectorAll('[data-field="resp-inline"],[data-field="resp"]').forEach(el=>{
    el.addEventListener('blur',function(){const it=items.find(i=>i.id===parseInt(this.dataset.item));if(it)it.resp=this.innerText.trim();});
  });
  document.querySelectorAll('[data-field="text"]').forEach(el=>{
    el.addEventListener('blur',function(){
      const li=this.closest('li'),ul=this.closest('ul');if(!ul)return;
      const it=items.find(i=>i.id===parseInt(ul.dataset.item));
      const idx=Array.from(ul.children).indexOf(li);
      if(it&&it[ul.dataset.section])it[ul.dataset.section][idx]=this.innerText.trim();
    });
  });
}
function updateProgress(id,val) {
  const item=items.find(i=>i.id===id);if(!item)return;
  item.progress=parseInt(val);
  const block=document.querySelector(`#row-${id}`).closest('.item-block');
  const pc=progClass(item.progress);
  const pd=block.querySelector('.item-prog');
  pd.querySelector('.prog-track').parentElement.className=pc;
  pd.querySelector('.prog-fill').style.width=item.progress+'%';
  pd.querySelector('.prog-pct').textContent=item.progress+'%';
  updateSummary();
}
function updateStatus(id,val){const it=items.find(i=>i.id===id);if(it){it.status=val;renderItems(activeFilter);}}
function updateFort(id,field,val){
  const it=items.find(i=>i.id===id);if(!it)return;
  it[field]=parseInt(val);
  if(it.start>it.end)it.end=it.start;
  renderItems(activeFilter);
  setTimeout(()=>{document.getElementById(`detail-${id}`)?.classList.add('open');document.getElementById(`row-${id}`)?.classList.add('expanded');},10);
}
function updateColor(id,val){
  const it=items.find(i=>i.id===id);if(!it)return;
  it.color=val;renderItems(activeFilter);
  setTimeout(()=>{document.getElementById(`detail-${id}`)?.classList.add('open');document.getElementById(`row-${id}`)?.classList.add('expanded');},10);
}
// ── ADD ITEM TO DB ───────────────────────────────────
async function addItemToDb(item, ordem) {
  const { data, error } = await supa.from('iniciativas').insert({
    nome: item.name, responsavel: item.resp, categoria: item.category,
    status: item.status, cor: item.color, inicio: item.start, fim: item.end,
    progresso: 0, ordem: ordem,
  }).select().single();
  if (error || !data) { console.error('addItemToDb', error); return null; }
  const rows = [
    ...item.actions.map((t,j) => ({ iniciativa_id: data.id, tipo:'action', texto:t, ordem:j, concluida:false })),
    ...item.kpis.map((t,j)    => ({ iniciativa_id: data.id, tipo:'kpi',    texto:t, ordem:j })),
    ...item.risks.map((t,j)   => ({ iniciativa_id: data.id, tipo:'risk',   texto:t, ordem:j })),
  ];
  if (rows.length > 0) {
    const { data: inserted } = await supa.from('lista_itens').insert(rows).select();
    if (inserted) {
      const newActions = inserted.filter(r => r.tipo === 'action').sort((a,b) => a.ordem - b.ordem);
      item.actionsData = newActions.map(r => ({ dbId: r.id, texto: r.texto, concluida: false }));
      item.actionsDone = item.actionsData.map(() => false);
    }
  }
  item.id = data.id;
  return data.id;
}

async function removeItem(id){
  if(!confirm('Remover esta iniciativa?'))return;
  items=items.filter(i=>i.id!==id);
  renderItems(activeFilter);
  await deleteItemFromSupabase(id);
  showToast('Iniciativa removida ✓');
}
function addNewItem(){
  const n={id:nextId++,name:"Nova iniciativa",resp:"Responsável",category:activeFilter==='all'?'infra':activeFilter,status:"not-started",color:"blue",start:1,end:2,progress:0,actions:["Ação 1"],actionsDone:[false],kpis:["KPI 1"],risks:["Risco 1"],};
  items.push(n);renderItems(activeFilter);
  setTimeout(()=>{document.getElementById(`detail-${n.id}`)?.classList.add('open');document.getElementById(`row-${n.id}`)?.classList.add('expanded');},10);
}
function addListItem(itemId,section){
  const it=items.find(i=>i.id===itemId);if(!it)return;
  it[section].push(section==='actions'?'Nova ação':section==='kpis'?'Novo KPI':'Novo risco');
  renderItems(activeFilter);
  setTimeout(()=>{document.getElementById(`detail-${itemId}`)?.classList.add('open');document.getElementById(`row-${itemId}`)?.classList.add('expanded');},10);
}
function removeListItem(btn){
  const li=btn.closest('li'),ul=btn.closest('ul');
  const id=parseInt(ul.dataset.item),section=ul.dataset.section;
  const idx=Array.from(ul.children).indexOf(li);
  const it=items.find(i=>i.id===id);
  if(it&&it[section].length>1){it[section].splice(idx,1);renderItems(activeFilter);
    setTimeout(()=>{document.getElementById(`detail-${id}`)?.classList.add('open');document.getElementById(`row-${id}`)?.classList.add('expanded');},10);}
}

// ── SUPABASE CONFIG ─────────────────────────────────
const SUPA_URL = 'https://lqbmjmqrhcokimdtekyc.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxYm1qbXFyaGNva2ltZHRla3ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzE5MjYsImV4cCI6MjA5MDQ0NzkyNn0.iZicQ0AzJW2zX9Q-UaL0HviFfEefeBH3mGno1WsT3VA';
let supa; // initialized in DOMContentLoaded after SDK loads

function showToast(msg, ok=true) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = ok ? 'var(--gvc)' : 'var(--coral-400)';
  t.style.opacity = '1'; t.style.transform = 'translateY(0)';
  setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateY(12px)'; }, 2500);
}

// ── TOGGLE ACTION ────────────────────────────────────
async function toggleAction(itemId, actionIdx, el) {
  const item = items.find(i => i.id === itemId);
  if (!item) return;

  // Toggle local state
  if (!item.actionsDone) item.actionsDone = new Array(item.actions.length).fill(false);
  item.actionsDone[actionIdx] = !item.actionsDone[actionIdx];
  const isDone = item.actionsDone[actionIdx];

  // Update actionsData in sync
  if (item.actionsData && item.actionsData[actionIdx]) {
    item.actionsData[actionIdx].concluida = isDone;
  }

  // Visual update immediately (no re-render needed)
  el.classList.toggle('checked', isDone);
  const textEl = el.nextElementSibling;
  if (textEl) textEl.classList.toggle('done', isDone);

  // Recalculate progress locally
  const total = item.actions.length;
  const done  = item.actionsDone.filter(Boolean).length;
  item.progress = total > 0 ? Math.round((done / total) * 100) : 0;

  // Update progress bar without full re-render
  const block = document.getElementById(`row-${itemId}`)?.closest('.item-block');
  if (block) {
    const pc = progClass(item.progress);
    const pd = block.querySelector('.item-prog');
    if (pd) {
      pd.querySelector('.prog-track').parentElement.className = pc;
      pd.querySelector('.prog-fill').style.width = item.progress + '%';
      pd.querySelector('.prog-pct').textContent = item.progress + '%';
    }
  }
  updateSummary();

  // ── Persist to Supabase using stored DB id ──
  const dbId = item.actionsData?.[actionIdx]?.dbId;
  if (dbId) {
    // Update by known DB id — fast and reliable
    const { error } = await supa.from('lista_itens')
      .update({ concluida: isDone })
      .eq('id', dbId);
    if (error) { showToast('Erro ao salvar ✗', false); console.error(error); }
    // DB trigger recalcula progresso automaticamente
  } else {
    // Fallback: busca por ordem caso actionsData ainda não tenha dbId (item novo)
    const { data: liRows, error } = await supa
      .from('lista_itens')
      .select('id')
      .eq('iniciativa_id', itemId)
      .eq('tipo', 'action')
      .order('ordem', { ascending: true });
    if (!error && liRows && liRows[actionIdx]) {
      // Store dbId for future use
      if (!item.actionsData) item.actionsData = [];
      if (!item.actionsData[actionIdx]) item.actionsData[actionIdx] = {};
      item.actionsData[actionIdx].dbId = liRows[actionIdx].id;
      await supa.from('lista_itens')
        .update({ concluida: isDone })
        .eq('id', liRows[actionIdx].id);
    }
  }
}

async function loadFromSupabase() {
  showToast('Carregando dados…');
  const { data: rows, error } = await supa
    .from('iniciativas')
    .select('*, lista_itens(*)')
    .order('ordem', { ascending: true });

  if (error) { showToast('Erro ao carregar ✗', false); return; }

  if (!rows || rows.length === 0) {
    showToast('Nenhum dado no banco', false);
    return;
  }

  items = rows.map(r => {
    const listItems = r.lista_itens || [];
    const actionRows = listItems.filter(i=>i.tipo==='action').sort((a,b)=>a.ordem-b.ordem);
    return {
      id:          r.id,
      name:        r.nome,
      resp:        r.responsavel,
      category:    r.categoria,
      status:      r.status,
      color:       r.cor,
      start:       r.inicio,
      end:         r.fim,
      progress:    r.progresso,
      actions:     actionRows.map(i=>i.texto),
      actionsDone: actionRows.map(i=>!!i.concluida),
      kpis:        listItems.filter(i=>i.tipo==='kpi').sort((a,b)=>a.ordem-b.ordem).map(i=>i.texto),
      risks:       listItems.filter(i=>i.tipo==='risk').sort((a,b)=>a.ordem-b.ordem).map(i=>i.texto),
    };
  });
  nextId = Math.max(...items.map(i=>i.id)) + 1;
  showToast('Dados carregados ✓');
  renderItems(activeFilter);
}


// ── SAVE EDITS ───────────────────────────────────────
async function saveEdits() {
  showToast('Salvando…');
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const { error: e1 } = await supa.from('iniciativas').update({
      nome:        item.name,
      responsavel: item.resp,
      categoria:   item.category,
      status:      item.status,
      cor:         item.color,
      inicio:      item.start,
      fim:         item.end,
      progresso:   item.progress,
      ordem:       i,
    }).eq('id', item.id);
    if (e1) { console.error('save iniciativa', e1); continue; }

    await supa.from('lista_itens').delete().eq('iniciativa_id', item.id);
    const rows = [
      ...item.actions.map((t, j) => ({
        iniciativa_id: item.id, tipo: 'action', texto: t, ordem: j,
        concluida: item.actionsData?.[j]?.concluida ?? item.actionsDone?.[j] ?? false,
      })),
      ...item.kpis.map((t, j)  => ({ iniciativa_id: item.id, tipo: 'kpi',  texto: t, ordem: j })),
      ...item.risks.map((t, j) => ({ iniciativa_id: item.id, tipo: 'risk', texto: t, ordem: j })),
    ];
    if (rows.length > 0) {
      const { data: inserted, error: e2 } = await supa.from('lista_itens').insert(rows).select();
      if (e2) { console.error('save lista_itens', e2); continue; }
      if (inserted) {
        const newActions = inserted.filter(r => r.tipo === 'action').sort((a, b) => a.ordem - b.ordem);
        item.actionsData = newActions.map(r => ({ dbId: r.id, texto: r.texto, concluida: r.concluida }));
        item.actionsDone = item.actionsData.map(a => a.concluida);
      }
    }
  }
  showToast('Salvo ✓');
}

window.addEventListener('DOMContentLoaded', async () => {
  // Initialize Supabase client here — ensures SDK is loaded first
  supa = supabase.createClient(SUPA_URL, SUPA_KEY);

  document.getElementById('editToggle').addEventListener('click', async () => {
    if (editMode) {
      document.getElementById('editToggle').disabled = true;
      document.getElementById('editToggle').textContent = '⏳ Salvando…';
      await saveEdits();
      document.getElementById('editToggle').disabled = false;
    }
    toggleEditMode();
  });

  renderItems('all');
  await loadFromSupabase();
  await loadVersion();
});

async function loadVersion() {
  const { data } = await supa
    .from('versoes')
    .select('versao, descricao, created_at')
    .order('id', { ascending: false })
    .limit(1)
    .single();
  if (data) {
    const el = document.getElementById('footerVersion');
    const date = new Date(data.created_at).toLocaleDateString('pt-BR');
    el.textContent = 'v' + data.versao;
    el.title = data.descricao + ' · ' + date;
  }
}
</script>

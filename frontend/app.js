// ─── CONFIGURACIÓN Y CONSTANTES ───
const API_URL = 'https://bodapp.onrender.com/api/invitados';
const GOOGLE_SHEETS_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRUTF1kZPARXGAKcjPbBhpsPWs2bV5MbsS9MFGCVOVtTXrPSIbVKRkAA9OkQ9fwwKj3KZyFAgy74ZiT/pub?output=csv";

const GROUPS = [
  'Familia novia','Familia novio','Amigos novia','Amigos novio',
  'Amigos en común','Trabajo novia','Trabajo novio','Otros'
];

const ICONS = {
    trash: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
    edit: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
    wp: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>`
};

// ─── ESTADO ───
let guests = [];
let activeFilter = 'Todos';
let pendingDelete = null;
let editingId = null;
let isFetching = true; // Controla el estado de carga

// ─── INIT ───
document.addEventListener("DOMContentLoaded", () => {
  render(); // Dibuja la estructura base y los filtros al instante
  loadGuests(); // Va a buscar los datos
  setupEvents();
});

function setupEvents() {
  const inpName = document.getElementById('inp-name');
  if(inpName) {
    inpName.addEventListener('keydown', e => {
      if (e.key === 'Enter') addGuest();
    });
  }
}

function saveDate() {
    const val = document.getElementById('event-date').value;
    const display = document.getElementById('header-date-display');
    if (display) {
        display.innerHTML = val ? `Casamiento · <em>${val}</em>` : "Casamiento · 2026";
    }
}

// ─── COMUNICACIÓN CON LA API (PYTHON) ───
async function loadGuests() {
  isFetching = true;
  renderTable(); // Muestra el cartel de carga
  try {
    const response = await fetch(API_URL);
    if (response.ok) {
      guests = await response.json();
      if (!Array.isArray(guests)) guests = []; // Por seguridad
    }
  } catch (error) { 
    console.error("Error al cargar invitados:", error); 
  } finally {
    isFetching = false;
    render(); // Refresca todo con los datos reales
  }
}

async function addGuest() {
  const name = document.getElementById('inp-name').value.trim();
  if (!name) { shake('inp-name'); return; }
  
  const payload = {
    name: name,
    group: document.getElementById('inp-group').value || 'Otros',
    rsvp: document.getElementById('inp-rsvp').value,
    dietary: document.getElementById('inp-dietary').value.trim(),
    phone: document.getElementById('inp-phone') ? document.getElementById('inp-phone').value.trim() : "",
    plus: document.getElementById('inp-plus') ? document.getElementById('inp-plus').value.trim() : "",
    notes: document.getElementById('inp-notes') ? document.getElementById('inp-notes').value.trim() : ""
  };

  try {
    if (editingId) {
      payload.id = editingId;
      await fetch(`${API_URL}/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      editingId = null;
      const btn = document.getElementById('btn-add-main');
      if (btn) { btn.textContent = "+ Agregar invitado"; btn.style.background = ""; }
    } else {
      payload.id = guests.length > 0 ? Math.max(...guests.map(g => g.id)) + 1 : 1;
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
    clearForm();
    loadGuests(); 
  } catch (error) { console.error("Error al guardar:", error); }
}

async function changeRsvp(id, val) {
  try {
    await fetch(`${API_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rsvp: val })
    });
    loadGuests(); 
  } catch (error) { console.error("Error al actualizar:", error); }
}

function askDelete(id) {
  const g = guests.find(g => g.id === id);
  if (!g) return;
  pendingDelete = id;
  const modalMsg = document.getElementById('modal-msg');
  const modal = document.getElementById('modal');
  if(modalMsg) modalMsg.textContent = `¿Eliminar a "${g.name}" de la lista?`;
  if(modal) modal.classList.add('open');
}

async function confirmDelete() {
  if (pendingDelete !== null) {
    try {
      await fetch(`${API_URL}/${pendingDelete}`, { method: 'DELETE' });
      pendingDelete = null;
      document.getElementById('modal').classList.remove('open');
      loadGuests(); 
    } catch (error) { console.error("Error al borrar:", error); }
  }
}

// ─── FUNCIONES DE ACCIÓN RÁPIDA ───
function editGuest(id) {
  const g = guests.find(g => g.id === id);
  if (!g) return;
  
  document.getElementById('inp-name').value = g.name;
  document.getElementById('inp-group').value = g.group;
  document.getElementById('inp-rsvp').value = g.rsvp;
  if(document.getElementById('inp-phone')) document.getElementById('inp-phone').value = g.phone || '';
  document.getElementById('inp-dietary').value = g.dietary || '';
  if(document.getElementById('inp-plus')) document.getElementById('inp-plus').value = g.plus || '';
  if(document.getElementById('inp-notes')) document.getElementById('inp-notes').value = g.notes || '';
  
  editingId = id;
  const btn = document.getElementById('btn-add-main');
  if(btn) {
      btn.textContent = "💾 Guardar cambios";
      btn.style.background = "#2D3748";
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function sendWhatsApp(phone, name) {
  if (!phone) {
    alert(`No hay un número de teléfono guardado para ${name}.`);
    return;
  }
  const mensaje = encodeURIComponent(`¡Hola ${name}! Te escribimos para contarte que...`);
  window.open(`https://wa.me/${phone}?text=${mensaje}`, '_blank');
}

// ─── SINCRONIZACIÓN CON GOOGLE SHEETS ───
function parseCSVRow(str) {
  let arr = [], quote = false, col = '';
  for (let i = 0; i < str.length; i++) {
    let cc = str[i], nc = str[i+1];
    if (cc === '"' && quote && nc === '"') { col += cc; i++; continue; }
    if (cc === '"') { quote = !quote; continue; }
    if (cc === ',' && !quote) { arr.push(col); col = ''; continue; }
    col += cc;
  }
  arr.push(col);
  return arr;
}

async function syncRSVP() {
  const btn = document.getElementById('btn-sync');
  try {
    if(btn) btn.innerHTML = "⏳ Sincronizando...";
    const response = await fetch(GOOGLE_SHEETS_URL);
    const data = await response.text();
    const rows = data.split('\n');
    if (rows.length < 2) return alert("Todavía no hay respuestas en el formulario.");

    const headers = parseCSVRow(rows[0].toLowerCase());
    const idxNombre = headers.findIndex(h => h.includes('nombre'));
    const idxAsiste = headers.findIndex(h => h.includes('acompañ') || h.includes('asist') || h.includes('confirm') || h.includes('vas a'));
    const idxDieta = headers.findIndex(h => h.includes('dieta') || h.includes('restricción') || h.includes('aliment'));

    let actualizados = 0;
    for (let i = 1; i < rows.length; i++) {
      if (!rows[i].trim()) continue; 
      const cols = parseCSVRow(rows[i]);
      const nombreForm = cols[idxNombre] ? cols[idxNombre].trim().toLowerCase() : '';
      const asisteForm = cols[idxAsiste] ? cols[idxAsiste].trim() : '';
      const dietaForm = idxDieta >= 0 && cols[idxDieta] ? cols[idxDieta].trim() : '';
      const invitado = guests.find(g => g.name.toLowerCase() === nombreForm);
      
      if (invitado) {
        let cambioEstado = false;
        let nuevoRsvp = invitado.rsvp;
        let nuevaDieta = invitado.dietary;
        
        const asisteStr = asisteForm.toLowerCase();
        if (asisteStr.includes('no') && invitado.rsvp !== 'declined') { nuevoRsvp = 'declined'; cambioEstado = true; } 
        else if ((asisteStr.includes('si') || asisteStr.includes('sí')) && invitado.rsvp !== 'confirmed') { nuevoRsvp = 'confirmed'; cambioEstado = true; }
        
        if (dietaForm !== '' && dietaForm !== invitado.dietary) { nuevaDieta = dietaForm; cambioEstado = true; }
        
        if (cambioEstado) {
          await fetch(`${API_URL}/${invitado.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rsvp: nuevoRsvp, dietary: nuevaDieta })
          });
          actualizados++;
        }
      }
    }
    if (actualizados > 0) loadGuests(); 
    alert(`¡Sincronización exitosa! Se actualizaron ${actualizados} invitados.`);
  } catch (err) {
    console.error("Error en la sincronización:", err);
    alert("Hubo un error de conexión al sincronizar.");
  } finally {
    if(btn) btn.innerHTML = "🔄 Sincronizar Sheets";
  }
}

// ─── FUNCIONES DE EXPORTACIÓN ───
function printPDF() { window.print(); }

function exportCSV() {
  let csvContent = "Nombre,Grupo,Estado,Dieta,Notas\n";
  guests.forEach(g => {
    let estadoTexto = g.rsvp === 'confirmed' ? 'Confirmado' : g.rsvp === 'declined' ? 'No asiste' : 'Pendiente';
    csvContent += `"${g.name}","${g.group}","${estadoTexto}","${g.dietary}","${g.notes}"\n`;
  });
  const dataStr = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", "invitados_casamiento.csv");
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

// ─── LÓGICA DE INTERFAZ Y RENDERIZADO ───
function closeModal() {
  const modal = document.getElementById('modal');
  if(modal) modal.classList.remove('open');
  pendingDelete = null;
}

function clearForm() {
  ['inp-name','inp-dietary','inp-plus','inp-notes','inp-phone'].forEach(id => {
    if(document.getElementById(id)) document.getElementById(id).value = '';
  });
  if(document.getElementById('inp-rsvp')) document.getElementById('inp-rsvp').value = 'pending';
  if(document.getElementById('inp-group')) document.getElementById('inp-group').value = '';
  
  editingId = null;
  const btn = document.getElementById('btn-add-main');
  if(btn) { btn.textContent = "+ Agregar invitado"; btn.style.background = ""; }
}

function shake(id) {
  const el = document.getElementById(id);
  if(!el) return;
  el.style.borderColor = '#7A2E2E';
  setTimeout(() => el.style.borderColor = '', 800);
}

function esc(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function renderFilters() {
  const container = document.getElementById('filter-pills');
  if (!container) return;
  const filters = ['Todos', 'Confirmados', 'Pendientes', 'Cancelados'];
  container.innerHTML = filters.map(f => `
    <button class="filter-btn ${activeFilter === f ? 'active' : ''}" style="margin-right: 8px; margin-bottom: 8px; border-radius: 20px; padding: 6px 16px;" onclick="setFilter('${f}')">${f}</button>
  `).join('');
}

function setFilter(f) {
  activeFilter = f;
  renderFilters();
  render();
}

function getFilteredGuests() {
  let list = guests;
  if (activeFilter === 'Confirmados') list = list.filter(g => g.rsvp === 'confirmed');
  if (activeFilter === 'Pendientes') list = list.filter(g => g.rsvp === 'pending');
  if (activeFilter === 'Cancelados') list = list.filter(g => g.rsvp === 'declined');

  const searchInput = document.getElementById('search');
  if (searchInput && searchInput.value) {
    const q = searchInput.value.toLowerCase();
    list = list.filter(g => g.name.toLowerCase().includes(q) || g.group.toLowerCase().includes(q));
  }

  const sortInput = document.getElementById('sort-by');
  if (sortInput) {
    const sortVal = sortInput.value;
    if (sortVal === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortVal === 'group') list.sort((a, b) => a.group.localeCompare(b.group));
    else if (sortVal === 'rsvp') list.sort((a, b) => a.rsvp.localeCompare(b.rsvp));
    else list.sort((a,b) => a.id - b.id);
  }
  return list;
}

function render() {
  renderFilters();
  renderTable();
  updateStats();
  renderGroupProgress();
}

function renderTable() {
    const tbody = document.getElementById('guest-tbody');
    if (!tbody) return;
    
    // Si la aplicación está esperando al servidor, muestra el cartel
    if (isFetching) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#718096; padding: 3rem; font-style:italic;">⏳ Despertando al servidor y cargando invitados...</td></tr>`;
        return;
    }
    
    const list = getFilteredGuests();
    
    // Si cargó pero la base de datos está vacía
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#718096; padding: 3rem;">No hay invitados cargados todavía. ¡Empezá a agregar arriba!</td></tr>`;
        return;
    }
    
    tbody.innerHTML = list.map(g => {
        let dietaHTML = g.dietary ? `<span class="diet-pill">${esc(g.dietary)}</span>` : '';
        return `
        <tr>
            <td>
                <div style="font-weight:500; color:#2d3748;">${esc(g.name)}</div>
                ${g.plus ? `<div style="font-size:11px; color:#a0aec0;">+ ${esc(g.plus)}</div>` : ''}
            </td>
            <td style="font-size:12px; color:#718096;">${esc(g.group)}</td>
            <td>
                <select onchange="changeRsvp(${g.id}, this.value)" class="status-${g.rsvp}" style="border:none; background:transparent; font-size:13px; cursor:pointer;">
                    <option value="pending" ${g.rsvp === 'pending' ? 'selected' : ''}>Pendiente</option>
                    <option value="confirmed" ${g.rsvp === 'confirmed' ? 'selected' : ''}>Confirmado</option>
                    <option value="declined" ${g.rsvp === 'declined' ? 'selected' : ''}>No asiste</option>
                </select>
            </td>
            <td class="hide-mobile">${dietaHTML}</td>
            <td class="hide-mobile" style="font-size:12px; color:#a0aec0; font-style:italic;">${esc(g.notes)}</td>
            <td class="no-print" style="text-align:right;">
                <div style="display:flex; gap:12px; justify-content:flex-end; align-items:center;">
                    <button class="btn-icon" title="WhatsApp" onclick="sendWhatsApp('${g.phone}','${g.name}')" style="color:#4a5568;">${ICONS.wp}</button>
                    <button class="btn-icon" title="Editar" onclick="editGuest(${g.id})" style="color:#4a5568;">${ICONS.edit}</button>
                    <button class="btn-icon" title="Eliminar" onclick="askDelete(${g.id})" style="color:#e53e3e; opacity:0.7;">${ICONS.trash}</button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function updateStats() {
  const container = document.getElementById('stats-grid');
  if (!container) return;
  const total = guests.length;
  const conf = guests.filter(g => g.rsvp === 'confirmed').length;
  const pend = guests.filter(g => g.rsvp === 'pending').length;
  const dec = guests.filter(g => g.rsvp === 'declined').length;
  container.innerHTML = `
    <div class="stat-card"><h3>${total}</h3><p>Total</p></div>
    <div class="stat-card"><h3>${conf}</h3><p>Confirmados</p></div>
    <div class="stat-card"><h3>${pend}</h3><p>Pendientes</p></div>
    <div class="stat-card"><h3>${dec}</h3><p>Cancelados</p></div>
  `;
}

function renderGroupProgress() {
    const container = document.getElementById('progress-grid');
    if (!container) return;
    
    container.innerHTML = GROUPS.map(grupo => {
        const enGrupo = guests.filter(g => g.group === grupo);
        if (enGrupo.length === 0) return '';
        
        const conf = enGrupo.filter(g => g.rsvp === 'confirmed').length;
        const porc = (conf / enGrupo.length) * 100;
        
        return `
            <div style="background:white; padding:16px; border-radius:12px; border:1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);">
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <span style="font-weight:600; font-size:13px; color:#2d3748;">${grupo}</span>
                    <span style="font-size:11px; color:#718096; font-weight:500;">${conf} de ${enGrupo.length}</span>
                </div>
                <div style="background:#edf2f7; border-radius:10px; height:6px; width:100%; overflow:hidden;">
                    <div style="background:#4a5568; height:100%; width:${porc}%; transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);"></div>
                </div>
            </div>
        `;
    }).join('');
}
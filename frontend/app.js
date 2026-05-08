// ─── CONSTANTES Y CONEXIÓN AL SERVIDOR ───-
// Esta es la dirección de tu servidor en Python (asegurate de que esté corriendo)
const API_URL = 'http://localhost:8000/api/invitados';

const GROUPS = [
  'Familia novia','Familia novio','Amigos novia','Amigos novio',
  'Amigos en común','Trabajo novia','Trabajo novio','Otros'
];

// ─── ESTADO ───
let guests = [];
let activeFilter = 'Todos';
let pendingDelete = null;

// ─── INIT ───
document.addEventListener("DOMContentLoaded", () => {
  loadGuests(); // Ahora cargamos desde Python
  setupEvents();
});

function setupEvents() {
  document.getElementById('inp-name')
    .addEventListener('keydown', e => {
      if (e.key === 'Enter') addGuest();
    });
}

// ─── COMUNICACIÓN CON LA API (PYTHON) ───

// 1. LEER TODOS (GET)
async function loadGuests() {
  try {
    const response = await fetch(API_URL);
    if (response.ok) {
      guests = await response.json();
      render(); // Dibujamos la tabla recién cuando llegan los datos
    }
  } catch (error) {
    console.error("Error al cargar invitados:", error);
    alert("No se pudo conectar al servidor. ¿Está encendido uvicorn?");
  }
}

// 2. CREAR (POST)
async function addGuest() {
  const name = document.getElementById('inp-name').value.trim();
  if (!name) {
    shake('inp-name');
    return;
  }
  
  // Calculamos un ID temporal (luego una BD real lo hace sola)
  const nuevoId = guests.length > 0 ? Math.max(...guests.map(g => g.id)) + 1 : 1;

  const nuevoInvitado = {
    id: nuevoId,
    name: name,
    group: document.getElementById('inp-group').value || 'Otros',
    rsvp: document.getElementById('inp-rsvp').value,
    dietary: document.getElementById('inp-dietary').value.trim(),
    phone: document.getElementById('inp-phone') ? document.getElementById('inp-phone').value.trim() : "",
    plus: document.getElementById('inp-plus') ? document.getElementById('inp-plus').value.trim() : "",
    notes: document.getElementById('inp-notes') ? document.getElementById('inp-notes').value.trim() : ""
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nuevoInvitado)
    });

    if (response.ok) {
      clearForm();
      loadGuests(); // Recargamos la lista actualizada desde el servidor
    }
  } catch (error) {
    console.error("Error al guardar:", error);
  }
}

// 3. ACTUALIZAR ESTADO (PUT)
async function changeRsvp(id, val) {
  try {
    await fetch(`${API_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rsvp: val })
    });
    loadGuests(); // Recargamos para ver el cambio
  } catch (error) {
    console.error("Error al actualizar:", error);
  }
}

// 4. BORRAR (DELETE)
function askDelete(id) {
  const g = guests.find(g => g.id === id);
  if (!g) return;
  pendingDelete = id;
  document.getElementById('modal-msg').textContent = `¿Eliminar a "${g.name}" de la lista?`;
  document.getElementById('modal').classList.add('open');
}

async function confirmDelete() {
  if (pendingDelete !== null) {
    try {
      await fetch(`${API_URL}/${pendingDelete}`, {
        method: 'DELETE'
      });
      pendingDelete = null;
      document.getElementById('modal').classList.remove('open');
      loadGuests(); // Recargamos la lista limpia
    } catch (error) {
      console.error("Error al borrar:", error);
    }
  }
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
  pendingDelete = null;
}

function clearForm() {
  ['inp-name','inp-dietary','inp-plus','inp-notes','inp-phone'].forEach(id => {
    if(document.getElementById(id)) document.getElementById(id).value = '';
  });
  document.getElementById('inp-rsvp').value = 'pending';
  document.getElementById('inp-group').value = '';
}

function shake(id) {
  const el = document.getElementById(id);
  el.style.borderColor = '#7A2E2E';
  setTimeout(() => el.style.borderColor = '', 800);
}

function esc(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// (DEJÁ TODO EL RESTO DE TUS FUNCIONES ABAJO DE ESTO: getFilteredGuests, render, renderTable, sendWhatsApp, etc.)

// ─── RENDERS ───
function render() {
  renderStats();
  renderFilters();
  renderTable();
  renderProgress();
  renderChecklist();
}

function renderStats() {
  const total = guests.length;
  const confirmed = guests.filter(g => g.rsvp === 'confirmed').length;
  const pending = guests.filter(g => g.rsvp === 'pending').length;
  const declined = guests.filter(g => g.rsvp === 'declined').length;

  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card total fade-in">
      <div class="stat-label">Total Lista</div>
      <div class="stat-number">${total}</div>
    </div>
    <div class="stat-card confirmed fade-in">
      <div class="stat-label">Confirmados</div>
      <div class="stat-number">${confirmed}</div>
    </div>
    <div class="stat-card pending fade-in">
      <div class="stat-label">Pendientes</div>
      <div class="stat-number">${pending}</div>
    </div>
    <div class="stat-card declined fade-in">
      <div class="stat-label">Rechazados</div>
      <div class="stat-number">${declined}</div>
    </div>
  `;
}

function renderFilters() {
  const groups = [...new Set(guests.map(g => g.group))].filter(Boolean);
  const pills = ['Todos', ...groups];
  
  document.getElementById('filter-pills').innerHTML = pills.map(p => `
    <button class="pill ${activeFilter === p ? 'active' : ''}" onclick="setFilter('${p}')">${p}</button>
  `).join('');
}

function renderTable() {
  const tbody = document.getElementById('guest-tbody');
  const filtered = getFilteredGuests();

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No se encontraron invitados.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(g => {
    let rsvpHTML = '';
    if (g.rsvp === 'confirmed') rsvpHTML = `<span class="badge badge-confirmed">✓ Confirmado</span>`;
    else if (g.rsvp === 'declined') rsvpHTML = `<span class="badge badge-declined">✕ Rechazó</span>`;
    else rsvpHTML = `<span class="badge badge-pending">? Pendiente</span>`;

    return `
    <tr class="fade-in">
      <td>
        <div class="td-name">${esc(g.name)}</div>
        ${g.plus ? `<div class="td-plus">+ ${esc(g.plus)}</div>` : ''}
      </td>
      <td><span class="group-tag">${esc(g.group)}</span></td>
      <td>
        <select class="rsvp-select no-print" onchange="changeRsvp(${g.id}, this.value)">
          <option value="pending" ${g.rsvp === 'pending' ? 'selected' : ''}>Pendiente</option>
          <option value="confirmed" ${g.rsvp === 'confirmed' ? 'selected' : ''}>Confirmado</option>
          <option value="declined" ${g.rsvp === 'declined' ? 'selected' : ''}>Rechazó</option>
        </select>
        <span class="print-show" style="display:none;">${rsvpHTML}</span>
      </td>
      <td class="hide-mobile">${g.dietary ? `<span class="dietary-tag">${esc(g.dietary)}</span>` : '-'}</td>
      <td class="hide-mobile" style="color: var(--text-light); font-size:12px;">${esc(g.notes)}</td>
      <td class="no-print" style="display: flex; gap: 8px; justify-content: flex-end;">
        <button class="btn-wsp" onclick="sendWhatsApp(${g.id})" data-tip="Enviar WhatsApp" title="Enviar WhatsApp">💬</button>
        <button class="btn-del" onclick="askDelete(${g.id})" data-tip="Eliminar" title="Eliminar">🗑</button>
      </td>

    </tr>
  `}).join('');
}

function renderProgress() {
  const container = document.getElementById('progress-grid');
  const groups = [...new Set(guests.map(g => g.group))].filter(Boolean);
  
  if(groups.length === 0){
      container.innerHTML = '<p style="font-size:13px; color:var(--text-light);">Agrega invitados con grupo para ver estadísticas.</p>';
      return;
  }

  container.innerHTML = groups.map(groupName => {
    const groupGuests = guests.filter(g => g.group === groupName);
    const confirmed = groupGuests.filter(g => g.rsvp === 'confirmed').length;
    const total = groupGuests.length;
    const percentage = total === 0 ? 0 : Math.round((confirmed / total) * 100);

    return `
      <div class="progress-card fade-in">
        <div class="progress-card-top">
          <span class="progress-card-name">${esc(groupName)}</span>
          <span class="progress-card-count">${confirmed}/${total}</span>
        </div>
        <div class="progress-bar-track">
          <div class="progress-bar-fill" style="width: ${percentage}%"></div>
        </div>
        <div class="progress-sub">${percentage}% confirmados</div>
      </div>
    `;
  }).join('');
}

function renderChecklist() {
  document.getElementById('check-grid').innerHTML = CHECK_ITEMS.map((item, i) => {
    const isChecked = checks['c'+i] ? 'checked' : '';
    const doneClass = checks['c'+i] ? 'done' : '';
    return `
      <label class="check-item ${doneClass} fade-in">
        <input type="checkbox" ${isChecked} onchange="toggleCheck('c${i}', this.checked); renderChecklist();">
        ${item}
      </label>
    `;
  }).join('');
}

function setFilter(f) {
  activeFilter = f;
  render();
}

function toggleCheck(key, val) {
  checks[key] = val;
  save();
}

// ─── IMPORT / EXPORT (MULTI-DISPOSITIVO & BACKUP) ───

function printPDF() {
  window.print();
}

function exportJSON() {
  const dataStr = JSON.stringify(guests, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `invitados_casamiento_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const importedData = JSON.parse(e.target.result);
      if (Array.isArray(importedData)) {
        guests = importedData;
        save();
        load(); // Recalcula nextId y limpia
        render();
        alert("¡Lista importada con éxito!");
      } else {
        alert("El archivo no tiene el formato correcto.");
      }
    } catch (err) {
      alert("Error al leer el archivo JSON.");
    }
  };
  reader.readAsText(file);
  event.target.value = ''; // Reset input
}

function exportCSV() {
  if (guests.length === 0) return alert("No hay invitados para exportar.");
  
  const headers = ['Nombre', 'Acompañante', 'Grupo', 'Estado', 'Dieta', 'Notas'];
  const rows = guests.map(g => [
    `"${g.name}"`, 
    `"${g.plus}"`, 
    `"${g.group}"`, 
    `"${g.rsvp}"`,  
    `"${g.dietary}"`, 
    `"${g.notes}"`
  ]);
  
  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `invitados_casamiento_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Función para enviar mensaje por WhatsApp (Mejorada con teléfono)
function sendWhatsApp(id) {
  const g = guests.find(g => g.id === id);
  if (!g) return;

  const linkFormulario = "https://forms.gle/TU_LINK_AQUI"; 
  
  const mensaje = `¡Hola ${g.name}! Te escribimos para pedirte que nos confirmes tu asistencia 
  a nuestro casamiento. Por favor, completá este formulario rápido para avisarnos y saber si tenés alguna 
  restricción alimentaria: ${linkFormulario} ¡Avisanos cualquier cosa!`;
  
  let url = '';

  // Si el invitado tiene un teléfono guardado, abrimos su chat directo
  if (g.phone && g.phone.trim() !== '') {
    // Limpiamos el número por si le pusiste espacios o guiones
    const numeroLimpio = g.phone.replace(/\D/g, ''); 
    url = `https://api.whatsapp.com/send?phone=${numeroLimpio}&text=${encodeURIComponent(mensaje)}`;
  } else {
    // Si no tiene teléfono, usamos el enlace genérico
    url = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
  }
  
  window.open(url, '_blank');
}
// ─── SINCRONIZACIÓN CON GOOGLE SHEETS ───

// Función auxiliar para separar el CSV (Incluso si los invitados usan comas en sus respuestas)
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

// Función principal que trae las respuestas
async function syncRSVP() {
  const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRUTF1kZPARXGAKcjPbBhpsPWs2bV5MbsS9MFGCVOVtTXrPSIbVKRkAA9OkQ9fwwKj3KZyFAgy74ZiT/pub?output=csv";
  const btn = document.getElementById('btn-sync');
  
  try {
    btn.innerHTML = "⏳ Sincronizando...";
    
    const response = await fetch(url);
    const data = await response.text();
    
    const rows = data.split('\n');
    if (rows.length < 2) {
        alert("Todavía no hay respuestas en el formulario.");
        btn.innerHTML = "🔄 Sincronizar Sheets";
        return;
    }

    // Leemos los títulos
    const headers = parseCSVRow(rows[0].toLowerCase());
    
    // Hacemos que la búsqueda de columnas sea a prueba de balas
    const idxNombre = headers.findIndex(h => h.includes('nombre'));
    const idxAsiste = headers.findIndex(h => h.includes('acompañ') || h.includes('asist') || h.includes('confirm') || h.includes('vas a'));
    const idxDieta = headers.findIndex(h => h.includes('dieta') || h.includes('restricción') || h.includes('aliment'));

    // ESTO TE VA A AYUDAR A DEPURAR: Imprime en la consola qué columnas encontró
    console.log("Columnas detectadas -> Nombre:", idxNombre, "| Asistencia:", idxAsiste, "| Dieta:", idxDieta);

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
        
        // Primero buscamos el NO para evitar el error de "no podré aSIstir"
        const asisteStr = asisteForm.toLowerCase();
        if (asisteStr.includes('no')) {
          invitado.rsvp = 'declined';
          cambioEstado = true;
        } else if (asisteStr.includes('si') || asisteStr.includes('sí')) {
          invitado.rsvp = 'confirmed';
          cambioEstado = true;
        }
        
        if (dietaForm !== '') {
          invitado.dietary = dietaForm;
          cambioEstado = true;
        }
        
        // Solo cuenta como actualizado si realmente le cambió algún dato
        if (cambioEstado) actualizados++;
      }
    }

    save();
    render();
    
    if (actualizados > 0) {
      alert(`¡Sincronización exitosa! Se actualizaron ${actualizados} invitados.`);
    } else {
      alert("Sincronización conectada, pero no hubo invitados nuevos para actualizar (o no coincidieron los nombres).");
    }
    
  } catch (err) {
    console.error("Error en la sincronización:", err);
    alert("Hubo un error de conexión. Revisá la consola (F12) para más detalles.");
  } finally {
    btn.innerHTML = "🔄 Sincronizar Sheets";
  }
}
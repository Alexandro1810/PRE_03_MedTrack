const API = '/api';
let currentUser = null;
let devices = [];
let events = [];
let selectedDeviceId = null;
let calendarDate = new Date();

const $ = (id) => document.getElementById(id);

async function api(path, options = {}) {
    const response = await fetch(`${API}/${path}`, { credentials: 'same-origin', ...options });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
    return data;
}

function setText(id, value) { const el = $(id); if (el) el.textContent = value ?? ''; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c])); }

async function init() {
    $('loginForm').addEventListener('submit', handleLogin);
    $('logoutButton').addEventListener('click', logout);
    $('profileButton').addEventListener('click', () => $('profileMenu').classList.toggle('hidden'));
    document.querySelectorAll('.nav-item').forEach(btn => btn.addEventListener('click', () => showSection(btn.dataset.section)));
    $('refreshDevices').addEventListener('click', loadDevices);
    $('locateButton').addEventListener('click', locateSelected);
    $('prevMonth').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth()-1); renderCalendar(); });
    $('nextMonth').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth()+1); renderCalendar(); });
    $('newEventButton').addEventListener('click', openEventModal);
    $('newDeviceButton').addEventListener('click', openDeviceModal);
    $('modalClose').addEventListener('click', closeModal);
    $('modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
    $('passwordForm').addEventListener('submit', changePassword);
    $('userForm').addEventListener('submit', createUser);
    document.addEventListener('click', e => { if (!$('profileButton').contains(e.target) && !$('profileMenu').contains(e.target)) $('profileMenu').classList.add('hidden'); });

    try { await restoreSession(); } catch (_) { showLogin(); }
}

async function restoreSession() {
    try {
        const data = await api('auth/me.php');
        if (!data.loggedIn) return showLogin();
        currentUser = data.user;
        showApp();
        await loadAll();
    } catch (_) { showLogin(); }
}

async function handleLogin(event) {
    event.preventDefault();
    const error = $('loginError'); error.textContent = '';
    const form = new FormData($('loginForm'));
    try {
        const data = await api('auth/login.php', { method:'POST', body:form });
        currentUser = data.user;
        showApp();
        await loadAll();
    } catch (e) { error.textContent = e.message; }
}

function showLogin() { $('loginScreen').classList.remove('hidden'); $('app').classList.add('hidden'); }
function showApp() { $('loginScreen').classList.add('hidden'); $('app').classList.remove('hidden'); updateUserUI(); }

async function logout() {
    try { await api('auth/logout.php', { method:'POST' }); } catch (_) {}
    currentUser = null; showLogin(); $('loginPassword').value = '';
}

function updateUserUI() {
    const name = currentUser.username;
    setText('headerUserName', name); setText('menuUserName', name); setText('menuUserRole', currentUser.role);
    setText('settingsUsername', name); setText('settingsRole', currentUser.role);
    setText('headerAvatar', name.charAt(0).toUpperCase());
    $('adminPanel').classList.toggle('hidden', currentUser.role !== 'Administrator');
    $('newDeviceButton').classList.toggle('hidden', currentUser.role !== 'Administrator');
}

async function loadAll() {
    await Promise.all([loadDevices(), loadEvents()]);
    if (currentUser.role === 'Administrator') await loadUsers();
}

function showSection(section) {
    document.querySelectorAll('.page-section').forEach(s => s.classList.add('hidden'));
    $(`section-${section}`).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.section === section));
    if (section === 'settings' && currentUser.role === 'Administrator') loadUsers();
    if (section === 'calendar') renderCalendar();
    if (section === 'devices') renderDevicesTable();
}

async function loadDevices() {
    const data = await api('devices/get.php');
    devices = data.devices || [];
    if (!selectedDeviceId && devices.length) selectedDeviceId = Number(devices[0].id);
    if (selectedDeviceId && !devices.some(d => Number(d.id) === Number(selectedDeviceId))) selectedDeviceId = devices.length ? Number(devices[0].id) : null;
    renderMap(); renderDeviceList(); renderDeviceDetails(); renderDevicesTable();
}

function renderMap() {
    const wrap = $('mapDevices'); wrap.innerHTML = '';
    devices.forEach(device => {
        const el = document.createElement('div');
        el.className = `map-device ${Number(device.id) === Number(selectedDeviceId) ? 'selected' : ''}`;
        el.style.left = `${(Number(device.x)/12)*100}%`;
        el.style.bottom = `${(Number(device.y)/11)*100}%`;
        el.title = device.name;
        el.innerHTML = `<span class="map-label">${escapeHtml(device.name)}</span>`;
        el.addEventListener('click', () => selectDevice(device.id));
        wrap.appendChild(el);
    });
    const d = devices.find(x => Number(x.id) === Number(selectedDeviceId));
    if (d) { $('radius').classList.remove('hidden'); $('radius').style.left = `${(Number(d.x)/12)*100}%`; $('radius').style.bottom = `${(Number(d.y)/11)*100}%`; }
    else $('radius').classList.add('hidden');
}

function renderDeviceList() {
    $('deviceList').innerHTML = devices.length ? devices.map(d => `<div class="device-item ${Number(d.id)===Number(selectedDeviceId)?'selected':''}" onclick="selectDevice(${Number(d.id)})"><div class="device-name">${escapeHtml(d.name)}</div><div class="device-type">${escapeHtml(d.type)}</div><div class="status">● ${escapeHtml(d.status)}</div></div>`).join('') : '<p class="muted">Keine Geräte vorhanden.</p>';
}

function selectDevice(id) { selectedDeviceId = Number(id); renderMap(); renderDeviceList(); renderDeviceDetails(); }
window.selectDevice = selectDevice;

function renderDeviceDetails() {
    const d = devices.find(x => Number(x.id) === Number(selectedDeviceId));
    if (!d) { $('deviceDetails').innerHTML=''; return; }
    $('deviceDetails').innerHTML = `<h2>Berechnete Position</h2>
        <div class="detail-row"><span>X-Position</span><span>${Number(d.x).toFixed(2)} m</span></div>
        <div class="detail-row"><span>Y-Position</span><span>${Number(d.y).toFixed(2)} m</span></div>
        <div class="detail-row"><span>RSSI Sensor A</span><span>${d.rssi_a ?? '-'} dBm</span></div>
        <div class="detail-row"><span>RSSI Sensor B</span><span>${d.rssi_b ?? '-'} dBm</span></div>
        <div class="detail-row"><span>Entfernung A</span><span>${d.distance_a ?? '-'} m</span></div>
        <div class="detail-row"><span>Entfernung B</span><span>${d.distance_b ?? '-'} m</span></div>
        <div class="accuracy"><small>Aktuelle Messgenauigkeit</small><strong>Testbetrieb</strong></div>`;
}

async function locateSelected() {
    const d = devices.find(x => Number(x.id) === Number(selectedDeviceId));
    if (!d) return;
    alert(`${d.name}\n\nBerechnete Position:\nX: ${Number(d.x).toFixed(2)} m\nY: ${Number(d.y).toFixed(2)} m\n\nRSSI A: ${d.rssi_a ?? '-'} dBm\nRSSI B: ${d.rssi_b ?? '-'} dBm`);
}

function renderDevicesTable() {
    $('deviceCount').textContent = devices.length;
    $('availableCount').textContent = devices.filter(d => ['Online','Verfügbar'].includes(d.status)).length;
    $('inUseCount').textContent = devices.filter(d => d.status === 'In Verwendung').length;
    $('devicesTable').innerHTML = devices.map(d => `<tr>
        <td><strong>${escapeHtml(d.name)}</strong></td><td>${escapeHtml(d.type)}</td><td>${escapeHtml(d.status)}</td>
        <td>${Number(d.x).toFixed(2)} m / ${Number(d.y).toFixed(2)} m</td>
        <td><div class="action-row">${d.status==='In Verwendung' ? `<button class="small-button" onclick="returnDevice(${d.id})">Zurückgeben</button>` : `<button class="small-button" onclick="borrowDevice(${d.id})">Ausleihen</button>`}<button class="small-button" onclick="showHistory(${d.id})">Historie</button></div></td>
    </tr>`).join('');
}

async function borrowDevice(id) { await deviceAction('devices/borrow.php', id, 'Gerät wurde ausgeliehen.'); }
async function returnDevice(id) { await deviceAction('devices/return.php', id, 'Gerät wurde zurückgegeben.'); }
window.borrowDevice = borrowDevice; window.returnDevice = returnDevice;
async function deviceAction(path,id,msg) { try { await api(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({device_id:id})}); await loadDevices(); alert(msg); } catch(e){alert(e.message);} }

async function showHistory(id) {
    try { const data=await api(`devices/history.php?device_id=${id}`); const d=devices.find(x=>Number(x.id)===id); openModal(`Historie – ${d?.name || 'Gerät'}`, `<div>${data.history.length ? data.history.map(h=>`<div class="event-card"><strong>${escapeHtml(h.action)}</strong><small>${escapeHtml(h.username||'System')} · ${escapeHtml(h.created_at)}</small></div>`).join('') : '<p class="muted">Noch keine Historie.</p>'}</div>`); } catch(e){alert(e.message);} }
window.showHistory = showHistory;

async function loadEvents() { const data=await api('calendar/get.php'); events=data.events||[]; renderCalendar(); }

function renderCalendar() {
    const year=calendarDate.getFullYear(), month=calendarDate.getMonth();
    setText('calendarTitle', calendarDate.toLocaleDateString('de-AT',{month:'long',year:'numeric'}));
    const first=new Date(year,month,1); const start=(first.getDay()+6)%7; const days=new Date(year,month+1,0).getDate(); const prevDays=new Date(year,month,0).getDate();
    const cells=[];
    for(let i=0;i<42;i++){
        const dayNum=i-start+1; let dateObj;
        let other=false;
        if(dayNum<1){dateObj=new Date(year,month-1,prevDays+dayNum);other=true;} else if(dayNum>days){dateObj=new Date(year,month+1,dayNum-days);other=true;} else dateObj=new Date(year,month,dayNum);
        const iso=dateObj.toISOString().slice(0,10);
        const todays=events.filter(e=>e.event_date===iso);
        cells.push(`<div class="calendar-day ${other?'other':''} ${iso===new Date().toISOString().slice(0,10)?'today':''}"><div class="day-number">${dateObj.getDate()}</div>${todays.slice(0,3).map(e=>`<span class="event-dot" title="${escapeHtml(e.title)}">${escapeHtml(e.title)}</span>`).join('')}</div>`);
    }
    $('calendarGrid').innerHTML=cells.join('');
    const upcoming=[...events].filter(e=>`${e.event_date} ${e.event_time}`>=new Date().toISOString().slice(0,16).replace('T',' ')).sort((a,b)=>`${a.event_date} ${a.event_time}`.localeCompare(`${b.event_date} ${b.event_time}`)).slice(0,8);
    $('upcomingEvents').innerHTML=upcoming.length?upcoming.map(e=>`<div class="event-card"><strong>${escapeHtml(e.title)}</strong><small>${escapeHtml(e.event_date)} · ${escapeHtml(e.event_time.slice(0,5))} · ${escapeHtml(e.event_type)}${e.device_name?' · '+escapeHtml(e.device_name):''}</small>${(currentUser.role==='Administrator'||Number(e.user_id)===Number(currentUser.id))?`<button class="small-button danger" onclick="deleteEvent(${e.id})">Löschen</button>`:''}</div>`).join(''):'<div class="event-card"><span class="muted">Keine kommenden Termine.</span></div>';
}
window.deleteEvent=async function(id){try{await api('calendar/delete.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});await loadEvents();}catch(e){alert(e.message)}};

function openEventModal() {
    const options=devices.map(d=>`<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
    openModal('Neuen Termin erstellen', `<form id="eventModalForm"><label>Titel<input id="eventTitle" required placeholder="z. B. Wartung EKG #01"></label><label>Datum<input id="eventDate" type="date" required value="${new Date().toISOString().slice(0,10)}"></label><label>Uhrzeit<input id="eventTime" type="time" required value="09:00"></label><label>Typ<select id="eventType"><option>Wartung</option><option>Ausleihe</option><option selected>Termin</option><option>Sonstiges</option></select></label><label>Gerät<select id="eventDevice"><option value="">Kein Gerät</option>${options}</select></label><label>Beschreibung<textarea id="eventDescription" placeholder="Optional"></textarea></label><div class="modal-actions"><button type="button" class="small-button" onclick="closeModal()">Abbrechen</button><button class="primary" type="submit">Speichern</button></div></form>`);
    $('eventModalForm').addEventListener('submit', async e=>{e.preventDefault();try{await api('calendar/create.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:$('eventTitle').value,date:$('eventDate').value,time:$('eventTime').value,type:$('eventType').value,device_id:$('eventDevice').value,description:$('eventDescription').value})});closeModal();await loadEvents();}catch(err){alert(err.message)}});
}

async function loadUsers(){if(currentUser.role!=='Administrator')return;try{const data=await api('users/get.php');$('usersTable').innerHTML=data.users.map(u=>`<tr><td><strong>${escapeHtml(u.username)}</strong></td><td>${escapeHtml(u.role)}</td><td>${escapeHtml(u.created_at)}</td><td>${Number(u.id)===Number(currentUser.id)?'<span class="muted">Aktuell</span>':`<button class="small-button danger" onclick="deleteUser(${u.id})">Löschen</button>`}</td></tr>`).join('');}catch(e){$('userMessage').textContent=e.message;$('userMessage').className='form-message error'}}

async function createUser(e){e.preventDefault();const msg=$('userMessage');msg.textContent='';try{await api('users/create.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:$('newUsername').value,password:$('newUserPassword').value,role:$('newUserRole').value})});$('userForm').reset();msg.textContent='Benutzer erstellt.';msg.className='form-message success';await loadUsers();}catch(err){msg.textContent=err.message;msg.className='form-message error'}}
window.deleteUser=async function(id){if(!confirm('Benutzer wirklich löschen?'))return;try{await api('users/delete.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});await loadUsers();}catch(e){alert(e.message)}};

async function changePassword(e){e.preventDefault();const msg=$('passwordMessage');msg.textContent='';if($('newPassword').value!==$('newPassword2').value){msg.textContent='Die neuen Passwörter stimmen nicht überein.';msg.className='form-message error';return;}try{await api('users/password.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword:$('currentPassword').value,newPassword:$('newPassword').value})});$('passwordForm').reset();msg.textContent='Passwort erfolgreich geändert.';msg.className='form-message success';}catch(err){msg.textContent=err.message;msg.className='form-message error'}}

function openDeviceModal(){openModal('Gerät hinzufügen',`<form id="deviceModalForm"><label>Name<input id="deviceName" required placeholder="z. B. Rollstuhl #03"></label><label>Typ<input id="deviceType" required placeholder="z. B. Rollstuhl"></label><div class="modal-actions"><button type="button" class="small-button" onclick="closeModal()">Abbrechen</button><button class="primary">Speichern</button></div></form>`);$('deviceModalForm').addEventListener('submit',async e=>{e.preventDefault();try{await api('devices/create.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:$('deviceName').value,type:$('deviceType').value})});closeModal();await loadDevices();}catch(err){alert(err.message)}})}

function openModal(title,body){setText('modalTitle',title);$('modalBody').innerHTML=body;$('modal').classList.remove('hidden')}
function closeModal(){$('modal').classList.add('hidden');$('modalBody').innerHTML=''}
window.closeModal=closeModal;

document.addEventListener('DOMContentLoaded', init);

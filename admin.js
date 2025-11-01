// admin.js — Admin logic for uploading & editing dataset

let adminData = {
  All_Together_Data: [],
  Sheet1: [],
  Sheet2: []
};

const $ = id => document.getElementById(id);

// Helper: refresh counts
function refreshCounts() {
  $('counts').textContent = `Participants: ${adminData.All_Together_Data.length} • Events: ${adminData.Sheet1.length} • Students: ${adminData.Sheet2.length}`;
}

// Validate minimal dataset shape
function isValidDataset(obj) {
  return obj && (Array.isArray(obj.All_Together_Data) || Array.isArray(obj.Sheet1) || Array.isArray(obj.Sheet2));
}

// Render tables
function renderParticipants(filter = '') {
  const tbody = $('participantsTable');
  const q = (filter || '').toLowerCase();
  tbody.innerHTML = adminData.All_Together_Data.filter(r => {
    if (!q) return true;
    return (r.Student_Name || '').toLowerCase().includes(q) || (r.Student_ID || '').toLowerCase().includes(q);
  }).map((r, idx) => `
    <tr>
      <td>${escapeHtml(r.Student_Name)}</td>
      <td>${escapeHtml(r.Student_ID)}</td>
      <td>${escapeHtml(r.Event_Name)}</td>
      <td>${escapeHtml(r.Event_Date)}</td>
      <td>${escapeHtml(r.Attendance_Status || '')}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary" onclick="adminEditParticipant(${idx})">Edit</button>
        <button class="btn btn-sm btn-outline-danger" onclick="adminDeleteParticipant(${idx})">Delete</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="6" class="text-center text-muted">No participants</td></tr>';
}

function renderEvents(filter = '') {
  const tbody = $('eventsTable');
  const q = (filter || '').toLowerCase();
  tbody.innerHTML = adminData.Sheet1.filter(e => {
    if (!q) return true;
    return (e.Event_Name || '').toLowerCase().includes(q) || (e.Event_ID || '').toLowerCase().includes(q);
  }).map((e, idx) => `
    <tr>
      <td>${escapeHtml(e.Event_Name)}</td>
      <td>${escapeHtml(e.Event_Date)}</td>
      <td>${escapeHtml(e.Event_Type)}</td>
      <td>${escapeHtml(e.Event_ID)}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary" onclick="adminEditEvent(${idx})">Edit</button>
        <button class="btn btn-sm btn-outline-danger" onclick="adminDeleteEvent(${idx})">Delete</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="5" class="text-center text-muted">No events</td></tr>';
}

function renderStudents(filter = '') {
  const tbody = $('studentsTable');
  const q = (filter || '').toLowerCase();
  tbody.innerHTML = adminData.Sheet2.filter(s => {
    if (!q) return true;
    return (s.Student_Name || '').toLowerCase().includes(q) || (s.Student_ID || '').toLowerCase().includes(q);
  }).map((s, idx) => `
    <tr>
      <td>${escapeHtml(s.Student_Name)}</td>
      <td>${escapeHtml(s.Student_ID)}</td>
      <td>${escapeHtml(s.Department)}</td>
      <td>${escapeHtml(s.Gender)}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary" onclick="adminEditStudent(${idx})">Edit</button>
        <button class="btn btn-sm btn-outline-danger" onclick="adminDeleteStudent(${idx})">Delete</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="5" class="text-center text-muted">No students</td></tr>';
}

// Load uploaded JSON (from file)
$('adminUpload').addEventListener('change', function(e){
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev){
    try {
      const parsed = JSON.parse(ev.target.result);
      if (!isValidDataset(parsed)) {
        alert('Uploaded JSON structure looks wrong. Expect keys: All_Together_Data, Sheet1, Sheet2 (arrays).');
        return;
      }
      adminData.All_Together_Data = Array.isArray(parsed.All_Together_Data) ? parsed.All_Together_Data : [];
      adminData.Sheet1 = Array.isArray(parsed.Sheet1) ? parsed.Sheet1 : [];
      adminData.Sheet2 = Array.isArray(parsed.Sheet2) ? parsed.Sheet2 : [];
      $('uploadedFileName').textContent = file.name;
      refreshCounts();
      renderAll();
    } catch(err){
      console.error(err);
      alert('Failed to parse JSON file. Check console for errors.');
    }
  };
  reader.readAsText(file);
});

// Export current adminData
$('exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(adminData, null, 2)], {type: 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `dashboard_data_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
});

// Save to localStorage so dashboard can pick it up
$('btnSaveLocal').addEventListener('click', () => {
  localStorage.setItem('uploadedDashboardJson', JSON.stringify(adminData));
  alert('Saved current dataset to localStorage (key: uploadedDashboardJson). Dashboard will load this automatically.');
});

// Quick render wrapper
function renderAll() {
  renderParticipants($('searchParticipants').value);
  renderEvents($('searchEvents').value);
  renderStudents($('searchStudents').value);
  refreshCounts();
}

// Basic search listeners
$('searchParticipants').addEventListener('input', (e) => renderParticipants(e.target.value));
$('searchEvents').addEventListener('input', (e) => renderEvents(e.target.value));
$('searchStudents').addEventListener('input', (e) => renderStudents(e.target.value));

// Add new participant
const participantModal = new bootstrap.Modal($('modalParticipant'));
$('btnAddParticipant').addEventListener('click', () => {
  $('participantForm').reset();
  $('participantForm').__mode.value = 'create';
  $('participantModalTitle').textContent = 'Add Participant';
  participantModal.show();
});

// Submit participant form (create/update)
$('participantForm').addEventListener('submit', function(e){
  e.preventDefault();
  const form = e.target;
  const mode = form.__mode.value;
  const obj = {
    Student_ID: form.Student_ID.value.trim(),
    Student_Name: form.Student_Name.value.trim(),
    Event_ID: form.Event_ID.value.trim(),
    Event_Name: form.Event_Name.value.trim(),
    Event_Date: form.Event_Date.value.trim(),
    Attendance_Status: form.Attendance_Status.value,
    Participation_Role: form.Participation_Role.value,
    Department: form.Department.value,
    Feedback: form.Feedback.value
  };

  if (mode === 'create') {
    adminData.All_Together_Data.push(obj);
  } else {
    // mode contains index for update
    const idx = parseInt(mode, 10);
    adminData.All_Together_Data[idx] = obj;
  }
  participantModal.hide();
  renderAll();
});

// Edit / Delete handlers (participants)
window.adminEditParticipant = function(idx) {
  const item = adminData.All_Together_Data[idx];
  if (!item) return;
  const form = $('participantForm');
  form.Student_ID.value = item.Student_ID || '';
  form.Student_Name.value = item.Student_Name || '';
  form.Event_ID.value = item.Event_ID || '';
  form.Event_Name.value = item.Event_Name || '';
  form.Event_Date.value = item.Event_Date || '';
  form.Attendance_Status.value = item.Attendance_Status || 'Attended';
  form.Participation_Role.value = item.Participation_Role || '';
  form.Department.value = item.Department || '';
  form.Feedback.value = item.Feedback || '';
  form.__mode.value = String(idx);
  $('participantModalTitle').textContent = 'Edit Participant';
  participantModal.show();
};

window.adminDeleteParticipant = function(idx) {
  if (!confirm('Delete this participant record?')) return;
  adminData.All_Together_Data.splice(idx, 1);
  renderAll();
};

// Events: add/edit/delete
const eventModal = new bootstrap.Modal($('modalEvent'));
$('btnAddEvent').addEventListener('click', () => {
  $('eventForm').reset();
  $('eventForm').__mode.value = 'create';
  $('eventModalTitle').textContent = 'Add Event';
  eventModal.show();
});

$('eventForm').addEventListener('submit', function(e){
  e.preventDefault();
  const form = e.target;
  const obj = {
    Event_ID: form.Event_ID.value.trim(),
    Event_Name: form.Event_Name.value.trim(),
    Event_Date: form.Event_Date.value.trim(),
    Event_Type: form.Event_Type.value.trim(),
    Event_Location: form.Event_Location.value.trim()
  };
  if (form.__mode.value === 'create') adminData.Sheet1.push(obj);
  else adminData.Sheet1[parseInt(form.__mode.value,10)] = obj;
  eventModal.hide();
  renderAll();
});

window.adminEditEvent = function(idx) {
  const item = adminData.Sheet1[idx];
  if (!item) return;
  const form = $('eventForm');
  form.Event_ID.value = item.Event_ID || '';
  form.Event_Name.value = item.Event_Name || '';
  form.Event_Date.value = item.Event_Date || '';
  form.Event_Type.value = item.Event_Type || '';
  form.Event_Location.value = item.Event_Location || '';
  form.__mode.value = String(idx);
  $('eventModalTitle').textContent = 'Edit Event';
  eventModal.show();
};

window.adminDeleteEvent = function(idx) {
  if (!confirm('Delete this event? (participation records will remain — you may delete them separately)')) return;
  adminData.Sheet1.splice(idx, 1);
  renderAll();
};

// Students: add/edit/delete
const studentModal = new bootstrap.Modal($('modalStudent'));
$('btnAddStudent').addEventListener('click', () => {
  $('studentForm').reset();
  $('studentForm').__mode.value = 'create';
  $('studentModalTitle').textContent = 'Add Student';
  studentModal.show();
});

$('studentForm').addEventListener('submit', function(e){
  e.preventDefault();
  const form = e.target;
  const obj = {
    Student_ID: form.Student_ID.value.trim(),
    Student_Name: form.Student_Name.value.trim(),
    Department: form.Department.value.trim(),
    Gender: form.Gender.value.trim()
  };
  if (form.__mode.value === 'create') adminData.Sheet2.push(obj);
  else adminData.Sheet2[parseInt(form.__mode.value,10)] = obj;
  studentModal.hide();
  renderAll();
});

window.adminEditStudent = function(idx) {
  const item = adminData.Sheet2[idx];
  if (!item) return;
  const form = $('studentForm');
  form.Student_ID.value = item.Student_ID || '';
  form.Student_Name.value = item.Student_Name || '';
  form.Department.value = item.Department || '';
  form.Gender.value = item.Gender || '';
  form.__mode.value = String(idx);
  $('studentModalTitle').textContent = 'Edit Student';
  studentModal.show();
};

window.adminDeleteStudent = function(idx) {
  if (!confirm('Delete this student? (participation records will remain)')) return;
  adminData.Sheet2.splice(idx, 1);
  renderAll();
};

// Initialize (attempt to load from localStorage if present)
function adminInit() {
  const stored = localStorage.getItem('uploadedDashboardJson');
  if (stored) {
    try {
      adminData = JSON.parse(stored);
      $('uploadedFileName').textContent = 'localStorage (saved)';
    } catch (err) {
      console.warn('Failed to parse local uploadedDashboardJson');
    }
  }
  renderAll();
}
adminInit();

// small helper escape for HTML in rows
function escapeHtml(text) {
  if (text === undefined || text === null) return '';
  return String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

document.getElementById('logoutBtn')?.addEventListener('click', () => {
  localStorage.removeItem('isAdminLoggedIn');
  window.location.href = 'admin-login.html';
});


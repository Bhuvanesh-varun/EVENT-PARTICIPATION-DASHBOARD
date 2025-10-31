// dashboard.js
// Full interactive logic for the dashboard UI

let allEvents = [];
let rawParticipation = [];
let studentsMap = {};
let eventsMap = {};
let deptGenderChart = null;
let eventCountChart = null;
let eventTypeChart = null;
let yearlyChart = null;
let currentEventName = '';
let currentEventDate = '';
let currentEventEventID = '';

const saved = localStorage.getItem('uploadedDashboardJson');
if (saved) {
  try {
    const parsed = JSON.parse(saved);
    rawParticipation = Array.isArray(parsed.All_Together_Data) ? parsed.All_Together_Data : [];
    studentsMap = {};
    eventsMap = {};
    if (Array.isArray(parsed.Sheet2)) {
      parsed.Sheet2.forEach(s => {
        if (s.Student_ID) studentsMap[String(s.Student_ID).toLowerCase()] = { Gender: s.Gender || '', Department: s.Department || '', Student_Name: s.Student_Name || '' };
      });
    }
    if (Array.isArray(parsed.Sheet1)) {
      parsed.Sheet1.forEach(ev => {
        if (ev.Event_ID) eventsMap[String(ev.Event_ID)] = { Event_Name: ev.Event_Name || '', Event_Date: ev.Event_Date || '', Event_Type: ev.Event_Type || '', Event_Location: ev.Event_Location || '' };
      });
    }
    enrichAllEvents();
    populateEventDropdown();
    document.getElementById('eventSelect').disabled = false;
    initFromLogin();
  } catch (err) {
    console.warn('Failed to parse uploadedDashboardJson', err);
  }
}

function safe(v, f = '') { return (v === undefined || v === null) ? f : v; }
function escapeHtml(text) {
  if (text === undefined || text === null) return '';
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function enrichAllEvents() {
  allEvents = rawParticipation.map(r => {
    const sid = safe(r.Student_ID, '').toString().toLowerCase();
    const studentMeta = studentsMap[sid] || {};
    const eventMeta = eventsMap[safe(r.Event_ID, '')] || {};
    return {
      Student_ID: safe(r.Student_ID, ''),
      Student_Name: safe(r.Student_Name, ''),
      Participation_Role: safe(r.Participation_Role, ''),
      Award: safe(r.Award, ''),
      Feedback: safe(r.Feedback, ''),
      Attendance_Status: safe(r.Attendance_Status, ''),
      Registration_Date: safe(r.Registration_Date, ''),
      Event_ID: safe(r.Event_ID, ''),
      Event_Name: safe(r.Event_Name, eventMeta.Event_Name || ''),
      Event_Date: safe(r.Event_Date, eventMeta.Event_Date || ''),
      Event_Type: safe(r.Event_Type, eventMeta.Event_Type || ''),
      Event_Location: safe(r.Event_Location, eventMeta.Event_Location || ''),
      Department: safe(r.Department, studentMeta.Department || ''),
      Gender: safe(r.Gender, studentMeta.Gender || '')
    };
  });
}

  // Redirect to your desired page when button is clicked
  document.getElementById("searchStudentBtn").addEventListener("click", () => {
    // Change this URL later as needed
    window.location.href = "student_dashboard.html";
  });

// Load JSON (change path if needed)
fetch('./data/events.json')
  .then(res => {
    if (!res.ok) throw new Error('Failed to load data/events.json');
    return res.json();
  })
  .then(data => {
    rawParticipation = Array.isArray(data.All_Together_Data) ? data.All_Together_Data : [];

    if (Array.isArray(data.Sheet2)) {
      data.Sheet2.forEach(s => {
        if (s.Student_ID) {
          studentsMap[String(s.Student_ID).toLowerCase()] = { Gender: safe(s.Gender, ''), Department: safe(s.Department, ''), Student_Name: safe(s.Student_Name, '') };
        }
      });
    }

    if (Array.isArray(data.Sheet1)) {
      data.Sheet1.forEach(ev => {
        if (ev.Event_ID) eventsMap[String(ev.Event_ID)] = { Event_Name: safe(ev.Event_Name, ''), Event_Date: safe(ev.Event_Date, ''), Event_Type: safe(ev.Event_Type, ''), Event_Location: safe(ev.Event_Location, '') };
      });
    }

    enrichAllEvents();
    populateEventDropdown();
    document.getElementById('eventSelect').disabled = false;
    computeTopKPIs();
    renderOverallCharts();
    initFromLogin();
  })
  .catch(err => {
    console.error('Failed to load events.json:', err);
    document.getElementById('eventSelect').innerHTML = '<option>Error loading events</option>';
  });

function populateEventDropdown() {
  const map = {};
  allEvents.forEach(e => {
    const key = e.Event_ID ? e.Event_ID : `${e.Event_Name}|${e.Event_Date || 'Unknown'}`;
    if (!map[key]) map[key] = { Event_ID: e.Event_ID, Event_Name: e.Event_Name, Event_Date: e.Event_Date };
  });

  const sel = document.getElementById('eventSelect');
  sel.innerHTML = '<option value="">All events (show overall)</option>';
  Object.values(map).sort((a,b) => (a.Event_Date || '').localeCompare(b.Event_Date || '')).forEach(ev => {
    const opt = document.createElement('option');
    opt.value = ev.Event_ID ? ev.Event_ID : `${ev.Event_Name}|${ev.Event_Date || ''}`;
    const label = ev.Event_Date ? `${ev.Event_Name} (${ev.Event_Date})` : ev.Event_Name;
    opt.textContent = label;
    sel.appendChild(opt);
  });
}

document.getElementById('eventSelect').addEventListener('change', function () {
  const value = this.value;
  if (!value) {
    currentEventEventID = '';
    currentEventName = '';
    currentEventDate = '';
    computeTopKPIs();
    renderOverallCharts();
    resetParticipantTablePrompt();
    return;
  }
  const byId = allEvents.filter(r => r.Event_ID && r.Event_ID === value);
  if (byId.length) {
    renderDashboardByRecords(byId);
    return;
  }
  const [name, date] = value.split('|');
  renderDashboard(name, (date || '').trim());
});

document.getElementById('filterDeptBtn').addEventListener('click', applyDepartmentFilter);
document.getElementById('resetBtn').addEventListener('click', function () {
  document.getElementById('eventSelect').value = '';
  document.getElementById('deptFilter').value = '';
  currentEventEventID = '';
  currentEventName = '';
  currentEventDate = '';
  computeTopKPIs();
  renderOverallCharts();
  resetParticipantTablePrompt();
});
document.getElementById('deptFilter').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') applyDepartmentFilter();
});

function computeTopKPIs() {
  const uniqueStudents = new Set(allEvents.map(r => safe(r.Student_ID, '')).filter(x => x !== ''));
  document.getElementById('kpiUniqueStudents').textContent = uniqueStudents.size;

  const uniqueEvents = new Set(allEvents.map(r => safe(r.Event_ID, '') || `${r.Event_Name}|${r.Event_Date}`).filter(x => x !== ''));
  document.getElementById('kpiUniqueEvents').textContent = uniqueEvents.size;

  document.getElementById('kpiTotalParticipants').textContent = allEvents.length;

  const attendedCount = allEvents.filter(r => (r.Attendance_Status || '').toLowerCase() === 'attended').length;
  const percent = allEvents.length ? Math.round((attendedCount / allEvents.length) * 100) : 0;
  document.getElementById('kpiAttendancePercent').textContent = percent + '%';
}

function renderOverallCharts() {
  const deptGender = {};
  allEvents.forEach(r => {
    const dept = r.Department || 'Unknown';
    const gender = (r.Gender || 'Unknown').toLowerCase();
    deptGender[dept] = deptGender[dept] || { male: 0, female: 0, other: 0 };
    if (gender === 'male' || gender === 'm') deptGender[dept].male++;
    else if (gender === 'female' || gender === 'f') deptGender[dept].female++;
    else deptGender[dept].other++;
  });
  const deptLabels = Object.keys(deptGender);
  const maleData = deptLabels.map(d => deptGender[d].male || 0);
  const femaleData = deptLabels.map(d => deptGender[d].female || 0);
  const otherData = deptLabels.map(d => deptGender[d].other || 0);

  if (deptGenderChart) deptGenderChart.destroy();
  deptGenderChart = new Chart(document.getElementById('deptGenderChart'), {
    type: 'bar',
    data: {
      labels: deptLabels,
      datasets: [
        { label: 'Female', data: femaleData, backgroundColor: '#0ea5e9', stack: 'stack1' },
        { label: 'Male', data: maleData, backgroundColor: '#2563eb', stack: 'stack1' },
        { label: 'Other', data: otherData, backgroundColor: '#64748b', stack: 'stack1' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });

  const eventCounts = {};
  allEvents.forEach(r => {
    const name = r.Event_Name || 'Unknown';
    eventCounts[name] = (eventCounts[name] || 0) + 1;
  });
  const eventSorted = Object.entries(eventCounts).sort((a,b)=>b[1]-a[1]).slice(0,12);
  const eventLabels = eventSorted.map(e => e[0]);
  const eventData = eventSorted.map(e => e[1]);

  if (eventCountChart) eventCountChart.destroy();
  eventCountChart = new Chart(document.getElementById('eventCountChart'), {
    type: 'bar',
    data: { labels: eventLabels, datasets: [{ label: 'Participants', data: eventData, backgroundColor: '#0ea5e9' }] },
    options: { indexAxis: 'x', responsive: true, maintainAspectRatio: false, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true, ticks:{precision:0}}} }
  });

  const typeCounts = {};
  allEvents.forEach(r => { const t = r.Event_Type || 'Other'; typeCounts[t] = (typeCounts[t] || 0) + 1; });
  const typeLabels = Object.keys(typeCounts);
  const typeData = Object.values(typeCounts);
  if (eventTypeChart) eventTypeChart.destroy();
  eventTypeChart = new Chart(document.getElementById('eventTypeChart'), {
    type: 'doughnut',
    data: { labels: typeLabels, datasets: [{ data: typeData }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
  });

  const yearCounts = {};
  allEvents.forEach(r => {
    const date = r.Event_Date || r.Registration_Date || '';
    let year = '';
    if (date && /\d{4}/.test(date)) {
      const m = date.match(/(\d{4})/);
      year = m ? m[1] : '';
    }
    if (!year) year = 'Unknown';
    yearCounts[year] = (yearCounts[year] || 0) + 1;
  });
  const yearLabels = Object.keys(yearCounts).sort();
  const yearData = yearLabels.map(y => yearCounts[y]);

  if (yearlyChart) yearlyChart.destroy();
  yearlyChart = new Chart(document.getElementById('yearlyChart'), {
    type: 'line',
    data: { labels: yearLabels, datasets: [{ label: 'Total Participants', data: yearData, fill:false }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
}

function renderDashboard(eventName, eventDate) {
  currentEventEventID = '';
  currentEventName = eventName;
  currentEventDate = eventDate;
  const records = allEvents.filter(e => e.Event_Name === eventName && (eventDate ? e.Event_Date === eventDate : true));
  renderDashboardByRecords(records);
}

function renderDashboardByRecords(records) {
  if (!records || records.length === 0) {
    resetDashboard();
    return;
  }

  currentEventEventID = records[0].Event_ID || '';
  currentEventName = records[0].Event_Name || '';
  currentEventDate = records[0].Event_Date || '';

  const uniqueStudents = new Set(records.map(r => safe(r.Student_ID, '')).filter(x => x !== ''));
  document.getElementById('kpiUniqueStudents').textContent = uniqueStudents.size;

  const uniqueEvents = new Set(records.map(r => safe(r.Event_ID, '') || `${r.Event_Name}|${r.Event_Date}`).filter(x => x !== ''));
  document.getElementById('kpiUniqueEvents').textContent = uniqueEvents.size;

  document.getElementById('kpiTotalParticipants').textContent = records.length;

  const attended = records.filter(r => (r.Attendance_Status || '').toLowerCase() === 'attended').length;
  const attendPct = records.length ? Math.round((attended / records.length) * 100) : 0;
  document.getElementById('kpiAttendancePercent').textContent = attendPct + '%';

  const deptGender = {};
  records.forEach(r => {
    const d = r.Department || 'Unknown';
    const g = (r.Gender || 'Unknown').toLowerCase();
    deptGender[d] = deptGender[d] || { male: 0, female: 0, other: 0 };
    if (g === 'male' || g === 'm') deptGender[d].male++;
    else if (g === 'female' || g === 'f') deptGender[d].female++;
    else deptGender[d].other++;
  });
  const deptLabels = Object.keys(deptGender);
  const femaleData = deptLabels.map(d => deptGender[d].female || 0);
  const maleData = deptLabels.map(d => deptGender[d].male || 0);
  const otherData = deptLabels.map(d => deptGender[d].other || 0);
  if (deptGenderChart) deptGenderChart.destroy();
  deptGenderChart = new Chart(document.getElementById('deptGenderChart'), {
    type: 'bar',
    data: { labels: deptLabels, datasets: [{ label:'Female', data: femaleData, backgroundColor:'#0ea5e9' },{ label:'Male', data: maleData, backgroundColor:'#2563eb' },{ label:'Other', data: otherData, backgroundColor:'#64748b' }] },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'top'}}, scales:{y:{beginAtZero:true}} }
  });

  const deptCount = {};
  records.forEach(r => { const d = r.Department || 'Unknown'; deptCount[d] = (deptCount[d]||0)+1; });
  const eLabels = Object.keys(deptCount);
  const eData = Object.values(deptCount);
  if (eventCountChart) eventCountChart.destroy();
  eventCountChart = new Chart(document.getElementById('eventCountChart'), {
    type: 'bar',
    data: { labels: eLabels, datasets: [{ label: 'Participants', data: eData, backgroundColor: '#0ea5e9' }] },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}} }
  });

  const type = (records[0].Event_Type || 'Other');
  if (eventTypeChart) eventTypeChart.destroy();
  eventTypeChart = new Chart(document.getElementById('eventTypeChart'), {
    type: 'doughnut',
    data: { labels: [type, 'Other'], datasets: [{ data: [records.length, Math.max(0, (allEvents.length - records.length))] }] },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'right'}} }
  });

  const yearCounts = {};
  records.forEach(r => {
    const date = r.Event_Date || r.Registration_Date || '';
    let y = '';
    if (date && /\d{4}/.test(date)) {
      const m = date.match(/(\d{4})/);
      y = m ? m[1] : '';
    }
    if (!y) y = 'Unknown';
    yearCounts[y] = (yearCounts[y] || 0) + 1;
  });
  const years = Object.keys(yearCounts).sort();
  const yData = years.map(y => yearCounts[y]);
  if (yearlyChart) yearlyChart.destroy();
  yearlyChart = new Chart(document.getElementById('yearlyChart'), {
    type: 'line',
    data: { labels: years, datasets: [{ label:'Participants', data: yData, fill:false }] },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}} }
  });

  updateParticipantTable(records);
}

function updateParticipantTable(records) {
  const tbody = document.getElementById('participantsTableBody');
  if (!records || records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No participants found</td></tr>`;
    return;
  }

  tbody.innerHTML = records.map(r => `
    <tr class="participant-row"
        data-name="${escapeHtml(r.Student_Name)}"
        data-id="${escapeHtml(r.Student_ID)}"
        data-dept="${escapeHtml(r.Department)}"
        data-role="${escapeHtml(r.Participation_Role)}"
        data-status="${escapeHtml(r.Attendance_Status)}"
        data-event="${escapeHtml(r.Event_Name)}"
        data-event-type="${escapeHtml(r.Event_Type)}"
        data-event-date="${escapeHtml(r.Event_Date)}"
        data-event-location="${escapeHtml(r.Event_Location)}"
        data-award="${escapeHtml(r.Award || 'None')}"
        data-feedback="${escapeHtml(r.Feedback || 'No feedback')}"
        data-registration-date="${escapeHtml(r.Registration_Date)}"
        data-event-id="${escapeHtml(r.Event_ID)}"
        data-gender="${escapeHtml(r.Gender)}"
    >
      <td class="student-name-cell" style="cursor:pointer;color:#0b5cff;text-decoration:underline;">${escapeHtml(r.Student_Name)}</td>
      <td>${escapeHtml(r.Department || 'Unknown')}</td>
      <td>${escapeHtml(r.Participation_Role)}</td>
      <td><span class="${(String(r.Attendance_Status).toLowerCase() === 'attended') ? 'attended-badge' : 'absent-badge'}">${escapeHtml(r.Attendance_Status || 'Unknown')}</span></td>
    </tr>
  `).join('');
  addPopupListeners();
}

function createPopupElement() {
  const existing = document.getElementById('studentPopup');
  if (existing) return existing;

  // const popup = document.createElement('div');
  // popup.id = 'studentPopup';
  // popup.style = `
  //   position: fixed; z-index:9999; left:50%; top:50%; transform:translate(-50%,-50%);
  //   width:880px; max-width:96vw; max-height:92vh; overflow-y:auto;
  //   background:#fff; border-radius:12px; box-shadow:0 40px 90px rgba(2,6,23,0.35); padding:20px;
  // `;
  popup.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <div>
        <h3 id="popupStudentName" style="margin:0; color:#0b5cff;"></h3>
        <div id="popupStudentID" class="small-muted"></div>
      </div>
      <div style="display:flex; gap:8px; align-items:center;">
        <button id="popupExportBtn" class="btn btn-outline-secondary btn-sm">Export</button>
        <button id="popupMessageBtn" class="btn btn-outline-primary btn-sm">Message</button>
        <button id="popupCloseBtn" class="btn btn-danger btn-sm">Close</button>
      </div>
    </div>

    <div id="popupAbsentBanner" style="display:none; padding:10px; border-radius:8px; margin-bottom:12px; background:#fff1f2; border:1px solid #fecaca; color:#7f1d1d;">
      <strong>Absent</strong> — This student is marked absent for this event.
    </div>

    <div style="display:flex; gap:18px; margin-bottom:12px; flex-wrap:wrap;">
      <div style="flex:1; min-width:260px;">
        <h6 style="margin-bottom:8px;">Student Information</h6>
        <div><small class="small-muted">Department</small><div id="popupStudentDept" style="font-weight:600"></div></div>
        <div><small class="small-muted">Gender</small><div id="popupStudentGender" style="font-weight:600"></div></div>
      </div>
      <div style="flex:1; min-width:260px;">
        <h6 style="margin-bottom:8px;">Event Information</h6>
        <div><small class="small-muted">Event</small><div id="popupEventName" style="font-weight:600"></div></div>
        <div><small class="small-muted">Event Type</small><div id="popupEventType" style="font-weight:600"></div></div>
      </div>
    </div>

    <div style="display:flex; gap:12px; align-items:center; margin-bottom:12px;">
      <button id="popupMarkAbsentBtn" class="btn btn-outline-danger btn-sm">Mark Absent</button>
      <button id="popupAttendanceBtn" class="btn btn-outline-secondary btn-sm">Attendance History</button>
    </div>

    <div id="popupEventsList" style="max-height:220px; overflow-y:auto;"></div>
  `;
  document.body.appendChild(popup);

  popup.querySelector('#popupCloseBtn').addEventListener('click', () => { popup.style.display = 'none'; });

  popup.querySelector('#popupExportBtn').addEventListener('click', () => {
    const payload = {
      Student_Name: popup.querySelector('#popupStudentName').textContent,
      Student_ID: popup.querySelector('#popupStudentID').textContent,
      Event_Name: popup.querySelector('#popupEventName').textContent,
      Event_ID: popup.querySelector('#popupEventID') ? popup.querySelector('#popupEventID').textContent : ''
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${payload.Student_ID || 'student'}_${payload.Event_ID || 'event'}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  popup.querySelector('#popupMessageBtn').addEventListener('click', () => {
    const student = popup.querySelector('#popupStudentName').textContent;
    const body = prompt(`Send message to ${student} (demo):`);
    if (body) alert(`(demo) Message sent to ${student}:\n\n"${body}"`);
  });

  return popup;
}

function addPopupListeners() {
  const popup = document.getElementById('studentPopup') || createPopupElement();

  document.querySelectorAll('.student-name-cell').forEach(cell => {
    const clone = cell.cloneNode(true);
    cell.parentNode.replaceChild(clone, cell);
  });

  document.querySelectorAll('.student-name-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      const row = cell.closest('tr');
      const popupEl = createPopupElement();

      popupEl.querySelector('#popupStudentName').textContent = row.dataset.name || '';
      popupEl.querySelector('#popupStudentID').textContent = row.dataset.id || '';
      popupEl.querySelector('#popupStudentDept').textContent = row.dataset.dept || '';
      popupEl.querySelector('#popupStudentGender').textContent = row.dataset.gender || '';
      popupEl.querySelector('#popupEventName').textContent = row.dataset.event || '';
      popupEl.querySelector('#popupEventType').textContent = row.dataset.eventType || '';

      if (!popupEl.querySelector('#popupEventID')) {
        const span = document.createElement('span');
        span.id = 'popupEventID';
        span.style.display = 'none';
        popupEl.appendChild(span);
      }
      popupEl.querySelector('#popupEventID').textContent = row.dataset.eventId || '';

      const absentBanner = popupEl.querySelector('#popupAbsentBanner');
      const markBtn = popupEl.querySelector('#popupMarkAbsentBtn');
      const status = (row.dataset.status || '').toLowerCase();
      if (status === 'absent') {
        absentBanner.style.display = 'block';
        markBtn.textContent = 'Mark Present';
        markBtn.classList.remove('btn-outline-danger');
        markBtn.classList.add('btn-success');
      } else {
        absentBanner.style.display = 'none';
        markBtn.textContent = 'Mark Absent';
        markBtn.classList.remove('btn-success');
        markBtn.classList.add('btn-outline-danger');
      }

      const newMarkBtn = markBtn.cloneNode(true);
      markBtn.parentNode.replaceChild(newMarkBtn, markBtn);
      newMarkBtn.addEventListener('click', () => {
        const sid = row.dataset.id;
        const eid = row.dataset.eventId;
        if (!sid || !eid) { alert('Missing student or event id'); return; }
        const target = allEvents.filter(r => String(r.Student_ID) === String(sid) && String(r.Event_ID) === String(eid));
        if (!target.length) { alert('No matching record'); return; }
        const currentlyAbsent = target.some(t => (t.Attendance_Status || '').toLowerCase() === 'absent');
        const newStatus = currentlyAbsent ? 'Attended' : 'Absent';
        target.forEach(t => { t.Attendance_Status = newStatus; });

        document.querySelectorAll('#participantsTableBody tr.participant-row').forEach(tr => {
          if ((tr.dataset.id || '') === String(sid) && (tr.dataset.eventId || '') === String(eid)) {
            tr.dataset.status = newStatus;
            const statusCell = tr.querySelector('td:last-child span');
            if (statusCell) statusCell.textContent = newStatus;
            statusCell.className = (newStatus.toLowerCase() === 'attended') ? 'attended-badge' : 'absent-badge';
          }
        });

        if (newStatus.toLowerCase() === 'absent') {
          popupEl.querySelector('#popupAbsentBanner').style.display = 'block';
          newMarkBtn.textContent = 'Mark Present';
          newMarkBtn.classList.remove('btn-outline-danger');
          newMarkBtn.classList.add('btn-success');
        } else {
          popupEl.querySelector('#popupAbsentBanner').style.display = 'none';
          newMarkBtn.textContent = 'Mark Absent';
          newMarkBtn.classList.remove('btn-success');
          newMarkBtn.classList.add('btn-outline-danger');
        }

        if (currentEventEventID) {
          const recs = allEvents.filter(r => r.Event_ID === currentEventEventID);
          renderDashboardByRecords(recs);
        } else if (currentEventName) {
          renderDashboard(currentEventName, currentEventDate);
        } else {
          computeTopKPIs();
          renderOverallCharts();
        }

        newMarkBtn.disabled = true;
        setTimeout(() => newMarkBtn.disabled = false, 700);
      });

      const attendanceBtn = popupEl.querySelector('#popupAttendanceBtn');
      const newAttendanceBtn = attendanceBtn.cloneNode(true);
      attendanceBtn.parentNode.replaceChild(newAttendanceBtn, attendanceBtn);
      newAttendanceBtn.addEventListener('click', () => {
        const sid = row.dataset.id;
        const history = allEvents.filter(r => String(r.Student_ID) === String(sid)).map(x => `${x.Event_Name} • ${x.Event_Date} • ${x.Attendance_Status || '—'}`);
        alert(`Attendance history for ${row.dataset.name}:\n\n` + (history.length ? history.join('\n') : '(no records)'));
      });

      showOtherEvents(row.dataset.id, row.dataset.name, popupEl);

      popupEl.style.display = 'block';
    });
  });
}

function showOtherEvents(studentId, studentName, popupEl) {
  const eventsList = popupEl.querySelector('#popupEventsList');
  if (!eventsList) return;
  const sidLower = (studentId || '').toString().toLowerCase();
  const studentEvents = allEvents.filter(e => (String(e.Student_ID || '').toLowerCase() === sidLower) || ((e.Student_Name || '').toLowerCase() === (studentName || '').toLowerCase()));
  const otherEvents = studentEvents.filter(e => !(e.Event_Name === currentEventName && e.Event_Date === currentEventDate));
  if (!otherEvents.length) { eventsList.innerHTML = '<div class="small-muted">No other events</div>'; return; }

  eventsList.innerHTML = otherEvents.map(ev => `
    <div style="padding:10px;border-bottom:1px solid #f1f5f9;">
      <div style="font-weight:600;color:#0b5cff;">${escapeHtml(ev.Event_Name)}</div>
      <div class="small-muted">${escapeHtml(ev.Event_Type)} • ${escapeHtml(ev.Event_Date)}</div>
      <div style="margin-top:6px;"><small>Role: ${escapeHtml(ev.Participation_Role)} • Status: ${escapeHtml(ev.Attendance_Status)}</small></div>
    </div>
  `).join('');
}

function applyDepartmentFilter() {
  const q = document.getElementById('deptFilter').value.trim().toLowerCase();
  if (!q) {
    if (currentEventEventID) renderDashboardByRecords(allEvents.filter(r => r.Event_ID === currentEventEventID));
    else if (currentEventName) renderDashboard(currentEventName, currentEventDate);
    else computeTopKPIs(), renderOverallCharts();
    return;
  }

  let base = [];
  if (currentEventEventID) base = allEvents.filter(r => r.Event_ID === currentEventEventID);
  else if (currentEventName) base = allEvents.filter(r => r.Event_Name === currentEventName && (currentEventDate ? r.Event_Date === currentEventDate : true));
  else base = allEvents;

  const filtered = base.filter(r =>
    (r.Student_ID || '').toLowerCase().includes(q) ||
    (r.Student_Name || '').toLowerCase().includes(q) ||
    (r.Department || '').toLowerCase().includes(q)
  );

  updateParticipantTable(filtered);
}

function resetDashboard() {
  currentEventName = '';
  currentEventDate = '';
  currentEventEventID = '';
  computeTopKPIs();
  renderOverallCharts();
  resetParticipantTablePrompt();
}

function resetParticipantTablePrompt() {
  document.getElementById('participantsTableBody').innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">Select an event to view participants</td></tr>`;
}

function initFromLogin() {
  const raw = sessionStorage.getItem('loggedStudent');
  if (!raw) return;
  let logged = null;
  try { logged = JSON.parse(raw); } catch(e){ return; }
  const studentId = (logged.Student_ID || '').toString().toLowerCase();
  if (!studentId) return;

  const matches = allEvents.filter(e => (e.Student_ID || '').toString().toLowerCase() === studentId);
  if (matches.length === 0) {
    const nameMatches = allEvents.filter(e => (e.Student_Name || '').toString().toLowerCase() === (logged.Student_Name || '').toString().toLowerCase());
    if (nameMatches.length > 0) {
      const pick = nameMatches[0];
      const optionValue = pick.Event_ID ? pick.Event_ID : `${pick.Event_Name}|${pick.Event_Date}`;
      const select = document.getElementById('eventSelect');
      if (Array.from(select.options).some(o => o.value === optionValue)) {
        select.value = optionValue;
        renderDashboard(pick.Event_Name, pick.Event_Date);
        document.getElementById('deptFilter').value = logged.Student_Name || '';
        applyDepartmentFilter();
        setTimeout(() => showStudentPopupByIdOrName(pick.Student_ID, pick.Student_Name), 60);
      }
    }
    return;
  }

  const pick = matches[0];
  const optionValue = pick.Event_ID ? pick.Event_ID : `${pick.Event_Name}|${pick.Event_Date}`;
  const select = document.getElementById('eventSelect');
  if (Array.from(select.options).some(o => o.value === optionValue)) {
    select.value = optionValue;
    renderDashboard(pick.Event_Name, pick.Event_Date);
    document.getElementById('deptFilter').value = logged.Student_ID || '';
    applyDepartmentFilter();
    setTimeout(() => showStudentPopupByIdOrName(logged.Student_ID, logged.Student_Name), 60);
  }
}

function showStudentPopupByIdOrName(studentId, studentName) {
  const rows = document.querySelectorAll('#participantsTableBody tr.participant-row');
  for (let r of rows) {
    const rid = (r.dataset.id || '').toString().toLowerCase();
    const rname = (r.dataset.name || '').toString().toLowerCase();
    if ((studentId && rid === (studentId + '').toLowerCase()) || (studentName && rname === (studentName + '').toLowerCase())) {
      const popup = createPopupElement();
      popup.querySelector('#popupStudentName').textContent = r.dataset.name;
      popup.querySelector('#popupStudentID').textContent = r.dataset.id;
      popup.querySelector('#popupStudentDept').textContent = r.dataset.dept;
      popup.querySelector('#popupStudentGender').textContent = r.dataset.gender || '';
      popup.querySelector('#popupEventName').textContent = r.dataset.event || '';
      popup.querySelector('#popupEventType').textContent = r.dataset.eventType || '';
      showOtherEvents(r.dataset.id, r.dataset.name, popup);
      popup.style.display = 'block';
      r.style.transition = 'background-color 0.3s';
      const originalBg = r.style.backgroundColor;
      r.style.backgroundColor = '#fffbeb';
      setTimeout(() => r.style.backgroundColor = originalBg, 1600);
      return;
    }
  }
}

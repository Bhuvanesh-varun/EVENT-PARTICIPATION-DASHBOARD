// student_dashboard.js
// Loads ./events.json -> uses All_Together_Data to render dashboard

let allData = [];
let charts = [];

// helper to destroy charts when re-rendering
function clearCharts(){
  charts.forEach(c => { try { c.destroy(); } catch(e){} });
  charts = [];
}

document.addEventListener('DOMContentLoaded', init);

async function init() {
  try {
    const resp = await fetch('./data/events.json');
    const json = await resp.json();

    // load both sheets
    const allTogether = json.All_Together_Data || [];
    const eventsMeta = json.Sheet1 || [];
    const studentsMeta = json.Sheet2 || [];

    // Create lookup map for event dates and departments
    const eventMap = Object.fromEntries(eventsMeta.map(e => [e.Event_ID, e.Event_Date]));
    const deptMap = Object.fromEntries(studentsMeta.map(s => [s.Student_ID, s.Department]));

    // Merge Event_Date + Department into main dataset
    allData = allTogether.map(r => ({
      ...r,
      Event_Date: eventMap[r.Event_ID] || "—",
      Department: deptMap[r.Student_ID] || "N/A"
    }));

    populateStudentSelect();

    const first = document.getElementById('studentSelect').value;
    if (first) renderDashboard(first);

  } catch (err) {
    console.error('Failed to load events.json', err);
    alert('Could not load events.json (check path).');
  }
}


function populateStudentSelect(){
  const sel = document.getElementById('studentSelect');
  const ids = Array.from(new Set(allData.map(r => r.Student_ID))).sort();
  sel.innerHTML = ids.map(id => `<option value="${id}">${id}</option>`).join('');
  sel.addEventListener('change', () => renderDashboard(sel.value));
}

function renderDashboard(studentID){
  if(!studentID) return;
  const records = allData.filter(r => r.Student_ID === studentID);
  if(records.length === 0) {
    console.warn('No records for', studentID);
    return;
  }

  // header info
  const student = records[0];
  document.getElementById('studentName').textContent = student.Student_Name || student.Student_ID;
  // If events.json includes a separate students sheet with Department, you can merge. Fallback: show first record Dept if present
  document.getElementById('studentDept').textContent = student.Department || (student.Department === undefined ? 'EE' : student.Department);

  // KPIs
  const totalEvents = records.length;
  const validAwards = records.filter(r => r.Award && r.Award !== 'Not Attended' && r.Award !== 'None').length;
  const attended = records.filter(r => r.Attendance_Status && r.Attendance_Status.toLowerCase() === 'attended').length;
  const participationPercent = totalEvents ? ((attended / totalEvents) * 100) : 0;

  document.getElementById('registeredCount').textContent = totalEvents;
  document.getElementById('validAwards').textContent = validAwards;
  document.getElementById('participationPercent').textContent = participationPercent.toFixed(2) + '%';
  document.getElementById('attPercentBig').textContent = (participationPercent/100).toFixed(2);

  renderTable(records);
  renderCharts(records, attended, totalEvents);
}

function renderTable(records){
  const tbody = document.getElementById('eventTableBody');
  tbody.innerHTML = records.map(r => {
    const trClass = r.Attendance_Status && r.Attendance_Status.toLowerCase() === 'absent' ? 'table-danger' : '';
    const eventDate = r.Event_Date || '—';
    return `<tr class="${trClass}">
      <td>${escapeHtml(r.Event_Name || '')}</td>
      <td>${escapeHtml(r.Registration_Date || '')}</td>
      <td>${escapeHtml(r.Event_Date || '-')}</td>
      <td>${escapeHtml(r.Award || '')}</td>
      <td>${escapeHtml(r.Participation_Role || '')}</td>
      <td>${escapeHtml(r.Feedback || '')}</td>
    </tr>`;
  }).join('');
}

// --- Charts ---
function renderCharts(records, attended, totalEvents){
  clearCharts();

  // 1) Attendance doughnut
  const aCtx = document.getElementById('attendanceChart').getContext('2d');
  const attendanceChart = new Chart(aCtx, {
    type: 'doughnut',
    data: {
      labels: ['Attended','Absent'],
      datasets: [{ data: [attended, totalEvents - attended], backgroundColor: ['#0077b6','#e9ecef'] }]
    },
    options: {
      cutout: '70%',
      plugins: { legend: { display: false } }
    }
  });
  charts.push(attendanceChart);

  // 2) Event type donut (count by Event_Name categories approximates Event_Type in shot)
  // If you have explicit Event_Type field, change grouping accordingly.
  const eventTypeCounts = {};
  records.forEach(r => {
    const ev = r.Event_Name || 'Other';
    eventTypeCounts[ev] = (eventTypeCounts[ev] || 0) + 1;
  });
  const typeCtx = document.getElementById('eventTypeChart').getContext('2d');
  const typeChart = new Chart(typeCtx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(eventTypeCounts),
      datasets: [{ data: Object.values(eventTypeCounts), backgroundColor: [
        '#0077b6','#00b4d8','#48cae4','#90e0ef','#caf0f8','#023e8a','#007f5f','#ffa600'
      ] }]
    },
    options: { plugins: { legend: { position:'right', labels: { boxWidth:12 } } } }
  });
  charts.push(typeChart);

  // 3) Role pie
  const roleCounts = {};
  records.forEach(r => { const k = r.Participation_Role || 'Participant'; roleCounts[k] = (roleCounts[k]||0)+1; });
  const roleCtx = document.getElementById('roleChart').getContext('2d');
  const roleChart = new Chart(roleCtx, {
    type: 'pie',
    data: { labels: Object.keys(roleCounts), datasets: [{ data: Object.values(roleCounts), backgroundColor: ['#0077b6','#023e8a','#48cae4'] }] },
    options: { plugins: { legend: { position:'right' } } }
  });
  charts.push(roleChart);

  // 4) Feedback & Awards over time (registration date)
  const sorted = [...records].sort((a,b) => new Date(a.Registration_Date) - new Date(b.Registration_Date));
  const labels = sorted.map(r => {
    if(!r.Registration_Date) return '';
    const d = new Date(r.Registration_Date);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });
  const feedbackScore = sorted.map(r => {
    // simple numeric mapping for visualization
    const fb = (r.Feedback||'').toLowerCase();
    if(fb.includes('outstanding') || fb.includes('excellent')) return 2;
    if(fb.includes('energi') || fb.includes('good') || fb.includes('solid') || fb.includes('great')) return 1;
    if(fb.includes('need') || fb.includes('not')) return 0;
    return 1;
  });
  const awardsCount = sorted.map(r => (r.Award && r.Award !== 'Not Attended' ? 1 : 0));

  const fbCtx = document.getElementById('feedbackTimelineChart').getContext('2d');
  const fbChart = new Chart(fbCtx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Feedback (scaled)', data: feedbackScore, tension:0.25, borderColor:'#0077b6', fill:true, backgroundColor:'rgba(0,119,182,0.08)' },
        { label: 'Award (count)', data: awardsCount, tension:0.25, borderColor:'#00b4d8', fill:false, yAxisID:'y1' }
      ]
    },
    options: {
      scales: {
        y: { beginAtZero: true, suggestedMax: 3, title: { display:true, text:'Feedback (scale)' } },
        y1: { position:'right', beginAtZero:true, suggestedMax: 2, grid: { drawOnChartArea:false }, title: { display:true, text:'Awards' } }
      },
      plugins: { legend: { position:'top' } }
    }
  });
  charts.push(fbChart);
}

// small utility to prevent XSS in table outputs
function escapeHtml(str){
  if(!str) return '';
  return String(str)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}

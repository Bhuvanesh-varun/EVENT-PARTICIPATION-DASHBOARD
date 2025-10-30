// student_dashboard.js
// Enhanced dynamic student dashboard with analytics & responsive UI

let allData = [];
let currentCharts = [];

document.addEventListener("DOMContentLoaded", () => loadData());

async function loadData() {
  try {
    const res = await fetch("./data/events.json");
    const json = await res.json();
    allData = json.All_Together_Data || [];
    populateStudents();
    loadFromQuery();
  } catch (err) {
    console.error("Error loading data:", err);
  }
}

function populateStudents() {
  const select = document.getElementById("studentSelect");
  const students = [...new Set(allData.map(d => d.Student_ID))];
  select.innerHTML = students
    .map(s => `<option value="${s}">${s}</option>`)
    .join("");
  select.addEventListener("change", () => renderDashboard(select.value));
}

function loadFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("student");
  if (id) {
    document.getElementById("studentSelect").value = id;
    renderDashboard(id);
  } else if (allData.length > 0) {
    renderDashboard(allData[0].Student_ID);
  }
}

function renderDashboard(studentID) {
  const records = allData.filter(d => d.Student_ID === studentID);
  if (!records.length) return;

  const student = records[0];
  document.getElementById("studentName").textContent = student.Student_Name;
  document.getElementById("studentDept").textContent = student.Department || "N/A";

  const totalEvents = records.length;
  const validAwards = records.filter(r => r.Award && r.Award !== "Not Attended").length;
  const attended = records.filter(r => r.Attendance_Status === "Attended").length;
  const attendancePercent = ((attended / totalEvents) * 100).toFixed(2);

  document.getElementById("registeredCount").textContent = totalEvents;
  document.getElementById("validAwards").textContent = validAwards;
  document.getElementById("participationPercent").textContent = attendancePercent + "%";

  renderCharts(records, attended, totalEvents);
  renderTable(records);
}

function clearCharts() {
  currentCharts.forEach(c => c.destroy());
  currentCharts = [];
}

function renderCharts(records, attended, totalEvents) {
  clearCharts();

  // 1️⃣ Attendance chart
  const attendanceChart = new Chart(document.getElementById("attendanceChart"), {
    type: "doughnut",
    data: {
      labels: ["Attended", "Absent"],
      datasets: [{
        data: [attended, totalEvents - attended],
        backgroundColor: ["#0077b6", "#ced4da"]
      }]
    },
    options: {
      cutout: "70%",
      plugins: { legend: { position: "bottom" } }
    }
  });
  currentCharts.push(attendanceChart);

  // 2️⃣ Awards breakdown
  const awards = {};
  records.forEach(r => {
    const a = r.Award || "None";
    awards[a] = (awards[a] || 0) + 1;
  });
  const awardChart = new Chart(document.getElementById("participationRoleChart"), {
    type: "pie",
    data: {
      labels: Object.keys(awards),
      datasets: [{ data: Object.values(awards), backgroundColor: ["#00b4d8", "#48cae4", "#90e0ef", "#caf0f8"] }]
    },
    options: { plugins: { legend: { position: "bottom" } } }
  });
  currentCharts.push(awardChart);

  // 3️⃣ Feedback tone analysis
  const feedbackGroups = { Excellent: 0, Good: 0, Creative: 0, "Needs Improvement": 0, Other: 0 };
  records.forEach(r => {
    const fb = (r.Feedback || "").toLowerCase();
    if (fb.includes("excellent") || fb.includes("outstanding")) feedbackGroups.Excellent++;
    else if (fb.includes("good") || fb.includes("great") || fb.includes("energetic")) feedbackGroups.Good++;
    else if (fb.includes("creative") || fb.includes("innovative")) feedbackGroups.Creative++;
    else if (fb.includes("need")) feedbackGroups["Needs Improvement"]++;
    else if (fb && fb !== "not attended") feedbackGroups.Other++;
  });
  const feedbackChart = new Chart(document.getElementById("eventTypeChart"), {
    type: "pie",
    data: {
      labels: Object.keys(feedbackGroups),
      datasets: [{
        data: Object.values(feedbackGroups),
        backgroundColor: ["#0096c7", "#00b4d8", "#48cae4", "#ade8f4", "#caf0f8"]
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
  currentCharts.push(feedbackChart);

  // 4️⃣ Registration trend
  const sorted = [...records].sort((a, b) => new Date(a.Registration_Date) - new Date(b.Registration_Date));
  const dates = sorted.map(r => r.Registration_Date);
  const attendedTrend = sorted.map(r => (r.Attendance_Status === "Attended" ? 1 : 0));
  const trendChart = new Chart(document.getElementById("feedbackAwardChart"), {
    type: "line",
    data: {
      labels: dates,
      datasets: [{
        label: "Attendance Timeline",
        data: attendedTrend,
        borderColor: "#0077b6",
        tension: 0.3
      }]
    },
    options: { scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
  });
  currentCharts.push(trendChart);
}

function renderTable(records) {
  const tbody = document.getElementById("eventTableBody");
  tbody.innerHTML = records
    .map(r => `
    <tr class="${r.Attendance_Status === "Absent" ? "table-danger" : ""}">
      <td>${r.Event_Name}</td>
      <td>${r.Registration_Date}</td>
      <td>${r.Event_ID || "—"}</td>
      <td>${r.Award}</td>
      <td>${r.Participation_Role}</td>
      <td>${r.Feedback}</td>
    </tr>
  `)
    .join("");
}

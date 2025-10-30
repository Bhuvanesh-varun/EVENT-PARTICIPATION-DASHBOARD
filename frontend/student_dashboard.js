// student_dashboard.js
// Enhanced dynamic student dashboard with analytics & responsive UI

let allData = [];
let currentCharts = [];

document.addEventListener("DOMContentLoaded", () => loadData());

async function loadData() {
  try {
    const res = await fetch("./data/events.json");
    const json = await res.json();

    const allTogether = json.All_Together_Data || [];
    const eventsMeta = json.Sheet1 || [];
    const studentsMeta = json.Sheet2 || [];

    // 🔗 Create lookup maps
    const eventMap = Object.fromEntries(eventsMeta.map(e => [e.Event_ID, e]));
    const studentMap = Object.fromEntries(studentsMeta.map(s => [s.Student_ID, s]));

    // 🧩 Merge Event_Date + Department into main dataset
    allData = allTogether.map(r => ({
      ...r,
      Event_Date: eventMap[r.Event_ID]?.Event_Date || "—",
      Department: studentMap[r.Student_ID]?.Department || "N/A",
    }));

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
  const validAwards = records.filter(r => r.Award && r.Award !== "Not Attended" && r.Award !== "None").length;
  const attended = records.filter(r => r.Attendance_Status === "Attended").length;
  const attendancePercent = totalEvents > 0 ? ((attended / totalEvents) * 100).toFixed(2) : 0;

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
      plugins: { 
        legend: { 
          position: "bottom" 
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.raw || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = Math.round((value / total) * 100);
              return `${label}: ${value} (${percentage}%)`;
            }
          }
        }
      }
    }
  });
  currentCharts.push(attendanceChart);

  // 2️⃣ Awards distribution
  const awards = {};
  records.forEach(r => {
    const a = r.Award || "None";
    if (a !== "Not Attended") {
      awards[a] = (awards[a] || 0) + 1;
    }
  });
  
  const awardChart = new Chart(document.getElementById("awardChart"), {
    type: "pie",
    data: {
      labels: Object.keys(awards),
      datasets: [{ 
        data: Object.values(awards), 
        backgroundColor: ["#00b4d8", "#48cae4", "#90e0ef", "#caf0f8", "#0077b6", "#023e8a"] 
      }]
    },
    options: { 
      plugins: { 
        legend: { 
          position: "bottom" 
        } 
      } 
    }
  });
  currentCharts.push(awardChart);

  // 3️⃣ Feedback analysis
  const feedbackGroups = { 
    Excellent: 0, 
    Good: 0, 
    Creative: 0, 
    "Needs Improvement": 0, 
    "No Feedback": 0 
  };
  
  records.forEach(r => {
    const fb = (r.Feedback || "").toLowerCase();
    if (!fb || fb === "not attended") {
      feedbackGroups["No Feedback"]++;
    } else if (fb.includes("excellent") || fb.includes("outstanding")) {
      feedbackGroups.Excellent++;
    } else if (fb.includes("good") || fb.includes("great") || fb.includes("energetic")) {
      feedbackGroups.Good++;
    } else if (fb.includes("creative") || fb.includes("innovative")) {
      feedbackGroups.Creative++;
    } else if (fb.includes("need") || fb.includes("improve")) {
      feedbackGroups["Needs Improvement"]++;
    } else {
      feedbackGroups["No Feedback"]++;
    }
  });
  
  const feedbackChart = new Chart(document.getElementById("feedbackChart"), {
    type: "pie",
    data: {
      labels: Object.keys(feedbackGroups),
      datasets: [{
        data: Object.values(feedbackGroups),
        backgroundColor: ["#0096c7", "#00b4d8", "#48cae4", "#ade8f4", "#caf0f8"]
      }]
    },
    options: {
      plugins: { 
        legend: { 
          position: "bottom" 
        } 
      }
    }
  });
  currentCharts.push(feedbackChart);

  // 4️⃣ Attendance timeline
  const sorted = [...records].sort((a, b) => new Date(a.Registration_Date) - new Date(b.Registration_Date));
  const dates = sorted.map(r => {
    const date = new Date(r.Registration_Date);
    return `${date.getMonth()+1}/${date.getDate()}`;
  });
  
  const attendedTrend = sorted.map(r => (r.Attendance_Status === "Attended" ? 1 : 0));
  
  const trendChart = new Chart(document.getElementById("attendanceTimelineChart"), {
    type: "line",
    data: {
      labels: dates,
      datasets: [{
        label: "Attendance (1=Attended, 0=Absent)",
        data: attendedTrend,
        borderColor: "#0077b6",
        backgroundColor: "rgba(0, 119, 182, 0.1)",
        tension: 0.3,
        fill: true
      }]
    },
    options: { 
      scales: { 
        y: { 
          beginAtZero: true, 
          ticks: { 
            stepSize: 1 
          } 
        } 
      } 
    }
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
      <td>${r.Event_Date || "—"}</td>
      <td>${r.Award}</td>
      <td>${r.Participation_Role}</td>
      <td>${r.Feedback}</td>
    </tr>
  `)
    .join("");
}
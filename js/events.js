// js/events.js
document.addEventListener("DOMContentLoaded", () => {
  const eventList = document.getElementById("eventList");
  const searchInput = document.getElementById("searchInput");
  const filterButtons = document.querySelectorAll("[data-category]");
  const modalEl = document.getElementById("eventModal");
  const modal = new bootstrap.Modal(modalEl);

  let rawRecords = [];        // flat participant records from JSON
  let groupedEvents = [];     // [{ id, name, participants: [...], attendedCount, absentCount, date }]

  // Load JSON (expects data/events.json with root All_Together_Data)
  fetch("data/events.json")
    .then(r => {
      if (!r.ok) throw new Error("Failed to load data/events.json");
      return r.json();
    })
    .then(json => {
      rawRecords = Array.isArray(json.All_Together_Data) ? json.All_Together_Data : [];
      groupEvents(rawRecords);
      renderEvents(groupedEvents);
    })
    .catch(err => {
      console.error("Error loading events.json:", err);
      eventList.innerHTML = `<div class="text-center text-danger py-4">⚠ Unable to load events. Make sure <code>data/events.json</code> exists and you're serving the site with a local server.</div>`;
    });

  // Group participant records into events by Event_ID + Event_Name
  function groupEvents(records) {
    const map = new Map();
    records.forEach(r => {
      const id = r.Event_ID || ("E_" + (r.Event_Name || "unknown").replace(/\s+/g, "_"));
      const name = r.Event_Name || "Unnamed Event";
      const key = `${id}|${name}`;
      if (!map.has(key)) map.set(key, { id, name, participants: [] });
      map.get(key).participants.push(r);
    });

    groupedEvents = Array.from(map.values()).map(ev => {
      const attended = ev.participants.filter(p => String((p.Attendance_Status || "")).toLowerCase() === "attended").length;
      const absent = ev.participants.length - attended;
      // derive a best-effort date from earliest Registration_Date if present
      const dates = ev.participants.map(p => p.Registration_Date).filter(Boolean);
      const date = dates.length ? dates.sort()[0] : "TBA";
      return {
        id: ev.id,
        name: ev.name,
        participants: ev.participants,
        attendedCount: attended,
        absentCount: absent,
        date
      };
    });

    // optional: sort by name
    groupedEvents.sort((a,b) => a.name.localeCompare(b.name));
  }

  // Render event cards
  function renderEvents(events) {
    eventList.innerHTML = "";
    if (!events || events.length === 0) {
      eventList.innerHTML = `<p class="text-center text-muted mt-4">No events found.</p>`;
      return;
    }

    events.forEach(ev => {
      const col = document.createElement("div");
      col.className = "col-md-4";
      const statusText = ev.attendedCount > 0 && ev.absentCount === 0 ? "Completed" : ev.attendedCount === 0 && ev.absentCount > 0 ? "No-shows" : "Active";
      const statusBadgeClass = statusText === "Completed" ? "bg-secondary" : statusText === "No-shows" ? "bg-danger" : "bg-success";

      col.innerHTML = `
        <div class="card event-card h-100">
          <div class="card-body d-flex flex-column">
            <h5 class="card-title mb-1">${escapeHtml(ev.name)}</h5>
            <p class="text-muted small mb-1">Event ID: ${escapeHtml(ev.id)} • ${escapeHtml(ev.date)}</p>
            <div class="mb-2">
              <span class="badge ${statusBadgeClass} badge-status">${statusText}</span>
              <span class="ms-2 text-muted small">${ev.participants.length} participant${ev.participants.length>1?'s':''}</span>
            </div>
            <p class="small text-muted mb-3">${generateParticipantSummary(ev)}</p>
            <div class="mt-auto">
              <button class="btn btn-sm btn-primary w-100 view-btn" data-key="${encodeURIComponent(ev.id + '|' + ev.name)}">View Participants</button>
            </div>
          </div>
        </div>
      `;
      eventList.appendChild(col);
    });

    // attach handlers
    document.querySelectorAll(".view-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const key = decodeURIComponent(btn.getAttribute("data-key"));
        const [id, name] = key.split("|");
        const selected = groupedEvents.find(g => g.id === id && g.name === name);
        if (selected) openEventModal(selected);
      });
    });
  }

  // small summary text for card
  function generateParticipantSummary(ev) {
    const roles = {};
    ev.participants.forEach(p => {
      const r = p.Participation_Role || "Participant";
      roles[r] = (roles[r] || 0) + 1;
    });
    const parts = Object.entries(roles).slice(0,3).map(([r,c]) => `${c} ${r}${c>1?'s':''}`);
    return parts.length ? parts.join(" • ") : "No role info.";
  }

  // Open event modal and populate participants table
  function openEventModal(eventObj) {
    document.getElementById("modalEventName").textContent = eventObj.name;
    document.getElementById("modalEventDesc").textContent = `${eventObj.participants.length} participant(s). Attended: ${eventObj.attendedCount}, Absent: ${eventObj.absentCount}.`;
    document.getElementById("modalEventInfo").textContent = `Event ID: ${eventObj.id} • Date: ${eventObj.date}`;

    // Build participants table inside modal (replace modal body content area)
    const tbodyHtml = eventObj.participants.map(p => {
      const statusClass = String((p.Attendance_Status || "")).toLowerCase() === "attended" ? "text-success" : "text-danger";
      return `
        <tr class="participant-row" data-id="${escapeHtml(p.Student_ID)}" data-name="${escapeHtml(p.Student_Name)}">
          <td><a href="#" class="participant-link">${escapeHtml(p.Student_Name)}</a></td>
          <td>${escapeHtml(p.Participation_Role || '')}</td>
          <td>${escapeHtml(p.Award || '')}</td>
          <td class="${statusClass}">${escapeHtml(p.Attendance_Status || '')}</td>
        </tr>
      `;
    }).join("");

    const tableWrapper = `
      <div class="table-responsive">
        <table class="table table-sm align-middle">
          <thead class="table-light"><tr><th>Student</th><th>Role</th><th>Award</th><th>Status</th></tr></thead>
          <tbody>${tbodyHtml}</tbody>
        </table>
      </div>
    `;

    // put table into modal body (below existing content)
    const modalBody = modalEl.querySelector(".modal-body");
    // clear and add
    modalBody.querySelector("#modalContent").innerHTML = `
      <h4 id="modalEventName">${escapeHtml(eventObj.name)}</h4>
      <p id="modalEventDesc" class="mb-1">${escapeHtml(eventObj.participants.length + " participants")}</p>
      <p class="text-muted small" id="modalEventInfo">Event ID: ${escapeHtml(eventObj.id)} • Date: ${escapeHtml(eventObj.date)}</p>
      ${tableWrapper}
    `;

    // attach click handlers for participant links to show student popup
    modalBody.querySelectorAll(".participant-link").forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const tr = e.target.closest("tr");
        const sid = tr.dataset.id;
        const sname = tr.dataset.name;
        const record = eventObj.participants.find(r => (r.Student_ID === sid) || (r.Student_Name === sname));
        if (record) showStudentDetailPopup(record);
      });
    });

    modal.show();
  }

  // Create and show a student detail modal (single reusable)
  function showStudentDetailPopup(record) {
    let studentModal = document.getElementById("__studentDetailModal");
    if (!studentModal) {
      studentModal = document.createElement("div");
      studentModal.id = "__studentDetailModal";
      studentModal.innerHTML = `
        <div class="modal fade" tabindex="-1" id="__studentDetailInner">
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title" id="__studentNameTitle"></h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <ul class="list-unstyled mb-0">
                  <li><strong>Student ID:</strong> <span id="__studentID"></span></li>
                  <li><strong>Role:</strong> <span id="__studentRole"></span></li>
                  <li><strong>Status:</strong> <span id="__studentStatus"></span></li>
                  <li><strong>Registration Date:</strong> <span id="__studentRegDate"></span></li>
                  <li><strong>Award:</strong> <span id="__studentAward"></span></li>
                  <li><strong>Feedback:</strong> <div id="__studentFeedback" class="mt-2"></div></li>
                </ul>
              </div>
              <div class="modal-footer">
                <button class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(studentModal);
      // initialize bootstrap modal instance
    }

    // populate
    document.getElementById("__studentNameTitle").textContent = record.Student_Name || "Student";
    document.getElementById("__studentID").textContent = record.Student_ID || "—";
    document.getElementById("__studentRole").textContent = record.Participation_Role || "—";
    document.getElementById("__studentStatus").textContent = record.Attendance_Status || "—";
    document.getElementById("__studentRegDate").textContent = record.Registration_Date || "—";
    document.getElementById("__studentAward").textContent = record.Award || "—";
    document.getElementById("__studentFeedback").textContent = record.Feedback || "—";

    // show the modal
    const inner = new bootstrap.Modal(document.getElementById("__studentDetailInner"));
    inner.show();
  }

  // Search: filter groupedEvents by event name or by participant name/ID/role
  searchInput?.addEventListener("input", (e) => {
    const q = (e.target.value || "").toLowerCase().trim();
    if (!q) return renderEvents(groupedEvents);
    const filtered = groupedEvents.filter(ev => {
      if (ev.name.toLowerCase().includes(q)) return true;
      // search participants
      return ev.participants.some(p =>
        (p.Student_Name || "").toLowerCase().includes(q) ||
        (p.Student_ID || "").toLowerCase().includes(q) ||
        (p.Participation_Role || "").toLowerCase().includes(q)
      );
    });
    renderEvents(filtered);
  });

  // Simple category filter: tries to match keywords in event name
  filterButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelector(".btn-group .active")?.classList.remove("active");
      btn.classList.add("active");
      const cat = btn.dataset.category?.toLowerCase() || "all";
      if (cat === "all") return renderEvents(groupedEvents);

      // very simple keyword map
      const keywords = {
        technical: ["hack", "tech", "code", "ai", "ml", "workshop"],
        cultural: ["cultural", "fest", "dance", "music", "art"],
        sports: ["football", "cricket", "league", "sports", "tournament"],
        workshop: ["workshop", "bootcamp", "training"]
      }[cat] || [cat];

      const filtered = groupedEvents.filter(ev => {
        const name = ev.name.toLowerCase();
        return keywords.some(k => name.includes(k));
      });
      renderEvents(filtered);
    });
  });

  // minimal escaping
  function escapeHtml(str) {
    if (str === undefined || str === null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
});



// for event.html page
document.addEventListener("DOMContentLoaded", function () {
  const table = document.getElementById("eventsTable");
  const thead = table.querySelector("thead");
  const tbody = table.querySelector("tbody");

  // Adjust this path according to where your JSON file is located
  fetch("data/events.json")
    .then(response => response.json())
    .then(data => {
      // Access only the 'Sheet1' data
      const eventData = data["Sheet1"];

      if (!eventData || eventData.length === 0) {
        thead.innerHTML = "<tr><th>No Event Data Found in Sheet1</th></tr>";
        return;
      }

      renderTable(eventData);
    })
    .catch(err => {
      console.error("Error loading events.json:", err);
      thead.innerHTML = "<tr><th>Error loading event data</th></tr>";
    });

  // Function to render a dynamic table
  function renderTable(dataArray) {
    const headers = Object.keys(dataArray[0]);

    // Table Headings
    thead.innerHTML = "<tr>" + headers.map(h => `<th>${h.replace(/_/g, " ")}</th>`).join("") + "</tr>";

    // Table Rows
    tbody.innerHTML = dataArray.map(row => {
      return "<tr>" + headers.map(h => `<td>${row[h] ?? ""}</td>`).join("") + "</tr>";
    }).join("");
  }
});


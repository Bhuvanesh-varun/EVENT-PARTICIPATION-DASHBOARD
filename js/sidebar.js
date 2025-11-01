// Dynamically load sidebar HTML into pages
document.addEventListener("DOMContentLoaded", () => {
  fetch("components/sidebar.html")
    .then(response => response.text())
    .then(data => {
      document.body.insertAdjacentHTML("afterbegin", data);

      // Add sidebar toggle button after loading sidebar
      const toggleBtn = document.createElement("button");
      toggleBtn.className = "sidebar-toggle-btn";
      toggleBtn.innerHTML = '<i class="bi bi-list"></i>';
      toggleBtn.id = "sidebarToggle";
      document.body.appendChild(toggleBtn);

      // Sidebar behavior
      const sidebar = document.getElementById("sidebar");
      const overlay = document.getElementById("sidebarOverlay");

      toggleBtn.addEventListener("click", () => {
        sidebar.classList.toggle("active");
        overlay.classList.toggle("active");
      });

      overlay.addEventListener("click", () => {
        sidebar.classList.remove("active");
        overlay.classList.remove("active");
      });

      // Auto-close sidebar when a link is clicked (on mobile)
      document.querySelectorAll(".sidebar a").forEach((link) => {
        link.addEventListener("click", () => {
          if (window.innerWidth <= 991) {
            sidebar.classList.remove("active");
            overlay.classList.remove("active");
          }
        });
      });

      // Highlight current active page link
      const currentPage = location.pathname.split("/").pop();
      document.querySelectorAll(".sidebar a").forEach((link) => {
        if (link.getAttribute("href") === currentPage) {
          link.classList.add("active");
        }
      });
    })
    .catch(err => console.error("Sidebar load failed:", err));
});

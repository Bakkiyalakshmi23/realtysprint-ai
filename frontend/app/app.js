/**
 * RealtySprint AI - AI Workforce Control Center
 * Dashboard UI Logic & Interactions (frontend/app/app.js)
 */

document.addEventListener('DOMContentLoaded', () => {
  if (typeof Auth !== 'undefined') {
    Auth.requireAuth();
    initUserProfile();
  }
  initNavigationHighlight();
  initMobileSidebarToggle();
  initApprovalButtons();
  initFilterControls();
  initNotificationToggle();
  initLogoutBindings();
});

/**
 * Update User Profile widget dynamically from Auth module
 */
function initUserProfile() {
  if (typeof Auth === 'undefined') return;
  const user = Auth.getCurrentUser();
  if (!user) return;

  const userNames = document.querySelectorAll('.user-name');
  const userRoles = document.querySelectorAll('.user-role');
  
  userNames.forEach(el => el.innerText = user.name || 'Admin');
  userRoles.forEach(el => el.innerText = user.email || 'admin@realtysprint.ai');
}

/**
 * Bind logout event listeners
 */
function initLogoutBindings() {
  document.querySelectorAll('.logout-action-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof Auth !== 'undefined') {
        Auth.logout();
      }
    });
  });
}

/**
 * 1. Automatically highlight the active sidebar link based on current page URL
 */
function initNavigationHighlight() {
  const currentPath = window.location.pathname;
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');

  navItems.forEach(item => {
    const href = item.getAttribute('href');
    if (!href) return;

    // Match exact file name or fallback to index.html for root/empty
    const pageName = href.split('/').pop();
    const currentFileName = currentPath.split('/').pop() || 'index.html';

    if (currentFileName === pageName || (currentFileName === '' && pageName === 'index.html')) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}

/**
 * 2. Mobile sidebar drawer toggle
 */
function initMobileSidebarToggle() {
  const toggleBtn = document.getElementById('mobile-sidebar-toggle');
  const sidebar = document.getElementById('app-sidebar');

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      sidebar.classList.toggle('mobile-open');
    });

    // Close sidebar on document click outside
    document.addEventListener('click', (e) => {
      if (sidebar.classList.contains('mobile-open') && !sidebar.contains(e.target) && e.target !== toggleBtn) {
        sidebar.classList.remove('mobile-open');
      }
    });
  }
}

/**
 * 3. Human-in-the-loop Approval button visual actions
 */
function initApprovalButtons() {
  document.addEventListener('click', (e) => {
    const target = e.target.closest('.action-approve-btn, .action-reject-btn');
    if (!target) return;

    const card = target.closest('.approval-card-item') || target.closest('tr');
    const isApprove = target.classList.contains('action-approve-btn');

    if (card) {
      const btnGroup = target.parentElement;
      if (btnGroup) {
        if (isApprove) {
          btnGroup.innerHTML = `
            <span style="font-size: 0.85rem; font-weight: 700; color: var(--green-accent); display: flex; align-items: center; gap: 0.3rem;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
              Approved Successfully
            </span>
          `;
        } else {
          btnGroup.innerHTML = `
            <span style="font-size: 0.85rem; font-weight: 700; color: var(--red-danger); display: flex; align-items: center; gap: 0.3rem;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Action Rejected
            </span>
          `;
        }
      }

      // Decrement header counter pill if present
      const approvalBadge = document.querySelector('.nav-item[href="approvals.html"] .badge-count');
      if (approvalBadge) {
        let count = parseInt(approvalBadge.innerText) || 0;
        if (count > 0) {
          approvalBadge.innerText = count - 1;
        }
      }
    }
  });
}

/**
 * 4. Client-side Filter Controls for Task & Activity Tables
 */
function initFilterControls() {
  const filterBtns = document.querySelectorAll('.filter-btn');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Toggle active class on buttons in group
      const parent = btn.parentElement;
      if (parent) {
        parent.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      }
      btn.classList.add('active');

      const filterValue = btn.getAttribute('data-filter');
      const tableRows = document.querySelectorAll('.filterable-table tbody tr');

      if (!tableRows.length) return;

      tableRows.forEach(row => {
        if (!filterValue || filterValue === 'all') {
          row.style.display = '';
        } else {
          const rowCategory = row.getAttribute('data-category') || row.innerText.toLowerCase();
          if (rowCategory.includes(filterValue.toLowerCase())) {
            row.style.display = '';
          } else {
            row.style.display = 'none';
          }
        }
      });
    });
  });
}

/**
 * 5. Notification Icon Dropdown Interaction
 */
function initNotificationToggle() {
  const notifBtn = document.getElementById('notification-bell-btn');
  if (notifBtn) {
    notifBtn.addEventListener('click', () => {
      alert('RealtySprint AI Control Center: 3 pending agent approvals require human review.');
    });
  }
}

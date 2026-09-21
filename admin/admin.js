/**
 * MUHAR STUDIO — Admin Dashboard Controller
 * Handles inquiry data loading, real-time filtering, status updates, modal views, and session management.
 */
let csrfToken = null;

async function fetchCsrfToken() {
  const res = await fetch('/api/admin/csrf', {
    credentials: 'same-origin'
  });

  if (!res.ok) {
    throw new Error('Failed to get CSRF token.');
  }

  const data = await res.json();
  csrfToken = data.csrfToken;
}

document.addEventListener('DOMContentLoaded', () => {

  // Navigation & Controls
  const userDisplay = document.getElementById('admin-user-display');
  const logoutBtn = document.getElementById('admin-logout-btn');
  const refreshBtn = document.getElementById('admin-refresh-btn');
  const tbody = document.getElementById('inquiries-tbody');
  const searchInput = document.getElementById('admin-search');
  const statusSelect = document.getElementById('filter-status');
  const sortSelect = document.getElementById('filter-sort');
  const typePills = document.querySelectorAll('.admin-filter-pill');

  // Stats Elements
  const statTotal = document.getElementById('stat-total');
  const statNew = document.getElementById('stat-new');
  const statContacted = document.getElementById('stat-contacted');
  const statConsultations = document.getElementById('stat-consultations');
  const statContacts = document.getElementById('stat-contacts');

  // Modal Elements
  const modalBackdrop = document.getElementById('detail-modal-backdrop');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalTypeBadge = document.getElementById('modal-type-badge');
  const modalStatusBadge = document.getElementById('modal-status-badge');
  const modalClientName = document.getElementById('modal-client-name');
  const modalEmail = document.getElementById('modal-email');
  const modalPhone = document.getElementById('modal-phone');
  const modalTypeText = document.getElementById('modal-type-text');
  const modalStatusText = document.getElementById('modal-status-text');
  const modalProject = document.getElementById('modal-project');
  const modalBudget = document.getElementById('modal-budget');
  const modalDate = document.getElementById('modal-date');
  const modalIp = document.getElementById('modal-ip');
  const modalUserAgent = document.getElementById('modal-user-agent');
  const modalMessage = document.getElementById('modal-message');
  const modalBtnNew = document.getElementById('modal-status-new');
  const modalBtnContacted = document.getElementById('modal-status-contacted');
  const modalBtnArchived = document.getElementById('modal-status-archived');

  const toastEl = document.getElementById('admin-toast');

  // State
  let currentInquiries = [];
  let currentActiveId = null;
  let activeTypeFilter = 'all';
  let searchDebounceTimer = null;
  const pendingUpdates = new Set();

  // Initialize
  checkAuthAndLoad();

  // ==========================================================================
  // 1. Auth & Initial Load
  // ==========================================================================
  async function checkAuthAndLoad() {
    try {
      const res = await fetch('/api/admin/me', { credentials: 'same-origin' });
      if (!res.ok) {
        window.location.href = '/admin/login';
        return;
      }
      const data = await res.json();
      if (data && data.user && data.user.username) {
        userDisplay.textContent = data.user.username;
      }

      await fetchCsrfToken();
      loadInquiries();
    } catch {
      window.location.href = '/admin/login';
    }
  }

  // ==========================================================================
  // 2. Fetch Inquiries from API
  // ==========================================================================
  async function loadInquiries(options = {}) {
    const { silent = false } = options;

    if (!silent) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="admin-empty-state">
            <p class="admin-empty-state__title">Loading inquiries...</p>
          </td>
        </tr>
      `;
    }

    const params = new URLSearchParams();
    if (activeTypeFilter !== 'all') params.append('type', activeTypeFilter);
    if (statusSelect.value !== 'all') params.append('status', statusSelect.value);
    params.append('sort', sortSelect.value);
    if (searchInput.value.trim()) params.append('search', searchInput.value.trim());

    try {
      const res = await fetch(`/api/admin/inquiries?${params.toString()}`, { credentials: 'same-origin' });
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = '/admin/login';
          return;
        }
        throw new Error('Failed to load inquiries.');
      }

      const data = await res.json();
      currentInquiries = data.inquiries || [];

      // Update KPI stats
      if (data.stats) {
        updateKPIStats(data.stats);
      }

      renderTable(currentInquiries);

    } catch (err) {
      if (!silent) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" class="admin-empty-state">
              <span class="admin-empty-state__icon">⚠️</span>
              <p class="admin-empty-state__title">${escapeHtml(err.message || 'Error loading inquiries')}</p>
            </td>
          </tr>
        `;
      }
      showToast(err.message || 'Error loading inquiries', true);
    }
  }

  // ==========================================================================
  // 3. Update KPI Statistics
  // ==========================================================================
  function updateKPIStats(stats) {
    if (!stats) return;
    if (statTotal) statTotal.textContent = stats.total ?? 0;
    if (statNew) statNew.textContent = stats.new ?? 0;
    if (statContacted) statContacted.textContent = stats.contacted ?? 0;
    if (statConsultations) statConsultations.textContent = stats.consultations ?? 0;
    if (statContacts) statContacts.textContent = stats.contacts ?? 0;
  }

  // ==========================================================================
  // 4. Generate Action Buttons HTML for a Row
  // ==========================================================================
  function generateRowActionButtons(id, status) {
    const isPending = pendingUpdates.has(id);
    const disabledAttr = isPending ? 'disabled' : '';

    let buttonsHtml = `
      <button type="button" class="admin-btn-action admin-btn-action--view" data-action="view" data-id="${id}" ${disabledAttr}>
        <span class="admin-btn-view-desktop">View</span>
        <span class="admin-btn-view-mobile">View Details &rarr;</span>
      </button>
    `;

    if (status !== 'contacted') {
      buttonsHtml += `<button type="button" class="admin-btn-action admin-btn-action--primary" data-action="status" data-status="contacted" data-id="${id}" ${disabledAttr}>Contacted</button>`;
    }

    if (status !== 'new') {
      buttonsHtml += `<button type="button" class="admin-btn-action" data-action="status" data-status="new" data-id="${id}" title="Reopen / Mark as New" ${disabledAttr}>Reopen</button>`;
    }

    if (status !== 'archived') {
      buttonsHtml += `<button type="button" class="admin-btn-action" data-action="status" data-status="archived" data-id="${id}" title="Archive" ${disabledAttr}>Archive</button>`;
    }

    return buttonsHtml;
  }

  // ==========================================================================
  // 5. Render Inquiries Table / Cards
  // ==========================================================================
  function renderTable(inquiries) {
    if (!inquiries || inquiries.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="admin-empty-state">
            <span class="admin-empty-state__icon">📭</span>
            <p class="admin-empty-state__title">No inquiries found</p>
            <p style="font-size: 13px; color: var(--muhar-text-muted);">Try adjusting your search or filter settings.</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = inquiries.map(inq => {
      const isConsultation = inq.type === 'consultation';
      const typeBadgeClass = isConsultation ? 'admin-badge-type--consultation' : 'admin-badge-type--contact';
      const typeLabel = isConsultation ? 'Consultation' : 'Contact';

      const currentStatus = inq.status || 'new';
      const statusClass = `admin-badge-status--${currentStatus}`;
      const statusLabel = currentStatus.toUpperCase();

      const dateStr = inq.created_at ? new Date(inq.created_at).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) : '-';

      const actionsHtml = generateRowActionButtons(inq.id, currentStatus);

      return `
        <tr data-id="${inq.id}" class="admin-inquiry-row">
          <td class="admin-td-id" data-col="id"><span class="admin-inquiry-id">#${inq.id}</span></td>
          <td class="admin-td-type" data-col="type"><span class="admin-badge-type ${typeBadgeClass}">${typeLabel}</span></td>
          <td class="admin-td-client" data-col="client">
            <span class="admin-client-name">${escapeHtml(inq.name)}</span>
            <div class="admin-client-contact">
              <a href="mailto:${escapeHtml(inq.email)}" class="admin-contact-email">${escapeHtml(inq.email)}</a>
              ${inq.phone ? `<span class="admin-contact-divider">&middot;</span><a href="tel:${escapeHtml(inq.phone)}" class="admin-contact-phone">${escapeHtml(inq.phone)}</a>` : ''}
            </div>
          </td>
          <td class="admin-td-project" data-col="project">
            <div class="admin-project-box">
              <div class="admin-project-type">
                ${inq.project_type ? `<strong>${escapeHtml(inq.project_type)}</strong>` : '<span style="color: var(--muhar-text-muted);">General Contact</span>'}
              </div>
              ${inq.budget ? `<div class="admin-project-budget"><span class="admin-budget-label">Budget:</span> ${escapeHtml(inq.budget)}</div>` : ''}
            </div>
          </td>
          <td class="admin-td-date" data-col="date">
            <div class="admin-date-box">
              <span class="admin-date-label">Submitted: </span>
              <span class="admin-date-val">${dateStr}</span>
            </div>
          </td>
          <td class="admin-status-cell admin-td-status" data-col="status"><span class="admin-badge-status ${statusClass}">${statusLabel}</span></td>
          <td class="admin-td-actions" data-col="actions" style="text-align: right;">
            <div class="admin-action-btn-group" style="justify-content: flex-end;">
              ${actionsHtml}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // ==========================================================================
  // 6. View Detail Modal / Drawer
  // ==========================================================================
  function openDetailModal(id) {
    id = parseInt(id, 10);
    const inquiry = currentInquiries.find(i => i.id === id);
    if (!inquiry) return;

    currentActiveId = id;
    const isConsultation = inquiry.type === 'consultation';
    const currentStatus = inquiry.status || 'new';

    // Type Badge & Text
    if (modalTypeBadge) {
      modalTypeBadge.className = `admin-badge-type ${isConsultation ? 'admin-badge-type--consultation' : 'admin-badge-type--contact'}`;
      modalTypeBadge.textContent = isConsultation ? 'CONSULTATION REQUEST' : 'CONTACT MESSAGE';
    }
    if (modalTypeText) {
      modalTypeText.textContent = isConsultation ? 'Consultation Request' : 'Contact Message';
    }

    // Status Badge & Text
    if (modalStatusBadge) {
      modalStatusBadge.className = `admin-badge-status admin-badge-status--${currentStatus}`;
      modalStatusBadge.textContent = currentStatus.toUpperCase();
    }
    if (modalStatusText) {
      modalStatusText.textContent = currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1);
    }

    // Client Info
    if (modalClientName) modalClientName.textContent = inquiry.name || 'Client Name';
    if (modalEmail) {
      modalEmail.innerHTML = inquiry.email
        ? `<a href="mailto:${escapeHtml(inquiry.email)}" style="color: inherit; text-decoration: underline;">${escapeHtml(inquiry.email)}</a>`
        : '-';
    }
    if (modalPhone) {
      modalPhone.innerHTML = inquiry.phone
        ? `<a href="tel:${escapeHtml(inquiry.phone)}" style="color: inherit; text-decoration: underline;">${escapeHtml(inquiry.phone)}</a>`
        : '<span style="color: var(--muhar-text-muted);">Not provided</span>';
    }
    if (modalProject) modalProject.textContent = inquiry.project_type || 'General Contact';
    if (modalBudget) modalBudget.textContent = inquiry.budget || 'Not specified';
    if (modalDate) {
      modalDate.textContent = inquiry.created_at
        ? new Date(inquiry.created_at).toLocaleString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
        : '-';
    }
    if (modalIp) modalIp.textContent = inquiry.ip_address || 'Not recorded';
    if (modalUserAgent) modalUserAgent.textContent = inquiry.user_agent || 'Standard Web Client';
    if (modalMessage) modalMessage.textContent = inquiry.message || 'No message content';

    // Update Modal Action Buttons State
    updateModalButtonsState(currentStatus, pendingUpdates.has(id));

    // Open Modal
    modalBackdrop.classList.add('is-open');
    modalBackdrop.setAttribute('aria-hidden', 'false');
  }

  function updateModalButtonsState(status, isPending = false) {
    if (modalBtnNew) {
      modalBtnNew.disabled = isPending || status === 'new';
      modalBtnNew.textContent = isPending ? 'Updating...' : (status === 'new' ? 'Current: New' : 'Mark as New');
    }
    if (modalBtnContacted) {
      modalBtnContacted.disabled = isPending || status === 'contacted';
      modalBtnContacted.textContent = isPending ? 'Updating...' : (status === 'contacted' ? 'Current: Contacted' : 'Mark as Contacted');
    }
    if (modalBtnArchived) {
      modalBtnArchived.disabled = isPending || status === 'archived';
      modalBtnArchived.textContent = isPending ? 'Updating...' : (status === 'archived' ? 'Current: Archived' : 'Archive');
    }
  }

  function closeModal() {
    modalBackdrop.classList.remove('is-open');
    modalBackdrop.setAttribute('aria-hidden', 'true');
    currentActiveId = null;
  }

  modalCloseBtn.addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalBackdrop.classList.contains('is-open')) closeModal();
  });

  // ==========================================================================
  // 7. Update Status (Contacted, Archived, New / Reopen)
  // ==========================================================================
  async function updateInquiryStatus(id, newStatus, triggerBtn = null) {
    id = parseInt(id, 10);
    if (!id || isNaN(id)) return;

    // Prevent duplicate requests while in-flight
    if (pendingUpdates.has(id)) {
      return;
    }

    pendingUpdates.add(id);

    // Disable action buttons in table row and modal
    setRowButtonsLoading(id, true);
    if (currentActiveId === id) {
      updateModalButtonsState(newStatus, true);
    }

    try {
      const res = await fetch(`/api/admin/inquiries/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'same-origin',
        body: JSON.stringify({ status: newStatus })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to update inquiry status.');
      }

      // Update in-memory record
      const inquiry = currentInquiries.find(i => i.id === id);
      if (inquiry) {
        inquiry.status = newStatus;
      }

      // Immediately update Table Row DOM in-place without full reload
      updateRowDOM(id, newStatus);

      // Immediately update KPI statistics from backend response
      if (data.stats) {
        updateKPIStats(data.stats);
      }

      // If Detail Modal is open for this inquiry, update modal state in-place
      if (currentActiveId === id) {
        if (modalStatusBadge) {
          modalStatusBadge.className = `admin-badge-status admin-badge-status--${newStatus}`;
          modalStatusBadge.textContent = newStatus.toUpperCase();
        }
        if (modalStatusText) {
          modalStatusText.textContent = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
        }
        updateModalButtonsState(newStatus, false);
      }

      // If an active status filter excludes this newly updated status, smooth-refresh
      if (statusSelect.value !== 'all' && statusSelect.value !== newStatus) {
        const row = tbody.querySelector(`tr[data-id="${id}"]`);
        if (row) {
          row.style.opacity = '0';
          row.style.transition = 'opacity 0.25s ease';
          setTimeout(() => {
            loadInquiries({ silent: true });
          }, 250);
        }
      }

      showToast(`Inquiry #${id} marked as ${newStatus}.`);

    } catch (err) {
      showToast(err.message || 'Error updating status', true);
      // Restore modal button state if modal open
      if (currentActiveId === id) {
        const inquiry = currentInquiries.find(i => i.id === id);
        updateModalButtonsState(inquiry ? inquiry.status : 'new', false);
      }
    } finally {
      pendingUpdates.delete(id);
      setRowButtonsLoading(id, false);
    }
  }

  function setRowButtonsLoading(id, isLoading) {
    const row = tbody.querySelector(`tr[data-id="${id}"]`);
    if (!row) return;

    const buttons = row.querySelectorAll('.admin-btn-action');
    buttons.forEach(btn => {
      btn.disabled = isLoading;
      if (isLoading) {
        btn.classList.add('is-loading');
      } else {
        btn.classList.remove('is-loading');
      }
    });
  }

  function updateRowDOM(id, newStatus) {
    const row = tbody.querySelector(`tr[data-id="${id}"]`);
    if (!row) return;

    // Update Status Badge
    const statusCell = row.querySelector('.admin-status-cell');
    if (statusCell) {
      const statusClass = `admin-badge-status--${newStatus}`;
      const statusLabel = newStatus.toUpperCase();
      statusCell.innerHTML = `<span class="admin-badge-status ${statusClass}">${statusLabel}</span>`;
    }

    // Update Action Buttons
    const btnGroup = row.querySelector('.admin-action-btn-group');
    if (btnGroup) {
      btnGroup.innerHTML = generateRowActionButtons(id, newStatus);
    }
  }

  // ==========================================================================
  // 8. Event Delegation for Table Actions
  // ==========================================================================
  tbody.addEventListener('click', (e) => {
    const target = e.target.closest('button[data-action]');
    if (!target) return;

    const action = target.getAttribute('data-action');
    const id = parseInt(target.getAttribute('data-id'), 10);

    if (action === 'view') {
      openDetailModal(id);
    } else if (action === 'status') {
      const status = target.getAttribute('data-status');
      if (status) {
        updateInquiryStatus(id, status, target);
      }
    }
  });

  // Modal Action Buttons Event Listeners
  if (modalBtnNew) {
    modalBtnNew.addEventListener('click', () => {
      if (currentActiveId) updateInquiryStatus(currentActiveId, 'new', modalBtnNew);
    });
  }

  if (modalBtnContacted) {
    modalBtnContacted.addEventListener('click', () => {
      if (currentActiveId) updateInquiryStatus(currentActiveId, 'contacted', modalBtnContacted);
    });
  }

  if (modalBtnArchived) {
    modalBtnArchived.addEventListener('click', () => {
      if (currentActiveId) updateInquiryStatus(currentActiveId, 'archived', modalBtnArchived);
    });
  }

  // Backwards Compatibility Global Functions
  window.viewInquiryDetail = function (id) {
    openDetailModal(id);
  };

  window.quickUpdateStatus = function (id, newStatus) {
    updateInquiryStatus(id, newStatus);
  };

  // ==========================================================================
  // 9. Filter, Sort & Search Controls
  // ==========================================================================
  typePills.forEach(pill => {
    pill.addEventListener('click', () => {
      typePills.forEach(p => p.classList.remove('is-active'));
      pill.classList.add('is-active');
      activeTypeFilter = pill.getAttribute('data-type');
      loadInquiries();
    });
  });

  statusSelect.addEventListener('change', () => loadInquiries());
  sortSelect.addEventListener('change', () => loadInquiries());
  refreshBtn.addEventListener('click', () => loadInquiries());

  // Search input with debounce
  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      loadInquiries();
    }, 300);
  });

  // ==========================================================================
  // 10. Admin Logout
  // ==========================================================================
  logoutBtn.addEventListener('click', async () => {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': csrfToken
        },
        credentials: 'same-origin'
      });
    } finally {
      window.location.href = '/admin/login';
    }
  });

  // ==========================================================================
  // 11. Toast Helper
  // ==========================================================================
  let toastTimer = null;
  function showToast(msg, isError = false) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.style.backgroundColor = isError ? '#991B1B' : '#24211E';
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('is-visible');
    }, 3500);
  }

  // HTML Escape Helper
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});

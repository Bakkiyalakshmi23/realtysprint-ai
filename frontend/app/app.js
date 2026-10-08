/**
 * RealtySprint AI — AI Workforce Control Center
 * Dashboard UI Logic & API Data Loaders (frontend/app/app.js)
 *
 * Step 5C: Each page loads real data from the backend via window.API (api.js).
 * If the backend is unavailable the page shows a clear error — it does NOT
 * silently display stale static markup as live data.
 */

document.addEventListener('DOMContentLoaded', () => {
  // ── Auth guard ────────────────────────────────────────────────────────────
  if (typeof Auth !== 'undefined') {
    Auth.requireAuth();
    initUserProfile();
  }

  // ── Shared UI ─────────────────────────────────────────────────────────────
  initNavigationHighlight();
  initMobileSidebarToggle();
  initApprovalButtons();
  initAgentWorkflowButtons();
  initFilterControls();
  initNotificationToggle();
  initLogoutBindings();

  // ── Page-specific data loaders ────────────────────────────────────────────
  if (typeof API === 'undefined') return; // api.js not loaded

  const page = window.location.pathname.split('/').pop() || 'index.html';

  if (page === 'index.html' || page === '')  loadDashboardData();
  if (page === 'agents.html')               loadAgentsData();
  if (page === 'tasks.html')                loadTasksData();
  if (page === 'clients.html')              loadClientsData();
  if (page === 'client.html') {
    const urlParams = new URLSearchParams(window.location.search);
    const clientId = urlParams.get('id');
    if (clientId) loadClient360Data(clientId);
  }
  if (page === 'leads.html')                loadLeadsData();
  if (page === 'approvals.html')            loadApprovalsData();
  if (page === 'activity.html')             loadActivityData();
});

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE LOADERS
// ═══════════════════════════════════════════════════════════════════════════════

// ── DASHBOARD (index.html) ───────────────────────────────────────────────────
async function loadDashboardData() {
  // Fetch all in parallel
  const [agentsRes, tasksRes, approvalsRes, leadsRes, activityRes, businessRes, aiStatusRes] =
    await Promise.all([
      API.getAgents(),
      API.getTasks(),
      API.getApprovals(),
      API.getLeads(),
      API.getActivity(),
      API.getBusinessSummary(),
      API.getAIStatus(),
    ]);

  renderBusinessSnapshot(businessRes);
  const providerBadge = document.getElementById('ai-provider-status');
  if (providerBadge && aiStatusRes.ok) {
    const aiStatus = aiStatusRes.data.data;
    providerBadge.textContent = aiStatus.configured ? `OpenAI ready · ${aiStatus.model}` : 'DEMO mode · OpenAI not configured';
  }

  // ── KPI cards ─────────────────────────────────────────────────────────────
  updateKpiCard('kpi-active-agents',   agentsRes,    d => d.count);
  updateKpiCard('kpi-tasks-today',     tasksRes,     d => d.count);
  updateKpiCard('kpi-pending-approvals', approvalsRes, d => d.data.filter(a => a.status === 'pending').length);
  updateKpiCard('kpi-new-leads',       leadsRes,     d => d.count);
  updateKpiCard('kpi-qualified-leads', leadsRes,     d => d.data.filter(l =>
    l.status === 'qualified' || l.status === 'awaiting_approval').length);

  // ── Source badge ──────────────────────────────────────────────────────────
  const sourceBadgeEl = document.getElementById('dashboard-source-badge');
  if (sourceBadgeEl && agentsRes.ok) {
    API.renderSourceBadge(sourceBadgeEl, agentsRes.data.source);
  }

  // ── Today's AI Work table ─────────────────────────────────────────────────
  const tasksTbody = document.getElementById('dashboard-tasks-tbody');
  if (tasksTbody) {
    if (!tasksRes.ok) {
      API.renderApiError(tasksTbody.closest('.panel-card') || tasksTbody.parentElement, tasksRes.error);
    } else {
      const tasks = (tasksRes.data.data || []).slice(0, 5);
      tasksTbody.innerHTML = tasks.length ? tasks.map(t => `
        <tr>
          <td><span class="agent-tag ${API.agentTagClass(t.agentName)}">${API.agentShortName(t.agentName)}</span></td>
          <td>${escHtml(t.title)}</td>
          <td><span class="status-badge ${API.statusBadgeClass(t.status)}">${API.statusLabel(t.status)}</span></td>
          <td style="font-size:0.8rem;color:var(--text-muted);">${t.updatedAt ? API.formatTime(t.updatedAt) : (t.updated_at ? API.formatTime(t.updated_at) : '—')}</td>
        </tr>
      `).join('') : '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:1.5rem">No tasks found</td></tr>';
    }
  }

  // ── Pending Approvals mini-list ────────────────────────────────────────────
  const approvalsMini = document.getElementById('dashboard-approvals-mini');
  if (approvalsMini) {
    if (!approvalsRes.ok) {
      API.renderApiError(approvalsMini, approvalsRes.error);
    } else {
      const pending = (approvalsRes.data.data || []).filter(a => a.status === 'pending').slice(0, 2);
      approvalsMini.innerHTML = pending.length ? pending.map(a => `
        <div class="approval-card-item" data-approval-id="${escAttr(a.id)}">
          <div class="approval-meta-row">
            <span class="agent-tag ${API.agentTagClass(a.agentName)}">${escHtml(a.agentName || '')}</span>
            <span class="status-badge awaiting">Awaiting approval</span>
          </div>
          <div class="approval-action-title">${escHtml(a.description || a.action || '')}</div>
          <div class="approval-details-text">Type: ${escHtml(a.actionType || a.action_type || '')} • Risk: ${escHtml(a.riskLevel || '—')}</div>
          <div class="approval-buttons-group">
            <a href="approvals.html" class="btn btn-outline btn-sm">Review</a>
            <button class="btn btn-success btn-sm action-approve-btn">Approve</button>
            <button class="btn btn-danger btn-sm action-reject-btn">Reject</button>
          </div>
        </div>
      `).join('') : '<p style="padding:1rem;color:var(--text-muted);font-size:0.9rem">No pending approvals.</p>';

      // Update "View All (N)" link
      const viewAllLink = document.getElementById('dashboard-approvals-view-all');
      if (viewAllLink && approvalsRes.ok) {
        const total = (approvalsRes.data.data || []).filter(a => a.status === 'pending').length;
        viewAllLink.textContent = `View All (${total}) →`;
      }
    }
  }

  // ── Recent Activity feed ──────────────────────────────────────────────────
  const activityFeed = document.getElementById('dashboard-activity-feed');
  if (activityFeed) {
    if (!activityRes.ok) {
      API.renderApiError(activityFeed, activityRes.error);
    } else {
      const items = (activityRes.data.data || []).slice(0, 5);
      activityFeed.innerHTML = items.length ? items.map(a => {
        // Support both DB shape (startedAt/resultSummary) and demo shape (action/entity/timestamp)
        const agentName = a.agentName || 'Unknown Agent';
        const timeStr   = a.startedAt ? API.formatTime(a.startedAt) : (a.timestamp || '—');
        let   actionTxt = '';
        if (a.resultSummary && typeof a.resultSummary === 'object') {
          actionTxt = a.resultSummary.message || JSON.stringify(a.resultSummary);
        } else if (a.action) {
          actionTxt = `${a.action}${a.entity ? ' — ' + a.entity : ''}`;
        } else {
          actionTxt = `Run ${a.status || ''}`;
        }
        return `
          <div class="activity-feed-item">
            <div class="activity-time-col">${timeStr}</div>
            <div class="activity-dot-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
              </svg>
            </div>
            <div class="activity-info">
              <h5>${escHtml(agentName)}</h5>
              <p>${escHtml(actionTxt)}</p>
            </div>
          </div>
        `;
      }).join('') : '<p style="padding:1rem;color:var(--text-muted);font-size:0.9rem">No recent activity.</p>';
    }
  }
}

// ── AGENTS PAGE (agents.html) ────────────────────────────────────────────────
async function loadAgentsData() {
  const container = document.getElementById('agents-api-container');
  if (!container) return;

  API.renderLoading(container, 'Loading agent data from API…');

  const res = await API.getAgents();

  if (!res.ok) {
    API.renderApiError(container, res.error);
    return;
  }

  const agents = res.data.data || [];

  // Update source badge
  const badge = document.getElementById('agents-source-badge');
  if (badge) API.renderSourceBadge(badge, res.data.source);

  // Update each agent card with live data
  agents.forEach(agent => {
    const slug = agent.agentId || agent.slug || '';
    const cardEl = document.getElementById(`agent-card-${slug}`);
    if (!cardEl) return;

    // Status pill
    const statusPill = cardEl.querySelector('.agent-online-pill');
    if (statusPill) {
      const isOnline = agent.status === 'online';
      statusPill.innerHTML = `<span class="status-dot" style="${isOnline ? '' : 'background:var(--text-muted)'}"></span> ${agent.status ? agent.status.charAt(0).toUpperCase() + agent.status.slice(1) : 'Unknown'}`;
    }

    // Description
    const descEl = cardEl.querySelector('.agent-desc');
    if (descEl && agent.description) descEl.textContent = agent.description;

    // Capabilities pills
    const pillsContainer = cardEl.querySelector('.capabilities-pills');
    if (pillsContainer) {
      const caps = Array.isArray(agent.capabilities) ? agent.capabilities : [];
      if (caps.length) {
        pillsContainer.innerHTML = caps.map(c => `<span class="cap-pill">${escHtml(c)}</span>`).join('');
      }
    }

    // Stats (tasksToday, completedToday, successRate, lastActivity)
    const statsMap = {
      '.stat-tasks-today':    agent.tasksToday     || '—',
      '.stat-completed':      agent.completedToday  || '—',
      '.stat-success-rate':   agent.successRate     || '—',
      '.stat-last-activity':  agent.lastActivity    || '—',
    };
    Object.entries(statsMap).forEach(([sel, val]) => {
      const el = cardEl.querySelector(sel);
      if (el) el.textContent = val;
    });
  });

  // Clear loading state if container still has it
  if (container.querySelector('svg')) container.innerHTML = '';
}

// ── TASKS PAGE (tasks.html) ──────────────────────────────────────────────────
async function loadTasksData() {
  const tbody = document.getElementById('tasks-tbody');
  const filterCountEl = document.getElementById('tasks-filter-count');
  const sourceBadge   = document.getElementById('tasks-source-badge');
  if (!tbody) return;

  API.renderLoading(tbody, 'Loading tasks…');

  const res = await API.getTasks();

  if (!res.ok) {
    tbody.innerHTML = '';
    API.renderApiError(tbody.closest('.panel-card') || tbody.parentElement, res.error);
    return;
  }

  const tasks = res.data.data || [];
  if (sourceBadge) API.renderSourceBadge(sourceBadge, res.data.source);
  if (filterCountEl) filterCountEl.textContent = `All Tasks (${tasks.length})`;

  tbody.innerHTML = tasks.length ? tasks.map(t => {
    const category = `${API.agentShortName(t.agentName)} ${API.statusLabel(t.status)}`;
    return `
      <tr data-category="${escAttr(category)}">
        <td style="font-weight:700">${escHtml(t.title)}</td>
        <td><span class="agent-tag ${API.agentTagClass(t.agentName)}">${escHtml(API.agentShortName(t.agentName))}</span></td>
        <td><span style="color:${API.priorityColor(t.priority)};font-weight:700">${API.statusLabel(t.priority || 'normal')}</span></td>
        <td><span class="status-badge ${API.statusBadgeClass(t.status)}">${API.statusLabel(t.status)}</span></td>
        <td style="font-size:0.85rem;color:var(--text-muted)">${t.createdAt ? API.formatTime(t.createdAt) : (t.created_at ? API.formatTime(t.created_at) : '—')}</td>
        <td style="font-size:0.85rem;color:var(--text-muted)">${t.updatedAt ? API.formatTime(t.updatedAt) : (t.updated_at ? API.formatTime(t.updated_at) : '—')}</td>
      </tr>
    `;
  }).join('') : '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:2rem">No tasks found</td></tr>';

  // Re-apply filter controls to newly injected rows
  initFilterControls();
}

// ── CLIENTS DIRECTORY (clients.html) ─────────────────────────────────────────
async function loadClientsData() {
  const tbody = document.getElementById('clients-tbody');
  const sourceBadge = document.getElementById('clients-source-badge');
  if (!tbody) return;

  API.renderLoading(tbody, 'Loading client intelligence…');

  const res = await API.getClients();

  if (!res.ok) {
    tbody.innerHTML = '';
    API.renderApiError(tbody.closest('.panel-card') || tbody.parentElement, res.error);
    return;
  }

  const clients = res.data.data || [];
  const summary = res.data.summary || {};
  if (sourceBadge) API.renderSourceBadge(sourceBadge, res.data.source);

  // Update summary metrics
  document.getElementById('clients-kpi-total').textContent = summary.totalClients || 0;
  document.getElementById('clients-kpi-prospects').textContent = summary.prospects || 0;
  document.getElementById('clients-kpi-won').textContent = summary.won || 0;
  document.getElementById('clients-kpi-duplicates').textContent = summary.duplicateReview || 0;

  // Render table
  tbody.innerHTML = clients.length ? clients.map((c) => {
    const compName = c.company || 'Unknown Company';
    const contName = c.contact || 'Unknown Contact';
    const expRev = c.expectedRevenue ? new Intl.NumberFormat('en-US', { style: 'currency', currency: c.currency || 'INR', maximumFractionDigits: 0 }).format(c.expectedRevenue) : '—';
    const score = c.score != null ? c.score : '—';
    const duplicateBadge = c.duplicateStatus === 'pending_review' ? '<span class="status-badge failed" style="margin-top:4px;display:inline-block;font-size:0.6rem">Duplicate Review</span>' : '';
    
    return `
      <tr style="cursor:pointer" onclick="window.location.href='client.html?id=${c.id}'">
        <td><strong style="color:var(--navy-dark)">${escHtml(compName)}</strong><br>${duplicateBadge}</td>
        <td>${escHtml(contName)}</td>
        <td>${escHtml(c.source || '—')}</td>
        <td><span style="font-weight:800;color:${API.scoreColor(score)}">${score !== '—' ? score + ' / 100' : '—'}</span></td>
        <td><span class="status-badge ${API.statusBadgeClass(c.stage || c.leadStatus)}">${API.statusLabel(c.stage || c.leadStatus)}</span></td>
        <td style="font-weight:600">${expRev}</td>
        <td><span class="status-badge ${API.statusBadgeClass(c.clientStatus)}">${API.statusLabel(c.clientStatus)}</span></td>
      </tr>
    `;
  }).join('') : '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:2rem">No clients found</td></tr>';
}

// ── CLIENT 360 VIEW (client.html) ────────────────────────────────────────────
async function loadClient360Data(clientId) {
  const container = document.getElementById('client-content');
  const loading = document.getElementById('client-loading');
  const sourceBadge = document.getElementById('client-source-badge');
  const headerName = document.getElementById('client-header-name');

  const res = await API.getClient(clientId);

  if (!res.ok) {
    loading.innerHTML = '';
    API.renderApiError(loading, res.error);
    return;
  }

  const { client, company, contact, leadIntelligence, sources, requirements, interactions, pipeline, duplicates, mergeHistory, activities, revenue } = res.data.data;
  if (sourceBadge) API.renderSourceBadge(sourceBadge, res.data.source);
  
  if (headerName) headerName.textContent = company.name || 'Unknown Company';
  loading.style.display = 'none';
  container.style.display = 'block';

  // Format currency
  const money = (val, cur = 'INR') => new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(val || 0);

  // LIFECYCLE
  const stages = [
    { id: 'source', label: 'Discovered', isActive: true, isDone: true },
    { id: 'prospect', label: 'Prospect', isActive: true, isDone: true },
    { id: 'qualified', label: 'Qualified', isActive: pipeline?.stage !== 'prospect', isDone: leadIntelligence.status === 'qualified' || leadIntelligence.status === 'won' || pipeline?.stage !== 'prospect' },
    { id: 'proposal', label: 'Proposal', isActive: pipeline?.stage === 'proposal' || pipeline?.stage === 'won', isDone: pipeline?.stage === 'won' },
    { id: 'won', label: 'Won Client', isActive: pipeline?.stage === 'won', isDone: pipeline?.stage === 'won' && client.status === 'active' },
    { id: 'revenue', label: 'Revenue', isActive: revenue.actual > 0, isDone: revenue.actual > 0 && revenue.actual >= revenue.expected }
  ];
  
  document.getElementById('lifecycle-viz').innerHTML = stages.map(s => `
    <div class="lifecycle-stage ${s.isActive ? 'active' : ''} ${s.isDone ? 'completed' : ''}">
      <div class="stage-dot">${s.isDone ? '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" style="width:100%;height:100%;padding:4px"><polyline points="20 6 9 17 4 12"/></svg>' : ''}</div>
      <div class="stage-label">${s.label}</div>
    </div>
  `).join('');

  // COMPANY & CONTACT
  document.getElementById('company-contact-content').innerHTML = `
    <div style="padding:1.5rem">
      <div class="detail-row"><div class="detail-label">Company</div><div class="detail-value">${escHtml(company.name)}</div></div>
      <div class="detail-row"><div class="detail-label">Location</div><div class="detail-value">${escHtml(company.location || '—')}</div></div>
      <div class="detail-row"><div class="detail-label">Industry</div><div class="detail-value">${escHtml(company.industry || '—')}</div></div>
      <div class="detail-row"><div class="detail-label">Website</div><div class="detail-value">${company.website ? `<a href="${escAttr(company.website)}" target="_blank">${escHtml(company.website)}</a>` : '—'}</div></div>
      <div style="margin-top:1.5rem;margin-bottom:0.5rem;font-size:0.75rem;text-transform:uppercase;color:var(--text-muted);font-weight:700;letter-spacing:0.05em">Primary Contact</div>
      <div class="detail-row"><div class="detail-label">Name</div><div class="detail-value">${escHtml(contact.name)}</div></div>
      <div class="detail-row"><div class="detail-label">Role</div><div class="detail-value">${escHtml(contact.jobTitle || '—')}</div></div>
      <div class="detail-row"><div class="detail-label">Email</div><div class="detail-value">${escHtml(contact.email || '—')}</div></div>
      <div class="detail-row"><div class="detail-label">Phone</div><div class="detail-value">${escHtml(contact.phone || '—')}</div></div>
    </div>
  `;

  // LEAD INTELLIGENCE
  document.getElementById('lead-intelligence-content').innerHTML = `
    <div style="padding:1.5rem">
      <div class="detail-row"><div class="detail-label">Original Source</div><div class="detail-value">${escHtml(leadIntelligence.source || '—')}</div></div>
      <div class="detail-row"><div class="detail-label">Status</div><div class="detail-value"><span class="status-badge ${API.statusBadgeClass(leadIntelligence.status)}">${API.statusLabel(leadIntelligence.status)}</span></div></div>
      <div class="detail-row"><div class="detail-label">AI Score</div><div class="detail-value"><span style="font-weight:800;color:${API.scoreColor(leadIntelligence.score)}">${leadIntelligence.score != null ? leadIntelligence.score + ' / 100' : '—'}</span></div></div>
      <div class="detail-row" style="flex-direction:column;align-items:flex-start;border:none">
        <div class="detail-label" style="margin-bottom:0.5rem;width:100%">AI Qualification Notes</div>
        <div class="detail-value" style="width:100%;font-weight:400;font-size:0.85rem;padding:0.75rem;background:var(--bg-main);border-radius:4px;border:1px solid var(--border-color)">
          ${escHtml(leadIntelligence.notes || JSON.stringify(leadIntelligence.qualification) || 'No qualification notes available.')}
        </div>
      </div>
    </div>
  `;

  // PIPELINE & REQUIREMENTS
  document.getElementById('pipeline-requirements-content').innerHTML = `
    <div style="padding:1.5rem">
      <div class="detail-row"><div class="detail-label">Stage</div><div class="detail-value"><span class="status-badge ${API.statusBadgeClass(pipeline?.stage)}">${API.statusLabel(pipeline?.stage || 'Unknown')}</span></div></div>
      <div class="detail-row"><div class="detail-label">Probability</div><div class="detail-value">${pipeline?.probability != null ? pipeline.probability + '%' : '—'}</div></div>
      <div class="detail-row"><div class="detail-label">Next Action</div><div class="detail-value">${escHtml(pipeline?.nextAction || '—')} <br><span style="font-size:0.75rem;color:var(--text-muted)">${pipeline?.nextActionAt ? API.formatDate(pipeline.nextActionAt) : ''}</span></div></div>
      
      <div style="margin-top:1.5rem;margin-bottom:0.5rem;font-size:0.75rem;text-transform:uppercase;color:var(--text-muted);font-weight:700;letter-spacing:0.05em">Requirements</div>
      ${requirements.length ? requirements.map(r => `
        <div style="padding:0.75rem;background:var(--bg-main);border:1px solid var(--border-color);border-radius:4px;margin-bottom:0.5rem;font-size:0.85rem">
          <div style="display:flex;justify-content:space-between;margin-bottom:0.25rem">
            <strong>${escHtml(r.requirement)}</strong>
            <span class="status-badge ${API.statusBadgeClass(r.status)}">${API.statusLabel(r.status)}</span>
          </div>
          <div style="color:var(--text-muted)">Budget: ${r.budget ? money(r.budget, r.currency) : 'Unspecified'} • Priority: ${escHtml(r.priority || 'Normal')}</div>
        </div>
      `).join('') : '<p style="color:var(--text-muted);font-size:0.85rem">No requirements recorded.</p>'}
    </div>
  `;

  // DATA INTEGRITY (Duplicates & Merges)
  const dupesHtml = duplicates.length ? duplicates.map(d => `
    <div style="padding:0.75rem;background:var(--bg-main);border:1px solid var(--border-color);border-radius:4px;margin-bottom:0.5rem;font-size:0.85rem;border-left:3px solid ${d.status === 'pending_review' ? 'var(--red-danger)' : 'var(--blue-primary)'}">
      <div style="display:flex;justify-content:space-between;margin-bottom:0.25rem">
        <strong>Match: <a href="client.html?id=${d.duplicateClientId}">${escHtml(d.duplicateCompanyName || 'ID ' + d.duplicateClientId)}</a></strong>
        <span class="status-badge ${d.status === 'pending_review' ? 'failed' : 'completed'}">${API.statusLabel(d.status)}</span>
      </div>
      <div style="color:var(--text-muted)">Type: ${escHtml(d.matchType)} • Score: ${Math.round(d.matchScore * 100)}%</div>
    </div>
  `).join('') : '<p style="color:var(--text-muted);font-size:0.85rem">No duplicate candidates detected.</p>';

  const mergesHtml = mergeHistory.length ? mergeHistory.map(m => `
    <div style="padding:0.75rem;background:var(--bg-main);border:1px solid var(--border-color);border-radius:4px;margin-bottom:0.5rem;font-size:0.85rem">
      Merged Client ID ${m.mergedId} into ID ${m.canonicalId} <br>
      <span style="color:var(--text-muted)">Reason: ${escHtml(m.reason)} • ${API.formatDate(m.createdAt)}</span>
    </div>
  `).join('') : '';

  document.getElementById('data-integrity-content').innerHTML = `
    <div style="padding:1.5rem">
      <div style="margin-bottom:0.5rem;font-size:0.75rem;text-transform:uppercase;color:var(--text-muted);font-weight:700;letter-spacing:0.05em">Duplicate Candidates</div>
      ${dupesHtml}
      ${mergeHistory.length ? `<div style="margin-top:1.5rem;margin-bottom:0.5rem;font-size:0.75rem;text-transform:uppercase;color:var(--text-muted);font-weight:700;letter-spacing:0.05em">Merge History</div>${mergesHtml}` : ''}
    </div>
  `;

  // DELIVERY & REVENUE
  document.getElementById('delivery-revenue-content').innerHTML = `
    <div style="padding:1.5rem;flex:1">
      <div style="margin-bottom:0.5rem;font-size:0.75rem;text-transform:uppercase;color:var(--text-muted);font-weight:700;letter-spacing:0.05em">Revenue</div>
      <div style="display:flex;gap:2rem;margin-bottom:1.5rem">
        <div>
          <div style="font-size:0.8rem;color:var(--text-muted)">Expected</div>
          <div style="font-size:1.5rem;font-weight:700;color:var(--navy-dark)">${money(revenue.expected, revenue.currency)}</div>
        </div>
        <div>
          <div style="font-size:0.8rem;color:var(--text-muted)">Actual (Recognized)</div>
          <div style="font-size:1.5rem;font-weight:700;color:var(--green-accent)">${money(revenue.actual, revenue.currency)}</div>
        </div>
      </div>
      
      <div style="margin-bottom:0.5rem;font-size:0.75rem;text-transform:uppercase;color:var(--text-muted);font-weight:700;letter-spacing:0.05em">Delivery & Handover</div>
      <div class="detail-row"><div class="detail-label">Client Status</div><div class="detail-value"><span class="status-badge ${API.statusBadgeClass(client.status)}">${API.statusLabel(client.status)}</span></div></div>
      <div class="detail-row"><div class="detail-label">Handed Over</div><div class="detail-value">${client.handedOverAt ? API.formatDate(client.handedOverAt) : 'Not yet'}</div></div>
    </div>
  `;

  // INTERACTIONS & SOURCES
  document.getElementById('interactions-content').innerHTML = `
    <div style="padding:1.5rem">
      <div style="margin-bottom:0.5rem;font-size:0.75rem;text-transform:uppercase;color:var(--text-muted);font-weight:700;letter-spacing:0.05em">Touchpoints</div>
      ${interactions.length ? interactions.map(i => `
        <div style="padding:0.75rem;background:var(--bg-main);border:1px solid var(--border-color);border-radius:4px;margin-bottom:0.5rem;font-size:0.85rem">
          <div style="display:flex;justify-content:space-between;margin-bottom:0.25rem">
            <strong>${escHtml(i.channel)} (${escHtml(i.direction)})</strong>
            <span class="status-badge ${API.statusBadgeClass(i.status)}">${API.statusLabel(i.status)}</span>
          </div>
          <div style="color:var(--text-muted);margin-bottom:0.25rem">${escHtml(i.interactionType)} • ${API.formatDate(i.createdAt)}</div>
          ${i.content ? `<div style="background:#fff;padding:0.5rem;border-radius:4px;border:1px solid #eee;margin-top:0.5rem;white-space:pre-wrap;font-family:monospace;font-size:0.8rem">${escHtml(typeof i.content === 'object' ? JSON.stringify(i.content) : i.content)}</div>` : ''}
        </div>
      `).join('') : '<p style="color:var(--text-muted);font-size:0.85rem">No interactions recorded.</p>'}
      
      <div style="margin-top:1.5rem;margin-bottom:0.5rem;font-size:0.75rem;text-transform:uppercase;color:var(--text-muted);font-weight:700;letter-spacing:0.05em">Attribution Sources</div>
      ${sources.length ? sources.map(s => `
        <div style="padding:0.5rem 0;border-bottom:1px solid var(--border-color);font-size:0.85rem">
          <strong>${escHtml(s.sourceType)}</strong>: ${escHtml(s.sourceReference)} <span style="color:var(--text-muted);float:right">${API.formatDate(s.discoveredAt)}</span>
        </div>
      `).join('') : ''}
    </div>
  `;

  // ACTIVITY TIMELINE
  document.getElementById('activity-timeline-content').innerHTML = `
    <div style="padding:1.5rem">
      ${activities.length ? activities.map(a => `
        <div class="timeline-item">
          <div class="timeline-icon">
            ${a.actorType === 'agent' ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'}
          </div>
          <div class="timeline-content">
            <div class="timeline-header">
              <span class="timeline-title">${escHtml(a.action)}</span>
              <span class="timeline-date">${API.formatTime(a.createdAt)}</span>
            </div>
            <div style="font-size:0.85rem;color:var(--text-muted)">${escHtml(a.description || '')}</div>
          </div>
        </div>
      `).join('') : '<p style="color:var(--text-muted);font-size:0.85rem;text-align:center">No activity recorded.</p>'}
    </div>
  `;
}

// ── LEADS PAGE (leads.html) ──────────────────────────────────────────────────
async function loadLeadsData() {
  const tbody       = document.getElementById('leads-tbody');
  const sourceBadge = document.getElementById('leads-source-badge');
  const kpiNew      = document.getElementById('leads-kpi-new');
  const kpiQual     = document.getElementById('leads-kpi-qualified');
  const kpiHigh     = document.getElementById('leads-kpi-high');
  const kpiAwaiting = document.getElementById('leads-kpi-awaiting');
  if (!tbody) return;

  API.renderLoading(tbody, 'Loading leads…');

  const res = await API.getLeads();

  if (!res.ok) {
    tbody.innerHTML = '';
    API.renderApiError(tbody.closest('.panel-card') || tbody.parentElement, res.error);
    return;
  }

  const leads = res.data.data || [];
  window.__realtySprintLeads = leads;
  if (sourceBadge) API.renderSourceBadge(sourceBadge, res.data.source);

  // KPI counts
  if (kpiNew)      kpiNew.textContent      = leads.length;
  if (kpiQual)     kpiQual.textContent     = leads.filter(l => l.status === 'qualified').length;
  if (kpiHigh)     kpiHigh.textContent     = leads.filter(l => (l.score || 0) >= 85).length;
  if (kpiAwaiting) kpiAwaiting.textContent = leads.filter(l => l.status === 'awaiting_approval').length;

  tbody.innerHTML = leads.length ? leads.map((l, index) => {
    const company = l.company || l.name || 'Unknown';
    const contact = l.contact || l.contactName || '—';
    const location = l.location || '—';
    const source   = l.source || '—';
    const score    = l.score != null ? l.score : '—';
    const lastAct  = l.updatedAt ? API.formatTime(l.updatedAt) : (l.lastActivity || '—');
    return `
      <tr>
        <td><strong style="color:var(--navy-dark)">${escHtml(company)}</strong></td>
        <td>${escHtml(contact)}</td>
        <td>${escHtml(location)}</td>
        <td>${escHtml(source)}</td>
        <td><span style="font-weight:800;color:${API.scoreColor(score)}">${score !== '—' ? score + ' / 100' : '—'}</span></td>
        <td><span class="status-badge ${API.statusBadgeClass(l.status)}">${API.statusLabel(l.status)}</span></td>
        <td style="font-size:0.85rem;color:var(--text-muted)">${lastAct}</td>
        <td><div class="agent-actions-row">
          <button class="btn btn-outline btn-sm" data-lead-action="qualify" data-lead-index="${index}">Qualify</button>
          <button class="btn btn-outline btn-sm" data-lead-action="proposal" data-lead-index="${index}">Proposal</button>
          <button class="btn btn-outline btn-sm" data-lead-action="follow-up" data-lead-index="${index}">Follow-up</button>
          <button class="btn btn-secondary btn-sm" data-lead-action="handover" data-lead-index="${index}">Won & Handover</button>
        </div></td>
      </tr>
    `;
  }).join('') : '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:2rem">No leads found</td></tr>';
}

// ── APPROVALS PAGE (approvals.html) ─────────────────────────────────────────
async function loadApprovalsData() {
  const container  = document.getElementById('approvals-list-container');
  const heading    = document.getElementById('approvals-page-heading');
  const sourceBadge = document.getElementById('approvals-source-badge');
  if (!container) return;

  API.renderLoading(container, 'Loading approvals…');

  const res = await API.getApprovals();

  if (!res.ok) {
    API.renderApiError(container, res.error);
    return;
  }

  const approvals = (res.data.data || []).filter(a => a.status === 'pending');
  if (sourceBadge) API.renderSourceBadge(sourceBadge, res.data.source);
  if (heading) heading.textContent = `Pending Action Approvals (${approvals.length})`;

  container.innerHTML = approvals.length ? approvals.map(a => {
    const agentName  = a.agentName  || 'Unknown Agent';
    const actionType = a.actionType || a.action_type || 'Action';
    const desc       = a.description || a.action || 'No description';
    const time       = a.requestedAt ? API.formatTime(a.requestedAt) : (a.createdAt || '—');
    const risk       = a.riskLevel  || '—';
    const riskColor  = risk.toLowerCase().includes('high')
      ? 'var(--red-danger)'
      : risk.toLowerCase().includes('medium')
        ? 'var(--amber-warning)'
        : 'var(--blue-primary)';

    return `
      <div class="approval-card-item" data-approval-id="${escAttr(a.id)}">
        <div class="approval-meta-row">
          <div style="display:flex;align-items:center;gap:0.75rem">
            <span class="agent-tag ${API.agentTagClass(agentName)}">${escHtml(agentName)}</span>
            <span style="font-size:0.8rem;color:var(--text-muted)">Created: ${time}</span>
          </div>
          <span class="status-badge awaiting">Awaiting approval</span>
        </div>
        <div class="approval-action-title">${escHtml(desc)}</div>
        <div class="approval-details-text">
          <strong>Action Type:</strong> ${escHtml(actionType)}<br>
          <strong>Risk Level:</strong> <span style="color:${riskColor};font-weight:800">${escHtml(risk)}</span>
        </div>
        ${a.result ? `<details><summary>Review draft or action details</summary><pre class="agent-run-output">${escHtml(JSON.stringify(a.result.result?.draft || a.result.draft || a.result, null, 2).slice(0, 6000))}</pre></details>` : ''}
        <div class="approval-buttons-group">
          <span class="approval-review-status" aria-live="polite"></span>
          <button class="btn btn-success btn-sm action-approve-btn">Approve</button>
          <button class="btn btn-danger btn-sm action-reject-btn">Reject</button>
        </div>
      </div>
    `;
  }).join('') : `
    <div style="padding:2rem;text-align:center;color:var(--text-muted)">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin:0 auto 1rem;display:block;opacity:0.4">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
      <p style="font-size:1rem;font-weight:700">No pending approvals</p>
      <p style="font-size:0.85rem;margin-top:0.25rem">All agent actions are cleared.</p>
    </div>
  `;
}

// ── ACTIVITY PAGE (activity.html) ────────────────────────────────────────────
async function loadActivityData() {
  const tbody       = document.getElementById('activity-tbody');
  const sourceBadge = document.getElementById('activity-source-badge');
  if (!tbody) return;

  API.renderLoading(tbody, 'Loading activity log…');

  const res = await API.getActivity();

  if (!res.ok) {
    tbody.innerHTML = '';
    API.renderApiError(tbody.closest('.panel-card') || tbody.parentElement, res.error);
    return;
  }

  const items = res.data.data || [];
  if (sourceBadge) API.renderSourceBadge(sourceBadge, res.data.source);

  tbody.innerHTML = items.length ? items.map(a => {
    const agentName = a.agentName || 'Unknown Agent';
    const timeStr   = a.startedAt ? API.formatTime(a.startedAt) : (a.timestamp || '—');
    let   action    = '';
    let   entity    = '';

    if (a.resultSummary && typeof a.resultSummary === 'object') {
      action = a.resultSummary.message || `Run ${a.status}`;
      entity = a.resultSummary.leadsFound
        ? `${a.resultSummary.leadsFound} leads found`
        : a.resultSummary.recordsProcessed
          ? `${a.resultSummary.recordsProcessed} records`
          : '';
    } else {
      action = a.action  || `Run ${a.status || ''}`;
      entity = a.entity  || '';
    }

    const category = API.agentShortName(agentName);
    return `
      <tr data-category="${escAttr(category)}">
        <td><strong style="color:var(--navy-dark)">${timeStr}</strong></td>
        <td><span class="agent-tag ${API.agentTagClass(agentName)}">${escHtml(API.agentShortName(agentName))}</span></td>
        <td>${escHtml(action)}</td>
        <td>${escHtml(entity)}</td>
        <td><span class="status-badge ${API.statusBadgeClass(a.status)}">${API.statusLabel(a.status)}</span></td>
      </tr>
    `;
  }).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:2rem">No activity found</td></tr>';

  // Re-apply filter to new rows
  initFilterControls();
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED UI HELPERS (unchanged from Step 4A)
// ═══════════════════════════════════════════════════════════════════════════════

function updateKpiCard(id, res, valueFn) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!res.ok) {
    el.textContent = '—';
    el.title = res.error;
    return;
  }
  try {
    el.textContent = valueFn(res.data);
  } catch {
    el.textContent = '—';
  }
}

function escHtml(str) {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escAttr(str) {
  return escHtml(str);
}

function initUserProfile() {
  if (typeof Auth === 'undefined') return;
  const user = Auth.getCurrentUser();
  if (!user) return;
  document.querySelectorAll('.user-name').forEach(el => el.innerText = user.name  || 'Admin');
  document.querySelectorAll('.user-role').forEach(el => el.innerText = user.email || 'admin@realtysprint.ai');
}

function initLogoutBindings() {
  document.querySelectorAll('.logout-action-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof Auth !== 'undefined') Auth.logout();
    });
  });
}

function initNavigationHighlight() {
  const currentPath = window.location.pathname;
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    const href = item.getAttribute('href');
    if (!href) return;
    const pageName       = href.split('/').pop();
    const currentFileName = currentPath.split('/').pop() || 'index.html';
    if (currentFileName === pageName || (currentFileName === '' && pageName === 'index.html')) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}

function initMobileSidebarToggle() {
  const toggleBtn = document.getElementById('mobile-sidebar-toggle');
  const sidebar   = document.getElementById('app-sidebar');
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', e => {
      e.stopPropagation();
      sidebar.classList.toggle('mobile-open');
    });
    document.addEventListener('click', e => {
      if (sidebar.classList.contains('mobile-open') && !sidebar.contains(e.target) && e.target !== toggleBtn) {
        sidebar.classList.remove('mobile-open');
      }
    });
  }
}

function initApprovalButtons() {
  document.addEventListener('click', e => {
    const target = e.target.closest('.action-approve-btn, .action-reject-btn');
    if (!target) return;
    const card      = target.closest('.approval-card-item') || target.closest('tr');
    const approvalId = card?.dataset.approvalId;
    if (!approvalId || typeof API === 'undefined') return;
    const isApprove = target.classList.contains('action-approve-btn');
    const status = card.querySelector('.approval-review-status');
    target.disabled = true;
    API.reviewApproval(approvalId, isApprove ? 'approve' : 'reject').then(response => {
      if (!response.ok) {
        target.disabled = false;
        if (status) status.textContent = response.error || 'Could not review approval.';
        return;
      }
      if (status) status.textContent = isApprove ? 'Approved by Founder. No communication was sent.' : 'Rejected by Founder.';
      card.querySelectorAll('.action-approve-btn, .action-reject-btn').forEach(button => button.remove());
      const approvalBadge = document.querySelector('.nav-item[href="approvals.html"] .badge-count');
      if (approvalBadge) {
        const count = parseInt(approvalBadge.innerText) || 0;
        if (count > 0) approvalBadge.innerText = count - 1;
      }
    }).catch(() => {
      target.disabled = false;
      if (status) status.textContent = 'Could not connect to review this approval.';
    });
  });
}

function initFilterControls() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    // Remove old listeners by replacing with clone
    const clone = btn.cloneNode(true);
    btn.parentNode.replaceChild(clone, btn);

    clone.addEventListener('click', () => {
      const parent = clone.parentElement;
      if (parent) parent.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      clone.classList.add('active');

      const filterValue = clone.getAttribute('data-filter');
      const tableRows   = document.querySelectorAll('.filterable-table tbody tr');
      tableRows.forEach(row => {
        if (!filterValue || filterValue === 'all') {
          row.style.display = '';
        } else {
          const cat = row.getAttribute('data-category') || row.innerText.toLowerCase();
          row.style.display = cat.toLowerCase().includes(filterValue.toLowerCase()) ? '' : 'none';
        }
      });
    });
  });
}

function initNotificationToggle() {
  const notifBtn = document.getElementById('notification-bell-btn');
  if (notifBtn) {
    notifBtn.addEventListener('click', () => {
      alert('RealtySprint AI Control Center: Check Approvals for pending agent actions.');
    });
  }
}

function renderBusinessSnapshot(response) {
  if (!response?.ok) return;
  const { data, source } = response.data;
  const actual = document.getElementById('business-revenue-actual');
  const expected = document.getElementById('business-revenue-expected');
  const progress = document.getElementById('business-target-progress');
  const delivery = document.getElementById('business-delivery-status');
  const badge = document.getElementById('business-data-source');
  const currency = data.revenue.currency || 'INR';
  const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0));
  if (actual) actual.textContent = money(data.revenue.totalActual);
  if (expected) expected.textContent = money(data.revenue.expected);
  if (progress) {
    const target = Number(data.revenue.target || 0);
    const value = Number(data.revenue.totalActual || 0);
    progress.textContent = `${money(value)} / ${money(target)} · ${target ? Math.round(value / target * 100) : 0}%`;
  }
  if (delivery) delivery.textContent = `${data.delivery.activeProjects} active · ${data.delivery.overdue} overdue · ${data.delivery.blocked} blocked`;
  if (badge) API.renderSourceBadge(badge, source);
}

function initAgentWorkflowButtons() {
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-agent][data-action], [data-lead-action]');
    if (!button || typeof API === 'undefined') return;
    const status = document.getElementById('agent-run-status') || document.getElementById('lead-action-status');
    const output = document.getElementById('agent-run-output') || document.getElementById('lead-action-output');
    button.disabled = true;
    if (status) status.textContent = 'Running agent action…';
    if (output) { output.hidden = true; output.textContent = ''; }
    try {
      let response;
      if (button.dataset.leadAction) {
        const lead = (window.__realtySprintLeads || [])[Number(button.dataset.leadIndex)];
        if (!lead) throw new Error('Lead details are unavailable. Reload the page and try again.');
        if (button.dataset.leadAction === 'handover') {
          if (!window.confirm(`Confirm ${lead.company} is already a won client and is ready for internal delivery handover? No external message will be sent.`)) return;
          const projectTitle = window.prompt('Enter the delivery project title:');
          if (!projectTitle) return;
          const amountText = window.prompt('Enter expected contract value (not received revenue):', '0');
          if (amountText === null) return;
          const contractValue = Number(amountText);
          if (!Number.isFinite(contractValue) || contractValue < 0) throw new Error('Enter a non-negative expected contract value.');
          response = await API.handoverLead(lead.id, {
            founderConfirmedWon: true,
            projectTitle,
            requirements: lead.requirements || [lead.notes || 'Confirm project requirements with the client.'],
            contractValue,
            currency: 'INR',
          });
        } else {
          const leadAction = button.dataset.leadAction;
          const action = leadAction === 'qualify' ? 'qualify_lead' : 'create_draft';
          const draftType = leadAction === 'proposal' ? 'proposal' : 'follow-up';
          response = await API.executeAgent('client-acquisition', action, { lead, draftType }, { useAI: document.getElementById('use-ai-analysis')?.checked === true });
        }
      } else {
        response = await API.executeAgent(button.dataset.agent, button.dataset.action, {}, { useAI: document.getElementById('use-ai-analysis')?.checked === true });
      }
      if (!response.ok) throw new Error(response.error || 'Agent action failed.');
      const payload = response.data;
      const display = payload.data || payload.result || payload;
      if (status) {
        const aiStatus = display.aiStatus?.status;
        status.textContent = `${payload.success ? 'Completed' : 'Needs attention'} · ${aiStatus ? `AI: ${aiStatus}` : 'DEMO / workflow result'}`;
      }
      if (output) {
        output.hidden = false;
        output.textContent = JSON.stringify(display, null, 2);
      }
      if (button.dataset.leadAction === 'qualify' || button.dataset.leadAction === 'handover') await loadLeadsData();
      if (button.dataset.leadAction === 'handover') await loadDashboardData();
      if (button.dataset.leadAction === 'proposal') {
        const approvals = document.getElementById('approvals-list-container');
        if (approvals) await loadApprovalsData();
      }
    } catch (error) {
      if (status) status.textContent = error.message || 'The agent action could not be completed.';
    } finally {
      button.disabled = false;
    }
  });
}

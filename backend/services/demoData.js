/**
 * Centralized Demo Data Service
 * Provides mock data for RealtySprint AI Agents, Tasks, Leads, Approvals, and Activity.
 */

const demoAgents = [
  {
    id: 'company-pa',
    name: 'Company PA Agent',
    description: 'Internal AI operations assistant for tasks, KPIs, reporting, follow-ups, workload visibility, and operational coordination.',
    status: 'online',
    capabilities: [
      'Task Management',
      'KPI Monitoring',
      'Daily Reporting',
      'Follow-ups',
      'Workload Analysis',
      'Operational Insights'
    ],
    tasksToday: 14,
    completedToday: 9,
    successRate: '98.2%',
    lastActivity: '09:42 AM'
  },
  {
    id: 'client-acquisition',
    name: 'Client Acquisition Agent',
    description: 'AI prospecting assistant for discovering, researching, qualifying, scoring, and organizing real-estate opportunities.',
    status: 'online',
    capabilities: [
      'Prospect Research',
      'Lead Qualification',
      'Lead Scoring',
      'Company Research',
      'Outreach Drafts',
      'Pipeline Tracking'
    ],
    tasksToday: 18,
    completedToday: 11,
    successRate: '94.6%',
    lastActivity: '09:36 AM'
  }
];

const demoTasks = [
  {
    id: 'task-101',
    title: 'Prepare daily operations report',
    agentId: 'company-pa',
    agentName: 'Company PA Agent',
    priority: 'medium',
    status: 'completed',
    createdAt: '2026-10-07T08:00:00Z',
    updatedAt: '2026-10-07T09:15:00Z'
  },
  {
    id: 'task-102',
    title: 'Review unallocated viewing resources',
    agentId: 'company-pa',
    agentName: 'Company PA Agent',
    priority: 'high',
    status: 'in_progress',
    createdAt: '2026-10-07T09:00:00Z',
    updatedAt: '2026-10-07T09:30:00Z'
  },
  {
    id: 'task-103',
    title: 'Research Dubai property agencies',
    agentId: 'client-acquisition',
    agentName: 'Client Acquisition Agent',
    priority: 'normal',
    status: 'completed',
    createdAt: '2026-10-07T07:30:00Z',
    updatedAt: '2026-10-07T08:50:00Z'
  },
  {
    id: 'task-104',
    title: 'Prepare outreach drafts for ABC Properties',
    agentId: 'client-acquisition',
    agentName: 'Client Acquisition Agent',
    priority: 'high',
    status: 'awaiting_approval',
    createdAt: '2026-10-07T09:10:00Z',
    updatedAt: '2026-10-07T09:40:00Z'
  },
  {
    id: 'task-105',
    title: 'Prepare weekly KPI summary',
    agentId: 'company-pa',
    agentName: 'Company PA Agent',
    priority: 'normal',
    status: 'pending',
    createdAt: '2026-10-07T09:30:00Z',
    updatedAt: '2026-10-07T10:00:00Z'
  }
];

const demoLeads = [
  {
    id: 'lead-201',
    company: 'ABC Properties LLC',
    contact: 'Tariq Al Hashimi',
    location: 'Downtown Dubai',
    source: 'Bayut Portal',
    score: 94,
    status: 'awaiting_approval',
    lastActivity: '09:36 AM'
  },
  {
    id: 'lead-202',
    company: 'Apex Luxury Real Estate',
    contact: 'Sarah Jenkins',
    location: 'Dubai Marina',
    source: 'Property Finder',
    score: 91,
    status: 'qualified',
    lastActivity: '08:50 AM'
  },
  {
    id: 'lead-203',
    company: 'Yas Island Heights',
    contact: 'Hamdan Al Nahyan',
    location: 'Abu Dhabi',
    source: 'WhatsApp Business',
    score: 88,
    status: 'qualified',
    lastActivity: '08:20 AM'
  },
  {
    id: 'lead-204',
    company: 'Gulf Horizon Brokerage',
    contact: 'Michael Vance',
    location: 'Business Bay, Dubai',
    source: 'Dubizzle',
    score: 79,
    status: 'in_review',
    lastActivity: '07:45 AM'
  },
  {
    id: 'lead-205',
    company: 'Al Reem Pearl Investments',
    contact: 'Fatima Al Suwaidi',
    location: 'Al Reem Island, Abu Dhabi',
    source: 'Website Chatbot',
    score: 86,
    status: 'awaiting_approval',
    lastActivity: '09:10 AM'
  }
];

const demoApprovals = [
  {
    id: 'appr-301',
    agentId: 'client-acquisition',
    agentName: 'Client Acquisition Agent',
    action: 'Outreach Draft for ABC Properties (Downtown Dubai)',
    reason: 'High lead score (94/100) matched 2BR Downtown Dubai portfolio opportunity.',
    riskLevel: 'medium',
    createdAt: '2026-10-07T09:40:00Z',
    status: 'pending'
  },
  {
    id: 'appr-302',
    agentId: 'company-pa',
    agentName: 'Company PA Agent',
    action: 'Update Operational Resource Assignment',
    reason: 'Reassign Agent Sarah viewing slot to Yas Island lead inquiry.',
    riskLevel: 'low',
    createdAt: '2026-10-07T09:18:00Z',
    status: 'pending'
  },
  {
    id: 'appr-303',
    agentId: 'client-acquisition',
    agentName: 'Client Acquisition Agent',
    action: 'Outreach Draft for Al Reem Pearl Investments',
    reason: 'Off-plan luxury penthouse inquiry on Al Reem Island.',
    riskLevel: 'medium',
    createdAt: '2026-10-07T09:10:00Z',
    status: 'pending'
  }
];

const demoActivity = [
  {
    id: 'act-401',
    timestamp: '09:42 AM',
    agentId: 'company-pa',
    agentName: 'Company PA Agent',
    action: 'KPI Analysis Completed',
    entity: 'Daily Operations Dashboard',
    status: 'success'
  },
  {
    id: 'act-402',
    timestamp: '09:36 AM',
    agentId: 'client-acquisition',
    agentName: 'Client Acquisition Agent',
    action: 'Qualified 4 New Prospects',
    entity: 'Bayut & Property Finder Sync',
    status: 'success'
  },
  {
    id: 'act-403',
    timestamp: '09:18 AM',
    agentId: 'company-pa',
    agentName: 'Company PA Agent',
    action: 'Resource Reassignment Requested',
    entity: 'Viewing Calendar Slot #108',
    status: 'awaiting_approval'
  },
  {
    id: 'act-404',
    timestamp: '08:55 AM',
    agentId: 'client-acquisition',
    agentName: 'Client Acquisition Agent',
    action: 'Agency Research Completed',
    entity: 'Dubai Real Estate Market Survey',
    status: 'success'
  },
  {
    id: 'act-405',
    timestamp: '08:30 AM',
    agentId: 'company-pa',
    agentName: 'Company PA Agent',
    action: 'Daily Operations Summary Generated',
    entity: 'Internal Report #402',
    status: 'success'
  }
];

const demoProposals = [];
const demoClients = [];
const demoProjects = [];
const demoRevenue = [];

function recordActivity({ agentSlug, action, status, message, traceId }) {
  const agentName = agentSlug === 'company-pa' ? 'Company PA Agent' : 'Client Acquisition Agent';
  demoActivity.unshift({
    id: `act-${Date.now()}`,
    timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    agentId: agentSlug,
    agentName,
    action,
    entity: message || 'Agent action',
    status: status === 'completed' ? 'success' : status,
    traceId,
  });
  if (demoActivity.length > 50) demoActivity.length = 50;
}

function addApproval(approval) {
  const saved = {
    id: `demo-approval-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    status: 'pending',
    requestedAt: new Date().toISOString(),
    ...approval,
  };
  demoApprovals.unshift(saved);
  return saved;
}

function reviewApproval(id, status) {
  const approval = demoApprovals.find(item => String(item.id) === String(id));
  if (!approval || approval.status !== 'pending') return null;
  approval.status = status;
  approval.reviewedAt = new Date().toISOString();
  approval.reviewedByName = 'Founder';
  approval.communicationSent = false;
  const proposal = demoProposals.find(item => String(item.approvalId) === String(id));
  if (proposal) proposal.status = status;
  return approval;
}

function saveProposal(proposal) {
  const saved = { id: `demo-proposal-${Date.now()}`, status: 'pending_approval', createdAt: new Date().toISOString(), ...proposal };
  demoProposals.unshift(saved);
  return saved;
}

function handoverLead(id, { projectTitle, requirements, amount, currency = 'INR', founderConfirmedWon = false }) {
  const lead = demoLeads.find(item => String(item.id) === String(id));
  if (!lead) return null;
  if (lead.status === 'handed_over') return { lead, client: demoClients.find(item => item.leadId === id), alreadyHandedOver: true };
  if (!founderConfirmedWon) return { error: 'Founder confirmation that the client is won is required.', status: 409 };
  lead.status = 'won';
  lead.status = 'handed_over';
  lead.updatedAt = new Date().toISOString();
  const client = { id: `demo-client-${Date.now()}`, leadId: id, company: lead.company, status: 'active', requirements, handedOverAt: lead.updatedAt };
  const project = { id: `demo-project-${Date.now()}`, clientId: client.id, title: projectTitle, status: 'planned', riskLevel: 'low', dueAt: null };
  const task = {
    id: `task-${Date.now()}`, title: `Kick off delivery: ${projectTitle}`, description: `Review approved requirements and establish the first delivery milestone for ${lead.company}.`,
    agentId: 'company-pa', agentName: 'Company PA Agent', priority: 'high', status: 'pending',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  demoClients.unshift(client);
  demoProjects.unshift(project);
  demoTasks.unshift(task);
  const revenue = { id: `demo-revenue-${Date.now()}`, leadId: id, clientId: client.id, amount: Number(amount), currency, recognitionStatus: 'expected', receivedAt: new Date().toISOString(), note: 'EXPECTED contract value; not yet recorded as received revenue.' };
  demoRevenue.unshift(revenue);
  return { lead, client, project, task, revenue, alreadyHandedOver: false };
}

function updateLeadQualification(idOrCompany, qualification) {
  const lead = demoLeads.find(item => String(item.id) === String(idOrCompany) || item.company === idOrCompany);
  if (!lead) return null;
  lead.score = qualification.score;
  lead.status = qualification.qualification === 'qualified' ? 'qualified' : 'in_review';
  lead.qualification = qualification;
  lead.updatedAt = new Date().toISOString();
  return lead;
}

function getBusinessSnapshot() {
  const today = new Date().toLocaleDateString('en-IN');
  const won = demoLeads.filter(lead => ['won', 'handed_over'].includes(lead.status)).length;
  const qualified = demoLeads.filter(lead => ['qualified', 'awaiting_approval', 'approved', 'proposal', 'won', 'handed_over'].includes(lead.status)).length;
  return {
    source: 'demo', dataQuality: 'DEMO — not actual company data', asOf: today,
    revenue: {
      todayActual: 0,
      totalActual: demoRevenue.filter(item => item.currency === 'INR' && item.recognitionStatus === 'actual').reduce((sum, item) => sum + item.amount, 0),
      expected: demoRevenue.filter(item => item.currency === 'INR' && item.recognitionStatus === 'expected').reduce((sum, item) => sum + item.amount, 0),
      target: 5000000, currency: 'INR',
    },
    pipeline: {
      totalLeads: demoLeads.length, qualified, conversations: 1,
      proposals: demoProposals.length, wins: won,
      followUps: demoActivity.filter(item => /follow.up/i.test(item.action || '')).length,
    },
    delivery: {
      activeProjects: demoProjects.filter(project => ['planned', 'in_progress', 'at_risk', 'blocked'].includes(project.status)).length,
      overdue: demoTasks.filter(task => task.status === 'overdue').length,
      blocked: demoTasks.filter(task => task.status === 'blocked').length,
      atRisk: demoProjects.filter(project => project.riskLevel === 'high').length,
    },
    blockers: ['DEMO DATA: live company revenue and delivery records are not connected.'],
    overdueWork: demoTasks.filter(task => task.status === 'overdue').map(task => task.title),
  };
}

module.exports = {
  getAgents: () => demoAgents,
  getAgentById: (id) => demoAgents.find(a => a.id === id),
  getTasks: () => demoTasks,
  getLeads: () => demoLeads,
  getApprovals: () => demoApprovals,
  getActivity: () => demoActivity,
  getProposals: () => demoProposals,
  getClients: () => demoClients,
  getProjects: () => demoProjects,
  getRevenue: () => demoRevenue,
  getBusinessSnapshot,
  recordActivity,
  addApproval,
  reviewApproval,
  saveProposal,
  handoverLead,
  updateLeadQualification,
};

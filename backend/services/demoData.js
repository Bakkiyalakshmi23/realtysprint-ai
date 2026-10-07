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

module.exports = {
  getAgents: () => demoAgents,
  getAgentById: (id) => demoAgents.find(a => a.id === id),
  getTasks: () => demoTasks,
  getLeads: () => demoLeads,
  getApprovals: () => demoApprovals,
  getActivity: () => demoActivity
};

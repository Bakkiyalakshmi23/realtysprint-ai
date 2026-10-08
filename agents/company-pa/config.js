/**
 * RealtySprint AI — Founder PA Agent: Config
 * agents/company-pa/config.js
 */
'use strict';

module.exports = {
  id:          'company-pa',
  name:        'Founder PA',
  slug:        'company-pa',
  description: 'Central operating and management brain of RealtySprint AI. Observes company state, analyzes data, plans priorities, coordinates workforce, tracks the ₹50L revenue target, and reports directly to the Founder.',
  status:      'online',
  capabilities: [
    'Founder Daily Brief',
    'Revenue Target Tracking',
    'Workforce Management',
    'Task Coordination',
    'Pipeline Monitoring',
    'Risk Identification',
    'Priority Management',
    'Client Handover',
    'Product Improvement',
    'Internal Reporting',
  ],
  // Six-month revenue target (₹50,00,000)
  revenueTarget: {
    currency:    'INR',
    amount:      5000000,
    label:       '₹50,00,000',
    periodMonths: 6,
  },
};

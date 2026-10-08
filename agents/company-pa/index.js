/**
 * RealtySprint AI — Founder PA Agent
 * agents/company-pa/index.js
 *
 * The central operating and management brain of RealtySprint AI.
 * Reports directly to the Founder.
 * Coordinates Client Acquisition Agent and internal workforce.
 * Tracks the ₹50,00,000 six-month revenue target.
 */
'use strict';

const BaseAgent   = require('../core/agentBase');
const agentResult = require('../core/agentResult');
const config      = require('./config');
const caps        = require('./capabilities');

class FounderPA extends BaseAgent {
  constructor() {
    super(config);
  }

  getSupportedActions() {
    return caps.SUPPORTED_ACTIONS;
  }

  async executeAction(action, context) {
    switch (action) {
      case 'generate_report':
        return caps.generateReport(context);

      case 'analyze_revenue':
        return caps.analyzeRevenue(context);

      case 'check_performance':
        return caps.checkPerformance(context);

      case 'identify_priorities':
        return caps.identifyPriorities(context);

      case 'read_internal_data':
      case 'analyze_data':
        return caps.readInternalData(context);

      case 'analyze_pipeline':
        return caps.identifyPriorities(context); // reuse pipeline view

      case 'analyze_workforce':
        return caps.checkPerformance(context);   // reuse workforce view

      case 'create_recommendation':
        return agentResult.completed({
          agent:   this.slug,
          action,
          result:  {
            demoMode:    true,
            _notice:     'DEMO DATA',
            recommendations: [
              'Approve pending outreach drafts in Approvals section.',
              'Set up PostgreSQL to enable live business intelligence.',
              'Define service catalog and pricing for proposal generation.',
              'Establish weekly revenue review cadence.',
            ],
          },
          traceId: context.traceId,
        });

      default:
        return agentResult.failed({
          agent:   this.slug,
          action,
          error:   `Action "${action}" reached executeAction but is not handled. This is a bug.`,
          traceId: context.traceId,
        });
    }
  }
}

// Export singleton
const founderPA = new FounderPA();
module.exports = founderPA;

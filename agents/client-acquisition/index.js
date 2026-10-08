/**
 * RealtySprint AI — Client Acquisition Agent
 * agents/client-acquisition/index.js
 *
 * Business growth and sales agent.
 * Discovers, qualifies, and prepares leads for the Founder.
 * All external communications require explicit Founder approval.
 */
'use strict';

const BaseAgent   = require('../core/agentBase');
const agentResult = require('../core/agentResult');
const config      = require('./config');
const caps        = require('./capabilities');

class ClientAcquisition extends BaseAgent {
  constructor() {
    super(config);
  }

  getSupportedActions() {
    return caps.SUPPORTED_ACTIONS;
  }

  /**
   * Override approval draft to provide richer CA context.
   */
  async createApprovalDraft(action, context) {
    return caps.createApprovalDraftForCA(action, context);
  }

  async executeAction(action, context) {
    switch (action) {
      case 'qualify_lead':
      case 'score_lead':
        return caps.qualifyLead(context);

      case 'create_draft':
        return caps.createDraft(context);

      case 'analyze_pipeline':
        return caps.analyzePipeline(context);

      case 'prepare_conversation':
        return caps.prepareConversation(context);

      case 'read_internal_data':
      case 'analyze_data':
        return agentResult.completed({
          agent:   this.slug,
          action,
          result:  {
            demoMode: true,
            _notice:  'DEMO DATA — Connect live database for real pipeline data.',
            pipeline: {
              totalLeads:       5,
              qualified:        3,
              awaitingApproval: 2,
              rejected:         0,
            },
          },
          traceId: context.traceId,
        });

      case 'create_recommendation':
        return agentResult.completed({
          agent:   this.slug,
          action,
          result:  {
            demoMode:        true,
            _notice:         'DEMO DATA',
            recommendations: [
              'Expand lead sources to LinkedIn and direct referrals.',
              'Review qualification criteria to increase qualified lead volume.',
              'Approve 2 pending outreach drafts to advance top leads.',
              'Schedule prospect research session for 10 new Dubai agencies.',
            ],
          },
          traceId: context.traceId,
        });

      case 'detect_duplicates':
        return agentResult.completed({
          agent:   this.slug,
          action,
          result:  {
            demoMode:    true,
            _notice:     'DEMO DATA',
            duplicates:  [],
            message:     'No duplicate leads detected in demo dataset.',
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
const clientAcquisition = new ClientAcquisition();
module.exports = clientAcquisition;

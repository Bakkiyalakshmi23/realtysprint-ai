/**
 * RealtySprint AI — Client Acquisition Agent: Capabilities
 * agents/client-acquisition/capabilities.js
 *
 * Defines the supported actions and their demo implementations.
 * Clearly labeled DEMO DATA throughout.
 *
 * External communication actions (send_email, send_whatsapp etc.)
 * are NOT in this list — they route through permissionPolicy to
 * pending_approval and are handled by BaseAgent.createApprovalDraft().
 */
'use strict';

const agentResult = require('../core/agentResult');
const config      = require('./config');
const { analyze } = require('../../backend/ai/analysis');

// ─── Supported actions ────────────────────────────────────────────────────────

const SUPPORTED_ACTIONS = [
  'qualify_lead',
  'score_lead',
  'create_draft',        // proposal draft, follow-up draft (DEMO only)
  'read_internal_data',
  'analyze_data',
  'analyze_pipeline',
  'create_recommendation',
  'detect_duplicates',
  'prepare_conversation',
  // Approval-required actions (handled by BaseAgent lifecycle):
  'send_email',
  'send_whatsapp',
  'send_linkedin',
  'send_proposal',
  'send_follow_up',
  'external_communication',
];

// ─── Demo lead data ────────────────────────────────────────────────────────

const DEMO_LEAD = {
  _dataLabel:  'DEMO DATA',
  company:     'ABC Properties LLC',
  contact:     'Tariq Al Hashimi',
  location:    'Downtown Dubai',
  source:      'Bayut Portal',
  industry:    'Real Estate',
  description: 'High-traffic agency with 2BR Downtown Dubai listings.',
};

// ─── Qualification scoring logic (deterministic, no ML) ──────────────────────

function calculateLeadScore(lead) {
  let score = 50; // base

  if (lead.source === 'Bayut Portal' || lead.source === 'Property Finder') score += 15;
  if (lead.industry === 'Real Estate') score += 10;
  if (lead.location && (lead.location.includes('Dubai') || lead.location.includes('Abu Dhabi'))) score += 10;
  if (lead.contact) score += 5;
  if (lead.description && lead.description.length > 20) score += 9;

  return Math.min(score, 100);
}

// ─── Action handlers ──────────────────────────────────────────────────────────

async function qualifyLead(context) {
  const lead  = context.input?.lead || DEMO_LEAD;
  const score = Math.max(0, Math.min(100, Number(context.input?.score ?? calculateLeadScore(lead)) || 0));

  const qualified   = score >= 70;
  const nextAction  = qualified
    ? 'Prepare personalised outreach and submit for Founder approval.'
    : 'Monitor for 7 days. Re-qualify if additional information becomes available.';
  const fallback = {
    qualification: qualified ? 'qualified' : 'needs_more_information',
    score,
    reasons: [qualified ? `Score ${score}/100 meets the demo qualification threshold.` : `Score ${score}/100 is below the demo qualification threshold.`],
    missing_information: [
      ...(!lead.contact ? ['Decision-maker contact'] : []),
      ...(!lead.description ? ['Specific business need and requirements'] : []),
      ...(!lead.website ? ['Company website and current digital presence'] : []),
    ],
    recommended_next_step: nextAction,
    risks: [lead.source && /portal/i.test(lead.source) ? 'Portal-provided information has not been independently verified.' : 'Lead information has not been independently verified.'],
  };
  const ai = await analyze({
    useAI: context.input?.useAI,
    schemaName: 'lead_qualification',
    systemPrompt: 'Qualify this business lead for a company selling websites, AI automation, custom solutions, and growth automation. Use the supplied facts only. Score 0-100; identify missing data and risks.',
    input: { lead: { company: lead.company || lead.name || 'Unknown', has_decision_maker_contact: Boolean(lead.contact), location: lead.location || null, source: lead.source || null, industry: lead.industry || null, description: lead.description || null, website: lead.website || null } },
    fallback,
  });
  const qualification = ai.output;

  return agentResult.completed({
    agent:   config.slug,
    action:  'qualify_lead',
    result:  {
      demoMode:         context.demoMode,
      dataQuality:      context.demoMode ? 'DEMO' : 'USER-PROVIDED',
      _notice:          context.demoMode ? 'DEMO DATA — lead values and deterministic scoring are for demonstration.' : 'Lead data was evaluated; verify all supplied details.',
      aiStatus:         ai.aiStatus,
      lead:             lead.company || lead.name || 'Unknown Lead',
      contact:          lead.contact || 'Unknown',
      qualification,
      score: qualification.score,
      scoreTier: qualification.score >= 85 ? 'HIGH' : qualification.score >= 70 ? 'MEDIUM' : 'LOW',
      qualified: qualification.qualification === 'qualified',
      qualificationReason: qualification.reasons.join(' '),
      recommendedNextAction: qualification.recommended_next_step,
      approvalRequired: false,
    },
    traceId: context.traceId,
  });
}

async function createDraft(context) {
  const draftType = context.input?.draftType || 'proposal';
  const lead      = context.input?.lead      || DEMO_LEAD;

  if (draftType === 'follow-up') {
    const fallback = {
      channel: context.input?.channel || 'email',
      objective: 'Confirm the prospect’s interest and agree on a next conversation.',
      message: `Hello ${lead.contact || 'there'},\n\nI’m following up on our conversation about how RealtySprint AI could support ${lead.company || 'your business'}. Would you be available for a short call this week to discuss your priorities?\n\nBest regards,\nRealtySprint AI`,
      timing: 'Within 2 business days after the last recorded conversation.',
      reason: 'A timely follow-up can clarify requirements and the next step.',
    };
    const ai = await analyze({
      useAI: context.input?.useAI, schemaName: 'follow_up_draft',
      systemPrompt: 'Prepare a concise follow-up draft. Do not send it, imply it was sent, or make unsupported claims. Keep the message professional.',
      input: { lead: { company: lead.company || lead.name || 'Unknown' }, channel: fallback.channel, conversation_notes: context.input?.conversationNotes || '' },
      fallback,
    });
    return agentResult.completed({
      agent: config.slug, action: 'create_draft', traceId: context.traceId,
      result: { demoMode: true, draftType, status: 'draft', sent: false, aiStatus: ai.aiStatus, _notice: 'DEMO DRAFT — not sent. Founder approval is required before external communication.', draft: ai.output },
    });
  }

  const requirementList = Array.isArray(context.input?.requirements) ? context.input.requirements : [lead.description || 'Requirements interview needed before scope confirmation.'];
  const fallbackProposal = {
    client: lead.company || lead.name || 'Unknown prospect',
    requirements: requirementList,
    recommended_solution: 'Discovery first, then scope a suitable website, AI automation, custom solution, or growth automation package.',
    scope: ['Discovery and requirements confirmation', 'Solution design and delivery plan to be agreed after discovery'],
    pricing: { amount: null, currency: context.input?.currency || 'INR', note: 'Founder pricing input required; no price has been invented.' },
    assumptions: ['Requirements, timeline, integrations, and acceptance criteria are not yet confirmed.'],
    risks: ['Pricing and delivery estimate remain unconfirmed until discovery is complete.'],
    next_step: 'Founder reviews and confirms scope and pricing before sharing with the prospect.',
  };
  const ai = await analyze({
    useAI: context.input?.useAI, schemaName: 'proposal_draft',
    systemPrompt: 'Prepare an internal proposal draft for a digital services company. Do not invent pricing, availability, dates, commitments, client requirements, or send the proposal. If price is unknown, amount must be null and the note must request Founder input.',
    input: { lead: { company: lead.company || lead.name || 'Unknown', location: lead.location || null }, requirements: requirementList, approved_pricing: context.input?.approvedPricing || null, service_options: ['website', 'AI automation', 'custom software', 'business growth automation'] },
    fallback: fallbackProposal,
  });

  return agentResult.completed({
    agent:   config.slug,
    action:  'create_draft',
    result:  {
      demoMode: true,
      _notice:  'DEMO DATA — Structured proposal created. NOT sent. Founder review is required before sharing.',
      draftType,
      lead:     lead.company || lead.name || 'Unknown',
      status: 'pending_approval',
      sent: false,
      aiStatus: ai.aiStatus,
      draft: ai.output,
    },
    traceId: context.traceId,
  });
}

async function analyzePipeline(context) {
  return agentResult.completed({
    agent:   config.slug,
    action:  'analyze_pipeline',
    result:  {
      demoMode:  true,
      _notice:   'DEMO DATA — Connect live pipeline for real analysis.',
      summary: {
        totalLeads:         5,
        qualified:          3,
        awaitingApproval:   2,
        inReview:           1,
        rejected:           0,
        clientsWon:         0,
        avgScore:           87.6,
        topLead:            'ABC Properties LLC (Score: 94/100)',
      },
      recommendations: [
        'Approve 2 pending outreach drafts to advance top leads.',
        'Increase lead volume — target is 20 qualified leads per week.',
        'Add new lead sources beyond Bayut and Property Finder.',
      ],
    },
    traceId: context.traceId,
  });
}

async function prepareConversation(context) {
  const lead = context.input?.lead || DEMO_LEAD;
  return agentResult.completed({
    agent:   config.slug,
    action:  'prepare_conversation',
    result:  {
      demoMode: true,
      _notice:  'DEMO DATA — Conversation brief prepared.',
      lead:     lead.company || 'Unknown Lead',
      brief: {
        opening:     `Introduce RealtySprint AI and how we help real estate agencies grow with technology.`,
        keyQuestions: [
          'What are your current challenges with client acquisition?',
          'Are you using any automation or AI tools today?',
          'What does your website and online presence look like?',
          'What is your current monthly lead volume and conversion rate?',
          'What budget range are you working with for technology solutions?',
        ],
        valueProposition: 'RealtySprint AI helps real estate agencies build websites, automate lead qualification, and use AI to grow revenue.',
        targetOutcome:    'Understand requirements and schedule a solution presentation.',
      },
    },
    traceId: context.traceId,
  });
}

async function createApprovalDraftForCA(action, context) {
  const lead = context.input?.lead || DEMO_LEAD;

  return {
    action,
    recipient:   lead.contact   || 'Unknown',
    company:     lead.company   || 'Unknown',
    channel:     action.replace('send_', ''),
    draftContent: `[DEMO DRAFT] This ${action} message for ${lead.company || 'the lead'} has been prepared by the Client Acquisition Agent. Full draft content would be generated here. Requires Founder approval before sending.`,
    riskLevel:   'medium',
    estimatedValue: 'DATA NOT AVAILABLE',
    _notice:     'This action requires Founder approval. The message has NOT been sent.',
    demoMode:    context.demoMode,
  };
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  SUPPORTED_ACTIONS,
  qualifyLead,
  createDraft,
  analyzePipeline,
  prepareConversation,
  createApprovalDraftForCA,
};

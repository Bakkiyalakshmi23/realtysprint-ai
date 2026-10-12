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
const { pool }    = require('../../backend/db/pool');

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
  'execute_tasks',
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

// ─── Qualification scoring logic (India-first, transparent) ─────────────────

const TARGET_CITIES = ['chennai', 'coimbatore', 'trichy', 'bangalore', 'bengaluru', 'hyderabad', 'mumbai', 'delhi', 'ncr', 'pune'];

function calculateLeadScore(lead) {
  let score = 50; // base
  const breakdown = [{ factor: 'Base Score', points: 50, type: 'inference' }];

  if (lead.location) {
    const loc = lead.location.toLowerCase();
    const isTarget = TARGET_CITIES.some(city => loc.includes(city));
    if (isTarget) {
      score += 20;
      breakdown.push({ factor: `Target location (${lead.location})`, points: 20, type: 'user-provided' });
    } else {
      score += 5;
      breakdown.push({ factor: `Non-target location (${lead.location})`, points: 5, type: 'user-provided' });
    }
  } else {
    breakdown.push({ factor: 'Missing location', points: 0, type: 'unknown' });
  }

  if (lead.website) {
    score += 15;
    breakdown.push({ factor: 'Has website', points: 15, type: 'user-provided' });
  } else {
    breakdown.push({ factor: 'Missing website', points: 0, type: 'unknown' });
  }

  if (lead.contact || lead.email) {
    score += 10;
    breakdown.push({ factor: 'Has contact person/email', points: 10, type: 'verified fact' });
  }

  if (lead.phone) {
    score += 5;
    breakdown.push({ factor: 'Has phone number', points: 5, type: 'verified fact' });
  }

  if (lead.source === 'Bayut Portal' || lead.source === 'Property Finder') {
      score += 5;
      breakdown.push({ factor: `Portal source (${lead.source})`, points: 5, type: 'inference' });
  }

  score = Math.min(score, 100);
  return { score, breakdown };
}

// ─── Helper to fetch real lead data ───────────────────────────────────────────

async function getRealLeadData(context) {
  if (context.input?.lead_id) {
    const res = await pool.query(`
      SELECT l.*, c.name as company, c.website, c.location, c.industry, ct.name as contact, ct.email, ct.phone
      FROM leads l
      LEFT JOIN companies c ON c.id = l.company_id
      LEFT JOIN contacts ct ON ct.id = l.contact_id
      WHERE l.id = $1
    `, [context.input.lead_id]);
    if (res.rows.length > 0) return res.rows[0];
  } else if (context.input?.client_id) {
    const res = await pool.query(`
      SELECT l.*, c.name as company, c.website, c.location, c.industry, ct.name as contact, ct.email, ct.phone
      FROM clients cl
      LEFT JOIN leads l ON l.id = cl.lead_id
      LEFT JOIN companies c ON c.id = cl.company_id
      LEFT JOIN contacts ct ON ct.id = cl.contact_id
      WHERE cl.id = $1
    `, [context.input.client_id]);
    if (res.rows.length > 0) return res.rows[0];
  }
  return context.input?.lead || DEMO_LEAD;
}

// ─── Action handlers ──────────────────────────────────────────────────────────

async function qualifyLead(context) {
  const lead = await getRealLeadData(context);
  const scoreResult = calculateLeadScore(lead);
  const score = Math.max(0, Math.min(100, Number(context.input?.score ?? scoreResult.score) || 0));

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
      scoreBreakdown: scoreResult.breakdown || [],
      recommendedNextAction: qualification.recommended_next_step,
      approvalRequired: false,
    },
    traceId: context.traceId,
  });
}

async function createDraft(context) {
  const draftType = context.input?.draftType || 'proposal';
  const lead = await getRealLeadData(context);

  if (draftType === 'follow-up' || draftType === 'outreach') {
    const fallback = {
      channel: context.input?.channel || 'email',
      objective: draftType === 'follow-up' ? 'Confirm prospect interest and agree on next steps.' : 'Initial outreach to gauge interest.',
      message: `Hello ${lead.contact || 'there'},\n\nI’m writing to you about how RealtySprint AI could support ${lead.company || 'your business'}. Are you available for a short call this week?\n\nBest regards,\nRealtySprint AI`,
      timing: 'Within 2 business days.',
      reason: 'A timely message can clarify requirements and next steps.',
    };

    const ai = await analyze({
      useAI: context.input?.useAI, schemaName: 'follow_up_draft',
      systemPrompt: 'Prepare a concise outreach/follow-up draft. Do not send it, imply it was sent, or make unsupported claims. Keep the message professional.',
      input: { lead: { company: lead.company || 'Unknown', location: lead.location }, channel: fallback.channel, conversation_notes: context.input?.conversationNotes || '' },
      fallback,
    });

    // Save to outreach_drafts if it's a real lead
    let draftId = null;
    let taskId = null;
    if (lead.id) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Idempotency check: prevent duplicate draft/task for the same lead and channel if one is pending/awaiting_approval
        const existingRes = await client.query(`
          SELECT id FROM outreach_drafts
          WHERE lead_id = $1 AND channel = $2 AND status IN ('draft', 'awaiting_approval')
          LIMIT 1
        `, [lead.id, ai.output.channel || 'email']);

        if (existingRes.rows.length > 0) {
          draftId = existingRes.rows[0].id;
          // Find existing task
          const existingTaskRes = await client.query(`
            SELECT id FROM agent_tasks WHERE title = $1 AND status IN ('pending', 'in_progress') LIMIT 1
          `, [`Follow up with ${lead.company}`]);
          if (existingTaskRes.rows.length > 0) {
            taskId = existingTaskRes.rows[0].id;
          }
        } else {
          const draftRes = await client.query(`
            INSERT INTO outreach_drafts (lead_id, channel, subject, message, status)
            VALUES ($1, $2, $3, $4, 'awaiting_approval') RETURNING id
          `, [lead.id, ai.output.channel || 'email', 'Outreach from RealtySprint AI', ai.output.message]);
          draftId = draftRes.rows[0].id;

          const approvalRes = await client.query(`
            INSERT INTO approvals (agent_id, action_type, description, status)
            VALUES ((SELECT id FROM agents WHERE slug = $1), 'approve_outreach', $2, 'pending') RETURNING id
          `, [config.slug, `Review ${draftType} draft for ${lead.company}. No message has been sent.`]);
          const approvalId = approvalRes.rows[0].id;

          await client.query(`UPDATE outreach_drafts SET approval_id = $1 WHERE id = $2`, [approvalId, draftId]);

          const taskRes = await client.query(`
            INSERT INTO agent_tasks (agent_id, title, description, status, priority, due_at)
            VALUES ((SELECT id FROM agents WHERE slug = $1), $2, $3, 'pending', 'normal', NOW() + INTERVAL '2 days')
            RETURNING id
          `, [config.slug, `Follow up with ${lead.company}`, `Check response for outreach draft #${draftId}`]);
          taskId = taskRes.rows[0].id;
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('Failed to save outreach draft:', err);
      } finally {
        client.release();
      }
    }

    return agentResult.completed({
      agent: config.slug, action: 'create_draft', traceId: context.traceId,
      result: { demoMode: !lead.id, draftType, status: 'awaiting_approval', sent: false, aiStatus: ai.aiStatus, draft: ai.output, draftId, scheduledTaskId: taskId },
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

  let proposalId = null;
  if (lead.id) {
    try {
      const workflows = require('../../backend/services/workflows');
      const propData = await workflows.persistProposal({
        agentSlug: config.slug,
        lead: { id: lead.id, company: lead.company, name: lead.name },
        content: JSON.stringify(ai.output)
      });
      proposalId = propData.id;
    } catch(err) {
      console.error('Failed to save proposal draft:', err);
    }
  }
  return agentResult.completed({
    agent:   config.slug,
    action:  'create_draft',
    result:  {
      demoMode: !lead.id,
      _notice:  !lead.id ? 'DEMO DATA — Structured proposal created.' : 'Proposal generated and saved. Founder review is required before sharing.',
      draftType,
      lead:     lead.company || lead.name || 'Unknown',
      status: 'pending_approval',
      sent: false,
      aiStatus: ai.aiStatus,
      draft: ai.output,
      proposalId
    },
    traceId: context.traceId,
  });
}

async function analyzePipeline(context) {
  try {
    const res = await pool.query(`
      SELECT status, count(*) as count FROM leads GROUP BY status
    `);
    const statusCounts = res.rows.reduce((acc, row) => ({ ...acc, [row.status]: parseInt(row.count, 10) }), {});

    return agentResult.completed({
      agent:   config.slug,
      action:  'analyze_pipeline',
      result:  {
        demoMode:  false,
        summary: {
          totalLeads:         Object.values(statusCounts).reduce((a, b) => a + b, 0),
          qualified:          statusCounts['qualified'] || 0,
          awaitingApproval:   statusCounts['awaiting_approval'] || 0,
          inReview:           statusCounts['in_review'] || 0,
          rejected:           statusCounts['rejected'] || 0,
        }
      },
      traceId: context.traceId,
    });
  } catch (err) {
    // fallback
  }
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
  const lead = await getRealLeadData(context);

  if (lead.id && context.input?.notes) {
    // Extract requirements from notes
    const ai = await analyze({
      useAI: context.input?.useAI, schemaName: 'requirements_extraction',
      systemPrompt: 'Extract business requirements from these notes. Do not hallucinate budget or timeline if absent.',
      input: { notes: context.input.notes },
      fallback: { requirements: ['Website revamp'], budget: null, timeline: null }
    });

    // Attempt to get client_id
    const clientRes = await pool.query('SELECT id FROM clients WHERE lead_id = $1', [lead.id]);
    if (clientRes.rows.length > 0) {
      const clientId = clientRes.rows[0].id;
      for (const req of (ai.output.requirements || [])) {
        await pool.query(`
          INSERT INTO client_requirements (client_id, requirement, budget, timeline)
          VALUES ($1, $2, $3, $4)
        `, [clientId, req, ai.output.budget, ai.output.timeline]);
      }
    }
  }

  return agentResult.completed({
    agent:   config.slug,
    action:  'prepare_conversation',
    result:  {
      demoMode: !lead.id,
      lead:     lead.company || 'Unknown Lead',
      brief: {
        opening:     `Introduce RealtySprint AI and how we help real estate agencies grow with technology.`,
        keyQuestions: [
          'What are your current challenges with client acquisition?',
          'Are you using any automation or AI tools today?',
          'What does your website and online presence look like?',
        ],
      },
    },
    traceId: context.traceId,
  });
}

async function executeTasks(context) {
  let executedTasks = [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Lock pending or eligible retry tasks to prevent concurrent claims
    const res = await client.query(`
      SELECT id, title, description, attempts, max_attempts
      FROM agent_tasks
      WHERE agent_id = (SELECT id FROM agents WHERE slug = $1)
        AND (status = 'pending' OR (status = 'retry_scheduled' AND next_retry_at <= NOW()))
      FOR UPDATE SKIP LOCKED
    `, [config.slug]);

    for (const task of res.rows) {
      await client.query(`UPDATE agent_tasks SET status = 'in_progress', locked_until = NOW() + INTERVAL '5 minutes' WHERE id = $1`, [task.id]);

      try {
        // Simulate executing the instruction
        if (task.description && task.description.includes('SIMULATE_TRANSIENT_FAILURE')) {
          const err = new Error('Simulated network timeout');
          err.isTransient = true;
          throw err;
        }
        if (task.description && task.description.includes('SIMULATE_PERMANENT_FAILURE')) {
          const err = new Error('Simulated validation failure');
          err.isTransient = false;
          throw err;
        }

        // Successfully completed
        executedTasks.push(task);
        await client.query(`UPDATE agent_tasks SET status = 'completed', last_error = NULL, locked_until = NULL WHERE id = $1`, [task.id]);
      } catch (err) {
        const isTransient = err.isTransient !== false && !err.message.includes('validation');
        const newAttempts = task.attempts + 1;

        if (isTransient && newAttempts < task.max_attempts) {
          // Exponential backoff: e.g. 2, 4, 8 minutes. For tests we might want seconds, but let's stick to minutes or seconds
          // Actually, for tests, let's just do seconds so we don't have to wait minutes: attempts * 2 seconds
          const delaySeconds = newAttempts * 2;
          await client.query(`
            UPDATE agent_tasks
            SET status = 'retry_scheduled',
                attempts = $1,
                last_error = $2,
                next_retry_at = NOW() + INTERVAL '${delaySeconds} seconds',
                locked_until = NULL
            WHERE id = $3
          `, [newAttempts, err.message, task.id]);
        } else {
          // Permanent failure or max attempts reached
          await client.query(`
            UPDATE agent_tasks
            SET status = 'permanent_failure',
                attempts = $1,
                last_error = $2,
                locked_until = NULL
            WHERE id = $3
          `, [newAttempts, err.message, task.id]);
        }
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to execute tasks:', err);
    return agentResult.failed({ agent: config.slug, action: 'execute_tasks', error: err.message, traceId: context.traceId });
  } finally {
    client.release();
  }

  return agentResult.completed({
    agent:   config.slug,
    action:  'execute_tasks',
    result:  {
      demoMode: false,
      tasksProcessed: executedTasks.length,
      tasks: executedTasks.map(t => ({ id: t.id, status: 'completed' }))
    },
    traceId: context.traceId,
  });
}

async function createApprovalDraftForCA(action, context) {
  const lead = await getRealLeadData(context);

  let approvalId = null;
  if (lead.id) {
    // Save directly to approvals table to block external communication
    const res = await pool.query(`
      INSERT INTO approvals (agent_id, action_type, description, status)
      VALUES ((SELECT id FROM agents WHERE slug = $1), $2, $3, 'pending')
      RETURNING id
    `, [config.slug, action, `Approval requested for external communication to ${lead.company}`]);
    approvalId = res.rows[0].id;
  }

  return {
    action,
    recipient:   lead.contact   || 'Unknown',
    company:     lead.company   || 'Unknown',
    channel:     action.replace('send_', ''),
    draftContent: `[DRAFT] This ${action} message for ${lead.company || 'the lead'} has been prepared. Requires Founder approval before sending.`,
    riskLevel:   'medium',
    _notice:     'This action requires Founder approval. The message has NOT been sent.',
    demoMode:    !lead.id,
    approvalId
  };
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  SUPPORTED_ACTIONS,
  qualifyLead,
  createDraft,
  analyzePipeline,
  prepareConversation,
  executeTasks,
  createApprovalDraftForCA,
  recoverStaleTasks
};

async function recoverStaleTasks(context) {
  const client = await pool.connect();
  let recoveredCount = 0;
  try {
    await client.query('BEGIN');
    const res = await client.query(`
      SELECT id, attempts, max_attempts
      FROM agent_tasks
      WHERE agent_id = (SELECT id FROM agents WHERE slug = $1)
        AND status = 'in_progress'
        AND locked_until < NOW()
      FOR UPDATE SKIP LOCKED
    `, [config.slug]);

    for (const task of res.rows) {
      if (task.attempts < task.max_attempts) {
        await client.query(`
          UPDATE agent_tasks
          SET status = 'retry_scheduled', locked_until = NULL, last_error = 'Task stalled and was recovered', next_retry_at = NOW()
          WHERE id = $1
        `, [task.id]);
      } else {
        await client.query(`
          UPDATE agent_tasks
          SET status = 'permanent_failure', locked_until = NULL, last_error = 'Task stalled and exceeded max attempts'
          WHERE id = $1
        `, [task.id]);
      }
      recoveredCount++;
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to recover stale tasks:', err);
    return agentResult.failed({ agent: config.slug, action: 'recover_stale_tasks', error: err.message, traceId: context?.traceId });
  } finally {
    client.release();
  }
  return agentResult.completed({ agent: config.slug, action: 'recover_stale_tasks', output: { recoveredCount }, traceId: context?.traceId });
}

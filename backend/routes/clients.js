/**
 * GET /api/clients
 * Returns client intelligence list and 360 view.
 * Queries DB. Does NOT fall back to demo data for this milestone to enforce real intelligence gathering.
 */

const express    = require('express');
const router     = express.Router();
const { pool }   = require('../db/pool');
const { requireAuth } = require('../middleware/authMiddleware');

// Helper to check DB connectivity
async function checkDB() {
  const client = await pool.connect();
  client.release();
  return true;
}

// ─── 1. LIST CLIENTS (GET /api/clients) ──────────────────────────────────────
router.get('/', requireAuth, async (req, res, next) => {
  try {
    await checkDB();

    // Fetch the client list with basic intelligence joined
    const clientsResult = await pool.query(`
      SELECT 
        c.id,
        c.status AS "clientStatus",
        comp.name AS "company",
        cont.name AS "contact",
        l.source,
        l.score,
        l.status AS "leadStatus",
        cp.stage,
        cp.expected_revenue AS "expectedRevenue",
        cp.currency,
        cp.probability,
        cp.next_action AS "nextAction",
        (
          SELECT status 
          FROM dedupe_candidates dc 
          WHERE dc.client_id = c.id OR dc.possible_duplicate_client_id = c.id
          ORDER BY dc.created_at DESC LIMIT 1
        ) AS "duplicateStatus"
      FROM clients c
      LEFT JOIN leads l ON l.id = c.lead_id
      LEFT JOIN companies comp ON comp.id = c.company_id
      LEFT JOIN contacts cont ON cont.id = c.contact_id
      LEFT JOIN client_pipeline cp ON cp.client_id = c.id
      ORDER BY c.created_at DESC
    `);

    const data = clientsResult.rows;

    // Aggregate summary metrics
    const summary = {
      totalClients: data.length,
      active: data.filter(d => d.clientStatus === 'active').length,
      prospects: data.filter(d => d.stage === 'prospect').length,
      qualified: data.filter(d => d.stage === 'qualified').length,
      proposal: data.filter(d => d.stage === 'proposal').length,
      won: data.filter(d => d.stage === 'won').length,
      duplicateReview: data.filter(d => d.duplicateStatus === 'pending_review').length,
    };

    return res.json({
      success: true,
      source: 'database',
      count: data.length,
      summary,
      data,
    });
  } catch (err) {
    console.error('[clients] DB unavailable:', err.message);
    return res.status(503).json({ success: false, error: 'Database unavailable. Real client intelligence requires a live database connection.', source: 'database_error' });
  }
});


// ─── 2. CLIENT 360 VIEW (GET /api/clients/:id) ────────────────────────────────
router.get('/:id', requireAuth, async (req, res, next) => {
  const clientId = parseInt(req.params.id, 10);
  if (isNaN(clientId)) return res.status(400).json({ success: false, error: 'Invalid client ID' });

  try {
    await checkDB();

    // 1. Fetch core client + company + contact + lead record
    const clientResult = await pool.query(`
      SELECT 
        c.id, c.status AS "clientStatus", c.handed_over_at AS "handedOverAt", c.created_at AS "createdAt",
        comp.name AS "companyName", comp.website, comp.location, comp.industry,
        cont.name AS "contactName", cont.email, cont.phone, cont.job_title AS "jobTitle", cont.linkedin_url AS "linkedinUrl",
        l.source AS "leadSource", l.status AS "leadStatus", l.score, l.qualification, l.notes
      FROM clients c
      LEFT JOIN leads l ON l.id = c.lead_id
      LEFT JOIN companies comp ON comp.id = c.company_id
      LEFT JOIN contacts cont ON cont.id = c.contact_id
      WHERE c.id = $1
    `, [clientId]);

    if (clientResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Client not found' });
    }

    const core = clientResult.rows[0];

    // 2. Fetch Sources
    const sourcesResult = await pool.query(`
      SELECT source_type AS "sourceType", source_reference AS "sourceReference", discovered_at AS "discoveredAt"
      FROM client_sources WHERE client_id = $1 ORDER BY discovered_at ASC
    `, [clientId]);

    // 3. Fetch Requirements
    const reqsResult = await pool.query(`
      SELECT requirement, priority, budget, currency, timeline, status
      FROM client_requirements WHERE client_id = $1 ORDER BY created_at DESC
    `, [clientId]);

    // 4. Fetch Interactions
    const interactionsResult = await pool.query(`
      SELECT channel, direction, interaction_type AS "interactionType", content, status, requires_approval AS "requiresApproval", created_by AS "createdBy", created_at AS "createdAt"
      FROM client_interactions WHERE client_id = $1 ORDER BY created_at DESC
    `, [clientId]);

    // 5. Fetch Pipeline
    const pipelineResult = await pool.query(`
      SELECT stage, expected_revenue AS "expectedRevenue", currency, probability, next_action AS "nextAction", next_action_at AS "nextActionAt"
      FROM client_pipeline WHERE client_id = $1 ORDER BY created_at DESC LIMIT 1
    `, [clientId]);

    // 6. Fetch Duplicate Intelligence
    const dupesResult = await pool.query(`
      SELECT 
        dc.id,
        dc.possible_duplicate_client_id AS "duplicateClientId",
        comp.name AS "duplicateCompanyName",
        dc.match_type AS "matchType",
        dc.match_score AS "matchScore",
        dc.status,
        dc.reviewed_by AS "reviewedBy",
        dc.reviewed_at AS "reviewedAt"
      FROM dedupe_candidates dc
      LEFT JOIN clients c ON c.id = dc.possible_duplicate_client_id
      LEFT JOIN companies comp ON comp.id = c.company_id
      WHERE dc.client_id = $1 OR dc.possible_duplicate_client_id = $1
    `, [clientId]);

    // 7. Fetch Merge History
    const mergeResult = await pool.query(`
      SELECT canonical_client_id AS "canonicalId", merged_client_id AS "mergedId", reason, merged_by AS "mergedBy", created_at AS "createdAt"
      FROM client_merge_history
      WHERE canonical_client_id = $1 OR merged_client_id = $1
      ORDER BY created_at DESC
    `, [clientId]);

    // 8. Fetch Activity Timeline
    const activityResult = await pool.query(`
      SELECT actor_type AS "actorType", action, description, metadata, created_at AS "createdAt"
      FROM client_activity WHERE client_id = $1 ORDER BY created_at DESC
    `, [clientId]);

    // 9. Fetch Revenue
    const revenueResult = await pool.query(`
      SELECT amount, currency, recognition_status AS "recognitionStatus", received_at AS "receivedAt"
      FROM revenue_records WHERE client_id = $1
    `, [clientId]);

    let actualRevenue = 0;
    let expectedRevenue = pipelineResult.rows.length ? Number(pipelineResult.rows[0].expectedRevenue || 0) : 0;
    let revCurrency = pipelineResult.rows.length ? pipelineResult.rows[0].currency : 'INR';

    revenueResult.rows.forEach(r => {
       if (r.recognitionStatus === 'actual') actualRevenue += Number(r.amount);
    });

    const payload = {
      client: {
        id: core.id,
        status: core.clientStatus,
        handedOverAt: core.handedOverAt,
        createdAt: core.createdAt,
      },
      company: {
        name: core.companyName,
        website: core.website,
        location: core.location,
        industry: core.industry,
      },
      contact: {
        name: core.contactName,
        email: core.email,
        phone: core.phone,
        jobTitle: core.jobTitle,
        linkedinUrl: core.linkedinUrl,
      },
      leadIntelligence: {
        source: core.leadSource,
        status: core.leadStatus,
        score: core.score,
        qualification: core.qualification,
        notes: core.notes,
      },
      sources: sourcesResult.rows,
      requirements: reqsResult.rows,
      interactions: interactionsResult.rows,
      pipeline: pipelineResult.rows[0] || null,
      duplicates: dupesResult.rows,
      mergeHistory: mergeResult.rows,
      activities: activityResult.rows,
      revenue: {
        expected: expectedRevenue,
        actual: actualRevenue,
        currency: revCurrency,
      },
    };

    return res.json({ success: true, source: 'database', data: payload });

  } catch (err) {
    console.error(`[clients 360] error fetching client ${clientId}:`, err.message);
    return res.status(503).json({ success: false, error: 'Database unavailable. Cannot retrieve Client 360.' });
  }
});

module.exports = router;

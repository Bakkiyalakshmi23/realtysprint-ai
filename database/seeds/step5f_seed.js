const { pool } = require("../../backend/db/pool");

const DEMO_PREFIX = "step5f-demo:";

async function getOrCreateCompany(client, name, website, location, industry) {
  const existing = await client.query(
    "SELECT id FROM companies WHERE name = $1",
    [name]
  );

  if (existing.rows.length) {
    return existing.rows[0].id;
  }

  const result = await client.query(
    `INSERT INTO companies
      (name, website, location, industry)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [name, website, location, industry]
  );

  return result.rows[0].id;
}

async function getOrCreateContact(
  client,
  companyId,
  name,
  email,
  phone,
  jobTitle,
  linkedinUrl
) {
  const existing = await client.query(
    "SELECT id FROM contacts WHERE email = $1",
    [email]
  );

  if (existing.rows.length) {
    return existing.rows[0].id;
  }

  const result = await client.query(
    `INSERT INTO contacts
      (company_id, name, email, phone, job_title, linkedin_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [companyId, name, email, phone, jobTitle, linkedinUrl]
  );

  return result.rows[0].id;
}

async function createLead(
  client,
  companyId,
  contactId,
  source,
  status,
  score,
  qualification,
  notes
) {
  const result = await client.query(
    `INSERT INTO leads
      (company_id, contact_id, source, status, score, qualification, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      companyId,
      contactId,
      source,
      status,
      score,
      JSON.stringify(qualification),
      notes
    ]
  );

  return result.rows[0].id;
}

async function createClient(
  client,
  leadId,
  companyId,
  contactId,
  status,
  requirements
) {
  const result = await client.query(
    `INSERT INTO clients
      (lead_id, company_id, contact_id, status, requirements)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [
      leadId,
      companyId,
      contactId,
      status,
      JSON.stringify(requirements)
    ]
  );

  return result.rows[0].id;
}

async function seed() {
  const db = await pool.connect();

  try {
    await db.query("BEGIN");

    console.log("[step5f] Cleaning previous Step 5F demo intelligence...");

    await db.query(
      `DELETE FROM client_merge_history
       WHERE metadata->>'demo_prefix' = $1`,
      [DEMO_PREFIX]
    );

    await db.query(
      `DELETE FROM dedupe_candidates
       WHERE client_id IN (
         SELECT client_id FROM client_sources
         WHERE source_reference LIKE $1
       )
       OR possible_duplicate_client_id IN (
         SELECT client_id FROM client_sources
         WHERE source_reference LIKE $1
       )`,
      [`${DEMO_PREFIX}%`]
    );

    await db.query(
      `DELETE FROM client_activity
       WHERE metadata->>'demo_prefix' = $1`,
      [DEMO_PREFIX]
    );

    await db.query(
      `DELETE FROM client_pipeline
       WHERE client_id IN (
         SELECT client_id FROM client_sources
         WHERE source_reference LIKE $1
       )`,
      [`${DEMO_PREFIX}%`]
    );

    await db.query(
      `DELETE FROM client_requirements
       WHERE client_id IN (
         SELECT client_id FROM client_sources
         WHERE source_reference LIKE $1
       )`,
      [`${DEMO_PREFIX}%`]
    );

    await db.query(
      `DELETE FROM client_interactions
       WHERE client_id IN (
         SELECT client_id FROM client_sources
         WHERE source_reference LIKE $1
       )`,
      [`${DEMO_PREFIX}%`]
    );

    await db.query(
      `DELETE FROM client_sources
       WHERE source_reference LIKE $1`,
      [`${DEMO_PREFIX}%`]
    );

    console.log("[step5f] Creating demo companies, contacts and leads...");

    const records = [];

    async function addRecord(data) {
      const companyId = await getOrCreateCompany(
        db,
        data.company,
        data.website,
        data.location,
        data.industry
      );

      const contactId = await getOrCreateContact(
        db,
        companyId,
        data.contact,
        data.email,
        data.phone,
        data.jobTitle,
        data.linkedin
      );

      const leadId = await createLead(
        db,
        companyId,
        contactId,
        data.source,
        data.leadStatus,
        data.score,
        data.qualification,
        data.notes
      );

      const clientId = await createClient(
        db,
        leadId,
        companyId,
        contactId,
        data.clientStatus,
        data.requirements
      );

      await db.query(
        `INSERT INTO client_sources
          (client_id, source_type, source_reference)
         VALUES ($1, $2, $3)`,
        [
          clientId,
          data.source,
          `${DEMO_PREFIX}${data.key}`
        ]
      );

      records.push({
        key: data.key,
        clientId,
        companyId,
        contactId,
        leadId,
        company: data.company
      });

      return clientId;
    }

    // ---------------------------------------------------------
    // 5 MAIN DEMO CLIENTS
    // ---------------------------------------------------------

    const alpha = await addRecord({
      key: "alpha-properties",
      company: "Demo Alpha Properties Dubai",
      website: "https://demo-alpha.example",
      location: "Dubai, UAE",
      industry: "Real Estate Brokerage",
      contact: "Aisha Rahman",
      email: "aisha.alpha@example.test",
      phone: "+971500000101",
      jobTitle: "Managing Director",
      linkedin: "https://example.com/demo-alpha",
      source: "LinkedIn Research",
      leadStatus: "qualified",
      score: 92,
      qualification: {
        budget: "AED 8,000/month",
        leadVolume: "150+ leads/month",
        decisionMaker: true,
        timeline: "30 days"
      },
      notes: "Demo brokerage interested in lead qualification and follow-up automation.",
      clientStatus: "active",
      requirements: {
        service: "AI Lead Qualification",
        channels: ["Website", "WhatsApp"],
        languages: ["English", "Arabic"]
      }
    });

    const skyline = await addRecord({
      key: "skyline-realty",
      company: "Demo Skyline Realty Abu Dhabi",
      website: "https://demo-skyline.example",
      location: "Abu Dhabi, UAE",
      industry: "Real Estate Brokerage",
      contact: "Omar Khalid",
      email: "omar.skyline@example.test",
      phone: "+971500000102",
      jobTitle: "Head of Sales",
      linkedin: "https://example.com/demo-skyline",
      source: "Website Inquiry",
      leadStatus: "proposal",
      score: 88,
      qualification: {
        budget: "AED 6,000/month",
        leadVolume: "100 leads/month",
        decisionMaker: true,
        timeline: "45 days"
      },
      notes: "Demo agency evaluating an AI receptionist and booking automation.",
      clientStatus: "active",
      requirements: {
        service: "Voice AI Receptionist",
        booking: true,
        reminders: true
      }
    });

    const nexus = await addRecord({
      key: "nexus-proptech",
      company: "Demo Nexus PropTech",
      website: "https://demo-nexus.example",
      location: "Dubai, UAE",
      industry: "PropTech",
      contact: "Sara Malik",
      email: "sara.nexus@example.test",
      phone: "+971500000103",
      jobTitle: "Product Director",
      linkedin: "https://example.com/demo-nexus",
      source: "Referral",
      leadStatus: "proposal",
      score: 84,
      qualification: {
        budget: "AED 12,000/month",
        leadVolume: "Enterprise",
        decisionMaker: false,
        timeline: "60 days"
      },
      notes: "Demo PropTech company exploring a custom AI workflow.",
      clientStatus: "active",
      requirements: {
        service: "Custom AI Automation",
        integrations: ["CRM", "Website", "Internal Dashboard"]
      }
    });

    const oasis = await addRecord({
      key: "oasis-management",
      company: "Demo Oasis Property Management",
      website: "https://demo-oasis.example",
      location: "Dubai, UAE",
      industry: "Property Management",
      contact: "Daniel Thomas",
      email: "daniel.oasis@example.test",
      phone: "+971500000104",
      jobTitle: "Operations Manager",
      linkedin: "https://example.com/demo-oasis",
      source: "Outbound Research",
      leadStatus: "new",
      score: 71,
      qualification: {
        budget: "AED 4,000/month",
        leadVolume: "60 leads/month",
        decisionMaker: false,
        timeline: "90 days"
      },
      notes: "Demo property manager at early discovery stage.",
      clientStatus: "active",
      requirements: {
        service: "Follow-up Automation",
        priority: "medium"
      }
    });

    const horizon = await addRecord({
      key: "horizon-developments",
      company: "Demo Horizon Developments",
      website: "https://demo-horizon.example",
      location: "Abu Dhabi, UAE",
      industry: "Property Development",
      contact: "Mariam Hassan",
      email: "mariam.horizon@example.test",
      phone: "+971500000105",
      jobTitle: "Commercial Director",
      linkedin: "https://example.com/demo-horizon",
      source: "Industry Event",
      leadStatus: "won",
      score: 96,
      qualification: {
        budget: "AED 18,000/month",
        leadVolume: "500+ leads/month",
        decisionMaker: true,
        timeline: "14 days"
      },
      notes: "Demo developer that has approved an AI lead operations project.",
      clientStatus: "active",
      requirements: {
        service: "Full AI Lead Operations",
        priority: "high",
        delivery: "14 days"
      }
    });

    // ---------------------------------------------------------
    // 2 DUPLICATE DEMO RECORDS
    // ---------------------------------------------------------

    const alphaDuplicate = await addRecord({
      key: "alpha-properties-duplicate",
      company: "Demo Alpha Properties LLC",
      website: "https://demo-alpha.example",
      location: "Dubai, UAE",
      industry: "Real Estate Brokerage",
      contact: "Aisha Rahman",
      email: "aisha.alpha.duplicate@example.test",
      phone: "+971500000101",
      jobTitle: "Managing Director",
      linkedin: "https://example.com/demo-alpha",
      source: "Website Inquiry",
      leadStatus: "qualified",
      score: 90,
      qualification: {
        duplicateOf: "alpha-properties",
        reason: "Same website and phone"
      },
      notes: "DEMO duplicate candidate.",
      clientStatus: "active",
      requirements: {
        duplicateOf: "Demo Alpha Properties Dubai"
      }
    });

    const skylineDuplicate = await addRecord({
      key: "skyline-realty-duplicate",
      company: "Demo Skyline Real Estate",
      website: "https://demo-skyline.example",
      location: "Abu Dhabi, UAE",
      industry: "Real Estate Brokerage",
      contact: "Omar Khalid",
      email: "omar.skyline.duplicate@example.test",
      phone: "+971500000199",
      jobTitle: "Head of Sales",
      linkedin: "https://example.com/demo-skyline",
      source: "LinkedIn Research",
      leadStatus: "new",
      score: 76,
      qualification: {
        duplicateOf: "skyline-realty",
        reason: "Same website and highly similar company name"
      },
      notes: "DEMO duplicate candidate requiring human review.",
      clientStatus: "active",
      requirements: {
        duplicateOf: "Demo Skyline Realty Abu Dhabi"
      }
    });

    const byKey = key => records.find(r => r.key === key);

    // ---------------------------------------------------------
    // PIPELINE
    // ---------------------------------------------------------

    const pipelines = [
      [alpha, "qualified", 8000, "AED", 70, "Prepare Growth proposal"],
      [skyline, "proposal", 6000, "AED", 75, "Founder review of proposal"],
      [nexus, "negotiation", 12000, "AED", 60, "Clarify integration scope"],
      [oasis, "prospect", 4000, "AED", 30, "Schedule discovery call"],
      [horizon, "won", 18000, "AED", 100, "Begin delivery handover"],
      [alphaDuplicate, "duplicate_review", 8000, "AED", 0, "Review duplicate candidate"],
      [skylineDuplicate, "duplicate_review", 6000, "AED", 0, "Review duplicate candidate"]
    ];

    for (const [
      clientId,
      stage,
      revenue,
      currency,
      probability,
      nextAction
    ] of pipelines) {
      await db.query(
        `INSERT INTO client_pipeline
          (client_id, stage, expected_revenue, currency, probability, next_action, next_action_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '1 day')`,
        [
          clientId,
          stage,
          revenue,
          currency,
          probability,
          nextAction
        ]
      );
    }

    // ---------------------------------------------------------
    // REQUIREMENTS
    // ---------------------------------------------------------

    const requirements = [
      [alpha, "24/7 lead qualification", "high", 8000, "AED", "30 days"],
      [alpha, "WhatsApp follow-up automation", "high", 8000, "AED", "30 days"],
      [skyline, "Voice AI receptionist", "high", 6000, "AED", "45 days"],
      [skyline, "Viewing booking and reminders", "medium", 6000, "AED", "45 days"],
      [nexus, "Custom CRM integration", "high", 12000, "AED", "60 days"],
      [oasis, "Automated lead follow-up", "medium", 4000, "AED", "90 days"],
      [horizon, "End-to-end lead operations", "critical", 18000, "AED", "14 days"]
    ];

    for (const [
      clientId,
      requirement,
      priority,
      budget,
      currency,
      timeline
    ] of requirements) {
      await db.query(
        `INSERT INTO client_requirements
          (client_id, requirement, priority, budget, currency, timeline)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [clientId, requirement, priority, budget, currency, timeline]
      );
    }

    // ---------------------------------------------------------
    // INTERACTIONS
    // ---------------------------------------------------------

    const interactions = [
      [alpha, "email", "outbound", "outreach_draft", "Prepared a qualification outreach draft.", "draft", true, "client-acquisition"],
      [alpha, "whatsapp", "inbound", "client_reply", "Demo client replied requesting a pricing discussion.", "recorded", false, "client-acquisition"],
      [skyline, "email", "outbound", "proposal_draft", "Prepared Growth proposal draft.", "draft", true, "client-acquisition"],
      [skyline, "phone", "inbound", "discovery_call", "Demo client confirmed interest in voice AI.", "completed", false, "client-acquisition"],
      [nexus, "email", "inbound", "requirement_update", "Requested CRM and dashboard integration.", "recorded", false, "client-acquisition"],
      [oasis, "linkedin", "outbound", "outreach_draft", "Prepared first-contact draft.", "draft", true, "client-acquisition"],
      [horizon, "email", "inbound", "proposal_approved", "Demo client approved project scope.", "completed", false, "client-acquisition"],
      [horizon, "internal", "outbound", "handover_preparation", "Prepared delivery handover for Company PA.", "completed", false, "company-pa"]
    ];

    for (const [
      clientId,
      channel,
      direction,
      type,
      content,
      status,
      requiresApproval,
      createdBy
    ] of interactions) {
      await db.query(
        `INSERT INTO client_interactions
          (client_id, channel, direction, interaction_type, content, status, requires_approval, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          clientId,
          channel,
          direction,
          type,
          content,
          status,
          requiresApproval,
          createdBy
        ]
      );
    }

    // ---------------------------------------------------------
    // ACTIVITY TIMELINE
    // ---------------------------------------------------------

    const activities = [
      [alpha, "agent", "client-acquisition", "client_discovered", "Demo Alpha Properties discovered from LinkedIn research."],
      [alpha, "agent", "client-acquisition", "lead_qualified", "Lead qualified with score 92."],
      [alpha, "agent", "client-acquisition", "requirement_updated", "Captured AI lead qualification requirements."],
      [alpha, "agent", "client-acquisition", "outreach_draft_created", "Created outreach draft requiring approval."],

      [skyline, "agent", "client-acquisition", "client_discovered", "Demo Skyline Realty discovered from website inquiry."],
      [skyline, "agent", "client-acquisition", "lead_scored", "Lead scored 88."],
      [skyline, "agent", "client-acquisition", "proposal_created", "Prepared proposal draft."],

      [nexus, "agent", "client-acquisition", "client_replied", "Client provided CRM integration requirements."],
      [nexus, "agent", "client-acquisition", "requirement_updated", "Updated custom automation requirements."],

      [oasis, "agent", "client-acquisition", "client_discovered", "Prospect discovered through outbound research."],

      [horizon, "agent", "client-acquisition", "proposal_approved", "Proposal approved by demo client."],
      [horizon, "agent", "client-acquisition", "client_won", "Client moved to won stage."],
      [horizon, "agent", "company-pa", "handover_created", "Company PA delivery handover created."],
      [horizon, "agent", "company-pa", "delivery_started", "Delivery kickoff task prepared."]
    ];

    for (const [
      clientId,
      actorType,
      actorId,
      action,
      description
    ] of activities) {
      await db.query(
        `INSERT INTO client_activity
          (client_id, actor_type, actor_id, action, description, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          clientId,
          actorType,
          actorId,
          action,
          description,
          JSON.stringify({ demo_prefix: DEMO_PREFIX })
        ]
      );
    }

    // ---------------------------------------------------------
    // DUPLICATE CANDIDATES
    // ---------------------------------------------------------

    await db.query(
      `INSERT INTO dedupe_candidates
        (client_id, possible_duplicate_client_id, match_type, match_score, status, reviewed_by, reviewed_at)
       VALUES
        ($1, $2, 'exact_domain_phone', 99, 'confirmed_duplicate', 'founder-demo', NOW()),
        ($3, $4, 'exact_domain_name_similarity', 94, 'pending_review', NULL, NULL)`,
      [
        alpha,
        alphaDuplicate,
        skyline,
        skylineDuplicate
      ]
    );

    // ---------------------------------------------------------
    // MERGE HISTORY
    //
    // Demo-only historical example. The duplicate client remains
    // in the database so historical information is preserved.
    // ---------------------------------------------------------

    await db.query(
      `INSERT INTO client_merge_history
        (canonical_client_id, merged_client_id, reason, merged_by, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        alpha,
        alphaDuplicate,
        "Demo duplicate confirmed: same website and phone number.",
        "founder-demo",
        JSON.stringify({
          demo_prefix: DEMO_PREFIX,
          preserved_history: true,
          example_only: true
        })
      ]
    );

    await db.query(
      `UPDATE clients
       SET status = 'paused'
       WHERE id = $1`,
      [alphaDuplicate]
    );

    await db.query("COMMIT");

    console.log("");
    console.log("==============================================");
    console.log("REALTYSPRINT AI — STEP 5F DEMO SEED");
    console.log("==============================================");
    console.log("Demo clients created: 7");
    console.log("Main clients: 5");
    console.log("Duplicate candidates: 2");
    console.log("Confirmed duplicate: 1");
    console.log("Pending duplicate review: 1");
    console.log("Pipeline records: 7");
    console.log("Requirements: 7");
    console.log("Interactions: 8");
    console.log("Activity events: 14");
    console.log("Merge history records: 1");
    console.log("Status: SUCCESS");
    console.log("==============================================");
  } catch (error) {
    await db.query("ROLLBACK");
    console.error("[step5f] Seed failed. Transaction rolled back.");
    console.error(error);
    process.exitCode = 1;
  } finally {
    db.release();
  }

  await pool.end();
}

seed();

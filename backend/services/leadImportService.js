const { pool } = require('../db/pool');

// Target India cities for higher scoring
const TARGET_CITIES = ['chennai', 'coimbatore', 'trichy', 'bangalore', 'bengaluru', 'hyderabad', 'mumbai', 'delhi', 'ncr', 'pune'];

function calculateIndiaScore(prospect) {
  let score = 50; // base score
  const breakdown = [{ factor: 'Base Score', points: 50, type: 'inference' }];

  if (prospect.location) {
    const loc = prospect.location.toLowerCase();
    const isTarget = TARGET_CITIES.some(city => loc.includes(city));
    if (isTarget) {
      score += 20;
      breakdown.push({ factor: `Target location (${prospect.location})`, points: 20, type: 'user-provided' });
    } else {
      score += 5;
      breakdown.push({ factor: `Non-target location (${prospect.location})`, points: 5, type: 'user-provided' });
    }
  } else {
    breakdown.push({ factor: 'Missing location', points: 0, type: 'unknown' });
  }

  if (prospect.website) {
    score += 15;
    breakdown.push({ factor: 'Has website', points: 15, type: 'user-provided' });
  } else {
    breakdown.push({ factor: 'Missing website', points: 0, type: 'unknown' });
  }

  if (prospect.email) {
    score += 10;
    breakdown.push({ factor: 'Has contact email', points: 10, type: 'verified fact' }); // Assuming email is verified structure-wise
  }

  if (prospect.phone) {
    score += 5;
    breakdown.push({ factor: 'Has phone number', points: 5, type: 'verified fact' });
  }

  score = Math.min(score, 100);
  return { score, breakdown };
}

async function processImport(prospects, createdBy) {
  const results = {
    total: prospects.length,
    imported: 0,
    exactDuplicates: 0,
    potentialDuplicates: 0,
    errors: [],
    details: []
  };

  if (!Array.isArray(prospects) || prospects.length === 0) {
    results.errors.push('Invalid input: prospects must be a non-empty array.');
    return results;
  }

  if (prospects.length > 500) {
    results.errors.push('Batch limit exceeded. Maximum 500 prospects per import.');
    return results;
  }

  for (const [index, prospect] of prospects.entries()) {
    if (!prospect.companyName || !prospect.contactName) {
      results.errors.push(`Row ${index + 1}: Missing required fields (companyName, contactName).`);
      results.details.push({ status: 'error', reason: 'Missing required fields' });
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Exact Duplicate Check
      // We check for exact company name (case insensitive) OR exact website OR exact email
      let exactMatchQuery = `
        SELECT c.id as company_id, cl.id as client_id
        FROM companies c
        LEFT JOIN clients cl ON cl.company_id = c.id
        LEFT JOIN contacts ct ON ct.company_id = c.id
        WHERE LOWER(TRIM(c.name)) = LOWER(TRIM($1))
      `;
      const queryParams = [prospect.companyName];
      let paramIndex = 2;

      if (prospect.website) {
        exactMatchQuery += ` OR LOWER(TRIM(c.website)) = LOWER(TRIM($${paramIndex++}))`;
        queryParams.push(prospect.website);
      }
      if (prospect.email) {
        exactMatchQuery += ` OR LOWER(TRIM(ct.email)) = LOWER(TRIM($${paramIndex++}))`;
        queryParams.push(prospect.email);
      }

      const exactMatchRes = await client.query(exactMatchQuery, queryParams);

      if (exactMatchRes.rows.length > 0) {
        // We found an exact match
        await client.query('ROLLBACK');
        results.exactDuplicates++;
        results.details.push({ status: 'skipped', reason: 'Exact duplicate found', match: exactMatchRes.rows[0] });
        continue;
      }

      // 2. Potential Duplicate Check
      // We check if the company name is a substring of an existing one, or vice-versa
      const potentialMatchQuery = `
        SELECT c.id as company_id, cl.id as client_id, c.name
        FROM companies c
        LEFT JOIN clients cl ON cl.company_id = c.id
        WHERE c.name ILIKE $1 OR $2 ILIKE '%' || c.name || '%'
        LIMIT 1
      `;
      const potentialMatchRes = await client.query(potentialMatchQuery, [`%${prospect.companyName}%`, prospect.companyName]);
      const potentialMatch = potentialMatchRes.rows[0];

      // 3. Insert new prospect
      // Insert company
      const companyRes = await client.query(`
        INSERT INTO companies (name, website, location, industry)
        VALUES ($1, $2, $3, $4) RETURNING id
      `, [prospect.companyName, prospect.website || null, prospect.location || null, prospect.industry || 'Real Estate']);
      const companyId = companyRes.rows[0].id;

      // Insert contact
      const contactRes = await client.query(`
        INSERT INTO contacts (company_id, name, email, phone, job_title)
        VALUES ($1, $2, $3, $4, $5) RETURNING id
      `, [companyId, prospect.contactName, prospect.email || null, prospect.phone || null, prospect.jobTitle || null]);
      const contactId = contactRes.rows[0].id;

      // Score lead
      const qualificationData = calculateIndiaScore(prospect);

      // Insert lead
      const leadRes = await client.query(`
        INSERT INTO leads (company_id, contact_id, source, status, score, qualification)
        VALUES ($1, $2, $3, 'new', $4, $5) RETURNING id
      `, [companyId, contactId, prospect.source || 'Manual Import', qualificationData.score, JSON.stringify(qualificationData)]);
      const leadId = leadRes.rows[0].id;

      // Insert client
      const clientRes = await client.query(`
        INSERT INTO clients (lead_id, company_id, contact_id, status)
        VALUES ($1, $2, $3, 'active') RETURNING id
      `, [leadId, companyId, contactId]);
      const newClientId = clientRes.rows[0].id;

      // Insert client_sources
      await client.query(`
        INSERT INTO client_sources (client_id, source_type, source_reference)
        VALUES ($1, 'import', $2)
      `, [newClientId, prospect.source || 'Manual Import']);

      // Insert client_pipeline
      await client.query(`
        INSERT INTO client_pipeline (client_id, stage)
        VALUES ($1, 'prospect')
      `, [newClientId]);

      // Insert client_activity
      await client.query(`
        INSERT INTO client_activity (client_id, actor_type, actor_id, action, description, metadata)
        VALUES ($1, 'user', $2, 'imported', 'Lead imported via manual/CSV entry', $3)
      `, [newClientId, createdBy || 'system', JSON.stringify({ source: prospect.source })]);

      // 4. Create dedupe candidate if potential duplicate found
      if (potentialMatch && potentialMatch.client_id) {
        await client.query(`
          INSERT INTO dedupe_candidates (client_id, possible_duplicate_client_id, match_type, match_score, status)
          VALUES ($1, $2, 'partial_name', 75, 'pending_review')
        `, [newClientId, potentialMatch.client_id]);
        results.potentialDuplicates++;
        results.details.push({ status: 'imported_with_duplicate_flag', companyName: prospect.companyName });
      } else {
        results.imported++;
        results.details.push({ status: 'imported', companyName: prospect.companyName });
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      results.errors.push(`Row ${index + 1} (${prospect.companyName}): ${err.message}`);
      results.details.push({ status: 'error', reason: err.message });
    } finally {
      client.release();
    }
  }

  return results;
}

module.exports = {
  processImport,
  calculateIndiaScore
};

'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const projectRoot = path.resolve(__dirname, '../..');
const { pool } = require('../db/pool');
const originalQuery = pool.query;
const originalConnect = pool.connect;
pool.query = async () => { throw new Error('Database unavailable in isolated test.'); };
pool.connect = async () => { throw new Error('Database unavailable in isolated test.'); };

const app = require('../server');
const { registry } = require('../../agents');
const policy = require('../../agents/core/permissionPolicy');
const agentContext = require('../../agents/core/agentContext');
const ai = require('../ai');
const OpenAIProvider = require('../ai/openaiProvider');
const GeminiProvider = require('../ai/geminiProvider');
const { validateStructuredOutput } = require('../ai/validator');

test('Step 5D agent system and backend integration', async t => {
  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  t.after(async () => {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    pool.query = originalQuery;
    pool.connect = originalConnect;
    await pool.end();
  });

  await t.test('registry loads exactly both active agents', () => {
    assert.deepEqual(registry.listSlugs().sort(), ['client-acquisition', 'company-pa']);
    assert.equal(registry.count(), 2);
    assert.equal(registry.getAgent('company-pa').slug, 'company-pa');
    assert.equal(registry.getAgent('client-acquisition').slug, 'client-acquisition');
    assert.throws(() => registry.register({ slug: 'extra-agent' }), /not one of the two active agents/);
    assert.equal(registry.count(), 2);
  });

  await t.test('context is bounded and excludes secret-like fields', () => {
    const created = agentContext.create({
      agent: 'client-acquisition', action: 'qualify_lead',
      user: { id: 'demo-admin', email: 'admin@realtysprint.ai' },
      input: { lead: { company: 'Demo Realty', apiKey: 'must-not-pass' } },
      permissions: ['admin:*'],
    });
    assert.equal(created.ok, true);
    assert.deepEqual(created.context.input, { lead: { company: 'Demo Realty' } });
    assert.deepEqual(created.context.permissions, []);
    assert.equal(agentContext.create({
      agent: 'company-pa', action: 'generate_report', user: { id: 'u' }, input: [],
    }).ok, false);
  });

  await t.test('safe action completes and returns correlation ID', async () => {
    const response = await fetch(`${baseUrl}/api/agents/execute`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + require('jsonwebtoken').sign({ id: 1, email: 'admin@realtysprint.ai', name: 'Admin', role: 'admin' }, process.env.JWT_SECRET || 'super_secret_jwt_key_for_testing'), 'x-correlation-id': 'step5d-safe-1' },
      body: JSON.stringify({ agent: 'company-pa', action: 'generate_report' }),
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.status, 'completed');
    assert.equal(body.result.demoMode, true);
    assert.equal(body.traceId, 'step5d-safe-1');
    assert.equal(response.headers.get('x-correlation-id'), 'step5d-safe-1');
  });

  await t.test('all six named demo actions return deterministic DEMO results', async () => {
    const actions = [
      ['company-pa', 'generate_report', {}],
      ['company-pa', 'check_performance', {}],
      ['company-pa', 'identify_priorities', {}],
      ['client-acquisition', 'qualify_lead', {}],
      ['client-acquisition', 'create_draft', { draftType: 'proposal' }],
      ['client-acquisition', 'create_draft', { draftType: 'follow-up' }],
    ];
    for (const [agent, action, input] of actions) {
      const response = await fetch(`${baseUrl}/api/agents/execute`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + require('jsonwebtoken').sign({ id: 1, email: 'admin@realtysprint.ai', name: 'Admin', role: 'admin' }, process.env.JWT_SECRET || 'super_secret_jwt_key_for_testing') },
        body: JSON.stringify({ agent, action, input }),
      });
      const body = await response.json();
      assert.equal(response.status, 200, `${agent}:${action}`);
      assert.equal(body.status, 'completed', `${agent}:${action}`);
      assert.equal(body.result.demoMode, true, `${agent}:${action}`);
      assert.ok(JSON.stringify(body.result).includes('DEMO'), `${agent}:${action} must be labeled DEMO`);
    }
  });

  await t.test('approval and blocked actions are classified server-side', async () => {
    const approval = await fetch(`${baseUrl}/api/agents/execute`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + require('jsonwebtoken').sign({ id: 1 }, process.env.JWT_SECRET || 'super_secret_jwt_key_for_testing') },
      body: JSON.stringify({ agent: 'client-acquisition', action: 'send_client_message' }),
    });
    const approvalBody = await approval.json();
    assert.equal(approval.status, 202);
    assert.equal(approvalBody.status, 'pending_approval');
    assert.equal(approvalBody.requiresApproval, true);

    const blocked = await fetch(`${baseUrl}/api/agents/execute`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + require('jsonwebtoken').sign({ id: 1 }, process.env.JWT_SECRET || 'super_secret_jwt_key_for_testing') },
      body: JSON.stringify({ agent: 'client-acquisition', action: 'mass_spam' }),
    });
    assert.equal(blocked.status, 403);
    assert.equal((await blocked.json()).status, 'blocked');
  });

  await t.test('authentication, agent/action, and input validation reject invalid requests', async () => {
    const post = (body, token = require('jsonwebtoken').sign({ id: 1 }, process.env.JWT_SECRET || 'super_secret_jwt_key_for_testing')) => fetch(`${baseUrl}/api/agents/execute`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + token },
      body: JSON.stringify(body),
    });
    assert.equal((await post({ agent: 'company-pa', action: 'generate_report' }, '')).status, 401);
    assert.equal((await post({ agent: 'unknown-agent', action: 'generate_report' })).status, 400);
    assert.equal((await post({ agent: 'company-pa', action: 'invented_action' })).status, 400);
    assert.equal((await post({ agent: 'company-pa', action: 'generate_report', input: [] })).status, 400);


  });

  await t.test('permission catalog matches required action groups', () => {
    for (const action of ['read_internal_data', 'analyze_data', 'calculate_score', 'generate_report', 'create_recommendation', 'create_internal_task', 'create_draft', 'analyze_workforce', 'analyze_revenue', 'analyze_pipeline']) {
      assert.equal(policy.evaluate(action).tier, 'safe_auto', action);
    }
    for (const action of ['send_email', 'send_whatsapp', 'send_linkedin', 'external_communication', 'delete_record', 'modify_critical_record', 'financial_action', 'modify_permissions', 'change_pricing', 'commit_client_contract', 'approve_proposal', 'send_client_message']) {
      assert.equal(policy.evaluate(action).tier, 'requires_approval', action);
    }
    for (const action of ['mass_spam', 'bypass_platform_restrictions', 'credential_harvesting', 'unauthorized_access', 'destructive_unauthorized_action']) {
      assert.equal(policy.evaluate(action).tier, 'blocked', action);
    }
  });

  await t.test('OpenAI provider uses private credentials and structured, non-stored responses', async () => {
    let request;
    const provider = new OpenAIProvider({
      apiKey: () => 'test-provider-secret',
      model: () => 'mock-model',
      fetchImpl: async (url, options) => {
        request = { url, options };
        return { ok: true, json: async () => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ channel: 'email', objective: 'agree next step', message: 'Draft only', timing: 'in 2 days', reason: 'maintain context' }) }] }] }) };
      },
    });
    const result = await provider.generateStructured({ schemaName: 'follow_up_draft', systemPrompt: 'Draft only.', input: { lead: { company: 'Example' } } });
    assert.equal(result.status, 'completed');
    assert.equal(request.url, 'https://api.openai.com/v1/responses');
    assert.equal(request.options.headers.Authorization, 'Bearer test-provider-secret');
    const body = JSON.parse(request.options.body);
    assert.equal(body.store, false);
    assert.equal(body.text.format.type, 'json_schema');
    assert.equal(JSON.stringify(body).includes('test-provider-secret'), false);
    const missingKey = new OpenAIProvider({ apiKey: () => '', fetchImpl: async () => { throw new Error('must not fetch'); } });
    assert.deepEqual(await missingKey.generateStructured({ schemaName: 'follow_up_draft', systemPrompt: '', input: {} }), { status: 'not_configured', output: null });
  });

  await t.test('Gemini provider sends structured JSON schema and keeps API key out of URL/body', async () => {
    const secret = 'AIza-test-gemini-secret-do-not-display';
    const expected = { qualification: 'qualified', score: 82, reasons: ['Good fit'], missing_information: ['Budget'], recommended_next_step: 'Prepare discovery', risks: ['Unverified details'] };
    let request;
    const provider = new GeminiProvider({
      apiKey: () => secret,
      model: () => 'gemini-2.5-flash',
      fetchImpl: async (url, options) => {
        request = { url, options };
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(expected) }] } }] }) };
      },
    });
    const result = await provider.generateStructured({ schemaName: 'lead_qualification', systemPrompt: 'Qualify the lead.', input: { lead: { company: 'Demo Realty' } } });
    assert.deepEqual(result, { status: 'completed', output: expected });
    assert.equal(request.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
    assert.equal(request.options.headers['x-goog-api-key'], secret);
    const body = JSON.parse(request.options.body);
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.deepEqual(body.generationConfig.responseJsonSchema, require('../ai/schemas').getSchema('lead_qualification'));
      assert.equal(request.url.includes(secret), false);
    assert.equal(JSON.stringify(body).includes(secret), false);
  });

  await t.test('Gemini provider returns sanitized HTTP diagnostics', async () => {
    const secret = 'AIza-test-gemini-secret-do-not-display';
    const provider = new GeminiProvider({
      apiKey: () => secret,
      fetchImpl: async () => ({
        ok: false, status: 429,
        json: async () => ({ error: { status: 'RESOURCE_EXHAUSTED', code: 429, message: `Key ${secret} has no quota.` } }),
      }),
    });
    await assert.rejects(
      provider.generateStructured({ schemaName: 'lead_qualification', systemPrompt: '', input: {} }),
      error => {
        assert.equal(error.name, 'GeminiProviderError');
        assert.equal(error.diagnostics.endpointReached, true);
        assert.equal(error.diagnostics.httpStatus, 429);
        assert.equal(error.diagnostics.errorType, 'RESOURCE_EXHAUSTED');
        assert.equal(JSON.stringify(error.diagnostics).includes(secret), false);
        return true;
      },
    );
  });

  await t.test('provider selection defaults to DEMO and selects Gemini only when explicitly requested', async () => {
    const previous = {
      provider: process.env.AI_PROVIDER,
      key: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL,
      openaiKey: process.env.OPENAI_API_KEY,
      openaiModel: process.env.OPENAI_MODEL,
    };
    try {
      delete process.env.AI_PROVIDER;
      process.env.GEMINI_API_KEY = 'test-gemini-key';
      process.env.GEMINI_MODEL = 'gemini-test-model';
      ai.resetProvider();
      assert.equal(ai.getStatus().provider, 'demo');
      assert.equal((await ai.generateStructured({ schemaName: 'lead_qualification', systemPrompt: '', input: {} })).status, 'not_configured');
      process.env.AI_PROVIDER = 'gemini';
      assert.deepEqual(ai.getStatus(), { provider: 'gemini', configured: true, model: 'gemini-test-model', mode: 'available' });
      process.env.AI_PROVIDER = 'openai';
      process.env.OPENAI_API_KEY = 'test-openai-key';
      process.env.OPENAI_MODEL = 'mock-openai-model';
      assert.deepEqual(ai.getStatus(), { provider: 'openai', configured: true, model: 'mock-openai-model', mode: 'available' });
    } finally {
      if (previous.provider === undefined) delete process.env.AI_PROVIDER; else process.env.AI_PROVIDER = previous.provider;
      if (previous.key === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous.key;
      if (previous.model === undefined) delete process.env.GEMINI_MODEL; else process.env.GEMINI_MODEL = previous.model;
      if (previous.openaiKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous.openaiKey;
      if (previous.openaiModel === undefined) delete process.env.OPENAI_MODEL; else process.env.OPENAI_MODEL = previous.openaiModel;
      ai.resetProvider();
    }
  });

  await t.test('mock AI supports Company PA and Client Acquisition structured reasoning', async () => {
    const outputs = {
      company_report: {
        summary: 'DEMO report summary',
        today_revenue: 0,
        actual_revenue: 0,
        expected_revenue: 125000,
        revenue_target: 5000000,
        remaining_target: 5000000,
        revenue_gap: 4875000,
        revenue_currency: 'INR',
        revenue_status: 'INR 0 received; INR 125000 expected and not received.',
        revenue_progress: '0%',
        required_pace: 'INR 27778 per day',
        revenue_data_quality: 'DEMO',
        target_status: { target: 'INR 5000000', period: '6 months', progress: '0%', gap: 'INR 5000000' },
        pipeline_status: { total_leads: 5, qualified_leads: 3, conversations: 1, proposals: 1, won_clients: 0, conversion_rate: '0%' },
        client_acquisition_status: { summary: '3 qualified leads', risks: ['DEMO only'], recommended_actions: ['Review pipeline'] },
        delivery_status: { active_projects: 0, overdue: 1, blocked: 0, at_risk: 0, summary: 'DEMO delivery status' },
        blockers: ['DEMO database unavailable'], overdue_work: ['DEMO overdue item'], founder_attention: ['Review pipeline'], tomorrow_priorities: ['Confirm next steps'], recommendations: ['Record outcomes'],
      },
      company_performance: { leads: 5, qualified_leads: 3, proposals: 1, wins: 0, conversion: '0%', follow_up_activity: '0 recorded', risks: ['No live data'], recommended_actions: ['Review follow-ups'] },
      company_priorities: { priorities: [{ priority: 'Pipeline', reason: 'DEMO gap', urgency: 'high', recommended_action: 'Review leads', owner: 'Founder', dependency: 'Lead details' }] },
      lead_qualification: { qualification: 'qualified', score: 82, reasons: ['Clear service fit'], missing_information: ['Budget'], recommended_next_step: 'Hold discovery call', risks: ['Unverified source'] },
      proposal_draft: { client: 'Example Realty', requirements: ['Lead workflow'], recommended_solution: 'Website and automation discovery', scope: ['Discovery'], pricing: { amount: null, currency: 'INR', note: 'Founder pricing input required.' }, assumptions: ['Needs confirmation'], risks: ['No agreed scope'], next_step: 'Founder review' },
      follow_up_draft: { channel: 'email', objective: 'Agree discovery call', message: 'Draft only', timing: 'In 2 business days', reason: 'Continue discussion' },
    };
    const calls = [];
    ai.setProvider({ providerName: 'gemini', model: 'mock-gemini', configured: true, generateStructured: async request => { calls.push(request); return { status: 'completed', output: outputs[request.schemaName] }; } });
    try {
      const execute = async (agent, action, input = {}) => {
        const response = await fetch(`${baseUrl}/api/agents/execute`, {
          method: 'POST', headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + require('jsonwebtoken').sign({ id: 1 }, process.env.JWT_SECRET || 'super_secret_jwt_key_for_testing') },
          body: JSON.stringify({ agent, action, input: { ...input, useAI: true } }),
        });
        assert.equal(response.status, 200, `${agent}:${action}`);
        return response.json();
      };
      const report = await execute('company-pa', 'generate_report');
      assert.equal(report.result.aiStatus.status, 'completed');
      assert.equal(report.result.report.summary, 'DEMO report summary');
      assert.equal(report.result.report.expected_revenue, 125000);
      assert.equal(report.result.report.actual_revenue, 0);
      assert.equal((await execute('company-pa', 'check_performance')).result.performanceReport.wins, 0);
      assert.equal((await execute('company-pa', 'identify_priorities')).result.priorities.priorities[0].urgency, 'high');
      assert.equal((await execute('client-acquisition', 'qualify_lead', { lead: { company: 'Example Realty' } })).result.qualification.score, 82);
      const proposal = await execute('client-acquisition', 'create_draft', { lead: { company: 'Example Realty' } });
      assert.equal(proposal.result.sent, false);
      assert.equal(proposal.result.draft.pricing.amount, null);
      assert.equal(proposal.result.approval.status, 'pending_approval');
      const followUp = await execute('client-acquisition', 'create_draft', { draftType: 'follow-up' });
      assert.equal(followUp.result.draft.message, 'Draft only');
      assert.equal(followUp.result.sent, false);
      assert.deepEqual(calls.map(call => call.schemaName), ['company_report', 'company_performance', 'company_priorities', 'lead_qualification', 'proposal_draft', 'follow_up_draft']);
      assert.equal(JSON.stringify(calls).includes('test-provider-secret'), false);
    } finally {
      ai.resetProvider();
    }
  });

  await t.test('invalid structured AI output is rejected by local validation', () => {
    assert.throws(() => validateStructuredOutput('lead_qualification', { score: 300 }), /failed validation/);
  });

  await t.test('existing APIs retain dashboard response shape and exactly two agents', async () => {
    assert.equal((await fetch(`${baseUrl}/api/agents`)).status, 401);
    assert.equal((await fetch(`${baseUrl}/api/leads`)).status, 401);
    assert.equal((await fetch(`${baseUrl}/api/business/summary`)).status, 401);
    const expected = ['/api/health', '/api/agents', '/api/tasks', '/api/leads', '/api/approvals', '/api/activity'];
    const responses = await Promise.all(expected.map(endpoint => fetch(`${baseUrl}${endpoint}`, {
      headers: endpoint === '/api/health' ? {} : { 'authorization': 'Bearer ' + require('jsonwebtoken').sign({ id: 1 }, process.env.JWT_SECRET || 'super_secret_jwt_key_for_testing') },
    })));
    for (const response of responses) assert.equal(response.status, 200);
    const [health, agents, tasks, leads, approvals, activity] = await Promise.all(responses.map(response => response.json()));
    assert.equal(health.success, true);
    assert.equal(agents.count, 2);
    assert.deepEqual(agents.data.map(agent => agent.agentId).sort(), ['client-acquisition', 'company-pa']);
    for (const payload of [tasks, leads, approvals, activity]) {
      assert.equal(payload.success, true);
      assert.equal(payload.source, 'demo');
      assert.ok(Array.isArray(payload.data));
    }
  });

  await t.test('Founder approval and client handover remain explicit and do not send messages', async () => {
    const authHeaders = { 'content-type': 'application/json', 'authorization': 'Bearer ' + require('jsonwebtoken').sign({ id: 1 }, process.env.JWT_SECRET || 'super_secret_jwt_key_for_testing') };
    const approvalsResponse = await fetch(`${baseUrl}/api/approvals`, { headers: authHeaders });
    const approvals = await approvalsResponse.json();
    const proposalApproval = approvals.data.find(item => item.actionType === 'approve_proposal' && item.status === 'pending');
    assert.ok(proposalApproval);
    const reviewed = await fetch(`${baseUrl}/api/approvals/${encodeURIComponent(proposalApproval.id)}/review`, {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ decision: 'approve' }),
    });
    assert.equal(reviewed.status, 200);
    assert.equal((await reviewed.json()).communicationSent, false);

    const notConfirmed = await fetch(`${baseUrl}/api/leads/lead-201/handover`, {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ projectTitle: 'Website delivery', requirements: [], contractValue: 250000 }),
    });
    assert.equal(notConfirmed.status, 400);
    const handover = await fetch(`${baseUrl}/api/leads/lead-201/handover`, {
      method: 'POST', headers: authHeaders,
      body: JSON.stringify({ founderConfirmedWon: true, projectTitle: 'Website and lead automation', requirements: ['Website refresh', 'Lead qualification automation'], contractValue: 250000, currency: 'INR' }),
    });
    assert.equal(handover.status, 201);
    const handoverBody = await handover.json();
    assert.equal(handoverBody.revenueStatus, 'expected');
    assert.equal(handoverBody.actualRevenueRecorded, false);
    assert.equal(handoverBody.data.task.agentId, 'company-pa');
    const summary = await fetch(`${baseUrl}/api/business/summary`, { headers: authHeaders });
    const summaryBody = await summary.json();
    assert.equal(summaryBody.source, 'demo');
    assert.equal(summaryBody.data.revenue.expected, 250000);
    assert.equal(summaryBody.data.revenue.totalActual, 0);

    const founderReportResponse = await fetch(`${baseUrl}/api/agents/execute`, {
      method: 'POST', headers: authHeaders,
      body: JSON.stringify({ agent: 'company-pa', action: 'generate_report' }),
    });
    assert.equal(founderReportResponse.status, 200);
    const founderReport = (await founderReportResponse.json()).result.report;
    assert.equal(founderReport.expected_revenue, 250000);
    assert.equal(founderReport.actual_revenue, 0);
    assert.equal(founderReport.revenue_target, 5000000);
    assert.equal(founderReport.remaining_target, 5000000);
    assert.equal(founderReport.revenue_gap, 4750000);
    assert.match(founderReport.revenue_status, /expected and not received/);
    assert.equal(founderReport.revenue_currency, 'INR');
  });

  await t.test('public website remains untouched', () => {
    execFileSync('git', ['diff', '--quiet', 'HEAD', '--', 'index.html'], { cwd: projectRoot });
    assert.ok(fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8').includes('RealtySprint'));
  });
});

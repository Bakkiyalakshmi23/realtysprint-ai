const https = require('https');

/**
 * Validates the email provider configuration based on mode.
 * @param {string} mode - 'mock' or 'real'
 * @throws {Error} if configuration is invalid
 */
function validateConfig(mode) {
  if (mode === 'real') {
    if (!process.env.EMAIL_VERIFIED_SENDER) {
      throw new Error('EMAIL_VERIFIED_SENDER is required for real email delivery.');
    }
    if (!process.env.EMAIL_TEST_INBOX) {
      throw new Error('EMAIL_TEST_INBOX is required for real email delivery.');
    }
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is required for real email delivery.');
    }
  }
}

/**
 * Sends an email using the real provider (Resend API).
 */
async function sendRealEmail(recipient, subject, text, idempotencyKey) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      from: process.env.EMAIL_VERIFIED_SENDER,
      to: [recipient],
      subject: subject,
      text: text,
    });

    const options = {
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 10000 // safe 10-second timeout
    };
    if (idempotencyKey) {
      options.headers['Idempotency-Key'] = idempotencyKey;
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(data);
            resolve({ status: 'sent', provider_message_id: parsed.id });
          } catch (e) {
            resolve({ status: 'unknown', error_details: 'Failed to parse success response from provider' });
          }
        } else {
          // It failed, but we must not log secrets. We can return the status code and safe error text.
          resolve({ status: 'failed', error_details: `Provider returned HTTP ${res.statusCode}` });
        }
      });
    });

    req.on('error', (e) => {
      resolve({ status: 'failed', error_details: `Network error: ${e.message}` });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 'unknown', error_details: 'Request timed out' });
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Sends an email using the mock provider for tests.
 */
async function sendMockEmail(recipient, subject, text, idempotencyKey) {
  // Simulate network delay
  await new Promise(r => setTimeout(r, 50));

  if (process.env.MOCK_EMAIL_FAILURE === 'true') {
    return { status: 'failed', error_details: 'Simulated mock failure' };
  }

  if (process.env.MOCK_EMAIL_TIMEOUT === 'true') {
    return { status: 'unknown', error_details: 'Simulated mock timeout' };
  }

  return { status: 'sent', provider_message_id: `mock-${Date.now()}` };
}

/**
 * Sends an email by delegating to the appropriate provider based on configuration.
 */
async function sendEmail({ recipient, subject, body, idempotencyKey }) {
  const mode = process.env.EMAIL_PROVIDER_MODE || 'mock';

  validateConfig(mode);

  if (mode === 'real') {
    return await sendRealEmail(recipient, subject, body, idempotencyKey);
  } else {
    return await sendMockEmail(recipient, subject, body, idempotencyKey);
  }
}

module.exports = { sendEmail };

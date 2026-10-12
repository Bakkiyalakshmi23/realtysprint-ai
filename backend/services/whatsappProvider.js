const https = require('https');

function validateConfig(mode) {
  if (mode === 'real') {
    if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
      throw new Error('Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID in environment variables.');
    }
  }
}

async function sendRealMessage(phone, templateName, templateData) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: templateName ? 'template' : 'text',
      ...(templateName ? {
        template: {
          name: templateName,
          language: { code: 'en_US' },
          components: templateData || []
        }
      } : {
        text: { body: templateData?.text || 'Hello' }
      })
    });

    const options = {
      hostname: 'graph.facebook.com',
      path: `/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              status: 'sent',
              provider_message_id: parsed.messages?.[0]?.id || `wa-real-${Date.now()}`
            });
          } else {
            resolve({ status: 'failed', error_details: parsed.error?.message || 'Unknown provider error' });
          }
        } catch (e) {
          resolve({ status: 'failed', error_details: 'Invalid JSON response from provider' });
        }
      });
    });

    req.on('error', (err) => resolve({ status: 'failed', error_details: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 'failed', error_details: 'timeout' }); });
    req.write(payload);
    req.end();
  });
}

async function sendMockMessage(phone, templateName, templateData) {
  await new Promise(r => setTimeout(r, 50));

  if (phone === '9999999999') {
    return { status: 'failed', error_details: 'simulated bounce' };
  }

  return {
    status: 'sent',
    provider_message_id: `wa-mock-${Date.now()}`
  };
}

async function sendWhatsapp({ phone, templateName, templateData }) {
  const mode = process.env.WHATSAPP_PROVIDER_MODE || 'mock';
  validateConfig(mode);

  if (mode === 'real') {
    return await sendRealMessage(phone, templateName, templateData);
  } else {
    return await sendMockMessage(phone, templateName, templateData);
  }
}

module.exports = { sendWhatsapp };

'use strict';

const ai = require('./index');
const { validateStructuredOutput } = require('./validator');

async function analyze({ useAI, schemaName, systemPrompt, input, fallback }) {
  if (useAI !== true) {
    return { output: fallback, aiStatus: { status: 'demo', message: 'DEMO analysis; AI was not requested.' } };
  }

  try {
    const response = await ai.generateStructured({ schemaName, systemPrompt, input });
    if (response.status === 'not_configured') {
      const selected = ai.getStatus();
      return { output: fallback, aiStatus: { status: 'not_configured', provider: selected.provider, message: 'Selected AI provider is not configured. Showing deterministic DEMO output.' } };
    }
    const output = validateStructuredOutput(schemaName, response.output);
    const selected = ai.getStatus();
    return { output, aiStatus: { status: 'completed', provider: selected.provider, model: selected.model } };
  } catch (error) {
    const status = error.name === 'StructuredOutputValidationError' ? 'invalid_output' : 'unavailable';
    const diagnostics = error.diagnostics && ['OpenAIProviderError', 'GeminiProviderError'].includes(error.name)
      ? {
          provider: error.name === 'GeminiProviderError' ? 'gemini' : 'openai',
          endpointReached: error.diagnostics.endpointReached,
          httpStatus: error.diagnostics.httpStatus,
          errorType: error.diagnostics.errorType,
          errorCode: error.diagnostics.errorCode,
          networkCode: error.diagnostics.networkCode,
          timedOut: error.diagnostics.timedOut,
          timeoutMs: error.diagnostics.timeoutMs,
          message: error.diagnostics.message,
        }
      : {};
    return {
      output: fallback,
      aiStatus: {
        status,
        message: status === 'invalid_output'
          ? 'AI output did not pass validation. Showing deterministic DEMO output.'
          : diagnostics.message || 'AI provider is unavailable. Showing deterministic DEMO output.',
        ...diagnostics,
      },
    };
  }
}

module.exports = { analyze };

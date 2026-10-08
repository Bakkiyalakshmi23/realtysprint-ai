'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const OpenAIProvider = require('./openaiProvider');
const GeminiProvider = require('./geminiProvider');

class DemoProvider {
  constructor() {
    this.providerName = 'demo';
    this.configured = false;
  }

  async generateStructured() {
    return { status: 'not_configured', output: null };
  }
}

let providerOverride = null;

function selection() {
  const requested = (process.env.AI_PROVIDER || '').trim().toLowerCase();
  if (!requested) return { name: 'demo' };
  if (['gemini', 'openai', 'demo'].includes(requested)) return { name: requested };
  return { name: 'demo', configurationError: 'Unsupported AI_PROVIDER; using DEMO mode.' };
}

function selectedProvider() {
  if (providerOverride) return providerOverride;
  const selected = selection().name;
  if (selected === 'gemini') return new GeminiProvider();
  if (selected === 'openai') return new OpenAIProvider();
  return new DemoProvider();
}

function getStatus() {
  const selected = selection();
  const active = selectedProvider();
  const model = selected.name === 'gemini'
    ? process.env.GEMINI_MODEL || 'gemini-2.5-flash'
    : selected.name === 'openai'
      ? process.env.OPENAI_MODEL || 'gpt-4o-mini'
      : null;
  return {
    provider: providerOverride?.providerName || (providerOverride ? 'mock' : selected.name),
    configured: active.configured === true,
    model: active.configured === true ? (providerOverride ? (providerOverride.model || null) : model) : null,
    mode: active.configured === true ? 'available' : 'demo',
    ...(selected.configurationError ? { configurationError: selected.configurationError } : {}),
  };
}

async function generateStructured(request) {
  return selectedProvider().generateStructured(request);
}

function setProvider(nextProvider) {
  if (!nextProvider || typeof nextProvider.generateStructured !== 'function') {
    throw new Error('AI provider must implement generateStructured().');
  }
  providerOverride = nextProvider;
}

function resetProvider() {
  providerOverride = null;
}

module.exports = { getStatus, generateStructured, setProvider, resetProvider };

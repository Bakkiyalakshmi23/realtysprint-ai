/**
 * RealtySprint AI — Agent System Initializer
 * agents/index.js
 *
 * Registers all agents into the singleton registry.
 * Import this once at server startup.
 *
 * Usage (in server.js or a route):
 *   const agentSystem = require('../agents');
 *   agentSystem.registry.listAgents();
 */
'use strict';

const registry         = require('./core/agentRegistry');
const founderPA        = require('./company-pa');
const clientAcquisition = require('./client-acquisition');

// Register both agents
registry.register(founderPA);
registry.register(clientAcquisition);

console.log(`[agents] ${registry.count()} agents registered: [${registry.listSlugs().join(', ')}]`);

module.exports = {
  registry,
  founderPA,
  clientAcquisition,
};

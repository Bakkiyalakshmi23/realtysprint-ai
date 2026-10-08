/**
 * RealtySprint AI — Agent Core: Agent Registry
 * agents/core/agentRegistry.js
 *
 * Single registry for all active AI agents.
 * Exactly two agents: company-pa and client-acquisition.
 *
 * Operations:
 *   register(agent)      – add an agent (at startup only)
 *   getAgent(slug)       – get agent by slug (throws if unknown)
 *   listAgents()         – list all registered agents
 *   hasAgent(slug)       – check if slug is registered
 *   listDefinitions()    – safe definitions for API exposure
 */

'use strict';

const ACTIVE_AGENT_SLUGS = new Set(['company-pa', 'client-acquisition']);

class AgentRegistry {
  constructor() {
    this._agents = new Map();
  }

  /**
   * Register an agent instance.
   * @param {BaseAgent} agent
   */
  register(agent) {
    if (!agent || !agent.slug) {
      throw new Error('AgentRegistry.register(): agent must have a slug.');
    }
    if (!ACTIVE_AGENT_SLUGS.has(agent.slug)) {
      throw new Error(`AgentRegistry.register(): "${agent.slug}" is not one of the two active agents.`);
    }
    if (this._agents.has(agent.slug)) {
      throw new Error(`AgentRegistry.register(): agent "${agent.slug}" is already registered.`);
    }
    this._agents.set(agent.slug, agent);
    console.log(`[registry] Registered agent: ${agent.slug} (${agent.name})`);
  }

  /**
   * Get an agent by slug. Throws if not found.
   * @param {string} slug
   * @returns {BaseAgent}
   */
  getAgent(slug) {
    if (!slug) throw new Error('AgentRegistry.getAgent(): slug is required.');
    const agent = this._agents.get(slug.toLowerCase().trim());
    if (!agent) {
      throw new Error(`AgentRegistry.getAgent(): unknown agent slug "${slug}". Registered: [${this.listSlugs().join(', ')}]`);
    }
    return agent;
  }

  /**
   * List all registered agent instances.
   * @returns {BaseAgent[]}
   */
  listAgents() {
    return Array.from(this._agents.values());
  }

  /**
   * Check if a slug is registered.
   * @param {string} slug
   * @returns {boolean}
   */
  hasAgent(slug) {
    return this._agents.has((slug || '').toLowerCase().trim());
  }

  /**
   * List registered slugs.
   * @returns {string[]}
   */
  listSlugs() {
    return Array.from(this._agents.keys());
  }

  /**
   * Safe agent definitions for API/frontend exposure.
   * Never includes secrets or internal state.
   * @returns {object[]}
   */
  listDefinitions() {
    return this.listAgents().map(a => a.toDefinition());
  }

  /**
   * Total count of registered agents.
   * @returns {number}
   */
  count() {
    return this._agents.size;
  }
}

// Singleton instance
const registry = new AgentRegistry();

module.exports = registry;

/**
 * MUHAR STUDIO — Retell AI Service Foundation
 * Handles Retell AI SDK client initialization and safe configuration status checks.
 * Does NOT initiate calls, create numbers, or modify database records at this stage.
 */

const Retell = require('retell-sdk');
const config = require('../config');

let clientInstance = null;

/**
 * Check whether Retell AI is configured with a valid API key.
 * @returns {boolean}
 */
function isConfigured() {
  return config.retell.isConfigured();
}

/**
 * Get or initialize the Retell SDK client singleton.
 * Returns null if RETELL_API_KEY is not configured, preventing startup crashes.
 * @returns {Retell|null}
 */
function getClient() {
  if (!isConfigured()) {
    return null;
  }

  if (!clientInstance) {
    clientInstance = new Retell({
      apiKey: config.retell.apiKey
    });
  }

  return clientInstance;
}

/**
 * Get safe configuration summary without exposing sensitive credentials or keys.
 * @returns {{ configured: boolean, agentIdConfigured: boolean }}
 */
function getConfigStatus() {
  return {
    configured: isConfigured(),
    agentIdConfigured: Boolean(config.retell.agentId && config.retell.agentId.trim())
  };
}

module.exports = {
  Retell,
  isConfigured,
  getClient,
  getConfigStatus
};

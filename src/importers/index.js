/**
 * Session Importers Orchestrator
 *
 * Coordinates importing sessions from multiple AI coding assistants.
 * Uses tools.config.js to determine which importers are enabled
 * and where to find their session files.
 *
 * Supported tools:
 * - Claude Code: ~/.claude/projects/
 * - Codex CLI: ~/.codex/sessions/
 * - Gemini CLI: ~/.gemini/tmp/
 *
 * Each importer parses tool-specific formats (JSONL, JSON)
 * and normalizes them into a common session/message structure.
 */

import { getEnabledTools } from '../tools.config.js';

// Import all available importers
import { importClaudeSessions } from './claude.js';
import { importCodexSessions } from './codex.js';
import { importGeminiSessions } from './gemini.js';

// Map importer names to functions
const importers = {
  claude: importClaudeSessions,
  codex: importCodexSessions,
  gemini: importGeminiSessions
};

/**
 * Import sessions from all enabled AI tools
 * @returns {Object} Import statistics per tool
 */
export async function importAllSessions() {
  const stats = {};
  const enabledTools = getEnabledTools();

  for (const tool of enabledTools) {
    const importer = importers[tool.importer];

    if (importer) {
      try {
        stats[tool.id] = await importer(tool.defaultPath);
      } catch (err) {
        console.error(`  Error importing ${tool.name}:`, err.message);
        stats[tool.id] = 0;
      }
    } else {
      console.warn(`  No importer found for ${tool.name} (${tool.importer})`);
      stats[tool.id] = 0;
    }
  }

  return stats;
}

/**
 * Register a new importer dynamically
 * @param {string} name - Importer name (must match tool.importer in config)
 * @param {Function} importerFn - The importer function
 */
export function registerImporter(name, importerFn) {
  importers[name] = importerFn;
}

/**
 * Get list of available importer names
 */
export function getAvailableImporters() {
  return Object.keys(importers);
}

// Re-export individual importers for direct use
export { importClaudeSessions } from './claude.js';
export { importCodexSessions } from './codex.js';
export { importGeminiSessions } from './gemini.js';

// Re-export utilities
export { maskSecrets, parseJsonlFile, parseJsonFile } from './utils.js';

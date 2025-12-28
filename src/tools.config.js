/**
 * AI Tools Configuration
 *
 * Central registry for all supported AI coding assistants.
 * Controls which tools are imported and how they appear in the UI.
 *
 * Each tool defines:
 * - id: Unique identifier (used in DB and API)
 * - name: Display name in the UI
 * - icon: Font Awesome icon class
 * - color: Tailwind CSS color class
 * - enabled: Whether the tool is active
 * - defaultPath: Path to session files (relative to home dir)
 * - importer: Name of the importer module in src/importers/
 *
 * Adding a new AI tool:
 * 1. Create src/importers/newtool.js with importNewtoolSessions()
 * 2. Add entry to TOOLS array below
 * 3. Register in src/importers/index.js
 */

import { homedir } from 'os';
import { join } from 'path';

const home = homedir();

export const tools = [
  {
    id: 'claude',
    name: 'Claude Code',
    icon: 'fa-robot',
    color: 'text-orange-500',
    enabled: true,
    defaultPath: join(home, '.claude', 'projects'),
    importer: 'claude'
  },
  {
    id: 'codex',
    name: 'Codex',
    icon: 'fa-code',
    color: 'text-green-500',
    enabled: true,
    defaultPath: join(home, '.codex', 'sessions'),
    importer: 'codex'
  },
  {
    id: 'gemini',
    name: 'Gemini',
    icon: 'fa-gem',
    color: 'text-blue-500',
    enabled: true,
    defaultPath: join(home, '.gemini'),
    importer: 'gemini'
  }
];

/**
 * Get tool by ID
 */
export function getTool(id) {
  return tools.find(t => t.id === id);
}

/**
 * Get all enabled tools
 */
export function getEnabledTools() {
  return tools.filter(t => t.enabled);
}

/**
 * Get tool display info for frontend (without paths)
 */
export function getToolsForFrontend() {
  return tools.map(({ id, name, icon, color, enabled }) => ({
    id,
    name,
    icon,
    color,
    enabled
  }));
}

export default tools;

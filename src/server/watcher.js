/**
 * File watcher for new AI coding sessions
 * Watches ~/.claude, ~/.codex, ~/.gemini for new session files
 */

import chokidar from 'chokidar';
import { homedir } from 'os';
import { join } from 'path';
import { importClaudeSessions, importCodexSessions, importGeminiSessions } from '../importers/index.js';

// Debounce timer
let importTimer = null;
const DEBOUNCE_MS = 2000;

/**
 * Start watching for new session files
 */
export function startWatcher() {
  const watchPaths = [
    join(homedir(), '.claude', 'projects'),
    join(homedir(), '.codex', 'sessions'),
    join(homedir(), '.gemini', 'tmp')
  ];

  console.log('👀 Watching for new sessions...');

  const watcher = chokidar.watch(watchPaths, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true,
    depth: 5
  });

  watcher.on('add', (filePath) => {
    // Only react to session files
    if (filePath.endsWith('.jsonl') || (filePath.endsWith('.json') && filePath.includes('session-'))) {
      console.log(`📄 New session file detected: ${filePath}`);
      scheduleImport(filePath);
    }
  });

  watcher.on('change', (filePath) => {
    // Session updated (e.g., new messages added)
    if (filePath.endsWith('.jsonl') || (filePath.endsWith('.json') && filePath.includes('session-'))) {
      scheduleImport(filePath);
    }
  });

  watcher.on('error', (error) => {
    console.error('Watcher error:', error);
  });

  return watcher;
}

/**
 * Schedule import with debouncing
 * (multiple file changes can happen rapidly, we want to batch them)
 */
function scheduleImport(filePath) {
  if (importTimer) {
    clearTimeout(importTimer);
  }

  importTimer = setTimeout(async () => {
    try {
      // Determine which importer to use based on path
      if (filePath.includes('.claude')) {
        const count = await importClaudeSessions();
        if (count > 0) console.log(`  ✅ Imported ${count} Claude session(s)`);
      } else if (filePath.includes('.codex')) {
        const count = await importCodexSessions();
        if (count > 0) console.log(`  ✅ Imported ${count} Codex session(s)`);
      } else if (filePath.includes('.gemini')) {
        const count = await importGeminiSessions();
        if (count > 0) console.log(`  ✅ Imported ${count} Gemini session(s)`);
      }
    } catch (error) {
      console.error('Import error:', error);
    }
  }, DEBOUNCE_MS);
}

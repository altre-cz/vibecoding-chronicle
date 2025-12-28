/**
 * Codex CLI session importer
 * Imports from ~/.codex/sessions/
 */

import { existsSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import { glob } from 'fs/promises';
import { upsertSession, insertMessages, sessionExists } from '../db/index.js';
import { parseJsonlFile, generateMessageId, truncate } from './utils.js';

const DEFAULT_PATH = join(homedir(), '.codex', 'sessions');

/**
 * Import Codex CLI sessions
 * @param {string} codexPath - Path to Codex sessions directory
 * @returns {number} Number of imported sessions
 */
export async function importCodexSessions(codexPath = DEFAULT_PATH) {
  if (!existsSync(codexPath)) {
    console.log(`  Codex path not found: ${codexPath}`);
    return 0;
  }

  let imported = 0;

  // Find all JSONL files recursively
  const pattern = join(codexPath, '**', '*.jsonl');
  let jsonlFiles = [];

  try {
    // Node 22+ has glob in fs/promises
    for await (const file of glob(pattern)) {
      jsonlFiles.push(file);
    }
  } catch {
    // Fallback: manual recursive search
    jsonlFiles = await findJsonlFilesRecursive(codexPath);
  }

  for (const filePath of jsonlFiles) {
    // Extract session ID from filename (format: something-UUID.jsonl)
    const fileName = basename(filePath, '.jsonl');
    const sessionId = fileName.split('-').pop();

    // Skip if already imported
    if (sessionExists(sessionId)) {
      continue;
    }

    const { messages: rawMessages, errors } = parseJsonlFile(filePath);
    if (rawMessages.length === 0) {
      continue;
    }

    // Extract session metadata
    let projectName = null;
    let summary = null;
    let firstTs = null;
    let lastTs = null;
    const messages = [];

    for (let i = 0; i < rawMessages.length; i++) {
      const msg = rawMessages[i];
      const msgType = msg.type || '';
      const ts = msg.timestamp;

      if (ts) {
        if (!firstTs) firstTs = ts;
        lastTs = ts;
      }

      if (msgType === 'session_meta') {
        const payload = msg.payload || {};
        const cwd = payload.cwd || '';
        if (cwd) {
          projectName = cwd.includes('/') ? cwd.split('/').pop() : cwd;
        }
      } else if (msgType === 'response_item') {
        const payload = msg.payload || {};
        const role = payload.role || '';

        if (role === 'user' || role === 'assistant') {
          // Extract content
          let content = null;
          const contentList = payload.content || [];

          if (Array.isArray(contentList)) {
            const textParts = [];
            for (const part of contentList) {
              if (typeof part === 'object') {
                const text = part.text || part.output_text || '';
                if (text) textParts.push(text);
              }
            }
            content = textParts.length > 0 ? textParts.join('\n') : null;
          }

          // Use first user message as summary (skip environment context)
          if (role === 'user' && !summary && content) {
            if (!content.startsWith('<environment_context>')) {
              summary = truncate(content, 200);
            }
          }

          messages.push({
            id: generateMessageId(sessionId, i),
            type: role,
            content,
            thinking: null,
            timestamp: ts,
            tool_name: null,
            tool_input: null,
            tool_output: null,
            position: i
          });
        }
      }
    }

    if (!projectName) {
      projectName = 'unknown';
    }

    // Insert session
    upsertSession({
      id: sessionId,
      tool: 'codex',
      project: projectName,
      project_path: null,
      started_at: firstTs,
      ended_at: lastTs,
      message_count: messages.length,
      summary
    });

    // Insert messages
    if (messages.length > 0) {
      insertMessages(sessionId, messages);
    }

    imported++;
  }

  return imported;
}

/**
 * Fallback: manually find JSONL files recursively
 */
async function findJsonlFilesRecursive(dir) {
  const { readdir, stat } = await import('fs/promises');
  const files = [];

  async function walk(currentDir) {
    const entries = await readdir(currentDir);
    for (const entry of entries) {
      const fullPath = join(currentDir, entry);
      const stats = await stat(fullPath);
      if (stats.isDirectory()) {
        await walk(fullPath);
      } else if (entry.endsWith('.jsonl')) {
        files.push(fullPath);
      }
    }
  }

  await walk(dir);
  return files;
}

export default importCodexSessions;

/**
 * Claude Code session importer
 * Imports from ~/.claude/projects/
 */

import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { upsertSession, insertMessages, sessionExists } from '../db/index.js';
import { parseJsonlFile, extractProjectName, generateMessageId } from './utils.js';

const DEFAULT_PATH = join(homedir(), '.claude', 'projects');

/**
 * Extract text content and thinking from a Claude message
 */
function extractMessageContent(msg) {
  let content = null;
  let thinking = null;

  if (msg.message) {
    const message = msg.message;
    if (typeof message.content === 'string') {
      content = message.content;
    } else if (Array.isArray(message.content)) {
      const textParts = [];
      for (const part of message.content) {
        if (typeof part === 'object') {
          if (part.type === 'text') {
            textParts.push(part.text || '');
          } else if (part.type === 'thinking') {
            thinking = part.thinking || '';
          }
        }
      }
      content = textParts.length > 0 ? textParts.join('\n') : null;
    }
  } else if (msg.content) {
    content = typeof msg.content === 'string' ? msg.content : null;
  }

  return { content, thinking };
}

/**
 * Import Claude Code sessions
 * @param {string} claudePath - Path to Claude projects directory
 * @returns {number} Number of imported sessions
 */
export async function importClaudeSessions(claudePath = DEFAULT_PATH) {
  if (!existsSync(claudePath)) {
    console.log(`  Claude path not found: ${claudePath}`);
    return 0;
  }

  let imported = 0;

  // Iterate through project directories
  const projectDirs = readdirSync(claudePath).filter(name => {
    const fullPath = join(claudePath, name);
    return statSync(fullPath).isDirectory();
  });

  for (const projectDir of projectDirs) {
    const projectPath = join(claudePath, projectDir);
    const projectName = extractProjectName(projectDir);

    // Find all JSONL files in project directory
    const jsonlFiles = readdirSync(projectPath).filter(f => f.endsWith('.jsonl'));

    for (const jsonlFile of jsonlFiles) {
      const sessionId = jsonlFile.replace('.jsonl', '');

      // Skip if already imported
      if (sessionExists(sessionId)) {
        continue;
      }

      const filePath = join(projectPath, jsonlFile);
      const rawMessages = parseJsonlFile(filePath);

      if (rawMessages.length === 0) {
        continue;
      }

      // Extract session metadata
      let summary = null;
      let firstTs = null;
      let lastTs = null;
      const messages = [];

      for (let i = 0; i < rawMessages.length; i++) {
        const msg = rawMessages[i];
        const msgType = msg.type || '';
        const ts = msg.timestamp;

        if (msgType === 'summary') {
          summary = msg.summary || '';
        }

        if (ts) {
          if (!firstTs) firstTs = ts;
          lastTs = ts;
        }

        if (msgType === 'user' || msgType === 'assistant') {
          const { content, thinking } = extractMessageContent(msg);

          messages.push({
            id: msg.uuid || generateMessageId(sessionId, i),
            type: msgType,
            content,
            thinking,
            timestamp: ts,
            tool_name: null,
            tool_input: null,
            tool_output: null,
            position: i
          });
        }
      }

      // Insert session
      upsertSession({
        id: sessionId,
        tool: 'claude',
        project: projectName,
        project_path: projectPath,
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
  }

  return imported;
}

export default importClaudeSessions;

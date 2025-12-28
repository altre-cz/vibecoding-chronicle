/**
 * Gemini CLI session importer
 * Imports from ~/.gemini/tmp/[hash]/chats/
 */

import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { upsertSession, insertMessages, sessionExists } from '../db/index.js';
import { parseJsonFile, generateMessageId, truncate } from './utils.js';

const DEFAULT_PATH = join(homedir(), '.gemini', 'tmp');

/**
 * Import Gemini CLI sessions
 * @param {string} geminiPath - Path to Gemini tmp directory
 * @returns {number} Number of imported sessions
 */
export async function importGeminiSessions(geminiPath = DEFAULT_PATH) {
  if (!existsSync(geminiPath)) {
    console.log(`  Gemini path not found: ${geminiPath}`);
    return 0;
  }

  let imported = 0;

  // Find all session JSON files in */chats/ subdirectories
  const tmpDirs = readdirSync(geminiPath).filter(name => {
    const fullPath = join(geminiPath, name);
    return statSync(fullPath).isDirectory();
  });

  for (const tmpDir of tmpDirs) {
    const chatsDir = join(geminiPath, tmpDir, 'chats');
    if (!existsSync(chatsDir)) {
      continue;
    }

    // Find session-*.json files
    const sessionFiles = readdirSync(chatsDir).filter(f =>
      f.startsWith('session-') && f.endsWith('.json')
    );

    for (const sessionFile of sessionFiles) {
      const filePath = join(chatsDir, sessionFile);
      const sessionData = parseJsonFile(filePath);

      if (!sessionData) {
        continue;
      }

      const sessionId = sessionData.sessionId || sessionFile.replace('.json', '');

      // Skip if already imported
      if (sessionExists(sessionId)) {
        continue;
      }

      // Extract session metadata
      const projectHash = sessionData.projectHash || 'unknown';
      const projectName = `gemini-${projectHash.slice(0, 8)}`;

      const firstTs = sessionData.startTime;
      const lastTs = sessionData.lastUpdated;

      const rawMessages = sessionData.messages || [];
      if (rawMessages.length === 0) {
        continue;
      }

      let summary = null;
      const messages = [];

      for (let i = 0; i < rawMessages.length; i++) {
        const msg = rawMessages[i];
        let msgType = msg.type || '';
        const ts = msg.timestamp;
        const content = msg.content || '';

        // Map gemini -> assistant
        if (msgType === 'gemini') {
          msgType = 'assistant';
        } else if (msgType === 'info') {
          // Skip info messages
          continue;
        }

        if (msgType === 'user' || msgType === 'assistant') {
          // Extract thinking from thoughts array
          let thinking = null;
          const thoughts = msg.thoughts || [];
          if (thoughts.length > 0) {
            const thinkingParts = [];
            for (const thought of thoughts) {
              const subject = thought.subject || '';
              const desc = thought.description || '';
              if (subject || desc) {
                thinkingParts.push(subject ? `**${subject}**\n${desc}` : desc);
              }
            }
            thinking = thinkingParts.length > 0 ? thinkingParts.join('\n\n') : null;
          }

          // Use first user message as summary (clean content)
          if (msgType === 'user' && !summary && content) {
            // Remove "--- Content from referenced files ---" and everything after
            let cleanContent = content.split('--- Content from referenced files ---')[0].trim();
            if (cleanContent && !cleanContent.startsWith('/')) {
              summary = truncate(cleanContent, 200);
            }
          }

          messages.push({
            id: msg.id || generateMessageId(sessionId, i),
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

      if (!summary) {
        summary = 'Gemini session';
      }

      // Insert session
      upsertSession({
        id: sessionId,
        tool: 'gemini',
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
  }

  return imported;
}

export default importGeminiSessions;

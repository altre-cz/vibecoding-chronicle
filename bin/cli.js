#!/usr/bin/env node

/**
 * CLI Entry Point for Vibecoding Chronicle
 *
 * Provides command-line interface for the application:
 * - serve: Start the web server (default command)
 * - import: Manually trigger session import
 *
 * Usage:
 * - npx vibecoding-chronicle serve --port 3000
 * - npx vibecoding-chronicle serve --dev --no-open
 * - vcc serve (if installed globally)
 */

import { Command } from 'commander';
import { startServer } from '../src/server/index.js';
import { importAllSessions } from '../src/importers/index.js';
import { initDb } from '../src/db/index.js';

const program = new Command();

program
  .name('vibecoding-chronicle')
  .description('Beautiful explorer for AI coding assistant transcripts')
  .version('1.0.0');

program
  .command('serve')
  .description('Start the Chronicle server')
  .option('-p, --port <number>', 'Port to listen on', '3000')
  .option('--no-open', 'Do not open browser automatically')
  .option('--no-watch', 'Do not watch for new sessions')
  .option('--dev', 'Development mode with verbose logging')
  .action(async (options) => {
    const port = parseInt(options.port);
    console.log('🚀 Starting Vibecoding Chronicle...');

    // Initialize database
    await initDb();

    // Import sessions
    console.log('📥 Importing sessions...');
    const stats = await importAllSessions();
    console.log(`   Claude: ${stats.claude} sessions`);
    console.log(`   Codex: ${stats.codex} sessions`);
    console.log(`   Gemini: ${stats.gemini} sessions`);

    // Start server
    await startServer({
      port,
      open: options.open,
      watch: options.watch,
      dev: options.dev
    });
  });

program
  .command('import')
  .description('Import sessions without starting server')
  .action(async () => {
    await initDb();
    console.log('📥 Importing sessions...');
    const stats = await importAllSessions();
    console.log(`✅ Imported: Claude ${stats.claude}, Codex ${stats.codex}, Gemini ${stats.gemini}`);
  });

program.parse();

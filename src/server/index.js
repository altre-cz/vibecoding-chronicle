/**
 * Express Server for Vibecoding Chronicle
 *
 * Main entry point for the web application. Sets up Express
 * with EJS templating, static file serving, and API routes.
 *
 * Features:
 * - EJS layouts with partials (header, sidebar, pages)
 * - REST API endpoints for sessions, tags, and stats
 * - File watcher for auto-importing new AI sessions
 * - Automatic browser opening on startup
 *
 * Usage:
 * - startServer({ port: 3000, dev: false, open: true })
 */

import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import open from 'open';
import expressEjsLayouts from 'express-ejs-layouts';
import { setupRoutes } from './routes.js';
import { setupViewRoutes } from './viewRoutes.js';
import { startWatcher } from './watcher.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..', '..');

/**
 * Start the Chronicle server
 */
export async function startServer(options = {}) {
  const {
    port = 3000,
    open: openBrowser = true,
    watch = true,
    dev = false
  } = options;

  const app = express();

  // EJS View Engine
  app.set('view engine', 'ejs');
  app.set('views', join(ROOT_DIR, 'views'));
  app.use(expressEjsLayouts);
  app.set('layout', 'layout');

  // Middleware
  app.use(express.json());

  // Logging in dev mode
  if (dev) {
    app.use((req, res, next) => {
      console.log(`${req.method} ${req.path}`);
      next();
    });
  }

  // Static files from public directory
  app.use(express.static(join(ROOT_DIR, 'public')));

  // Setup view routes (EJS pages)
  setupViewRoutes(app);

  // Setup API routes
  setupRoutes(app);

  // Start server
  app.listen(port, () => {
    console.log(`\n✨ Vibecoding Chronicle running at http://localhost:${port}\n`);

    if (openBrowser) {
      open(`http://localhost:${port}`);
    }
  });

  // Start file watcher for new sessions
  if (watch) {
    startWatcher();
  }

  return app;
}

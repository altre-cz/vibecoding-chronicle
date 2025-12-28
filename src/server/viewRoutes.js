/**
 * View Routes for EJS rendering
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getTagsWithCounts } from '../db/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'));

/**
 * Get common data for all pages (sidebar data)
 */
function getCommonData() {
  const tags = getTagsWithCounts();

  return {
    tags,
    projects: [],  // Will be loaded via API
    tools: ['claude', 'codex', 'gemini'],
    appVersion: pkg.version,
    appName: pkg.name
  };
}

/**
 * Setup view routes for EJS pages
 */
export function setupViewRoutes(app) {

  /**
   * GET / - Sessions list (home page)
   */
  app.get('/', (req, res) => {
    res.render('pages/sessions', {
      title: 'Sessions',
      currentPage: 'sessions',
      showSidebar: true,
      ...getCommonData()
    });
  });

  /**
   * GET /session/:id - Session detail
   */
  app.get('/session/:id', (req, res) => {
    res.render('pages/session', {
      title: 'Session',
      currentPage: 'session',
      showSidebar: true,
      sessionId: req.params.id,
      ...getCommonData()
    });
  });

}

/**
 * View Routes for EJS rendering
 */

import { getTagsWithCounts } from '../db/index.js';

/**
 * Get common data for all pages (sidebar data)
 */
function getCommonData() {
  const tags = getTagsWithCounts();

  return {
    tags,
    projects: [],  // Will be loaded via API
    tools: ['claude', 'codex', 'gemini'],
    selectedTag: null
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

  /**
   * GET /tagged - Tagged messages
   */
  app.get('/tagged', (req, res) => {
    const tagFilter = req.query.tag || null;

    res.render('pages/tagged', {
      title: 'Tagged Messages',
      currentPage: 'tagged',
      showSidebar: true,
      selectedTag: tagFilter,
      ...getCommonData()
    });
  });
}

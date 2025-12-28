/**
 * API Routes for Vibecoding Chronicle
 *
 * Handles all REST API endpoints for the application:
 * - Sessions: List, get details, search with full-text
 * - Stars/Tags: Add, remove, list tags on messages
 * - Tags: CRUD operations for tag definitions
 * - Stats: Aggregate statistics
 *
 * All data is stored locally in SQLite. Input validation
 * is applied to prevent injection and limit abuse.
 */

// Input validation limits
const LIMITS = {
  TAG_ID: 50,
  TAG_LABEL: 100,
  NOTE: 500,
  SEARCH_QUERY: 200
};

/**
 * Validate and sanitize string input
 */
function validateString(value, maxLength, fieldName) {
  if (typeof value !== 'string') {
    return { error: `${fieldName} must be a string` };
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { error: `${fieldName} cannot be empty` };
  }
  if (trimmed.length > maxLength) {
    return { error: `${fieldName} exceeds maximum length of ${maxLength} characters` };
  }
  return { value: trimmed };
}

import {
  getAllSessions,
  getSessionsCount,
  getSession,
  getMessages,
  getStarsForSession,
  getAllStars,
  addTag,
  removeTag,
  getMessageTags,
  deleteStar,
  getStarCounts,
  getAllTags,
  getTagsWithCounts,
  getTag,
  createTag,
  updateTag,
  deleteTag,
  getSessionTagCounts,
  searchMessages
} from '../db/index.js';
import { maskSecrets } from '../importers/utils.js';
import { getToolsForFrontend } from '../tools.config.js';

/**
 * Setup all API routes
 */
export function setupRoutes(app) {

  // ============ TOOLS ============

  /**
   * GET /api/tools
   * Get available AI tools configuration
   */
  app.get('/api/tools', (req, res) => {
    try {
      const tools = getToolsForFrontend();
      res.json({ tools });
    } catch (error) {
      console.error('Error fetching tools:', error);
      res.status(500).json({ error: 'Failed to fetch tools' });
    }
  });

  // ============ SESSIONS ============

  /**
   * GET /api/sessions
   * List all sessions with sidebar counts
   * Query params: q (search query, min 3 chars)
   */
  app.get('/api/sessions', (req, res) => {
    try {
      // Load all sessions (filtering/pagination done client-side)
      const sessions = getAllSessions({ limit: 100000, offset: 0 });
      const totalCount = sessions.length;

      // Get tag counts per session
      const tagCounts = getSessionTagCounts();
      const tagCountMap = {};
      for (const tc of tagCounts) {
        tagCountMap[tc.session_id] = tc.tag_count;
      }

      // Add tag_count to each session
      for (const session of sessions) {
        session.tag_count = tagCountMap[session.id] || 0;
      }

      // Calculate sidebar counts from ALL sessions
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const last7Date = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];
      const last30Date = new Date(Date.now() - 29 * 86400000).toISOString().split('T')[0];
      const thisMonthDate = new Date().toISOString().slice(0, 7) + '-01';

      const sidebarCounts = {
        dateCounts: { today: 0, yesterday: 0, last7: 0, last30: 0, thisMonth: 0 },
        toolCounts: {},
        projectCounts: {}
      };

      for (const s of sessions) {
        const date = s.started_at?.split('T')[0];
        if (date) {
          if (date === today) sidebarCounts.dateCounts.today++;
          if (date === yesterday) sidebarCounts.dateCounts.yesterday++;
          if (date >= last7Date && date <= today) sidebarCounts.dateCounts.last7++;
          if (date >= last30Date && date <= today) sidebarCounts.dateCounts.last30++;
          if (date >= thisMonthDate && date <= today) sidebarCounts.dateCounts.thisMonth++;
        }
        // Tool counts
        const tool = s.tool || 'claude';
        sidebarCounts.toolCounts[tool] = (sidebarCounts.toolCounts[tool] || 0) + 1;
        // Project counts
        const project = s.project || 'unknown';
        sidebarCounts.projectCounts[project] = (sidebarCounts.projectCounts[project] || 0) + 1;
      }

      // Full-text search in messages + summary/project (server-side for FTS)
      let filtered = sessions;
      if (req.query.q && req.query.q.trim().length >= 3) {
        const query = req.query.q.trim().toLowerCase();

        // Get session IDs that have matching messages (FTS)
        const ftsResults = searchMessages(query);
        const ftsSessionIds = new Set(ftsResults.map(r => r.session_id));

        // Filter: match in messages (FTS) OR in summary/project
        filtered = filtered.filter(s =>
          ftsSessionIds.has(s.id) ||
          s.summary?.toLowerCase().includes(query) ||
          s.project?.toLowerCase().includes(query)
        );
      }

      // Group by date for UI
      const byDate = {};
      for (const session of filtered) {
        if (session.started_at) {
          const date = session.started_at.split('T')[0];
          if (!byDate[date]) byDate[date] = [];
          byDate[date].push(session);
        }
      }

      res.json({
        sessions: filtered,
        byDate,
        sidebarCounts,
        meta: {
          total: filtered.length,
          totalAll: totalCount
        }
      });
    } catch (error) {
      console.error('Error fetching sessions:', error);
      res.status(500).json({ error: 'Failed to fetch sessions' });
    }
  });

  /**
   * GET /api/sessions/:id
   * Get a single session with all messages
   */
  app.get('/api/sessions/:id', (req, res) => {
    try {
      const session = getSession(req.params.id);

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Get messages and mask secrets
      const messages = getMessages(req.params.id).map(msg => ({
        ...msg,
        content: maskSecrets(msg.content),
        thinking: maskSecrets(msg.thinking),
        tool_output: maskSecrets(msg.tool_output)
      }));

      // Get stars/tags for this session (multiple per message)
      const stars = getStarsForSession(req.params.id);
      const starsMap = {};
      for (const star of stars) {
        if (!starsMap[star.message_id]) {
          starsMap[star.message_id] = [];
        }
        starsMap[star.message_id].push(star.tag);
      }

      res.json({
        session,
        messages,
        stars: starsMap
      });
    } catch (error) {
      console.error('Error fetching session:', error);
      res.status(500).json({ error: 'Failed to fetch session' });
    }
  });


  // ============ STARS ============

  /**
   * GET /api/stars
   * Get all starred messages across all sessions
   */
  app.get('/api/stars', (req, res) => {
    try {
      const stars = getAllStars();
      const counts = getStarCounts();

      res.json({
        stars,
        counts: counts.reduce((acc, c) => {
          acc[c.tag] = c.count;
          return acc;
        }, {})
      });
    } catch (error) {
      console.error('Error fetching stars:', error);
      res.status(500).json({ error: 'Failed to fetch stars' });
    }
  });

  /**
   * GET /api/stars/:sessionId
   * Get stars for a specific session
   */
  app.get('/api/stars/:sessionId', (req, res) => {
    try {
      const stars = getStarsForSession(req.params.sessionId);

      // Convert to map format
      const starsMap = {};
      for (const star of stars) {
        starsMap[star.message_id] = {
          tag: star.tag,
          note: star.note
        };
      }

      res.json(starsMap);
    } catch (error) {
      console.error('Error fetching stars:', error);
      res.status(500).json({ error: 'Failed to fetch stars' });
    }
  });

  /**
   * POST /api/stars/:sessionId/:messageId
   * Add a tag to a message
   */
  app.post('/api/stars/:sessionId/:messageId', (req, res) => {
    try {
      const { sessionId, messageId } = req.params;
      const { tag, note = '' } = req.body;

      // Validate tag
      const tagValidation = validateString(tag, LIMITS.TAG_ID, 'Tag');
      if (tagValidation.error) {
        return res.status(400).json({ error: tagValidation.error });
      }

      // Validate note (optional, but if provided must be valid)
      let validatedNote = '';
      if (note) {
        const noteValidation = validateString(note, LIMITS.NOTE, 'Note');
        if (noteValidation.error) {
          return res.status(400).json({ error: noteValidation.error });
        }
        validatedNote = noteValidation.value;
      }

      addTag(sessionId, messageId, tagValidation.value, validatedNote);

      // Return all tags for this message
      const tags = getMessageTags(sessionId, messageId);

      res.json({
        success: true,
        tags: tags.map(t => t.tag)
      });
    } catch (error) {
      console.error('Error saving tag:', error);
      res.status(500).json({ error: 'Failed to save tag' });
    }
  });

  /**
   * DELETE /api/stars/:sessionId/:messageId
   * Remove all tags from a message
   */
  app.delete('/api/stars/:sessionId/:messageId', (req, res) => {
    try {
      const { sessionId, messageId } = req.params;
      deleteStar(sessionId, messageId);

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting tags:', error);
      res.status(500).json({ error: 'Failed to delete tags' });
    }
  });

  /**
   * DELETE /api/stars/:sessionId/:messageId/:tag
   * Remove a specific tag from a message
   */
  app.delete('/api/stars/:sessionId/:messageId/:tag', (req, res) => {
    try {
      const { sessionId, messageId, tag } = req.params;
      removeTag(sessionId, messageId, tag);

      // Return remaining tags
      const tags = getMessageTags(sessionId, messageId);

      res.json({
        success: true,
        tags: tags.map(t => t.tag)
      });
    } catch (error) {
      console.error('Error removing tag:', error);
      res.status(500).json({ error: 'Failed to remove tag' });
    }
  });


  // ============ TAGS ============

  /**
   * GET /api/tags
   * Get all tags with usage counts
   */
  app.get('/api/tags', (req, res) => {
    try {
      const tags = getTagsWithCounts();
      res.json({ tags });
    } catch (error) {
      console.error('Error fetching tags:', error);
      res.status(500).json({ error: 'Failed to fetch tags' });
    }
  });

  /**
   * POST /api/tags
   * Create a new tag
   */
  app.post('/api/tags', (req, res) => {
    try {
      const { id, label } = req.body;

      // Validate id
      const idValidation = validateString(id, LIMITS.TAG_ID, 'Tag ID');
      if (idValidation.error) {
        return res.status(400).json({ error: idValidation.error });
      }

      // Validate label
      const labelValidation = validateString(label, LIMITS.TAG_LABEL, 'Label');
      if (labelValidation.error) {
        return res.status(400).json({ error: labelValidation.error });
      }

      // Check if tag already exists
      if (getTag(idValidation.value)) {
        return res.status(409).json({ error: 'Tag already exists' });
      }

      createTag({ id: idValidation.value, label: labelValidation.value });
      const newTag = getTag(idValidation.value);

      res.json({ success: true, tag: { ...newTag, count: 0 } });
    } catch (error) {
      console.error('Error creating tag:', error);
      res.status(500).json({ error: 'Failed to create tag' });
    }
  });

  /**
   * PUT /api/tags/:id
   * Update a tag
   */
  app.put('/api/tags/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { label } = req.body;

      // Validate label
      const labelValidation = validateString(label, LIMITS.TAG_LABEL, 'Label');
      if (labelValidation.error) {
        return res.status(400).json({ error: labelValidation.error });
      }

      const tag = getTag(id);
      if (!tag) {
        return res.status(404).json({ error: 'Tag not found' });
      }

      updateTag(id, { label: labelValidation.value });
      const updated = getTag(id);

      res.json({ success: true, tag: updated });
    } catch (error) {
      console.error('Error updating tag:', error);
      res.status(500).json({ error: 'Failed to update tag' });
    }
  });

  /**
   * DELETE /api/tags/:id
   * Delete a tag (only if not in use)
   */
  app.delete('/api/tags/:id', (req, res) => {
    try {
      const { id } = req.params;

      const result = deleteTag(id);

      if (result.error) {
        return res.status(409).json({
          error: result.error,
          count: result.count
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting tag:', error);
      res.status(500).json({ error: 'Failed to delete tag' });
    }
  });


  // ============ STATS ============

  /**
   * GET /api/stats
   * Get overall statistics
   */
  app.get('/api/stats', (req, res) => {
    try {
      const sessions = getAllSessions();
      const stars = getAllStars();

      const toolCounts = {};
      for (const s of sessions) {
        toolCounts[s.tool] = (toolCounts[s.tool] || 0) + 1;
      }

      const projectCounts = {};
      for (const s of sessions) {
        projectCounts[s.project] = (projectCounts[s.project] || 0) + 1;
      }

      res.json({
        totalSessions: sessions.length,
        totalStars: stars.length,
        byTool: toolCounts,
        byProject: projectCounts
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });


}

/**
 * API Routes for Vibecoding Chronicle
 */

import {
  getAllSessions,
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
   * List all sessions with optional filters
   */
  app.get('/api/sessions', (req, res) => {
    try {
      const sessions = getAllSessions();

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

      // Apply filters from query params
      let filtered = sessions;

      // Filter by tool
      if (req.query.tool) {
        const tools = req.query.tool.split(',');
        filtered = filtered.filter(s => tools.includes(s.tool));
      }

      // Filter by project
      if (req.query.project) {
        const projects = req.query.project.split(',');
        filtered = filtered.filter(s => projects.includes(s.project));
      }

      // Filter by date range
      if (req.query.from) {
        filtered = filtered.filter(s => s.started_at >= req.query.from);
      }
      if (req.query.to) {
        filtered = filtered.filter(s => s.started_at <= req.query.to);
      }

      // Full-text search in messages + summary/project
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

      // Get unique projects and tools for filters
      const allProjects = [...new Set(sessions.map(s => s.project))].sort();
      const allTools = [...new Set(sessions.map(s => s.tool))].sort();

      res.json({
        sessions: filtered,
        byDate,
        meta: {
          total: filtered.length,
          projects: allProjects,
          tools: allTools
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

      if (!tag) {
        return res.status(400).json({ error: 'Tag is required' });
      }

      addTag(sessionId, messageId, tag, note);

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

      if (!id || !label) {
        return res.status(400).json({ error: 'Missing required fields (id, label)' });
      }

      // Check if tag already exists
      if (getTag(id)) {
        return res.status(409).json({ error: 'Tag already exists' });
      }

      createTag({ id, label });
      const newTag = getTag(id);

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

      const tag = getTag(id);
      if (!tag) {
        return res.status(404).json({ error: 'Tag not found' });
      }

      updateTag(id, { label });
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

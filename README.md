# Vibecoding Chronicle

> **Ever lost that perfect solution Claude gave you last week?** This tool helps you find it.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-18+-green.svg)

![Vibecoding Chronicle Screenshot](docs/screenshot.png)

## The Problem

You've been coding with AI assistants for months. Somewhere in those hundreds of conversations is the exact solution you need right now - that clever regex, that Docker fix, that authentication pattern. But where?

AI coding assistants like **Claude Code**, **Codex CLI**, and **Gemini CLI** save conversation logs locally, but they're just raw files scattered across your system. Good luck finding anything.

## The Solution

**Vibecoding Chronicle** turns your AI conversation history into a searchable, organized knowledge base:

- **Full-Text Search** - Find any conversation by searching message content
- **Tag Important Moments** - Mark solutions as "Best Practice", "Troubleshooting", or custom tags
- **Filter Everything** - By date, project, AI tool, or tags
- **All Local** - Your data stays on your machine. No cloud, no accounts, no tracking.

It's like having a personal wiki of every problem you've solved with AI.

## Features

- **Multi-Tool Support** - Import sessions from Claude Code, Codex CLI, and Gemini CLI
- **Beautiful UI** - Modern, responsive design with TailwindCSS
- **Dark/Light Mode** - Persistent theme switching
- **Date Range Filtering** - Presets + custom range with session counts
- **AI Tools Filter** - Filter by AI assistant with counts
- **Project Multi-Select** - Filter by multiple projects with search
- **Tags Filter** - Filter sessions by tagged messages
- **Full-Text Search** - Search across all your sessions
- **Tagging System** - Tag important messages for later reference
- **Tag Indicators** - See which sessions have tagged messages at a glance
- **Refresh Button** - Manually refresh data to see new sessions
- **Secret Masking** - Automatically redacts API keys, tokens, passwords
- **Live Server** - Express.js server with hot reload
- **File Watcher** - Automatically imports new sessions

## Installation

### Prerequisites

- Node.js 18+
- npm

### Quick Start

```bash
# Clone the repository
git clone https://github.com/altre-cz/vibecoding-chronicle.git
cd vibecoding-chronicle

# Install dependencies
npm install

# Start the server
npm start
```

The server will start at `http://localhost:3000` and automatically open in your browser.

## Usage

### CLI Commands

```bash
# Start server (default port 3000)
npm start

# Start on custom port
npm start -- --port 8080

# Start without opening browser
npm start -- --no-open

# Start in development mode (with request logging)
npm start -- --dev
```

### Data Storage

- **Sessions Database**: `~/.vibecoding-chronicle/chronicle.db`
- **Session Sources**:
  - Claude Code: `~/.claude/projects/`
  - Codex CLI: `~/.codex/sessions/`
  - Gemini CLI: `~/.gemini/`

## Adding New AI Tools

The tool configuration is centralized in `src/tools.config.js`:

```javascript
{
  id: 'newtool',
  name: 'New Tool',
  icon: 'fa-robot',           // Font Awesome icon
  color: 'text-purple-500',   // Tailwind color class
  enabled: true,
  defaultPath: join(home, '.newtool', 'sessions'),
  importer: 'newtool'         // Must match importer name
}
```

To add a new AI tool:
1. Create `src/importers/newtool.js` with `importNewtoolSessions()` function
2. Add entry to `src/tools.config.js`
3. Register importer in `src/importers/index.js`

## Project Structure

```
vibecoding-chronicle/
├── bin/
│   └── cli.js              # CLI entry point
├── src/
│   ├── db/
│   │   └── index.js        # SQLite database operations
│   ├── importers/
│   │   ├── index.js        # Importer orchestrator
│   │   ├── claude.js       # Claude Code importer
│   │   ├── codex.js        # Codex CLI importer
│   │   ├── gemini.js       # Gemini CLI importer
│   │   └── utils.js        # Shared utilities (secret masking)
│   ├── server/
│   │   ├── index.js        # Express server setup
│   │   ├── routes.js       # API routes
│   │   ├── viewRoutes.js   # EJS page routes
│   │   └── watcher.js      # File watcher for auto-import
│   └── tools.config.js     # AI tools configuration
├── views/
│   ├── layout.ejs          # Main layout with Alpine.js app
│   ├── pages/
│   │   ├── sessions.ejs    # Session list page
│   │   └── session.ejs     # Session detail page
│   └── partials/
│       ├── header.ejs      # Header with search and actions
│       └── sidebar.ejs     # Sidebar with filters
├── public/                  # Static assets
├── package.json
└── LICENSE
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/tools` | GET | Get available AI tools |
| `/api/sessions` | GET | List sessions with filters |
| `/api/sessions/:id` | GET | Get session with messages |
| `/api/tags` | GET | Get all tags with counts |
| `/api/tags` | POST | Create new tag |
| `/api/stars/:session/:message` | POST | Add tag to message |
| `/api/stars/:session/:message/:tag` | DELETE | Remove tag from message |

## Security

### Automatic Secret Masking

The following patterns are automatically redacted:

- **API Keys**: OpenAI (`sk-*`), Anthropic (`sk-ant-*`), AWS (`AKIA*`), GitHub (`ghp_*`)
- **Tokens**: JWT, Bearer tokens, Slack tokens
- **Connection Strings**: MySQL, PostgreSQL, MongoDB, Redis
- **Environment Variables**: `*_KEY`, `*_SECRET`, `*_TOKEN`, `*_PASSWORD`
- **Private Keys**: SSH keys, PEM certificates

### Data Storage

- All data is stored locally in SQLite (`~/.vibecoding-chronicle/`)
- No data is sent to external servers
- Tags and preferences stored server-side

### Security Note

This is a **local-only tool** designed to run on your machine. It reads AI session files from your home directory (`~/.claude`, `~/.codex`, `~/.gemini`) and serves them via a web interface on `localhost:3000`.

The application does not expose any remote endpoints and is not intended to be accessible from other machines on your network.

## Tech Stack

- **Backend**: Node.js, Express.js, better-sqlite3
- **Frontend**: EJS templates, Alpine.js, TailwindCSS (CDN)
- **Icons**: Font Awesome

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by [claude-code-transcripts](https://github.com/simonw/claude-code-transcripts) by Simon Willison
- Built with [TailwindCSS](https://tailwindcss.com/), [Alpine.js](https://alpinejs.dev/), and [Font Awesome](https://fontawesome.com/)

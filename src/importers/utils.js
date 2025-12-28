import { readFileSync } from 'fs';

/**
 * Secret patterns for masking sensitive data
 */
const SECRET_PATTERNS = [
  // API Keys
  [/sk-[a-zA-Z0-9]{20,}/g, 'sk-***API_KEY***'],
  [/sk-proj-[a-zA-Z0-9\-_]{20,}/g, 'sk-proj-***API_KEY***'],
  [/sk-ant-[a-zA-Z0-9\-_]{20,}/g, 'sk-ant-***API_KEY***'],
  [/ghp_[a-zA-Z0-9]{36,}/g, 'ghp_***GITHUB_TOKEN***'],
  [/gho_[a-zA-Z0-9]{36,}/g, 'gho_***GITHUB_TOKEN***'],
  [/github_pat_[a-zA-Z0-9_]{22,}/g, 'github_pat_***TOKEN***'],
  [/AKIA[0-9A-Z]{16}/g, 'AKIA***AWS_KEY***'],
  [/xox[baprs]-[a-zA-Z0-9\-]{10,}/g, 'xox*-***SLACK_TOKEN***'],
  [/eyJ[a-zA-Z0-9\-_]+\.eyJ[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+/g, '***JWT_TOKEN***'],

  // Bearer tokens
  [/Bearer\s+[a-zA-Z0-9\-_.~+/]+=*/gi, 'Bearer ***TOKEN***'],
  [/Authorization:\s*["']?[a-zA-Z0-9\-_.~+/]+=*["']?/gi, 'Authorization: ***REDACTED***'],

  // Connection strings
  [/(mysql|postgres|postgresql|mongodb|redis):\/\/[^:]+:[^@]+@/gi, '$1://***:***@'],
  [/(mongodb\+srv):\/\/[^:]+:[^@]+@/gi, '$1://***:***@'],

  // Passwords in configs
  [/password["']?\s*[:=]\s*["'][^"']+["']/gi, 'password=***REDACTED***'],
  [/passwd["']?\s*[:=]\s*["'][^"']+["']/gi, 'passwd=***REDACTED***'],
  [/secret["']?\s*[:=]\s*["'][^"']+["']/gi, 'secret=***REDACTED***'],
  [/api_key["']?\s*[:=]\s*["'][^"']+["']/gi, 'api_key=***REDACTED***'],
  [/apikey["']?\s*[:=]\s*["'][^"']+["']/gi, 'apikey=***REDACTED***'],
  [/token["']?\s*[:=]\s*["'][^"']+["']/gi, 'token=***REDACTED***'],

  // .env style
  [/([A-Z_]+_KEY)\s*=\s*[^\s\n]+/g, '$1=***REDACTED***'],
  [/([A-Z_]+_SECRET)\s*=\s*[^\s\n]+/g, '$1=***REDACTED***'],
  [/([A-Z_]+_TOKEN)\s*=\s*[^\s\n]+/g, '$1=***REDACTED***'],
  [/([A-Z_]+_PASSWORD)\s*=\s*[^\s\n]+/g, '$1=***REDACTED***'],

  // Private keys
  [/-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]+?-----END [A-Z ]+ PRIVATE KEY-----/g,
    '-----BEGIN PRIVATE KEY-----\n***REDACTED***\n-----END PRIVATE KEY-----'],

  // SSH keys
  [/ssh-rsa\s+[A-Za-z0-9+/=]+/g, 'ssh-rsa ***REDACTED***'],
  [/ssh-ed25519\s+[A-Za-z0-9+/=]+/g, 'ssh-ed25519 ***REDACTED***'],

  // Common secrets
  [/(client_secret)["']?\s*[:=]\s*["'][^"']+["']/gi, '$1=***REDACTED***'],
  [/(access_token)["']?\s*[:=]\s*["'][^"']+["']/gi, '$1=***REDACTED***'],
];

/**
 * Mask sensitive data in text
 */
export function maskSecrets(text) {
  if (!text) return text;

  let masked = text;
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    masked = masked.replace(pattern, replacement);
  }
  return masked;
}

/**
 * Parse a JSONL file into array of objects
 */
export function parseJsonlFile(filePath) {
  const messages = [];
  try {
    const content = readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed) {
        try {
          messages.push(JSON.parse(trimmed));
        } catch {
          // Skip invalid JSON lines
        }
      }
    }
  } catch {
    // File read error
  }
  return messages;
}

/**
 * Parse a JSON file
 */
export function parseJsonFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Extract project name from Claude's directory naming convention
 * Format: -Users-username-path-to-project
 */
export function extractProjectName(dirName) {
  const parts = dirName.split('-');
  if (parts.length > 3) {
    // Skip -Users-username- prefix
    return parts.slice(3).join('/');
  }
  return dirName;
}

/**
 * Generate a unique message ID
 */
export function generateMessageId(sessionId, index) {
  return `${sessionId}_${index}`;
}

/**
 * Truncate text to specified length
 */
export function truncate(text, length = 200) {
  if (!text) return '';
  return text.length > length ? text.slice(0, length) + '...' : text;
}

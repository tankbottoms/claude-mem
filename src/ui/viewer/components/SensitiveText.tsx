import React from 'react';

/** Patterns that indicate sensitive data in observation content */
const SENSITIVE_PATTERNS = [
  /sk-[a-zA-Z0-9_-]{16,}/g,               // API keys (OpenAI, Anthropic, LiteLLM)
  /ghp_[a-zA-Z0-9]{30,}/g,                // GitHub PATs
  /gho_[a-zA-Z0-9]{30,}/g,                // GitHub OAuth
  /xox[bp]-[a-zA-Z0-9-]{10,}/g,           // Slack tokens
  /tvly-[a-zA-Z0-9_-]{10,}/g,             // Tavily keys
  /ctx7sk-[a-zA-Z0-9_-]{10,}/g,           // Context7 keys
  /AKIA[A-Z0-9]{12,}/g,                   // AWS access keys
  /-----BEGIN[A-Z ]*KEY-----[\s\S]{10,}?-----END[A-Z ]*KEY-----/g, // PEM keys
];

const COMBINED_PATTERN = new RegExp(
  SENSITIVE_PATTERNS.map(p => p.source).join('|'),
  'g'
);

/** Renders text with sensitive data masked. Hover to reveal. */
export function SensitiveText({ text }: { text: string }): React.ReactElement {
  if (!text) return <>{text}</>;

  const parts: (string | React.ReactElement)[] = [];
  let lastIndex = 0;

  // Need a fresh regex each call
  const regex = new RegExp(COMBINED_PATTERN.source, 'g');
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const sensitive = match[0];
    const preview = sensitive.substring(0, Math.min(6, sensitive.length));
    const masked = '\u2022'.repeat(Math.min(sensitive.length - preview.length, 12));

    parts.push(
      <span key={match.index} className="sensitive-data" title="Click to reveal">
        <span className="sensitive-masked">{preview}{masked}</span>
        <span className="sensitive-revealed">{sensitive}</span>
      </span>
    );

    lastIndex = match.index + sensitive.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  if (parts.length === 1 && typeof parts[0] === 'string') {
    return <>{text}</>;
  }

  return <>{parts}</>;
}

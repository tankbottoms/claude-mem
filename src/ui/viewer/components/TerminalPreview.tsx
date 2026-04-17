import React, { useMemo, useRef, useLayoutEffect, useState } from 'react';
import AnsiToHtml from 'ansi-to-html';
import DOMPurify from 'dompurify';

interface TerminalPreviewProps {
  content: string;
  isLoading?: boolean;
  className?: string;
}

const ansiConverter = new AnsiToHtml({
  fg: '#dcd6cc',
  bg: '#252320',
  newline: false,
  escapeXML: true,
  stream: false
});

// Map Nerd Font glyphs to Font Awesome Thin icons
const GLYPH_TO_FA: [string, string][] = [
  // Observation type glyphs (from code.json)
  ['\u{F0A2F}', '<i class="fat fa-bug"></i>'],           // bugfix
  ['\u{EB65}',  '<i class="fat fa-sparkles"></i>'],       // feature
  ['\u{F102B}', '<i class="fat fa-arrows-rotate"></i>'],  // refactor
  ['\u{F126}',  '<i class="fat fa-code-branch"></i>'],    // change
  ['\u{EB51}',  '<i class="fat fa-magnifying-glass"></i>'],// discovery
  ['\u{F09BB}', '<i class="fat fa-scale-balanced"></i>'], // decision
  // Summary section glyphs (from ColorFormatter)
  ['\u{F0349}', '<i class="fat fa-magnifying-glass"></i>'],// Investigated
  ['\u{F06E8}', '<i class="fat fa-lightbulb"></i>'],      // Learned
  ['\u{F012C}', '<i class="fat fa-check"></i>'],          // Completed
  ['\u{F0054}', '<i class="fat fa-arrow-right"></i>'],    // Next Steps
];

function replaceGlyphsWithFA(html: string): string {
  let result = html;
  for (const [glyph, faTag] of GLYPH_TO_FA) {
    // The glyph may have been HTML-escaped by ansi-to-html, so check both raw and escaped
    result = result.split(glyph).join(faTag);
    // Also handle HTML entity form (&#xHEX;)
    const codePoint = glyph.codePointAt(0)!;
    const entity = `&#x${codePoint.toString(16).toUpperCase()};`;
    result = result.split(entity).join(faTag);
    const entityLower = `&#x${codePoint.toString(16)};`;
    result = result.split(entityLower).join(faTag);
  }
  return result;
}

export function TerminalPreview({ content, isLoading = false, className = '' }: TerminalPreviewProps) {
  const preRef = useRef<HTMLPreElement>(null);
  const scrollTopRef = useRef(0);
  const [wordWrap, setWordWrap] = useState(true);

  const html = useMemo(() => {
    // Save scroll position before content changes
    if (preRef.current) {
      scrollTopRef.current = preRef.current.scrollTop;
    }
    if (!content) return '';
    const convertedHtml = ansiConverter.toHtml(content);
    const withFA = replaceGlyphsWithFA(convertedHtml);
    return DOMPurify.sanitize(withFA, {
      ALLOWED_TAGS: ['span', 'div', 'br', 'i'],
      ALLOWED_ATTR: ['style', 'class'],
      ALLOW_DATA_ATTR: false
    });
  }, [content]);

  // Restore scroll position after render
  useLayoutEffect(() => {
    if (preRef.current && scrollTopRef.current > 0) {
      preRef.current.scrollTop = scrollTopRef.current;
    }
  }, [html]);

  const preStyle: React.CSSProperties = {
    padding: '16px',
    margin: 0,
    fontFamily: 'var(--font-terminal)',
    fontSize: '12px',
    lineHeight: '1.6',
    overflow: 'auto',
    color: 'var(--color-text-primary)',
    backgroundColor: 'var(--color-bg-card)',
    whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
    wordBreak: wordWrap ? 'break-word' : 'normal',
    position: 'absolute',
    inset: 0,
  };

  return (
    <div
      className={className}
      style={{
        backgroundColor: 'var(--color-bg-card)',
        border: '1px solid var(--color-border-primary)',
        borderRadius: '8px',
        overflow: 'hidden',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4), 0 4px 12px rgba(0, 0, 0, 0.3)'
      }}
    >
      {/* Window chrome */}
      <div
        style={{
          padding: '12px',
          borderBottom: '1px solid var(--color-border-primary)',
          display: 'flex',
          gap: '6px',
          alignItems: 'center',
          backgroundColor: 'var(--color-bg-header)'
        }}
      >
        <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ff5f57' }} />
        <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ffbd2e' }} />
        <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#28c840' }} />

        <button
          onClick={() => setWordWrap(!wordWrap)}
          style={{
            marginLeft: 'auto',
            padding: '4px 8px',
            fontSize: '11px',
            fontWeight: 500,
            color: wordWrap ? 'var(--color-text-secondary)' : 'var(--color-accent-primary)',
            backgroundColor: 'transparent',
            border: '1px solid',
            borderColor: wordWrap ? 'var(--color-border-primary)' : 'var(--color-accent-primary)',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-accent-primary)';
            e.currentTarget.style.color = 'var(--color-accent-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = wordWrap ? 'var(--color-border-primary)' : 'var(--color-accent-primary)';
            e.currentTarget.style.color = wordWrap ? 'var(--color-text-secondary)' : 'var(--color-accent-primary)';
          }}
          title={wordWrap ? 'Disable word wrap (scroll horizontally)' : 'Enable word wrap'}
        >
          {wordWrap ? '⤢ Wrap' : '⇄ Scroll'}
        </button>
      </div>

      {/* Content area */}
      {isLoading ? (
        <div
          style={{
            padding: '16px',
            fontFamily: 'var(--font-terminal)',
            fontSize: '12px',
            color: 'var(--color-text-secondary)'
          }}
        >
          Loading preview...
        </div>
      ) : (
        <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
          <pre
            ref={preRef}
            style={preStyle}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      )}
    </div>
  );
}

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

/**
 * Map Nerd Font Private Use Area codepoints to Font Awesome HTML.
 * These glyphs render in terminal fonts but not in browser fonts.
 */
const NERD_FONT_TO_FA: Record<string, string> = {
  // Observation type icons (from code.json mode)
  '\u{F0A2F}': '<i class="fas fa-bug" style="color:#f85149"></i>',           // bugfix
  '\uEB65':    '<i class="fas fa-star" style="color:#3fb950"></i>',           // feature
  '\u{F102B}': '<i class="fas fa-recycle" style="color:#d2a8ff"></i>',        // refactor
  '\uF126':    '<i class="fas fa-code-branch" style="color:#58a6ff"></i>',    // change
  '\uEB51':    '<i class="fas fa-search" style="color:#58a6ff"></i>',         // discovery
  '\u{F09BB}': '<i class="fas fa-balance-scale" style="color:#d29922"></i>',  // decision
  // Summary section icons (from formatters)
  '\u{F0349}': '<i class="fas fa-search"></i>',        // investigated (magnify)
  '\u{F06E8}': '<i class="fas fa-lightbulb"></i>',     // learned (lightbulb)
  '\u{F012C}': '<i class="fas fa-check"></i>',         // completed (check)
  '\u{F0054}': '<i class="fas fa-arrow-right"></i>',   // next steps (arrow_right)
};

/** Replace Nerd Font glyphs with FA icons in HTML-escaped content */
function replaceNerdFontGlyphs(text: string): string {
  let result = text;
  for (const [glyph, fa] of Object.entries(NERD_FONT_TO_FA)) {
    // The glyph may be HTML-escaped by ansi-to-html, so check both raw and escaped forms
    result = result.replaceAll(glyph, fa);
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
    const withFaIcons = replaceNerdFontGlyphs(convertedHtml);
    return DOMPurify.sanitize(withFaIcons, {
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

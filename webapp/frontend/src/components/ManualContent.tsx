import React, { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import type { Language } from '../utils/localization';

// Fetch + render the bundled user manual (public/manual/USER_MANUAL_*.md). Body-only
// and controlled (doc + onDocChange) so both the modal (ManualViewer) and the Overview
// page reuse the exact same rendering — the markdown/link/image handling lives once.

// Mirror GitHub's heading slugs so the manual's table-of-contents anchors work.
const slugify = (text: string) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^\w一-鿿\s-]/g, '')
    .replace(/\s/g, '-');

interface ManualContentProps {
  doc: Language;
  onDocChange?: (l: Language) => void;
}

const ManualContent: React.FC<ManualContentProps> = ({ doc, onDocChange }) => {
  const [html, setHtml] = useState<string>('');
  const [error, setError] = useState(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setHtml('');
    setError(false);
    fetch(`/manual/USER_MANUAL_${doc === 'ch' ? 'CH' : 'EN'}.md`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.text();
      })
      .then((md) => {
        if (cancelled) return;
        let out = marked.parse(md, { async: false }) as string;
        // Manual images are relative to the markdown file's folder.
        out = out.replace(/src="images\//g, 'src="/manual/images/');
        setHtml(out);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [doc]);

  // Post-render: give headings GitHub-style ids and scroll back to the top.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.querySelectorAll('h1, h2, h3, h4').forEach((h) => {
      h.id = slugify(h.textContent || '');
    });
    el.scrollTop = 0;
  }, [html]);

  const handleClick = (e: React.MouseEvent) => {
    const anchor = (e.target as HTMLElement).closest('a');
    if (!anchor) return;
    const href = anchor.getAttribute('href') || '';
    // Cross-manual link -> switch the displayed language instead of navigating.
    if (href.endsWith('USER_MANUAL_EN.md')) { e.preventDefault(); onDocChange?.('en'); return; }
    if (href.endsWith('USER_MANUAL_CH.md')) { e.preventDefault(); onDocChange?.('ch'); return; }
    // In-page anchors scroll inside this body.
    if (href.startsWith('#')) {
      e.preventDefault();
      const target = bodyRef.current?.querySelector(`[id="${decodeURIComponent(href.slice(1))}"]`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    // External links open in a new tab.
    if (/^https?:/i.test(href)) { e.preventDefault(); window.open(href, '_blank', 'noopener'); }
  };

  return (
    <div className="manual-content" ref={bodyRef} onClick={handleClick}>
      {error ? (
        <p className="manual-status">
          {doc === 'ch' ? '手册加载失败，请稍后重试。' : 'Failed to load the manual, please try again later.'}
        </p>
      ) : html ? (
        <div className="manual-md" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <p className="manual-status">{doc === 'ch' ? '加载中…' : 'Loading…'}</p>
      )}

      <style>{`
        .manual-content { height: 100%; overflow-y: auto; padding: 24px 36px; box-sizing: border-box; }
        .manual-status { color: #888; text-align: center; margin-top: 40px; }
        .manual-md { color: #24292f; font-size: 0.92rem; line-height: 1.65; text-align: left; }
        .manual-md h1 { font-size: 1.6rem; border-bottom: 1px solid #e5e5e5; padding-bottom: 8px; }
        .manual-md h2 { font-size: 1.25rem; border-bottom: 1px solid #eee; padding-bottom: 6px; margin-top: 30px; }
        .manual-md h3 { font-size: 1.05rem; margin-top: 22px; }
        .manual-md img { max-width: 100%; border: 1px solid #ddd; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin: 6px 0; }
        .manual-md table { border-collapse: collapse; margin: 12px 0; }
        .manual-md th, .manual-md td { border: 1px solid #d8dee4; padding: 6px 12px; }
        .manual-md th { background: #f6f8fa; }
        .manual-md blockquote { margin: 12px 0; padding: 4px 14px; color: #57606a; border-left: 4px solid #d8dee4; background: #f9fafb; }
        .manual-md code { background: #f0f1f3; padding: 1px 5px; border-radius: 4px; font-size: 0.85em; }
        .manual-md a { color: #1976D2; }
        .manual-md hr { border: none; border-top: 1px solid #e5e5e5; margin: 22px 0; }
      `}</style>
    </div>
  );
};

export default ManualContent;

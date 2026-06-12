import React, { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import type { Language } from '../utils/localization';

// In-app reader for the bundled user manual (public/manual/*.md), so the
// docs work on the deployed site without sending users to GitHub.

interface ManualViewerProps {
  language: Language;
  onClose: () => void;
}

// Mirror GitHub's heading slugs so the manual's table-of-contents anchors work.
const slugify = (text: string) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^\w一-鿿\s-]/g, '')
    .replace(/\s/g, '-');

const ManualViewer: React.FC<ManualViewerProps> = ({ language, onClose }) => {
  const [doc, setDoc] = useState<Language>(language);
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
    if (href.endsWith('USER_MANUAL_EN.md')) {
      e.preventDefault();
      setDoc('en');
      return;
    }
    if (href.endsWith('USER_MANUAL_CH.md')) {
      e.preventDefault();
      setDoc('ch');
      return;
    }
    // In-page anchors scroll inside the modal body.
    if (href.startsWith('#')) {
      e.preventDefault();
      const target = bodyRef.current?.querySelector(
        `[id="${decodeURIComponent(href.slice(1))}"]`
      );
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    // External links open in a new tab.
    if (/^https?:/i.test(href)) {
      e.preventDefault();
      window.open(href, '_blank', 'noopener');
    }
  };

  return (
    <div className="manual-overlay" onClick={onClose}>
      <div className="manual-panel" onClick={(e) => e.stopPropagation()}>
        <div className="manual-header">
          <span className="manual-title">📖 {doc === 'ch' ? '用户手册' : 'User Manual'}</span>
          <div className="manual-lang-toggle">
            <button className={doc === 'ch' ? 'active' : ''} onClick={() => setDoc('ch')}>中文</button>
            <button className={doc === 'en' ? 'active' : ''} onClick={() => setDoc('en')}>EN</button>
          </div>
          <button className="manual-close" onClick={onClose}>✕</button>
        </div>
        <div className="manual-body" ref={bodyRef} onClick={handleClick}>
          {error ? (
            <p className="manual-status">
              {doc === 'ch' ? '手册加载失败，请稍后重试。' : 'Failed to load the manual, please try again later.'}
            </p>
          ) : html ? (
            <div className="manual-md" dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <p className="manual-status">{doc === 'ch' ? '加载中…' : 'Loading…'}</p>
          )}
        </div>
      </div>

      <style>{`
        .manual-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.6);
          display: flex; align-items: center; justify-content: center; z-index: 3100;
        }
        .manual-panel {
          background: white; border-radius: 8px; width: min(960px, 94vw); height: 90vh;
          display: flex; flex-direction: column; box-shadow: 0 10px 40px rgba(0,0,0,0.45);
          overflow: hidden;
        }
        .manual-header {
          display: flex; align-items: center; gap: 14px; padding: 12px 18px;
          background: #2c2c2c; color: white; flex-shrink: 0;
        }
        .manual-title { font-weight: bold; font-size: 1.05rem; flex: 1; }
        .manual-lang-toggle { display: flex; gap: 4px; }
        .manual-lang-toggle button {
          padding: 3px 12px; border-radius: 14px; border: 1px solid #555;
          background: #3a3a3a; color: #bbb; cursor: pointer; font-size: 0.78rem;
        }
        .manual-lang-toggle button.active { background: #2196F3; border-color: #2196F3; color: white; }
        .manual-close {
          background: none; border: none; color: #aaa; font-size: 1.1rem;
          cursor: pointer; padding: 2px 6px;
        }
        .manual-close:hover { color: white; }
        .manual-body { flex: 1; overflow-y: auto; padding: 24px 36px; }
        .manual-status { color: #888; text-align: center; margin-top: 40px; }

        .manual-md { color: #24292f; font-size: 0.92rem; line-height: 1.65; text-align: left; }
        .manual-md h1 { font-size: 1.6rem; border-bottom: 1px solid #e5e5e5; padding-bottom: 8px; }
        .manual-md h2 { font-size: 1.25rem; border-bottom: 1px solid #eee; padding-bottom: 6px; margin-top: 30px; }
        .manual-md h3 { font-size: 1.05rem; margin-top: 22px; }
        .manual-md img {
          max-width: 100%; border: 1px solid #ddd; border-radius: 6px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin: 6px 0;
        }
        .manual-md table { border-collapse: collapse; margin: 12px 0; }
        .manual-md th, .manual-md td { border: 1px solid #d8dee4; padding: 6px 12px; }
        .manual-md th { background: #f6f8fa; }
        .manual-md blockquote {
          margin: 12px 0; padding: 4px 14px; color: #57606a;
          border-left: 4px solid #d8dee4; background: #f9fafb;
        }
        .manual-md code { background: #f0f1f3; padding: 1px 5px; border-radius: 4px; font-size: 0.85em; }
        .manual-md a { color: #1976D2; }
        .manual-md hr { border: none; border-top: 1px solid #e5e5e5; margin: 22px 0; }
      `}</style>
    </div>
  );
};

export default ManualViewer;

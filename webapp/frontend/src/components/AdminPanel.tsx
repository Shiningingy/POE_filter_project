// Admin contribution flow (Supabase inbox).
//
// Invited admins (accounts created by the owner in the Supabase dashboard —
// public signups are disabled) sign in, tune the filter in the app like any
// user, then submit their full snapshot for review. The owner sees every
// submission, downloads the snapshot to review locally (import + git diff),
// and marks it approved/rejected; approval becomes a git commit, which
// auto-redeploys the site with the new data.
//
// Renders nothing when Supabase env vars are absent (local dev / GH preview).

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import type { Session } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured, OWNER_EMAIL } from '../services/supabaseClient';
import { gzipBase64, gunzipBase64 } from '../utils/snapshot';
import { downloadJson } from '../utils/themeSoundExport';
import { useTranslation } from '../utils/localization';
import type { Language } from '../utils/localization';

interface SubmissionRow {
  id: string;
  author_email: string | null;
  title: string;
  note: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

const AdminPanel: React.FC<{ language: Language }> = ({ language }) => {
  const t = useTranslation(language);
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [submitMsg, setSubmitMsg] = useState('');

  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);

  const supabase = getSupabase();
  const isOwner = session?.user?.email?.toLowerCase() === OWNER_EMAIL.toLowerCase();

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  const loadSubmissions = async () => {
    if (!supabase || !session) return;
    // RLS scopes this: admins get their own rows, the owner gets everything.
    const { data, error } = await supabase
      .from('submissions')
      .select('id, author_email, title, note, status, created_at')
      .order('created_at', { ascending: false });
    if (!error && data) setSubmissions(data as SubmissionRow[]);
  };

  useEffect(() => { if (open && session) loadSubmissions(); }, [open, session]);

  if (!isSupabaseConfigured()) return null;

  const signIn = async () => {
    if (!supabase) return;
    setBusy(true);
    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
    setBusy(false);
  };

  const signOut = async () => {
    await supabase?.auth.signOut();
    setSubmissions([]);
  };

  const submitSnapshot = async () => {
    if (!supabase || !session || !title.trim()) return;
    setBusy(true);
    setSubmitMsg('');
    try {
      const res = await axios.get('/api/export-snapshot');
      const compressed = await gzipBase64(JSON.stringify(res.data));
      const { error } = await supabase.from('submissions').insert({
        author_email: session.user.email,
        title: title.trim(),
        note: note.trim() || null,
        snapshot: compressed,
      });
      if (error) throw new Error(error.message);
      setSubmitMsg(t.admSubmitted);
      setTitle('');
      setNote('');
      loadSubmissions();
    } catch (e: any) {
      setSubmitMsg(`${t.admSubmitFailed}: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const downloadSubmission = async (row: SubmissionRow) => {
    if (!supabase) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from('submissions').select('snapshot').eq('id', row.id).single();
      if (error || !data) throw new Error(error?.message || 'not found');
      const json = JSON.parse(await gunzipBase64(data.snapshot));
      const author = (row.author_email || 'unknown').split('@')[0];
      downloadJson(json, `submission_${author}_${row.created_at.slice(0, 10)}.snapshot.json`);
    } catch (e: any) {
      alert(`${t.admDownloadFailed}: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (row: SubmissionRow, status: 'approved' | 'rejected') => {
    if (!supabase) return;
    const { error } = await supabase.from('submissions').update({ status }).eq('id', row.id);
    if (!error) loadSubmissions();
  };

  const statusLabel = (s: SubmissionRow['status']) =>
    s === 'approved' ? t.admApproved : s === 'rejected' ? t.admRejected : t.admPending;

  return (
    <>
      <button className="admin-link" onClick={() => setOpen(true)} title={t.admTitle}>
        {session ? `⚙ ${t.admTitle} ✓` : `⚙ ${t.admTitle}`}
      </button>
      <style>{`
        .admin-link { background: none; border: 1px solid #555; color: #bbb; border-radius: 4px; padding: 4px 10px; cursor: pointer; font-size: 0.78rem; white-space: nowrap; }
        .admin-link:hover { color: white; border-color: #888; }
      `}</style>

      {open && (
        <div className="admin-overlay" onClick={() => setOpen(false)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <div className="admin-header">
              <h3>{t.admTitle}</h3>
              <button className="admin-close" onClick={() => setOpen(false)}>×</button>
            </div>

            {!session ? (
              <div className="admin-login">
                <p className="admin-hint">{t.admLoginHint}</p>
                <input type="email" placeholder={t.admEmail} value={email}
                  onChange={e => setEmail(e.target.value)} />
                <input type="password" placeholder={t.admPassword} value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') signIn(); }} />
                {authError && <div className="admin-error">{authError}</div>}
                <button className="admin-primary" onClick={signIn} disabled={busy || !email || !password}>
                  {t.admSignIn}
                </button>
              </div>
            ) : (
              <div className="admin-body">
                <div className="admin-session">
                  <span>{session.user.email}{isOwner ? ` (${t.admOwner})` : ''}</span>
                  <button onClick={signOut}>{t.admSignOut}</button>
                </div>

                <div className="admin-section">
                  <h4>{t.admSubmitTitle}</h4>
                  <p className="admin-hint">{t.admSubmitHint}</p>
                  <input type="text" placeholder={t.admSubmissionTitle} value={title}
                    onChange={e => setTitle(e.target.value)} maxLength={120} />
                  <textarea placeholder={t.admSubmissionNote} value={note}
                    onChange={e => setNote(e.target.value)} rows={3} />
                  <button className="admin-primary" onClick={submitSnapshot} disabled={busy || !title.trim()}>
                    {busy ? '...' : t.admSubmit}
                  </button>
                  {submitMsg && <div className="admin-msg">{submitMsg}</div>}
                </div>

                <div className="admin-section">
                  <h4>{isOwner ? t.admAllSubmissions : t.admMySubmissions}</h4>
                  {submissions.length === 0 && <p className="admin-hint">{t.admNoSubmissions}</p>}
                  {submissions.map(row => (
                    <div key={row.id} className="admin-row">
                      <div className="admin-row-main">
                        <span className={`admin-status admin-status-${row.status}`}>{statusLabel(row.status)}</span>
                        <span className="admin-row-title">{row.title}</span>
                        <span className="admin-row-meta">
                          {isOwner && row.author_email ? `${row.author_email} · ` : ''}
                          {row.created_at.slice(0, 16).replace('T', ' ')}
                        </span>
                      </div>
                      {row.note && <div className="admin-row-note">{row.note}</div>}
                      {isOwner && (
                        <div className="admin-row-actions">
                          <button onClick={() => downloadSubmission(row)} disabled={busy}>⬇ {t.admDownload}</button>
                          {row.status !== 'approved' && (
                            <button className="admin-ok" onClick={() => setStatus(row, 'approved')}>✓ {t.admApprove}</button>
                          )}
                          {row.status !== 'rejected' && (
                            <button className="admin-no" onClick={() => setStatus(row, 'rejected')}>✗ {t.admReject}</button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <style>{`
            .admin-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 2000; display: flex; align-items: center; justify-content: center; }
            .admin-modal { background: white; color: #222; border-radius: 8px; width: 560px; max-width: 92vw; max-height: 84vh; overflow-y: auto; padding: 18px 22px; text-align: left; }
            .admin-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
            .admin-header h3 { margin: 0; font-size: 1.05rem; }
            .admin-close { background: none; border: none; font-size: 1.4rem; cursor: pointer; color: #888; }
            .admin-login { display: flex; flex-direction: column; gap: 10px; padding: 8px 0 4px; }
            .admin-login input, .admin-section input, .admin-section textarea { padding: 8px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 0.9rem; width: 100%; box-sizing: border-box; }
            .admin-hint { font-size: 0.8rem; color: #777; margin: 2px 0 4px; }
            .admin-error { color: #b71c1c; font-size: 0.82rem; }
            .admin-msg { font-size: 0.82rem; color: #2e7d32; margin-top: 6px; }
            .admin-primary { background: #4CAF50; color: white; border: none; padding: 9px 16px; border-radius: 4px; cursor: pointer; font-weight: bold; }
            .admin-primary:disabled { background: #ccc; }
            .admin-session { display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; color: #555; padding-bottom: 8px; border-bottom: 1px solid #eee; }
            .admin-session button { background: none; border: 1px solid #ccc; border-radius: 4px; padding: 4px 10px; cursor: pointer; font-size: 0.78rem; }
            .admin-section { margin-top: 14px; display: flex; flex-direction: column; gap: 8px; }
            .admin-section h4 { margin: 0 0 2px; font-size: 0.92rem; }
            .admin-row { border: 1px solid #e5e5e5; border-radius: 6px; padding: 8px 10px; }
            .admin-row-main { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
            .admin-row-title { font-weight: 600; font-size: 0.88rem; }
            .admin-row-meta { font-size: 0.75rem; color: #888; margin-left: auto; }
            .admin-row-note { font-size: 0.8rem; color: #666; margin-top: 4px; white-space: pre-wrap; }
            .admin-row-actions { display: flex; gap: 8px; margin-top: 8px; }
            .admin-row-actions button { border: 1px solid #ccc; background: #fafafa; border-radius: 4px; padding: 4px 10px; cursor: pointer; font-size: 0.78rem; }
            .admin-row-actions .admin-ok { border-color: #4CAF50; color: #2e7d32; }
            .admin-row-actions .admin-no { border-color: #e57373; color: #b71c1c; }
            .admin-status { font-size: 0.7rem; padding: 2px 8px; border-radius: 10px; font-weight: bold; }
            .admin-status-pending { background: #fff3e0; color: #e65100; }
            .admin-status-approved { background: #e8f5e9; color: #2e7d32; }
            .admin-status-rejected { background: #ffebee; color: #b71c1c; }
          `}</style>
        </div>
      )}
    </>
  );
};

export default AdminPanel;

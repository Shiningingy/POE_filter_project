import React from 'react';
import type { Language } from '../utils/localization';

// First-visit greeting: shown once (until "sharket_welcome_seen" is set),
// lets the user pick a language and jump straight into the manual.

interface WelcomeModalProps {
  language: Language;
  setLanguage: (l: Language) => void;
  onClose: () => void;
  onOpenManual: () => void;
}

const WelcomeModal: React.FC<WelcomeModalProps> = ({ language, setLanguage, onClose, onOpenManual }) => {
  const ch = language === 'ch';

  const features: { icon: string; en: string; ch: string }[] = [
    { icon: '🧱', en: 'Editor — drag & drop items between tiers, style every tier', ch: '编辑器 —— 拖放物品调整分级，自定义每个阶级的外观' },
    { icon: '🎨', en: 'Theme & Sound — global looks and alert sounds in one place', ch: '外观与音效 —— 集中管理全局主题与提示音' },
    { icon: '🧪', en: 'Simulator — preview drops exactly as they will look in game', ch: '模拟器 —— 所见即所得地预览游戏内掉落效果' },
    { icon: '💾', en: 'Save & Export — download your .filter, snapshot backups included', ch: '保存与导出 —— 下载 .filter 文件，支持快照备份' },
  ];

  return (
    <div className="welcome-overlay">
      <div className="welcome-modal">
        <div className="welcome-lang-row">
          <button className={ch ? 'active' : ''} onClick={() => setLanguage('ch')}>中文</button>
          <button className={!ch ? 'active' : ''} onClick={() => setLanguage('en')}>English</button>
        </div>

        <h2>{ch ? '欢迎使用 Sharket POE 过滤编辑器！' : 'Welcome to Sharket POE Filter!'}</h2>
        <p className="welcome-sub">
          {ch
            ? '一款免费的浏览器端《流放之路》掉落过滤器编辑工具 —— 无需注册，所有修改自动保存在你的浏览器中。'
            : 'A free, browser-based loot-filter editor for Path of Exile — no account needed, everything you change is saved in your browser automatically.'}
        </p>

        <ul className="welcome-features">
          {features.map((f) => (
            <li key={f.icon}>
              <span className="feat-icon">{f.icon}</span>
              {ch ? f.ch : f.en}
            </li>
          ))}
        </ul>

        <div className="welcome-actions">
          <button className="welcome-manual-btn" onClick={onOpenManual}>
            📖 {ch ? '查看用户手册' : 'Open the User Manual'}
          </button>
          <button className="welcome-start-btn" onClick={onClose}>
            {ch ? '直接开始 →' : 'Jump right in →'}
          </button>
        </div>
        <div className="welcome-hint">
          {ch ? '之后可随时通过右上角的 📖 按钮打开手册。' : 'You can reopen the manual anytime via the 📖 button in the top bar.'}
        </div>
      </div>

      <style>{`
        .welcome-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.65);
          display: flex; align-items: center; justify-content: center; z-index: 3000;
        }
        .welcome-modal {
          background: white; border-radius: 10px; padding: 28px 34px;
          width: min(560px, 92vw); box-shadow: 0 10px 40px rgba(0,0,0,0.4);
          text-align: center;
        }
        .welcome-lang-row { display: flex; justify-content: center; gap: 8px; margin-bottom: 14px; }
        .welcome-lang-row button {
          padding: 5px 18px; border-radius: 20px; border: 1px solid #ccc;
          background: #f5f5f5; color: #555; cursor: pointer; font-size: 0.85rem;
        }
        .welcome-lang-row button.active { background: #2196F3; border-color: #2196F3; color: white; font-weight: bold; }
        .welcome-modal h2 { margin: 0 0 10px; font-size: 1.35rem; color: #222; }
        .welcome-sub { color: #666; font-size: 0.9rem; line-height: 1.5; margin: 0 0 16px; }
        .welcome-features { list-style: none; padding: 0; margin: 0 0 20px; text-align: left; }
        .welcome-features li {
          padding: 7px 10px; font-size: 0.9rem; color: #333;
          display: flex; align-items: baseline; gap: 10px;
        }
        .welcome-features li + li { border-top: 1px solid #f0f0f0; }
        .feat-icon { flex-shrink: 0; }
        .welcome-actions { display: flex; gap: 10px; justify-content: center; }
        .welcome-manual-btn {
          background: #2196F3; color: white; border: none; border-radius: 6px;
          padding: 11px 22px; font-size: 0.95rem; font-weight: bold; cursor: pointer;
        }
        .welcome-manual-btn:hover { background: #1976D2; }
        .welcome-start-btn {
          background: white; color: #555; border: 1px solid #ccc; border-radius: 6px;
          padding: 11px 22px; font-size: 0.95rem; cursor: pointer;
        }
        .welcome-start-btn:hover { background: #f5f5f5; }
        .welcome-hint { margin-top: 14px; font-size: 0.78rem; color: #999; }
      `}</style>
    </div>
  );
};

export default WelcomeModal;

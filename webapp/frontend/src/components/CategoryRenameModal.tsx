import { useTranslation } from "../utils/localization";
import type { Language } from "../utils/localization";

// Rename dialog for a tier. Purely presentational; the bone owns the
// renameModal state and the save logic.
const CategoryRenameModal = ({
  tierKey,
  name,
  placeholder,
  language,
  onNameChange,
  onSave,
  onCancel,
}: {
  tierKey: string;
  name: string;
  placeholder: string;
  language: Language;
  onNameChange: (name: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) => {
  const t = useTranslation(language);
  return (
    <div className="rename-overlay" onClick={onCancel}>
      <div className="rename-modal" onClick={(e) => e.stopPropagation()}>
        <h4>{t.renameTier}</h4>
        <div className="rename-key">{tierKey}</div>
        <input
          type="text"
          autoFocus
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave();
          }}
        />
        <div className="rename-hint">{t.renameTierHint}</div>
        <div className="rename-actions">
          <button className="rename-cancel" onClick={onCancel}>{t.cancel}</button>
          <button className="rename-save" onClick={onSave}>
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CategoryRenameModal;

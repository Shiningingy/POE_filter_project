import ContextMenu from "./ContextMenu";
import { useTranslation } from "../utils/localization";
import type { Language } from "../utils/localization";

// Right-click menu for a tier block (rename / copy / delete / insert / paste).
// Builds the ContextMenu option list from callbacks; the bone owns clipboard
// state and tier mutation logic (including the index-fallback semantics).
const TierContextMenu = ({
  x,
  y,
  tierKey,
  hasClipboard,
  language,
  onClose,
  onRename,
  onCopy,
  onDelete,
  onInsertBefore,
  onInsertAfter,
  onPaste,
}: {
  x: number;
  y: number;
  tierKey?: string;
  hasClipboard: boolean;
  language: Language;
  onClose: () => void;
  onRename: (tierKey: string) => void;
  onCopy: (tierKey: string) => void;
  onDelete: (tierKey: string) => void;
  onInsertBefore: () => void;
  onInsertAfter: () => void;
  onPaste: () => void;
}) => {
  const t = useTranslation(language);
  return (
    <ContextMenu
      x={x}
      y={y}
      onClose={onClose}
      language={language}
      options={[
        ...(tierKey
          ? [
              { label: `✎ ${t.renameTier}`, onClick: () => onRename(tierKey) },
              { label: t.copyTier, onClick: () => onCopy(tierKey) },
              { label: t.deleteTier, onClick: () => onDelete(tierKey) },
              { divider: true, label: "", onClick: () => {} },
            ]
          : []),
        { label: t.insertBefore, onClick: onInsertBefore },
        { label: t.insertAfter, onClick: onInsertAfter },
        {
          label: t.pasteTier,
          onClick: onPaste,
          className: !hasClipboard ? "disabled" : "",
        },
      ]}
    />
  );
};

export default TierContextMenu;

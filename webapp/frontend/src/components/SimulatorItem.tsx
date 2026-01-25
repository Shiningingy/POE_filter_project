import React, { useState } from 'react';
import type { ItemProps, SimulationResult } from '../utils/simulatorEngine';
import ContextMenu from './ContextMenu';
import type { Language } from '../utils/localization';

interface SimulatorItemProps {
    item: ItemProps & { id: number; x: number; y: number };
    result: SimulationResult;
    onDelete: () => void;
    language: Language;
}

const SimulatorItem: React.FC<SimulatorItemProps> = ({ item, result, onDelete, language }) => {
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
    const [hover, setHover] = useState(false);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        setMousePos({ x: e.clientX, y: e.clientY });
    };

    const copyItemText = () => {
        const text = `Class: ${item.class}\nBaseType: ${item.name}\nItemLevel: ${item.itemLevel || 1}\nRarity: ${item.rarity || 'Normal'}`;
        navigator.clipboard.writeText(text);
    };

    const menuOptions = [
        { label: "Info", title: true, onClick: () => {} },
        { label: `Tier: ${result.matchedTier || 'Untiered'}`, disabled: true, onClick: () => {} },
        { label: `Rule: ${result.matchedRule || 'Base Mapping'}`, disabled: true, onClick: () => {} },
        { divider: true, label: "", onClick: () => {} },
        { label: "Copy Item Text", onClick: copyItemText },
        { label: "Remove", onClick: onDelete, color: "#ff4444" }
    ];

    if (!result.visible) return null;

    return (
        <>
            <div 
                className="item-plate"
                style={{
                    ...result.style,
                    position: 'absolute',
                    left: `calc(50% + ${item.x}px)`,
                    top: `calc(50% + ${item.y}px)`,
                    transform: 'translate(-50%, -50%)',
                }}
                onContextMenu={handleContextMenu}
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
                onMouseMove={handleMouseMove}
            >
                <div className="plate-body">
                    {item.name}
                    {item.stackSize && item.stackSize > 1 && <span className="stack-size"> x{item.stackSize}</span>}
                </div>
            </div>

            {hover && !contextMenu && (
                <div className="sim-tooltip" style={{ top: mousePos.y + 15, left: mousePos.x + 15 }}>
                    <div className="header" style={{ color: result.style.color }}>{item.name}</div>
                    <div className="sub">{item.class}</div>
                    <div className="separator"></div>
                    <div className="prop"><span>Item Level:</span> {item.itemLevel}</div>
                    <div className="prop"><span>Rarity:</span> {item.rarity}</div>
                    {item.dropLevel && <div className="prop"><span>Drop Level:</span> {item.dropLevel}</div>}
                    <div className="separator"></div>
                    <div className="meta">
                        <div>Match: <span className="val">{result.matchedTier || 'None'}</span></div>
                        <div>Rule: <span className="val">{result.matchedRule || 'Base Mapping'}</span></div>
                    </div>
                </div>
            )}

            {contextMenu && (
                <ContextMenu 
                    x={contextMenu.x} 
                    y={contextMenu.y} 
                    options={menuOptions} 
                    onClose={() => setContextMenu(null)}
                    language={language}
                />
            )}

            <style>{`
                .sim-tooltip {
                    position: fixed; z-index: 3000;
                    background: rgba(0, 0, 0, 0.9);
                    border: 1px solid #777;
                    padding: 10px;
                    border-radius: 4px;
                    pointer-events: none;
                    min-width: 200px;
                    color: #ddd;
                    font-family: 'Fontin', sans-serif;
                    box-shadow: 0 5px 15px rgba(0,0,0,0.5);
                }
                .sim-tooltip .header { font-size: 1.1rem; text-align: center; margin-bottom: 2px; }
                .sim-tooltip .sub { text-align: center; font-size: 0.8rem; color: #777; }
                .sim-tooltip .separator { height: 1px; background: #444; margin: 8px 0; }
                .sim-tooltip .prop { display: flex; justify-content: space-between; font-size: 0.85rem; }
                .sim-tooltip .prop span { color: #888; }
                .sim-tooltip .meta { font-size: 0.75rem; color: #555; margin-top: 5px; }
                .sim-tooltip .meta .val { color: #aaa; }
            `}</style>
        </>
    );
};

export default SimulatorItem;

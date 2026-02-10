import { useState, useRef, useEffect } from 'preact/hooks';
import { Renditions } from '../../types/playback';
import './QualitySelector.css';
import { ABRManagerType } from '../../types/abr-manager';
import { usePlayerStore } from '../../store/playerStore';
import { FixedQualityAbrManager } from '../../abr/FixedQualityAbrManager';

type QualitySelectorProps = {
    abr: ABRManagerType;
};

export const QualitySelector = ({
    abr,
}: QualitySelectorProps) => {
    const renditions = usePlayerStore((state) => state.renditions);
    const abrManager = usePlayerStore((state) => state.abrManager);

    if (!renditions || renditions.video.length === 0) {
        return null;
    }

    const handleQualityChange = async (index: number) => {
        if (abr === 'fixed' && abrManager instanceof FixedQualityAbrManager) {
            await abrManager.setManualRendition(index);
        }
    };

    const [isOpen, setIsOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(
        abr === 'fixed' ? 0 : -1
    );
    const menuRef = useRef<HTMLDivElement>(null);

    const handleSelect = (index: number) => {
        setSelectedIndex(index);
        handleQualityChange(index);
        setIsOpen(false);
    };

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                menuRef.current &&
                !menuRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const currentQuality =
        abr === 'fixed'
            ? renditions.video[selectedIndex]?.resolution || 'Auto'
            : 'Auto';

    return (
        <div className="quality-selector-wrapper">
            <div className="quality-selector" ref={menuRef}>
                <button
                    className="control-button quality-button"
                    onClick={() => setIsOpen(!isOpen)}
                    aria-label="Quality"
                >
                    {currentQuality}
                </button>

                {isOpen && (
                    <div className="quality-menu">
                        {abr === 'fixed' ? (
                            <>
                                {renditions.video.map((rendition, index) => (
                                    <button
                                        key={rendition.resolution}
                                        className={`quality-option ${index === selectedIndex ? 'active' : ''}`}
                                        onClick={() => handleSelect(index)}
                                    >
                                        {rendition.resolution}
                                        {index === selectedIndex && (
                                            <span className="checkmark">✓</span>
                                        )}
                                    </button>
                                ))}
                            </>
                        ) : (
                            <button
                                className={`quality-option ${selectedIndex === -1 ? 'active' : ''}`}
                            >
                                Auto
                                <span className="checkmark">✓</span>
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

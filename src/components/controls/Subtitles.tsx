import { useEffect, useRef, useState } from 'preact/hooks';
import { usePlayerStore } from '../../store/playerStore';
import './Subtitles.css';
import { getLanguageName } from '../../utils/text-tracks';
import type { SubtitleRendition } from '../../text-track-manager/text-track-manager';

export const Subtitles = () => {
    const textTrackManager = usePlayerStore((state) => state.textTrackManager);
    const textTracks = usePlayerStore((state) => state.textTracks);

    const [activeTrack, setActiveTrack] = useState(-1);
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const subtitleTracks = textTracks
        ? textTracks.filter((track) => track.kind === 'subtitles' || track.kind === 'captions')
        : [];

    const setSubtitleTrack = (trackIndex: number) => {
        if (!textTrackManager) return;

        if (trackIndex === -1) {
            // Turn off subtitles
            textTrackManager.clear();
            setActiveTrack(-1);
        } else {
            // Convert TextTrackRendition to SubtitleRendition format
            const track = textTracks![trackIndex];
            const subtitleRendition: SubtitleRendition = {
                name: track.name,
                language: track.language,
                url: track.url,
                kind: track.kind as TextTrackKind,
                default: track.default,
            };
            
            setActiveTrack(trackIndex);
            textTrackManager.load(subtitleRendition);
        }
    };

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowMenu(false);
            }
        };

        if (showMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showMenu]);

    const handleSelect = (index: number) => {
        setSubtitleTrack(index);
        setShowMenu(false);
    };

    if (!subtitleTracks.length) return null;

    return (
        <div className="subtitles-selector" ref={menuRef}>
            <button
                className={`control-button cc-button ${activeTrack >= 0 ? 'active' : ''}`}
                onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(!showMenu);
                }}
                aria-label="Closed Captions"
            >
                CC
            </button>

            {showMenu && (
                <div className="subtitles-menu">
                    <button
                        className={`subtitle-option ${activeTrack === -1 ? 'active' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleSelect(-1);
                        }}
                    >
                        Off
                        {activeTrack === -1 && <span className="checkmark">✓</span>}
                    </button>

                    {subtitleTracks.map((track, index) => (
                        <button
                            key={index}
                            className={`subtitle-option ${index === activeTrack ? 'active' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleSelect(index);
                            }}
                        >
                            {getLanguageName(track.language)}
                            {index === activeTrack && <span className="checkmark">✓</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

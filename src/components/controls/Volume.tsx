import './Volume.css';

interface VolumeProps {
    volume: number;
    isMuted: boolean;
    toggleMute: () => void;
    handleVolumeChange: (e: Event) => void;
}

export const Volume = ({
    volume,
    isMuted,
    toggleMute,
    handleVolumeChange,
}: VolumeProps) => {
    return (
        <>
            <button
                className="control-button volume-button"
                onClick={toggleMute}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
                {isMuted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
            </button>

            <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="volume-slider"
            />
        </>
    );
};

import { usePlayerStore, setPlayerState } from '../../store/playerStore';
import './Volume.css';

interface VolumeProps {
    volume: number;
    isMuted: boolean;
    toggleMute: () => void;
    handleVolumeChange: (e: Event) => void;
}

export const Volume = () => {
    const volume = usePlayerStore((state) => state.volume);
    const isMuted = usePlayerStore((state) => state.isMuted);
    const toggleMute = () => {
        setPlayerState({ isMuted: !isMuted });
    };

    const handleVolumeChange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const newVolume = parseFloat(target.value);
        setPlayerState({
            volume: newVolume,
            isMuted: newVolume === 0,
        });
    };

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

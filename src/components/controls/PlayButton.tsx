import { usePlayerStore, setPlayerState } from '../../store/playerStore';

export const PlayButton = () => {
    const videoEl = usePlayerStore((state) => state.videoEl);
    const isPlaying = usePlayerStore((state) => state.isPlaying);

    const togglePlay = () => {
        if (!videoEl) return;

        if (videoEl.paused) {
            videoEl.play();
            setPlayerState({ isPlaying: true });
        } else {
            videoEl.pause();
            setPlayerState({ isPlaying: false });
        }
    };
    return (
        <button
            className="control-button play-button"
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
        >
            {isPlaying ? '⏸' : '▶'}
        </button>
    );
};

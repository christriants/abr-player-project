export const PlayButton = ({
    isPlaying,
    onClick: togglePlay,
}: {
    isPlaying: boolean;
    onClick: () => void;
}) => {
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

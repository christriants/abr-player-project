interface FullscreenButtonProps {
    onClick: () => void;
}

export const FullscreenButton = ({
    onClick: toggleFullscreen,
}: FullscreenButtonProps) => {
    return (
        <button
            className="control-button fullscreen-button"
            onClick={toggleFullscreen}
            aria-label="Fullscreen"
        >
            ⛶
        </button>
    );
};

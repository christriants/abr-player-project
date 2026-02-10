import { usePlayerStore } from "../../store/playerStore";

export const FullscreenButton = () => {
    const videoEl = usePlayerStore((state) => state.videoEl);

    const toggleFullscreen = () => {
        if (!videoEl) return;
        if (!document.fullscreenElement) {
            videoEl.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    };

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

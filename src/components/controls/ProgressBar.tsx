import { usePlayerStore, setPlayerState } from '../../store/playerStore';
import { formatTime } from '../../utils/format-time';
import './ProgressBar.css';

export const ProgressBar = () => {
    const videoEl = usePlayerStore((state) => state.videoEl);
    const currentTime = usePlayerStore((state) => state.currentTime);
    const duration = usePlayerStore((state) => state.duration);
    const bufferedRanges = usePlayerStore((state) => state.bufferedRanges);

    const handleSeek = (e: Event) => {
        if (!videoEl) return;

        const target = e.target as HTMLInputElement;
        const newTime = parseFloat(target.value);

        videoEl.currentTime = newTime;
        setPlayerState({ currentTime: newTime });
    };

    const getBufferedSegments = () => {
        if (!bufferedRanges || !duration) return [];

        const segments: { start: number; width: number }[] = [];
        for (let i = 0; i < bufferedRanges.length; i++) {
            const start = (bufferedRanges.start(i) / duration) * 100;
            const end = (bufferedRanges.end(i) / duration) * 100;
            segments.push({ start, width: end - start });
        }
        return segments;
    };

    const progressPercent = duration ? (currentTime / duration) * 100 : 0;

    return (
        <div className="progress-container">
            <div className="time-display">{formatTime(currentTime)}</div>

            <div className="progress-track">
                {getBufferedSegments().map((segment, i) => (
                    <div
                        key={i}
                        className="progress-buffered"
                        style={{
                            left: `${segment.start}%`,
                            width: `${segment.width}%`,
                        }}
                    />
                ))}

                <div
                    className="progress-fill"
                    style={{ width: `${progressPercent}%` }}
                />

                <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    value={currentTime}
                    onChange={handleSeek}
                    className="progress-bar"
                    aria-label="Seek"
                />
            </div>

            <div className="time-display">{formatTime(duration)}</div>
        </div>
    );
};

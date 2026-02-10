import { formatTime } from '../../utils/format-time';
import './ProgressBar.css';

interface ProgressBarProps {
    currentTime: number;
    duration: number;
    handleSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
    bufferedRanges: TimeRanges | null;
}

export const ProgressBar = ({
    currentTime,
    duration,
    handleSeek,
    bufferedRanges,
}: ProgressBarProps) => {
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

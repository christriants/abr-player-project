import { Renditions } from '../types/playback';

type QualitySelectorProps = {
    renditions: Renditions;
    onSelect: (index: number) => void;
};

export const QualitySelector = ({
    renditions,
    onSelect,
}: QualitySelectorProps) => {
    return (
        <div className="quality-selector">
            {renditions.video.map((rendition, i) => (
                <button key={rendition.resolution} onClick={() => onSelect(i)}>
                    {rendition.resolution}
                </button>
            ))}
        </div>
    );
};

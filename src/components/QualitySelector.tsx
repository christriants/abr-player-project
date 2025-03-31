import { Renditions } from '../types/playback';

type QualitySelectorProps = {
    renditions: Renditions[];
    onSelect: (url: string) => void;
};

export const QualitySelector = ({
    renditions,
    onSelect,
}: QualitySelectorProps) => {
    return (
        <div className="quality-selector">
            {renditions.map((rendition) => (
                <button
                    key={rendition.resolution}
                    onClick={() => onSelect(rendition.url)}
                >
                    {rendition.resolution}
                </button>
            ))}
        </div>
    );
};

import { ABRManagerType } from '../../types/abr-manager';
import {
    PlayButton,
    ProgressBar,
    QualitySelector,
    Volume,
    FullscreenButton,
} from './index';
import './Controls.css';
import { usePlayerStore } from '../../store/playerStore';
import { Subtitles } from './Subtitles';

interface ControlsProps {
    abr: ABRManagerType; // Only keep abr type since it's config, not state
}

export const Controls = ({ abr }: ControlsProps) => {
    const showControls = usePlayerStore((state) => state.showControls);
    const textTracks = usePlayerStore((state) => state.textTracks);

    return (
        <div className={`controls ${showControls ? 'visible' : 'hidden'}`}>
            <PlayButton />
            <Volume />
            <ProgressBar />
            <QualitySelector
                abr={abr}
            />
            {!!textTracks.length && <Subtitles />}
            <FullscreenButton />
        </div>
    );
};

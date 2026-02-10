import { ABRManager, ABRManagerType } from '../../types/abr-manager';
import { Renditions } from '../../types/playback';
import {
    PlayButton,
    ProgressBar,
    QualitySelector,
    Volume,
    FullscreenButton,
} from './index';
import './Controls.css';
import { FixedQualityAbrManager } from '../../abr/FixedQualityAbrManager';

// @todo Lift state to shared store
// We can reduce prop drilling by using a shared store (e.g. Zustand) for player state 
// like isPlaying, currentTime, volume, etc. This way, individual 
// controls can subscribe to only the state they need 
// without having to pass everything down from Player.
interface ControlsProps {
    videoRef: React.RefObject<HTMLVideoElement>;
    isPlaying: boolean;
    setIsPlaying: (playing: boolean) => void;
    currentTime: number;
    setCurrentTime: (time: number) => void;
    duration: number;
    setIsMuted: (muted: boolean) => void;
    isMuted: boolean;
    volume: number;
    setVolume: (volume: number) => void;
    renditions?: Renditions;
    abrManager: ABRManager | null;
    abr: ABRManagerType;
    showControls: boolean;
    bufferedRanges: TimeRanges | null;
}

export const Controls = ({
    videoRef,
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    duration,
    setIsMuted,
    isMuted,
    volume,
    setVolume,
    renditions,
    abrManager,
    abr,
    showControls,
    bufferedRanges,
}: ControlsProps) => {
    // @todo Lift playing state to shared store
    const togglePlay = () => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) {
            video.play();
            setIsPlaying(true);
        } else {
            video.pause();
            setIsPlaying(false);
        }
    };

    const toggleMute = () => {
        const video = videoRef.current;
        if (!video) return;
        if (video.muted) {
            video.muted = false;
            setIsMuted(false);
        } else {
            video.muted = true;
            setIsMuted(true);
        }
    };
    // @todo switch to use logarithmic volume
    const handleVolumeChange = (e: Event) => {
        const video = videoRef.current;
        if (!video) return;

        const target = e.target as HTMLInputElement;
        const newVolume = parseFloat(target.value);
        video.volume = newVolume;
        setVolume(newVolume);
        setIsMuted(newVolume === 0);
    };

    const handleSeek = (e: Event) => {
        const video = videoRef.current;
        if (!video) return;

        const target = e.target as HTMLInputElement;
        video.currentTime = parseFloat(target.value);
        setCurrentTime(video.currentTime);
    };

    const handleQualityChange = async (index: number) => {
        if (abr === 'fixed' && abrManager instanceof FixedQualityAbrManager) {
            await abrManager?.setManualRendition(index);
        }
    };

    const toggleFullscreen = () => {
        const container = videoRef.current?.parentElement;
        if (!container) return;

        if (!document.fullscreenElement) {
            container.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    };

    return (
        <div className={`controls ${showControls ? 'visible' : 'hidden'}`}>
            <PlayButton isPlaying={isPlaying} onClick={togglePlay} />
            <Volume
                volume={volume}
                isMuted={isMuted}
                toggleMute={toggleMute}
                handleVolumeChange={handleVolumeChange}
            />
            <ProgressBar
                currentTime={currentTime}
                duration={duration}
                handleSeek={handleSeek}
                bufferedRanges={bufferedRanges}
            />
            <QualitySelector
                abr={abr}
                renditions={renditions}
                onSelect={handleQualityChange}
            />
            <FullscreenButton onClick={toggleFullscreen} />
        </div>
    );
};

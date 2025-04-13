import { useEffect, useRef, useState } from 'preact/hooks';
import { MSEEngine } from '../playback-engine/MSEEngine';
import { fetchManifest } from '../utils/fetch-manifest';
import { fetchPlaylist } from '../utils/fetch-playlist';
import { QualitySelector } from './QualitySelector';
import { Renditions } from '../types/playback';

type PlayerProps = {
    src: string;
};

export const Player = ({ src }: PlayerProps) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [engine, setEngine] = useState<MSEEngine | null>(null);
    const [renditions, setRenditions] = useState<Renditions[]>([]);

    const handleQualityChange = async (url: string) => {
        if (!engine || !videoRef.current) return;

        const targetTime = videoRef.current.currentTime;

        await engine.clearBuffer();

        videoRef.current.currentTime = targetTime;

        const segmentUrls = await fetchPlaylist(url);
        engine.loadSegments(segmentUrls, videoRef.current.currentTime);
    };

    useEffect(() => {
        if (!src || !videoRef.current) return;

        async function getRenditions(src: string, videoEl: HTMLVideoElement) {
            const renditions = await fetchManifest(src);
            setRenditions(renditions);

            if (!renditions.length) return;

            const startingRendition = renditions[0];
            const segmentUrls = await fetchPlaylist(startingRendition.url);

            // Calculate the total duration of the video (e.g., from the manifest)
            const totalDuration = renditions[0].totalDuration; // Assuming the manifest provides this
            console.log('Total video duration:', totalDuration);

            const mseInstance = new MSEEngine(videoEl, totalDuration);
            setEngine(mseInstance);
            mseInstance.loadSegments(
                segmentUrls,
                videoRef.current!.currentTime
            );
        }

        getRenditions(src, videoRef.current);

        return () => {
            engine?.destroy();
        };
    }, [src]);

    useEffect(() => {
        const videoEl = videoRef.current;
        if (!videoEl) return;

        const handleError = () => {
            console.error('Video error:', videoEl.error);
        };

        const handleCanPlay = () => {
            videoEl.play().catch((e) => console.error('Play error:', e));
        };

        videoEl.addEventListener('error', handleError);
        videoEl.addEventListener('canplay', handleCanPlay);

        return () => {
            videoEl.removeEventListener('error', handleError);
            videoEl.removeEventListener('canplay', handleCanPlay);
        };
    }, []);

    return (
        <>
            <video ref={videoRef} width="640" height="360" controls></video>
            <QualitySelector
                renditions={renditions}
                onSelect={handleQualityChange}
            />
        </>
    );
};

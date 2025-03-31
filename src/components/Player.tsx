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

        // Remove existing buffer
        engine.clearBuffer();

        // Fetch new segments for the selected quality
        const segmentUrls = await fetchPlaylist(url);
        engine.loadSegments(segmentUrls);

        videoRef.current.currentTime = Math.max(
            0,
            videoRef.current.currentTime - 1
        );
    };

    useEffect(() => {
        if (!src || !videoRef.current) {
            console.log('No src or video element');
            return;
        }

        async function getRenditions(src: string, videoEl: HTMLVideoElement) {
            if (!src || !videoEl) {
                console.log('No src or video element inside getRenditions');
                return;
            }
            const renditions = await fetchManifest(src);
            setRenditions(renditions);

            if (!renditions.length) {
                console.log('No renditions found');
                return;
            }

            const startingRendition = renditions[0];
            console.log('Starting rendition:', startingRendition);

            const segmentUrls = await fetchPlaylist(startingRendition.url);
            console.log('segmentUrls:', segmentUrls);

            const mseInstance = new MSEEngine(videoEl);
            setEngine(mseInstance);
            mseInstance.loadSegments(segmentUrls);
        }

        getRenditions(src, videoRef.current);

        return () => {
            if (engine) {
                engine.destroy();
            }
        };
    }, [src]);

    useEffect(() => {
        console.log('useEffect for video element events');
        const videoEl = videoRef.current;
        if (!videoEl) {
            console.log('No video element found');
            return;
        }

        const handleError = (e: Event) => {
            console.error('Video error:', videoEl.error);
        };

        const handleCanPlay = () => {
            console.log('Video can play');
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

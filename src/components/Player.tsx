import { useEffect, useRef, useState } from 'preact/hooks';
import { MSEEngine } from '../playback-engine/MSEEngine';
import { fetchManifest } from '../utils/fetch-manifest';
import {
    clearPlaylistCache,
    fetchPlaylist,
    fetchPlaylistData,
} from '../utils/fetch-playlist';
import { QualitySelector } from './QualitySelector';
import type { Renditions } from '../types/playback';
import type { ABRManager, ABRManagerType } from '../types/abr-manager';
import { FixedQualityAbrManager } from '../abr/FixedQualityAbrManager';
import { BufferBasedAbrManager } from '../abr/BufferBasedAbrManager';

type PlayerProps = {
    src: string;
    abr?: ABRManagerType;
};

export const Player = ({ src, abr = 'fixed' }: PlayerProps) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [engine, setEngine] = useState<MSEEngine | null>(null);
    const [renditions, setRenditions] = useState<Renditions[]>([]);
    const [abrManager, setAbrManager] = useState<ABRManager | null>(null);

    const handleQualityChange = async (index: number) => {
        if (abr === 'fixed' && abrManager instanceof FixedQualityAbrManager) {
            await abrManager.updateSelectedIndex(index);
        }
    };

    useEffect(() => {
        if (!src || !videoRef.current) return;

        clearPlaylistCache();

        async function initializePlayer() {
            const videoEl = videoRef.current!;
            const renditions = await fetchManifest(src);
            setRenditions(renditions);

            if (!renditions.length) return;

            const startingIndex = 0;
            const selectedRendition = renditions[startingIndex];

            const playlist = await fetchPlaylist(selectedRendition.url);
            const { segmentUrls, totalDuration } = await fetchPlaylistData(
                playlist,
                selectedRendition.url
            );

            const codecs = selectedRendition.codecs;

            if (abrManager) {
                abrManager.destroy();
            }

            let mseInstance;
            if (engine) {
                await engine.reset();
                mseInstance = engine;
            } else {
                mseInstance = new MSEEngine(videoEl, totalDuration, codecs);
                setEngine(mseInstance);
                await mseInstance.loadSegments(segmentUrls, 0);
            }

            let abrManagerInstance: ABRManager;
            if (abr === 'buffer-based') {
                abrManagerInstance = new BufferBasedAbrManager();
            } else {
                abrManagerInstance = new FixedQualityAbrManager(startingIndex);
            }

            abrManagerInstance.initialize(videoEl, renditions, mseInstance);
            setAbrManager(abrManagerInstance);
        }

        initializePlayer();

        return () => {
            abrManager?.destroy();
            engine?.destroy();
        };
    }, [src, abr]);

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
            {abr === 'fixed' && (
                <QualitySelector
                    renditions={renditions}
                    onSelect={handleQualityChange}
                />
            )}
        </>
    );
};

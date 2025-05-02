import { useEffect, useRef, useState } from 'preact/hooks';
import { MSEEngine } from '../playback-engine/MSEEngine';
import { fetchManifest } from '../utils/fetch-manifest';
import {
    clearPlaylistCache,
    fetchPlaylist,
    fetchPlaylistData,
} from '../utils/fetch-playlist';
import { QualitySelector } from './QualitySelector';
import { Renditions } from '../types/playback';
import { ABRManager } from '../types/abr-manager';
import { FixedAbrManager } from '../abr/FixedAbrManager';
import { BufferAbrManager } from '../abr/BufferAbrManager';

type PlayerProps = {
    src: string;
    abrManager?: 'buffer' | 'fixed';
};

export const Player = ({ src, abrManager = 'fixed' }: PlayerProps) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [engine, setEngine] = useState<MSEEngine | null>(null);
    const [renditions, setRenditions] = useState<Renditions[]>([]);
    const [abr, setAbr] = useState<ABRManager | null>(null);

    const handleQualityChange = async (index: number) => {
        if (abrManager === 'fixed' && abr instanceof FixedAbrManager) {
            await abr.updateSelectedIndex(index);
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
            console.log('[Player] Codecs:', codecs);

            if (abr) {
                console.log('[Player] Destroying previous ABR manager');
                abr.destroy();
            }

            let mseInstance;
            if (engine) {
                console.log('[Player] Resetting MSEEngine');
                await engine.reset(codecs);
                mseInstance = engine;
            } else {
                console.log('[Player] Initializing new MSEEngine');
                mseInstance = new MSEEngine(videoEl, totalDuration, codecs);
                setEngine(mseInstance);
                await mseInstance.loadSegments(segmentUrls, 0);
            }

            let managerInstance: ABRManager;
            if (abrManager === 'buffer') {
                console.log('[Player] Initializing BufferAbrManager');
                managerInstance = new BufferAbrManager();
            } else {
                console.log('[Player] Initializing FixedAbrManager');
                managerInstance = new FixedAbrManager(startingIndex);
            }

            managerInstance.initialize(videoEl, renditions, mseInstance);
            setAbr(managerInstance);
        }

        initializePlayer();

        return () => {
            console.log('[Player] Cleaning up Player');
            abr?.destroy();
            engine?.destroy();
        };
    }, [src, abrManager]);

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
            {abrManager === 'fixed' && (
                <QualitySelector
                    renditions={renditions}
                    onSelect={handleQualityChange}
                />
            )}
        </>
    );
};

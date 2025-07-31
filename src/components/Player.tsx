import { useEffect, useRef, useState } from 'preact/hooks';
import { MSEEngine } from '../playback-engine/MSEEngine';
import { fetchManifest } from '../utils/fetch-manifest';
import {
    clearPlaylistCache,
    fetchPlaylist,
    fetchPlaylistData,
} from '../utils/fetch-playlist';
import { QualitySelector } from './QualitySelector';
import type { Rendition, Renditions } from '../types/playback';
import type { ABRManager, ABRManagerType } from '../types/abr-manager';
import { FixedQualityAbrManager } from '../abr/FixedQualityAbrManager';
import { BufferBasedAbrManager } from '../abr/BufferBasedAbrManager';
import { ThroughputAbrManager } from '../abr/ThroughputAbrManager';
import { SimpleNetworkManager } from '../network-manager/SimpleNetworkManager';

type PlayerProps = {
    src: string;
    abr?: ABRManagerType;
    onDebugInfoUpdate: (info: {
        currentRendition: Rendition['resolution'];
        estimatedBandwidth: number;
        bufferLength: number;
    }) => void;
};

export const Player = ({
    src,
    abr = 'fixed',
    onDebugInfoUpdate,
}: PlayerProps) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [engine, setEngine] = useState<MSEEngine | null>(null);
    const [renditions, setRenditions] = useState<Renditions | null>(null);
    const [abrManager, setAbrManager] = useState<ABRManager | null>(null);
    const networkManagerRef = useRef<SimpleNetworkManager | null>(null);

    const handleQualityChange = async (index: number) => {
        if (abr === 'fixed' && abrManager instanceof FixedQualityAbrManager) {
            await abrManager.setManualRendition(index);
        }
    };

    const onPlaybackStalled = () => {
        console.warn('Playback stalled');
        if (abrManager && typeof abrManager.onPlaybackStall === 'function') {
            abrManager.onPlaybackStall();
        }
    };

    useEffect(() => {
        if (!src || !videoRef.current) return;

        clearPlaylistCache();

        async function initializePlayer() {
            const videoEl = videoRef.current!;
            const renditions = await fetchManifest(src);
            setRenditions(renditions);

            if (!renditions.video.length) return;

            const startingIndex = 0;
            const videoRendition = renditions.video[startingIndex];
            const audioRendition = renditions.audio[0];

            const videoPlaylist = await fetchPlaylist(videoRendition.url);
            const audioPlaylist = await fetchPlaylist(audioRendition.url);

            const {
                segmentUrls: videoSegmentUrls,
                totalDuration: videoDuration,
                initSegmentUrl: videoInitSegmentUrl,
            } = await fetchPlaylistData(videoPlaylist, videoRendition.url);

            const {
                segmentUrls: audioSegmentUrls,
                initSegmentUrl: audioInitSegmentUrl,
            } = await fetchPlaylistData(audioPlaylist, audioRendition.url);

            const codecs = videoRendition.codecs;

            if (abrManager) {
                abrManager.destroy();
            }

            if (networkManagerRef.current) {
                networkManagerRef.current.destroy();
            }

            const networkManager = new SimpleNetworkManager();
            networkManagerRef.current = networkManager;

            let mseInstance;
            if (engine) {
                await engine.reset();
                mseInstance = engine;
            } else {
                mseInstance = new MSEEngine(
                    videoEl,
                    videoDuration,
                    codecs,
                    networkManagerRef.current
                );

                setEngine(mseInstance);
                await mseInstance.loadSegments(
                    {
                        initSegmentUrls: {
                            video: videoInitSegmentUrl || videoSegmentUrls[0],
                            audio: audioInitSegmentUrl || audioSegmentUrls[0],
                        },
                        segmentUrls: {
                            video: videoSegmentUrls,
                            audio: audioSegmentUrls,
                        },
                    },
                    0
                );
            }

            let abrManagerInstance: ABRManager;

            if (abr === 'buffer-based') {
                abrManagerInstance = new BufferBasedAbrManager();
            } else if (abr === 'fixed') {
                abrManagerInstance = new FixedQualityAbrManager();
            } else if (abr === 'network-throughput') {
                abrManagerInstance = new ThroughputAbrManager();
            } else {
                throw new Error(`Unsupported ABR type: ${abr}`);
            }

            abrManagerInstance.initialize(
                videoEl,
                renditions,
                mseInstance,
                networkManager
            );
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

        const handleWaiting = () => {
            console.log('Video is waiting');
            onPlaybackStalled();
        };

        const handleTimeUpdate = () => {
            const buffered = videoEl.buffered;
            const currentTime = videoEl.currentTime;

            let isStalled = true;
            for (let i = 0; i < buffered.length; i++) {
                if (
                    currentTime >= buffered.start(i) &&
                    currentTime <= buffered.end(i)
                ) {
                    isStalled = false;
                    break;
                }
            }

            if (isStalled) {
                console.log('Detected potential stall during timeupdate');
                onPlaybackStalled();
            }
        };

        videoEl.addEventListener('waiting', handleWaiting);
        videoEl.addEventListener('timeupdate', handleTimeUpdate);

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

    useEffect(() => {
        const videoEl = videoRef.current;
        if (!videoEl || !abrManager) return;

        const updateDebugInfo = () => {
            const currentRendition = abrManager.getRendition();
            const estimatedBandwidth =
                networkManagerRef?.current?.getBandwidthEstimate() || 0;
            const bufferLength = videoEl.buffered.length
                ? videoEl.buffered.end(0) - videoEl.currentTime
                : 0;

            onDebugInfoUpdate({
                currentRendition: currentRendition
                    ? currentRendition.resolution
                    : 'Unknown',
                estimatedBandwidth,
                bufferLength,
            });
        };

        const interval = setInterval(updateDebugInfo, 1000);

        return () => {
            clearInterval(interval);
        };
    }, [abrManager, renditions, onDebugInfoUpdate]);

    return (
        <>
            <video ref={videoRef} width="640" height="360" controls></video>
            {abr === 'fixed' && renditions && (
                <QualitySelector
                    renditions={renditions}
                    onSelect={handleQualityChange}
                />
            )}
        </>
    );
};

import { useEffect, useRef, useState } from 'preact/hooks';
import { MSEEngine } from '../playback-engine/MSEEngine';
import { fetchManifest } from '../utils/fetch-manifest';
import {
    clearPlaylistCache,
    fetchPlaylist,
    fetchPlaylistData,
} from '../utils/fetch-playlist';
import type { Rendition } from '../types/playback';
import type { ABRManager, ABRManagerType } from '../types/abr-manager';
import { FixedQualityAbrManager } from '../abr/FixedQualityAbrManager';
import { BufferBasedAbrManager } from '../abr/BufferBasedAbrManager';
import { ThroughputAbrManager } from '../abr/ThroughputAbrManager';
import { SimpleNetworkManager } from '../network-manager/SimpleNetworkManager';
import { Controls } from './controls';
import './Player.css';
import { setPlayerState, usePlayerStore } from '../store/playerStore';
import { TextTrackManager } from '../text-track-manager/text-track-manager';

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
    const textTrackManager = useRef<TextTrackManager | null>(null);
    const networkManagerRef = useRef<SimpleNetworkManager | null>(null);
    const hideControlsTimeoutRef = useRef<number | null>(null);

    const videoEl = usePlayerStore((state) => state.videoEl);
    const engine = usePlayerStore((state) => state.engine);
    const abrManager = usePlayerStore((state) => state.abrManager);
    const isPlaying = usePlayerStore((state) => state.isPlaying);
    const isBuffering = usePlayerStore((state) => state.isBuffering);
    const isInitialLoading = usePlayerStore((state) => state.isInitialLoading);
    const textTracks = usePlayerStore((state) => state.textTracks);

    const resetControlsTimeout = () => {
        if (hideControlsTimeoutRef.current) {
            clearTimeout(hideControlsTimeoutRef.current);
        }

        setPlayerState({ showControls: true });

        if (isPlaying && !videoEl?.paused) {
            hideControlsTimeoutRef.current = window.setTimeout(() => {
                setPlayerState({ showControls: false });
            }, 2000);
        }
    };

    const handleMouseMove = () => resetControlsTimeout();

    const handleMouseLeave = () => {
        if (isPlaying) {
            hideControlsTimeoutRef.current = window.setTimeout(() => {
                setPlayerState({ showControls: false });
            }, 2000);
        }
    };

    const onPlaybackStalled = () => {
        console.warn('Playback stalled');
        setPlayerState({ isBuffering: true });
        if (abrManager && typeof abrManager.onPlaybackStall === 'function') {
            abrManager.onPlaybackStall();
        }
    };

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        setPlayerState({ videoEl: video });

        const handleLoadedMetadata = () => {
            setPlayerState({ duration: video.duration });
        };

        const handleWaiting = () => {
            console.log('Video is waiting');
            onPlaybackStalled();
        };

        const handleTimeUpdate = () => {
            const buffered = video.buffered;
            const currentTime = video.currentTime;

            setPlayerState({
                currentTime,
                duration: video.duration,
            });

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

        const handlePlaying = () => {
            console.log('Playback resumed');
            setPlayerState({ isBuffering: false, isPlaying: true });
        };

        const handleEnded = () => {
            setPlayerState({ isPlaying: false });
        };

        const handleError = () => {
            console.error('Video error:', video.error);
        };

        const handleCanPlay = () => {
            setPlayerState({ isInitialLoading: false });
            video.play().catch((e) => console.error('Play error:', e));
        };

        const handleProgress = () => {
            setPlayerState({ bufferedRanges: video.buffered });
        };

        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('waiting', handleWaiting);
        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('playing', handlePlaying);
        video.addEventListener('ended', handleEnded);
        video.addEventListener('error', handleError);
        video.addEventListener('canplay', handleCanPlay);
        video.addEventListener('progress', handleProgress);

        return () => {
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            video.removeEventListener('waiting', handleWaiting);
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('playing', handlePlaying);
            video.removeEventListener('ended', handleEnded);
            video.removeEventListener('error', handleError);
            video.removeEventListener('canplay', handleCanPlay);
            video.removeEventListener('progress', handleProgress);
        };
    }, []);

    useEffect(() => {
        if (!src || !videoEl) return;

        clearPlaylistCache();

        async function initializePlayer() {
            const renditions = await fetchManifest(src);
            setPlayerState({ renditions });
            if (renditions.textTracks?.length && videoEl) {
                textTrackManager.current = new TextTrackManager(videoEl);
                setPlayerState({
                    textTrackManager: textTrackManager.current,
                    textTracks: renditions.textTracks,
                });
            }

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

            if (textTrackManager.current) {
                textTrackManager.current.clear();
            }

            const networkManager = new SimpleNetworkManager();
            networkManagerRef.current = networkManager;

            let mseInstance;
            if (engine) {
                await engine.reset();
                mseInstance = engine;
            } else {
                if (!videoEl) {
                    throw new Error('Video element not found');
                }
                mseInstance = new MSEEngine(
                    videoEl,
                    videoDuration,
                    codecs,
                    networkManagerRef.current
                );

                setPlayerState({ engine: mseInstance });
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

            if (!videoEl) {
                throw new Error('Video element not found');
            }

            abrManagerInstance.initialize(
                videoEl,
                renditions,
                mseInstance,
                networkManager
            );
            setPlayerState({ abrManager: abrManagerInstance });
        }

        if (textTracks.length) {
            textTrackManager.current = new TextTrackManager(videoEl!);
            setPlayerState({ textTrackManager: textTrackManager.current });
        }

        initializePlayer();

        return () => {
            abrManager?.destroy();
            engine?.destroy();
            textTrackManager.current?.clear();
        };
    }, [src, abr, videoEl]);

    useEffect(() => {
        if (!videoEl || !abrManager || !engine) return;

        const updateDebugInfo = () => {
            const currentRendition = abrManager.getRendition();
            const estimatedBandwidth =
                networkManagerRef?.current?.getBandwidthEstimate() || 0;
            const bufferLength = engine.getBufferedLength(videoEl.currentTime);

            onDebugInfoUpdate({
                currentRendition: currentRendition?.resolution ?? 'Unknown',
                estimatedBandwidth,
                bufferLength,
            });
        };

        const interval = setInterval(updateDebugInfo, 1000);
        return () => clearInterval(interval);
    }, [videoEl, abrManager, engine, onDebugInfoUpdate]);

    useEffect(() => {
        resetControlsTimeout();
    }, [isPlaying]);

    useEffect(() => {
        return () => {
            if (hideControlsTimeoutRef.current) {
                clearTimeout(hideControlsTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !textTracks.length) return;

        while (video.firstChild) {
            video.removeChild(video.firstChild);
        }

        textTracks.forEach((track) => {
            const textTrack = video.addTextTrack(
                track.kind,
                track.name,
                track.language
            );

            textTrack.mode = track.default ? 'showing' : 'hidden';
        });
    }, []);

    return (
        <div className="player-container">
            <div
                className="video-wrapper"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
            >
                <video
                    ref={videoRef}
                    width="640"
                    height="360"
                    autoPlay
                    muted
                    disablePictureInPicture
                    crossOrigin="anonymous"
                />
                {(isInitialLoading || isBuffering) && (
                    <div className="spinner-overlay">
                        <div className="spinner"></div>
                    </div>
                )}
                <Controls abr={abr} />
            </div>
        </div>
    );
};

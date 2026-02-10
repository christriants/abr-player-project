import { useEffect, useRef, useState } from 'preact/hooks';
import { MSEEngine } from '../playback-engine/MSEEngine';
import { fetchManifest } from '../utils/fetch-manifest';
import {
    clearPlaylistCache,
    fetchPlaylist,
    fetchPlaylistData,
} from '../utils/fetch-playlist';
import type { Rendition, Renditions } from '../types/playback';
import type { ABRManager, ABRManagerType } from '../types/abr-manager';
import { FixedQualityAbrManager } from '../abr/FixedQualityAbrManager';
import { BufferBasedAbrManager } from '../abr/BufferBasedAbrManager';
import { ThroughputAbrManager } from '../abr/ThroughputAbrManager';
import { SimpleNetworkManager } from '../network-manager/SimpleNetworkManager';
import { Controls } from './controls';
import './Player.css';

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

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(true);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [isBuffering, setIsBuffering] = useState(false);
    const [bufferedRanges, setBufferedRanges] = useState<TimeRanges | null>(
        null
    );

    const [showControls, setShowControls] = useState(true);
    const hideControlsTimeoutRef = useRef<number | null>(null);

    const resetControlsTimeout = () => {
        if (hideControlsTimeoutRef.current) {
            clearTimeout(hideControlsTimeoutRef.current);
        }

        setShowControls(true);

        if (isPlaying && !videoRef.current?.paused) {
            hideControlsTimeoutRef.current = window.setTimeout(() => {
                setShowControls(false);
            }, 2000);
        }
    };

    const handleMouseMove = () => {
        resetControlsTimeout();
    };

    const handleMouseLeave = () => {
        if (isPlaying) {
            hideControlsTimeoutRef.current = window.setTimeout(() => {
                setShowControls(false);
            }, 2000);
        }
    };

    // -------- Video Event Handlers --------
    const onPlaybackStalled = () => {
        console.warn('Playback stalled');
        setIsBuffering(true);
        if (abrManager && typeof abrManager.onPlaybackStall === 'function') {
            abrManager.onPlaybackStall();
        }
    };

    const handlePlaying = () => {
        console.log('Playback resumed');
        setIsBuffering(false);
        setIsPlaying(true);
    };

    const handleError = () => {
        console.error('Video error:', videoRef?.current?.error);
    };

    const handleCanPlay = () => {
        setIsInitialLoading(false);
        videoRef.current?.play().catch((e) => console.error('Play error:', e));
    };

    const handleEnded = () => {
        setIsPlaying(false);
    };

    const handleProgress = () => {
        const video = videoRef.current;
        if (!video) return;
        setBufferedRanges(video.buffered);
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

        const handleLoadedMetadata = () => {
            setDuration(videoEl.duration);
        };

        const handleWaiting = () => {
            console.log('Video is waiting');
            onPlaybackStalled();
        };

        const handleTimeUpdate = () => {
            const buffered = videoEl.buffered;
            const currentTime = videoEl.currentTime;
            setCurrentTime(currentTime);
            setDuration(videoEl.duration);

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

        videoEl.addEventListener('loadedmetadata', handleLoadedMetadata);
        videoEl.addEventListener('waiting', handleWaiting);
        videoEl.addEventListener('timeupdate', handleTimeUpdate);
        videoEl.addEventListener('playing', handlePlaying);
        videoEl.addEventListener('ended', handleEnded);
        videoEl.addEventListener('error', handleError);
        videoEl.addEventListener('canplay', handleCanPlay);
        videoEl.addEventListener('progress', handleProgress);

        return () => {
            videoEl.removeEventListener('loadedmetadata', handleLoadedMetadata);
            videoEl.removeEventListener('error', handleError);
            videoEl.removeEventListener('canplay', handleCanPlay);
            videoEl.removeEventListener('playing', handlePlaying);
            videoEl.removeEventListener('ended', handleEnded);
            videoEl.removeEventListener('waiting', handleWaiting);
            videoEl.removeEventListener('timeupdate', handleTimeUpdate);
            videoEl.removeEventListener('progress', handleProgress);
        };
    }, []);
    useEffect(() => {
        const videoEl = videoRef.current;
        if (!videoEl || !abrManager || !engine) return;

        const updateDebugInfo = () => {
            const currentRendition = abrManager.getRendition();
            const estimatedBandwidth =
                networkManagerRef?.current?.getBandwidthEstimate() || 0;
            const bufferLength = engine.getBufferedLength(videoEl.currentTime);

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

    return (
        <div className="player-container">
            <div
                className="video-wrapper"
                onMouseEnter={handleMouseMove}
                onMouseLeave={handleMouseLeave}
            >
                <video
                    ref={videoRef}
                    width="640"
                    height="360"
                    autoPlay
                    muted
                    controls={false}
                    disablePictureInPicture
                ></video>
                {(isInitialLoading || isBuffering) && (
                    <div className="spinner-overlay">
                        <div className="spinner"></div>
                    </div>
                )}
                <Controls
                    videoRef={videoRef}
                    isPlaying={isPlaying}
                    isMuted={isMuted}
                    volume={volume}
                    currentTime={currentTime}
                    duration={duration}
                    setIsPlaying={setIsPlaying}
                    setIsMuted={setIsMuted}
                    setVolume={setVolume}
                    setCurrentTime={setCurrentTime}
                    showControls={showControls}
                    abrManager={abrManager}
                    abr={abr}
                    renditions={renditions || undefined}
                    bufferedRanges={bufferedRanges}
                />
            </div>
        </div>
    );
};

import type { ABRManager } from '../types/abr-manager';
import { MSEEngine } from '../playback-engine/MSEEngine';
import type { Rendition, Renditions } from '../types/playback';
import { NetworkManager } from '../types/network-manager';
import { fetchPlaylist, fetchPlaylistData } from '../utils/fetch-playlist';

export class ThroughputAbrManager implements ABRManager {
    private renditions: Renditions = {
        video: [],
        audio: [],
    };
    private videoEl!: HTMLVideoElement;
    private engine!: MSEEngine;
    private manualIndex: number | null = null;
    private networkManager!: NetworkManager;
    private bandwidthSafetyMargin = 1.1;
    private currentIndex: number = 0;
    private interval: number | undefined;

    initialize(
        videoEl: HTMLVideoElement,
        renditions: {
            video: Rendition[];
            audio: Rendition[];
        },
        engine: MSEEngine,
        networkManager: NetworkManager
    ): void {
        this.videoEl = videoEl;
        this.renditions = renditions;
        this.engine = engine;
        this.networkManager = networkManager;
        this.renditions = {
            video: this.renditions.video.sort(
                (a, b) => a.bandwidth - b.bandwidth
            ),
            audio: this.renditions.audio.sort(
                (a, b) => a.bandwidth - b.bandwidth
            ),
        };

        const startingIndex = this.selectRendition();
        this.currentIndex = startingIndex;
        this.loadRendition(startingIndex);

        this.videoEl.addEventListener('timeupdate', () => {
            const estimatedBps = this.networkManager.getBandwidthEstimate();
            if (!estimatedBps) {
                console.warn('No bandwidth estimate available');
                return;
            }

            const selectedIndex = this.selectRendition();
            if (selectedIndex !== this.currentIndex) {
                console.log(
                    `Switching to rendition: ${this.renditions.video[selectedIndex].resolution}`
                );
                this.loadRendition(selectedIndex);
            }
        });
    }

    selectRendition(): number {
        if (this.manualIndex !== null) return this.manualIndex;

        const estimatedBps = this.networkManager.getBandwidthEstimate();
        const safeBps = estimatedBps / this.bandwidthSafetyMargin;

        let bestIndex = 0;
        for (let i = 0; i < this.renditions.video.length; i++) {
            const rendition = this.renditions.video[i];
            if (rendition.bandwidth <= safeBps) {
                bestIndex = i;
            } else {
                break;
            }
        }

        const currentRendition = this.renditions.video[this.currentIndex];

        const shouldDownswitch =
            estimatedBps < currentRendition.bandwidth * 0.9 &&
            bestIndex < this.currentIndex;

        const shouldUpswitch =
            estimatedBps > currentRendition.bandwidth * 1.1 &&
            bestIndex > this.currentIndex;

        if (shouldDownswitch) {
            console.log(
                `Downswitching: Bandwidth (${estimatedBps}) << Current (${currentRendition.bandwidth})`
            );
            return bestIndex;
        }

        if (shouldUpswitch) {
            console.log(
                `Upswitching: Bandwidth (${estimatedBps}) >> Current (${currentRendition.bandwidth})`
            );
            return bestIndex;
        }

        return this.currentIndex;
    }

    getRendition(): Rendition {
        return this.renditions.video[this.currentIndex];
    }

    setManualRendition(index: number): void {
        this.manualIndex = index;
    }

    clearManualRendition(): void {
        this.manualIndex = null;
        console.log('Manual rendition cleared, resuming automatic selection');
        const selectedIndex = this.selectRendition();
        if (selectedIndex !== this.currentIndex) {
            console.log(
                `Switching to rendition: ${this.renditions.video[selectedIndex].resolution}`
            );
            this.loadRendition(selectedIndex);
        }
    }

    onPlaybackStall(): void {
        const selectedIndex = this.selectRendition();
        if (selectedIndex !== this.currentIndex) {
            console.log(
                `Downswitching to rendition: ${this.renditions.video[selectedIndex].resolution}`
            );
            this.loadRendition(selectedIndex);
        }
    }

    private async loadRendition(index: number): Promise<void> {
        this.currentIndex = index;
        const videoRendition = this.renditions.video[index];
        const audioRendition = this.renditions.audio[0];

        const videoPlaylist = await fetchPlaylist(videoRendition.url);
        const audioPlaylist = await fetchPlaylist(audioRendition.url);
        const {
            segmentUrls: videoSegmentUrls,
            initSegmentUrl: videoInitSegmentUrl,
        } = await fetchPlaylistData(videoPlaylist, videoRendition.url);

        const { segmentUrls: audioSegmentUrls } = await fetchPlaylistData(
            audioPlaylist,
            audioRendition.url
        );

        await this.engine.clearBuffers();
        this.engine.requestedSegments.video.clear();
        this.engine.requestedSegments.audio.clear();
        this.engine.loadSegments(
            {
                initSegmentUrls: {
                    video: videoInitSegmentUrl,
                    audio: audioSegmentUrls[0],
                },
                segmentUrls: {
                    video: videoSegmentUrls,
                    audio: audioSegmentUrls,
                },
            },
            this.videoEl.currentTime
        );
    }

    destroy(): void {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = undefined;
        }
        this.manualIndex = null;
    }
}

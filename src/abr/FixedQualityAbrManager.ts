import { MSEEngine } from '../playback-engine/MSEEngine';
import { ABRManager } from '../types/abr-manager';
import { NetworkManager } from '../types/network-manager';
import { Rendition, Renditions } from '../types/playback';
import { fetchPlaylist, fetchPlaylistData } from '../utils/fetch-playlist';

export class FixedQualityAbrManager implements ABRManager {
    private currentIndex = 0;
    private manualIndex: number | null = null;
    private videoEl!: HTMLVideoElement;
    private renditions!: Renditions;
    private engine!: MSEEngine;

    async initialize(
        videoEl: HTMLVideoElement,
        renditions: Renditions,
        engine: MSEEngine,
        _networkManager: NetworkManager
    ) {
        this.videoEl = videoEl;
        this.renditions = renditions;
        this.engine = engine;

        console.log('FixedQualityAbrManager initialized:', renditions);
    }

    destroy() {
        console.log('FixedQualityAbrManager destroyed');
    }

    getRendition(): Rendition {
        return this.renditions.video[this.currentIndex];
    }

    selectRendition(): number {
        return this.manualIndex ?? this.currentIndex;
    }

    setManualRendition(index: number): void {
        this.manualIndex = index;
        this.updateSelectedIndex(index);
    }

    clearManualRendition(): void {
        this.manualIndex = null;
    }

    onPlaybackStall(): void {}

    private async updateSelectedIndex(index: number) {
        if (this.currentIndex === index) return;
        this.currentIndex = index;
        await this.loadRenditionByIndex(index);
    }

    private async loadRenditionByIndex(index: number) {
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
}

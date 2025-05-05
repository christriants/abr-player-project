import { MSEEngine } from '../playback-engine/MSEEngine';
import { ABRManager } from '../types/abr-manager';
import { NetworkManager } from '../types/network-manager';
import { Renditions } from '../types/playback';
import { fetchPlaylist, fetchPlaylistData } from '../utils/fetch-playlist';

export class BufferBasedAbrManager implements ABRManager {
    private videoEl!: HTMLVideoElement;
    private renditions!: Renditions[];
    private engine!: MSEEngine;
    private currentIndex = 0;
    private manualIndex: number | null = null;
    private interval: number | undefined;

    initialize(
        videoEl: HTMLVideoElement,
        renditions: Renditions[],
        engine: MSEEngine,
        _networkManager: NetworkManager
    ) {
        this.videoEl = videoEl;
        this.renditions = renditions.sort((a, b) => a.bandwidth - b.bandwidth);
        this.engine = engine;
        this.currentIndex = 0;

        console.log('BufferBasedAbrManager initialized');

        this.interval = window.setInterval(
            () => this.checkBufferAndSwitch(),
            1000
        );
    }

    destroy() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = undefined;
        }
        console.log('BufferBasedAbrManager destroyed');
    }

    selectRendition(): number {
        return this.manualIndex ?? this.currentIndex;
    }

    setManualRendition(index: number): void {
        this.manualIndex = index;
        this.loadRendition(index);
    }

    clearManualRendition(): void {
        this.manualIndex = null;
    }

    onPlaybackStall(): void {}

    private async checkBufferAndSwitch() {
        if (this.manualIndex !== null) return;

        const bufferLength = this.engine.getBufferedLength(
            this.videoEl.currentTime
        );
        console.log(
            `Buffer length: ${bufferLength}, Current resolution: ${
                this.renditions[this.currentIndex].resolution
            }`
        );

        if (bufferLength < 3 && this.currentIndex > 0) {
            this.currentIndex--;
            await this.loadRendition(this.currentIndex);
        } else if (
            bufferLength > 3 &&
            this.currentIndex < this.renditions.length - 1
        ) {
            this.currentIndex++;
            await this.loadRendition(this.currentIndex);
        }
    }

    private async loadRendition(index: number) {
        const rendition = this.renditions[index];
        console.log('Loading rendition:', rendition);

        const playlist = await fetchPlaylist(rendition.url);
        const { segmentUrls } = await fetchPlaylistData(
            playlist,
            rendition.url
        );

        await this.engine.clearBuffer();
        this.engine.requestedSegments.clear();
        this.engine.loadSegments(segmentUrls, this.videoEl.currentTime);
    }
}

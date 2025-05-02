import { MSEEngine } from '../playback-engine/MSEEngine';
import { ABRManager } from '../types/abr-manager';
import { Renditions } from '../types/playback';
import { fetchPlaylist, fetchPlaylistData } from '../utils/fetch-playlist';

export class BufferBasedAbrManager implements ABRManager {
    private videoEl!: HTMLVideoElement;
    private renditions!: Renditions[];
    private engine!: MSEEngine;
    private currentIndex = 0;
    private interval: number | undefined;

    initialize(
        videoEl: HTMLVideoElement,
        renditions: Renditions[],
        engine: MSEEngine
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

    private async checkBufferAndSwitch() {
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
            console.log(
                `Switching to lower quality: ${
                    this.renditions[this.currentIndex].resolution
                }`
            );
            await this.loadCurrentRendition();
        } else if (
            bufferLength > 3 &&
            this.currentIndex < this.renditions.length - 1
        ) {
            this.currentIndex++;
            console.log(
                `Switching to higher quality: ${
                    this.renditions[this.currentIndex].resolution
                }`
            );
            await this.loadCurrentRendition();
        }
    }

    private async loadCurrentRendition() {
        const rendition = this.renditions[this.currentIndex];
        console.log('Loading rendition:', rendition);

        const playlist = await fetchPlaylist(rendition.url);
        const { segmentUrls } = await fetchPlaylistData(
            playlist,
            rendition.url
        );

        await this.engine.clearBuffer();
        this.engine.requestedSegments.clear();
        this.videoEl.currentTime = this.videoEl.currentTime;

        this.engine.loadSegments(segmentUrls, this.videoEl.currentTime);
    }
}

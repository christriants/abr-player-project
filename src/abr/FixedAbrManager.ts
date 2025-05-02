import { MSEEngine } from '../playback-engine/MSEEngine';
import { ABRManager } from '../types/abr-manager';
import { Renditions } from '../types/playback';
import { fetchPlaylist, fetchPlaylistData } from '../utils/fetch-playlist';

export class FixedAbrManager implements ABRManager {
    private currentIndex = 0;
    private videoEl!: HTMLVideoElement;
    private renditions!: Renditions[];
    private engine!: MSEEngine;
    private playlistCache = new Map<string, string[]>(); // Cache for playlists

    constructor(initialIndex = 0) {
        this.currentIndex = initialIndex;
    }

    initialize(
        videoEl: HTMLVideoElement,
        renditions: Renditions[],
        engine: MSEEngine
    ) {
        this.videoEl = videoEl;
        this.renditions = renditions;
        this.engine = engine;

        console.log('FixedAbrManager initialized:', renditions);
    }

    destroy() {
        console.log('FixedAbrManager destroyed');
    }

    getInitialRenditionIndex(): number {
        return this.currentIndex;
    }

    async updateSelectedIndex(index: number) {
        if (this.currentIndex === index) {
            return;
        }

        this.currentIndex = index;
        const rendition = this.renditions[this.currentIndex];
        console.log(
            `Switching to ${this.renditions[this.currentIndex].resolution}`
        );

        let segmentUrls = this.playlistCache.get(rendition.url);
        if (!segmentUrls) {
            const playlist = await fetchPlaylist(rendition.url);
            const { segmentUrls: fetchedSegmentUrls } = await fetchPlaylistData(
                playlist,
                rendition.url
            );
            segmentUrls = fetchedSegmentUrls;
            this.playlistCache.set(rendition.url, segmentUrls);
        }

        await this.engine.clearBuffer();
        this.engine.requestedSegments.clear();
        this.engine.loadSegments(segmentUrls, this.videoEl.currentTime);
    }
}

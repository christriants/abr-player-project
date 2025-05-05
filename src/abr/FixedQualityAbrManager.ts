import { MSEEngine } from '../playback-engine/MSEEngine';
import { ABRManager } from '../types/abr-manager';
import { NetworkManager } from '../types/network-manager';
import { Renditions } from '../types/playback';
import { fetchPlaylist, fetchPlaylistData } from '../utils/fetch-playlist';

export class FixedQualityAbrManager implements ABRManager {
    private currentIndex = 0;
    private manualIndex: number | null = null;
    private videoEl!: HTMLVideoElement;
    private renditions!: Renditions[];
    private engine!: MSEEngine;
    private playlistCache = new Map<string, string[]>();

    initialize(
        videoEl: HTMLVideoElement,
        renditions: Renditions[],
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

    getRendition(): Renditions {
        return this.renditions[this.currentIndex];
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
        const rendition = this.renditions[this.currentIndex];
        console.log(`Switching to ${rendition.resolution}`);

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

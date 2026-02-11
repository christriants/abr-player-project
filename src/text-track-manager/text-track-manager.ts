// src/text-track-manager/text-track-manager.ts

import { fetchPlaylist, fetchPlaylistData } from '../utils/fetch-playlist';
import { parseVtt } from '../vtt';

export type SubtitleRendition = {
    name: string;
    language: string;
    url: string;
    kind: TextTrackKind;
    default?: boolean;
};

export class TextTrackManager {
    private video: HTMLVideoElement;
    private textTrack: TextTrack | null = null;
    private trackElement: HTMLTrackElement | null = null;
    private abortController: AbortController | null = null;

    constructor(video: HTMLVideoElement) {
        this.video = video;
    }

    /**
     * Load a subtitle track - handles both native VTT and segmented VTT (m3u8)
     */
    async load(track: SubtitleRendition): Promise<void> {
        this.clear();

        const urlLower = track.url.toLowerCase();

        if (urlLower.endsWith('.vtt')) {
            console.log('Loading native VTT:', track.url);
            this.loadNativeVtt(track);
        } else if (urlLower.endsWith('.m3u8')) {
            console.log('Loading segmented VTT from m3u8:', track.url);
            await this.loadSegmentedVtt(track);
        } else {
            console.error('Unknown subtitle format:', track.url);
            throw new Error(`Unsupported subtitle format: ${track.url}`);
        }
    }

    /**
     * Load a native VTT file using the browser's <track> element
     */
    private loadNativeVtt(track: SubtitleRendition): void {
        // Create <track> element
        this.trackElement = document.createElement('track');
        this.trackElement.kind = track.kind;
        this.trackElement.label = track.name;
        this.trackElement.srclang = track.language;
        this.trackElement.src = track.url;

        // Append to video element
        this.video.appendChild(this.trackElement);

        // Wait for track to load
        this.trackElement.addEventListener('load', () => {
            const textTrack = this.trackElement?.track;
            if (textTrack) {
                textTrack.mode = 'showing';
                this.textTrack = textTrack;
                console.log('✅ Native VTT loaded:', {
                    cues: textTrack.cues?.length,
                    track: track.name,
                });
            }
        });

        this.trackElement.addEventListener('error', (e) => {
            console.error('❌ Error loading native VTT:', e, track.url);
        });
    }

    /**
     * Load a segmented VTT from an m3u8 playlist
     * Fetches all segments, parses them, and adds cues programmatically
     */
    private async loadSegmentedVtt(track: SubtitleRendition): Promise<void> {
        this.abortController = new AbortController();

        // Create a programmatic text track
        this.textTrack = this.video.addTextTrack(
            track.kind,
            track.name,
            track.language
        );
        this.textTrack.mode = 'showing';

        try {
            // Fetch the subtitle playlist
            const playlist = await fetchPlaylist(track.url);
            const { segmentUrls } = await fetchPlaylistData(playlist, track.url);

            console.log(`Fetching ${segmentUrls.length} VTT segments...`);

            let timeOffset = 0;

            // Fetch and parse each VTT segment
            for (let i = 0; i < segmentUrls.length; i++) {
                if (this.abortController.signal.aborted) {
                    console.log('Subtitle loading aborted');
                    return;
                }

                const segmentUrl = segmentUrls[i];
                console.log(`Fetching VTT segment ${i + 1}/${segmentUrls.length}:`, segmentUrl);

                // Fetch VTT segment
                const vttText = await fetch(segmentUrl, {
                    signal: this.abortController.signal,
                }).then(r => r.text());

                // Parse VTT
                const cues = parseVtt(vttText);
                console.log(`Parsed ${cues.length} cues from segment ${i + 1}`);

                let maxEndTime = 0;

                // Add cues with adjusted timing
                for (const cue of cues) {
                    cue.startTime += timeOffset;
                    cue.endTime += timeOffset;
                    maxEndTime = Math.max(maxEndTime, cue.endTime);
                    this.textTrack.addCue(cue);
                }

                // Update offset for next segment
                timeOffset = maxEndTime;
            }

            console.log('✅ Segmented VTT loaded:', {
                cues: this.textTrack.cues?.length,
                segments: segmentUrls.length,
                track: track.name,
            });
        } catch (error) {
            console.error('❌ Error loading segmented VTT:', error);
            throw error;
        }
    }

    /**
     * Clear all loaded tracks and abort any ongoing fetches
     */
    clear(): void {
        // Abort any ongoing fetches
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }

        // Remove native track element
        if (this.trackElement) {
            this.trackElement.remove();
            this.trackElement = null;
        }

        // Clear programmatic text track
        if (this.textTrack) {
            const cues = this.textTrack.cues;
            if (cues) {
                for (let i = cues.length - 1; i >= 0; i--) {
                    this.textTrack.removeCue(cues[i]);
                }
            }
            this.textTrack.mode = 'disabled';
            this.textTrack = null;
        }
    }

    /**
     * Get the currently active text track
     */
    getActiveTrack(): TextTrack | null {
        return this.textTrack;
    }

    /**
     * Check if a track is currently loaded
     */
    isLoaded(): boolean {
        return this.textTrack !== null || this.trackElement !== null;
    }
}

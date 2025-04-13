import muxjs from 'mux.js';

export class MSEEngine {
    private transmuxer: muxjs.mp4.Transmuxer;
    private video: HTMLVideoElement;
    private mediaSource: MediaSource;
    private sourceBuffer!: SourceBuffer;
    private segmentQueue: Uint8Array[] = [];
    private isAppending: boolean = false;
    private segmentUrls: string[] = [];
    private currentSegmentIndex: number = 0;

    constructor(videoElement: HTMLVideoElement, duration: number) {
        this.video = videoElement;
        this.mediaSource = new MediaSource();
        this.video.src = URL.createObjectURL(this.mediaSource);

        this.transmuxer = new muxjs.mp4.Transmuxer();
        this.transmuxer.on('data', (segmentData: any) => {
            const mp4Segment = new Uint8Array(
                segmentData.initSegment.byteLength + segmentData.data.byteLength
            );
            mp4Segment.set(segmentData.initSegment, 0);
            mp4Segment.set(
                segmentData.data,
                segmentData.initSegment.byteLength
            );

            const segmentStartTime = this.currentSegmentIndex * 3; // Assuming 3s segments
            segmentData.timestampOffset = segmentStartTime;

            this.queueSegment(mp4Segment);
        });

        this.mediaSource.addEventListener('sourceopen', () => {
            this.initSourceBuffer();

            this.mediaSource.duration = duration;
            console.log('MediaSource duration set to:', duration);
        });

        this.video.addEventListener('timeupdate', this.onTimeUpdate);
        this.video.addEventListener('seeking', this.onSeeking);
    }

    private initSourceBuffer() {
        const mimeCodec = 'video/mp4; codecs="avc1.42E01E"';

        if (!MediaSource.isTypeSupported(mimeCodec)) {
            console.error('Unsupported MIME type:', mimeCodec);
            return;
        }

        try {
            this.sourceBuffer = this.mediaSource.addSourceBuffer(mimeCodec);
            this.sourceBuffer.mode = 'segments';

            this.sourceBuffer.addEventListener('updateend', () => {
                this.isAppending = false;
                this.processQueue();
            });

            this.sourceBuffer.addEventListener('error', (e) => {
                console.error('SourceBuffer Error:', e);
            });
        } catch (e) {
            console.error('Error creating SourceBuffer:', e);
        }
    }

    loadSegments(segmentUrls: string[], startTime: number) {
        this.segmentUrls = segmentUrls;
        this.currentSegmentIndex = Math.floor(startTime / 3);
        this.fetchAndProcessNextSegment();
    }

    private async fetchAndProcessNextSegment() {
        const batchSize = 3;
        const segmentsToFetch = this.segmentUrls.slice(
            this.currentSegmentIndex,
            this.currentSegmentIndex + batchSize
        );

        if (segmentsToFetch.length === 0) {
            if (this.mediaSource.readyState === 'open') {
                this.mediaSource.endOfStream();
            }
            return;
        }

        for (const url of segmentsToFetch) {
            try {
                const data = await this.fetchSegment(url);
                this.transmuxer.push(data);
                this.transmuxer.flush();
            } catch (e) {
                console.error('Error fetching segment:', e);
            }
        }

        this.currentSegmentIndex += segmentsToFetch.length;
    }

    private async fetchSegment(url: string): Promise<Uint8Array> {
        const response = await fetch(url);
        return new Uint8Array(await response.arrayBuffer());
    }

    private queueSegment(data: Uint8Array) {
        if (!this.sourceBuffer) {
            this.segmentQueue.push(data);
            return;
        }

        this.segmentQueue.push(data);
        this.processQueue();
    }

    private processQueue() {
        if (
            !this.sourceBuffer ||
            this.isAppending ||
            this.sourceBuffer.updating ||
            this.segmentQueue.length === 0
        ) {
            return;
        }

        const segment = this.segmentQueue.shift();
        if (!segment) return;

        this.isAppending = true;
        try {
            this.sourceBuffer.appendBuffer(segment);
        } catch (e) {
            console.error('Error appending buffer:', e);
            this.isAppending = false;
        }
    }

    private onTimeUpdate = () => {
        const bufferedEnd = this.video.buffered.length
            ? this.video.buffered.end(this.video.buffered.length - 1)
            : 0;
        const timeRemaining = bufferedEnd - this.video.currentTime;

        if (timeRemaining < 5) {
            this.fetchAndProcessNextSegment();
        }

        if (this.video.readyState < 3) {
            const onCanPlay = () => {
                this.video.play().catch((e) => console.error('Play error:', e));
                this.video.removeEventListener('canplay', onCanPlay);
            };

            this.video.addEventListener('canplay', onCanPlay);
        }
    };

    private onSeeking = () => {
        const currentTime = this.video.currentTime;
        console.log('Seeking to:', currentTime);

        this.clearBuffer();

        const newSegmentIndex = Math.floor(currentTime / 3);
        this.currentSegmentIndex = newSegmentIndex;

        this.fetchAndProcessNextSegment();
    };

    clearBuffer(): Promise<void> {
        return new Promise((resolve) => {
            if (!this.sourceBuffer) return resolve();

            const tryClear = () => {
                if (!this.sourceBuffer || this.sourceBuffer.updating) {
                    setTimeout(tryClear, 50);
                    return;
                }

                const buffered = this.sourceBuffer.buffered;
                const currentTime = this.video.currentTime;

                if (buffered.length === 0) {
                    resolve();
                    return;
                }

                const handleUpdateEnd = () => {
                    this.sourceBuffer.removeEventListener(
                        'updateend',
                        handleUpdateEnd
                    );
                    resolve();
                };

                this.sourceBuffer.addEventListener(
                    'updateend',
                    handleUpdateEnd
                );

                for (let i = 0; i < buffered.length; i++) {
                    const start = buffered.start(i);
                    const end = buffered.end(i);

                    // Only clear ranges outside the current playback position
                    if (end < currentTime || start > currentTime + 5) {
                        try {
                            console.log(
                                `Removing buffer range: ${start} - ${end}`
                            );
                            this.sourceBuffer.remove(start, end);
                        } catch (e) {
                            console.warn('Failed to remove buffer range:', e);
                        }
                    }
                }

                // Clear the segment queue
                this.segmentQueue = [];
            };

            tryClear();
        });
    }

    destroy() {
        this.video.removeEventListener('timeupdate', this.onTimeUpdate);
        if (this.mediaSource.readyState === 'open') {
            this.mediaSource.endOfStream();
        }
        URL.revokeObjectURL(this.video.src);
    }
}

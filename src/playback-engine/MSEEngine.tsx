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
    private bufferMonitorInterval: number | null = null;
    private isFetching: boolean = false;
    requestedSegments: Set<number> = new Set();

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

            this.startBufferMonitor(); // ✅ Start monitoring when ready
        });

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
        if (this.isFetching) return;

        this.isFetching = true;

        const batchSize = 3;
        const startIndex = this.currentSegmentIndex;
        const segmentsToFetch = this.segmentUrls.slice(
            startIndex,
            startIndex + batchSize
        );

        if (segmentsToFetch.length === 0) {
            if (this.mediaSource.readyState === 'open') {
                this.mediaSource.endOfStream();
            }
            this.isFetching = false;
            return;
        }

        for (let i = 0; i < segmentsToFetch.length; i++) {
            const index = startIndex + i;

            // Check if any of the indices in the range [index, index + 2] are already requested
            let isAlreadyRequested = false;
            for (let offset = 0; offset <= batchSize; offset++) {
                if (this.requestedSegments.has(index + offset)) {
                    isAlreadyRequested = true;
                    break;
                }
            }

            if (isAlreadyRequested) {
                continue;
            }

            const url = segmentsToFetch[i];
            try {
                const data = await this.fetchSegment(url);
                this.requestedSegments.add(index);
                this.transmuxer.push(data);
                this.transmuxer.flush();
            } catch (e) {
                console.error('Error fetching segment:', e);
            }
        }

        this.currentSegmentIndex += batchSize;
        this.isFetching = false;
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

    private onSeeking = () => {
        const currentTime = this.video.currentTime;
        console.log('Seeking to:', currentTime);

        const isTimeBuffered = this.isTimeInBuffered(currentTime);

        if (!isTimeBuffered) {
            this.clearBuffer().then(() => {
                // Optional: also clear requestedSegments on seek, or manage it per segment index
                this.requestedSegments.clear();

                const newSegmentIndex = Math.floor(currentTime / 3);
                this.currentSegmentIndex = newSegmentIndex;

                this.fetchAndProcessNextSegment();
            });
        } else {
            console.log('Seeked to a time already buffered, skipping fetch');
        }
    };

    private isTimeInBuffered(time: number): boolean {
        const buffered = this.video.buffered;
        for (let i = 0; i < buffered.length; i++) {
            if (time >= buffered.start(i) && time <= buffered.end(i)) {
                return true;
            }
        }
        return false;
    }

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

                this.segmentQueue = [];
                resolve();
            };

            tryClear();
        });
    }

    private startBufferMonitor() {
        if (this.bufferMonitorInterval !== null) return;

        this.bufferMonitorInterval = window.setInterval(() => {
            const bufferedEnd = this.video.buffered.length
                ? this.video.buffered.end(this.video.buffered.length - 1)
                : 0;

            const timeRemaining = bufferedEnd - this.video.currentTime;

            if (timeRemaining < 5 && !this.isAppending) {
                console.log('Buffer low — fetching more segments...');
                this.fetchAndProcessNextSegment();
            }
        }, 1000);
    }

    private stopBufferMonitor() {
        if (this.bufferMonitorInterval !== null) {
            clearInterval(this.bufferMonitorInterval);
            this.bufferMonitorInterval = null;
        }
    }

    destroy() {
        this.stopBufferMonitor();

        this.video.removeEventListener('seeking', this.onSeeking);
        if (this.mediaSource.readyState === 'open') {
            this.mediaSource.endOfStream();
        }
        URL.revokeObjectURL(this.video.src);
    }
}

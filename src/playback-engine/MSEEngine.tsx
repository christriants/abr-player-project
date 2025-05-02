import muxjs from 'mux.js';

export class MSEEngine {
    private transmuxer: muxjs.mp4.Transmuxer;
    private video: HTMLVideoElement;
    private duration: number;
    private mediaSource: MediaSource;
    private sourceBuffer!: SourceBuffer;
    private codecs: string[];
    private segmentQueue: Uint8Array[] = [];
    private isAppending: boolean = false;
    private segmentUrls: string[] = [];
    private currentSegmentIndex: number = 0;
    private bufferMonitorInterval: number | null = null;
    private isFetching: boolean = false;

    requestedSegments: Set<number> = new Set();

    constructor(
        videoElement: HTMLVideoElement,
        duration: number,
        codecs: string[]
    ) {
        this.video = videoElement;
        this.mediaSource = new MediaSource();
        this.video.src = URL.createObjectURL(this.mediaSource);
        this.duration = duration;
        this.codecs = codecs;

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

            const segmentStartTime = this.currentSegmentIndex * 3; // 3s segments
            segmentData.timestampOffset = segmentStartTime;

            this.queueSegment(mp4Segment);
        });

        this.setup(this.codecs);
    }

    private setup(codecs: string[]) {
        this.mediaSource.addEventListener('sourceopen', () => {
            console.log('MediaSource opened');

            this.initSourceBuffer(codecs);

            if (this.duration) {
                this.mediaSource.duration = this.duration;
                console.log('MediaSource duration set to:', this.duration);
            }

            this.startBufferMonitor();
        });
        this.video.addEventListener('seeking', this.onSeeking);
    }

    reset(codecs: string[]): void {
        console.log('Resetting engine state');

        this.stopBufferMonitor();

        if (this.sourceBuffer) {
            try {
                this.mediaSource.removeSourceBuffer(this.sourceBuffer);
            } catch (e) {
                console.warn('Failed to remove SourceBuffer:', e);
            }
        }

        if (this.mediaSource.readyState === 'open') {
            try {
                this.mediaSource.endOfStream();
            } catch (e) {
                console.warn('Failed to end MediaSource stream:', e);
            }
        }

        this.mediaSource = new MediaSource();
        this.video.src = URL.createObjectURL(this.mediaSource);

        this.setup(codecs);

        this.clearBuffer().then(() => {
            this.requestedSegments.clear();
            this.currentSegmentIndex = 0;
            this.segmentQueue = [];
            this.isAppending = false;
        });
    }

    destroy() {
        this.stopBufferMonitor();

        this.video.removeEventListener('seeking', this.onSeeking);
        if (this.mediaSource.readyState === 'open') {
            this.mediaSource.endOfStream();
        }
        URL.revokeObjectURL(this.video.src);
    }

    loadSegments(segmentUrls: string[], startTime: number) {
        this.segmentUrls = segmentUrls;
        this.currentSegmentIndex = Math.floor(startTime / 3);
        this.fetchAndProcessNextSegment();
    }

    getBufferedLength(currentTime: number): number {
        const buffered = this.video.buffered;
        for (let i = 0; i < buffered.length; i++) {
            const start = buffered.start(i);
            const end = buffered.end(i);
            if (currentTime >= start && currentTime <= end) {
                return end - currentTime;
            }
        }
        return 0;
    }

    clearBuffer(): Promise<void> {
        return new Promise((resolve) => {
            if (!this.sourceBuffer) {
                console.warn('No SourceBuffer to clear');
                resolve();
                return;
            }

            const isSourceBufferValid = Array.from(
                this.mediaSource.sourceBuffers
            ).some((buffer) => buffer === this.sourceBuffer);

            if (!isSourceBufferValid) {
                console.error('SourceBuffer is no longer valid');
                resolve();
                return;
            }

            const tryClear = () => {
                if (!this.sourceBuffer || this.sourceBuffer.updating) {
                    setTimeout(tryClear, 50);
                    return;
                }

                try {
                    const buffered = this.sourceBuffer.buffered;
                    const currentTime = this.video.currentTime;

                    if (buffered.length === 0) {
                        this.requestedSegments.clear();
                        resolve();
                        return;
                    }

                    const handleUpdateEnd = () => {
                        this.sourceBuffer.removeEventListener(
                            'updateend',
                            handleUpdateEnd
                        );
                        this.requestedSegments.clear();
                        resolve();
                    };

                    this.sourceBuffer.addEventListener(
                        'updateend',
                        handleUpdateEnd
                    );

                    for (let i = 0; i < buffered.length; i++) {
                        const start = buffered.start(i);
                        const end = buffered.end(i);
                        if (end < currentTime || start > currentTime + 5) {
                            this.sourceBuffer.remove(start, end);
                        }
                    }
                } catch (e) {
                    console.warn('Failed to clear buffer:', e);
                    resolve();
                }
            };

            tryClear();
        });
    }

    private initSourceBuffer(codecs: string[]) {
        let supportedCodec: string | null = null;

        for (const codec of codecs) {
            console.log('Checking codec support for:', codec);
            const mimeCodec = `video/mp4; codecs="${codec}"`;
            if (MediaSource.isTypeSupported(mimeCodec)) {
                supportedCodec = mimeCodec;
                break;
            }
        }

        if (!supportedCodec) {
            console.error('No supported codecs found:', codecs);
            return;
        }

        try {
            this.sourceBuffer =
                this.mediaSource.addSourceBuffer(supportedCodec);
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

    private async fetchSegment(url: string): Promise<Uint8Array> {
        const response = await fetch(url);
        return new Uint8Array(await response.arrayBuffer());
    }

    private async fetchSegments(
        startIndex: number,
        batchSize: number
    ): Promise<Uint8Array[]> {
        const segmentsToFetch = this.segmentUrls.slice(
            startIndex,
            startIndex + batchSize
        );
        const fetchedSegments: Uint8Array[] = [];

        for (let i = 0; i < segmentsToFetch.length; i++) {
            const index = startIndex + i;

            if (this.requestedSegments.has(index)) {
                continue;
            }

            const url = segmentsToFetch[i];
            try {
                const data = await this.fetchSegment(url);
                this.requestedSegments.add(index);
                fetchedSegments.push(data);
            } catch (e) {
                console.error('Error fetching segment:', e);
            }
        }

        return fetchedSegments;
    }

    private async fetchAndProcessNextSegment() {
        if (this.isFetching) return;

        this.isFetching = true;

        const batchSize = 3;
        const startIndex = this.currentSegmentIndex;

        const fetchedSegments = await this.fetchSegments(startIndex, batchSize);

        for (const segment of fetchedSegments) {
            this.transmuxer.push(segment);
            this.transmuxer.flush();
        }

        this.currentSegmentIndex += batchSize;
        this.isFetching = false;
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

        const isSourceBufferValid = Array.from(
            this.mediaSource.sourceBuffers
        ).some((buffer) => buffer === this.sourceBuffer);

        if (!isSourceBufferValid) {
            console.error('SourceBuffer is no longer valid');
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
}

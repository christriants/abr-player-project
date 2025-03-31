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

    constructor(videoElement: HTMLVideoElement) {
        this.video = videoElement;
        this.mediaSource = new MediaSource();
        this.video.src = URL.createObjectURL(this.mediaSource);

        this.transmuxer = new muxjs.mp4.Transmuxer();
        this.transmuxer.on('data', (segmentData: any) => {
            console.log('Segment data:', segmentData);

            const mp4Segment = new Uint8Array(
                segmentData.initSegment.byteLength + segmentData.data.byteLength
            );
            mp4Segment.set(segmentData.initSegment, 0);
            mp4Segment.set(
                segmentData.data,
                segmentData.initSegment.byteLength
            );

            // Set the timestampOffset based on the segment's start time
            const segmentStartTime = this.currentSegmentIndex * 3; // Assuming 3-second segments
            segmentData.timestampOffset = segmentStartTime;
            console.log(
                'Setting timestampOffset:',
                segmentData.timestampOffset
            );

            this.queueSegment(mp4Segment);
        });

        this.mediaSource.addEventListener('sourceopen', () => {
            console.log('Media Source Opened');
            this.initSourceBuffer();
            this.fetchAndProcessNextSegment();
        });

        this.video.addEventListener('timeupdate', this.onTimeUpdate);
    }

    private initSourceBuffer() {
        const mimeCodec = 'video/mp4; codecs="avc1.42E01E"'; // @todo support audio

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

    loadSegments(segmentUrls: string[]) {
        this.segmentUrls = segmentUrls;

        if (this.video.currentTime > 0) {
            console.log('Seeking to:', this.video.currentTime);
            this.video.currentTime = this.video.currentTime;
        }
    }

    private async fetchAndProcessNextSegment() {
        const batchSize = 3; // Number of segments to fetch at once

        // Fetch segments starting from the currentSegmentIndex
        const segmentsToFetch = this.segmentUrls.slice(
            this.currentSegmentIndex,
            this.currentSegmentIndex + batchSize
        );

        if (segmentsToFetch.length === 0) {
            console.log('All segments loaded, calling endOfStream()');
            if (this.mediaSource.readyState === 'open') {
                this.mediaSource.endOfStream();
            }
            return;
        }

        console.log(
            `Fetching segments: ${this.currentSegmentIndex} to ${
                this.currentSegmentIndex + segmentsToFetch.length - 1
            }`
        );

        for (const url of segmentsToFetch) {
            try {
                const data = await this.fetchSegment(url);
                console.log('Pushing TS segment:', data.byteLength);
                this.transmuxer.push(data);
                this.transmuxer.flush();
            } catch (e) {
                console.error('Error fetching segment:', e);
            }
        }

        // Update currentSegmentIndex to reflect the next segment to fetch
        this.currentSegmentIndex += segmentsToFetch.length;
    }

    private async fetchSegment(url: string): Promise<Uint8Array> {
        console.log('Fetching segment:', url);
        const response = await fetch(url);
        return new Uint8Array(await response.arrayBuffer());
    }

    private queueSegment(data: Uint8Array) {
        if (!this.sourceBuffer) {
            console.warn(
                'SourceBuffer is not initialized yet. Queueing segment for later.'
            );
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

        console.log(
            'MediaSource state before appending:',
            this.mediaSource.readyState
        );

        const segment = this.segmentQueue.shift();
        if (!segment) return;

        console.log('Appending MP4 segment:', segment.byteLength, 'bytes');

        this.isAppending = true;
        try {
            this.sourceBuffer.appendBuffer(segment);

            // Log the buffered ranges after appending
            const buffered = this.video.buffered;
            console.log('Buffered ranges after appending:', buffered);
            for (let i = 0; i < buffered.length; i++) {
                console.log(
                    `Buffered range ${i}: ${buffered.start(i)} - ${buffered.end(
                        i
                    )}`
                );
            }
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

        console.log('Current time:', this.video.currentTime);
        console.log('Buffered end:', bufferedEnd);
        console.log('Time remaining:', timeRemaining);

        // Fetch the next segment if the time remaining is low
        if (timeRemaining < 5) {
            console.log('Time remaining is low, fetching next segment...');
            this.fetchAndProcessNextSegment();
        }

        // Check if playback is stalled and force playback to resume
        if (this.video.readyState < 3) {
            // READY_STATE_HAVE_FUTURE_DATA
            console.warn('Playback stalled, forcing play');
            this.video.play().catch((e) => console.error('Play error:', e));
        }
    };

    clearBuffer() {
        if (!this.sourceBuffer) return;

        const buffered = this.sourceBuffer.buffered;
        const currentTime = this.video.currentTime;

        for (let i = 0; i < buffered.length; i++) {
            const start = buffered.start(i);
            const end = buffered.end(i);

            // Remove only the buffered data before the current playback position
            if (end < currentTime) {
                console.log(`Clearing buffer from ${start} to ${end}`);
                this.sourceBuffer.remove(start, end);
            }
        }
    }

    destroy() {
        this.video.removeEventListener('timeupdate', this.onTimeUpdate);
        if (this.mediaSource.readyState === 'open') {
            this.mediaSource.endOfStream();
        }
        URL.revokeObjectURL(this.video.src);
    }
}

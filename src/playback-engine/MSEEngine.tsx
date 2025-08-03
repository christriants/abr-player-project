import muxjs from 'mux.js';
import { NetworkManager } from '../types/network-manager';

const DEFAULT_SEGMENT_DURATION = 3;

export class MSEEngine {
    private transmuxer: muxjs.mp4.Transmuxer;
    private audioTransmuxer?: muxjs.mp4.Transmuxer;
    private video: HTMLVideoElement;
    private duration: number;
    private mediaSource: MediaSource;
    private videoSourceBuffer?: SourceBuffer;
    private audioSourceBuffer?: SourceBuffer;
    private videoQueue: Uint8Array[] = [];
    private audioQueue: Uint8Array[] = [];
    private isVideoAppending: boolean = false;
    private isAudioAppending: boolean = false;
    private codecs: string[];
    private segmentUrls: { video: string[]; audio: string[] } = {
        video: [],
        audio: [],
    };
    private currentSegmentIndex: number = 0;
    private bufferMonitorInterval: number | null = null;
    private isFetching: boolean = false;
    private networkManager?: NetworkManager;
    private segmentFormat: 'ts' | 'fmp4' | 'unknown' = 'unknown';
    private initSegmentUrls?: { video?: string; audio?: string };
    private isSeeking: boolean = false;
    private segmentDuration: number = DEFAULT_SEGMENT_DURATION;

    requestedSegments: { video: Set<number>; audio: Set<number> } = {
        video: new Set(),
        audio: new Set(),
    };

    constructor(
        videoElement: HTMLVideoElement,
        duration: number,
        codecs: string[],
        networkManager?: NetworkManager
    ) {
        this.video = videoElement;
        this.mediaSource = new MediaSource();
        this.video.src = URL.createObjectURL(this.mediaSource);
        this.duration = duration;
        this.codecs = codecs;
        this.networkManager = networkManager;

        this.transmuxer = new muxjs.mp4.Transmuxer();
        this.transmuxer.on('data', (segmentData: any) => {
            if (segmentData.initSegment && segmentData.data) {
                const mp4Segment = new Uint8Array(
                    segmentData.initSegment.byteLength +
                        segmentData.data.byteLength
                );
                mp4Segment.set(segmentData.initSegment, 0);
                mp4Segment.set(
                    segmentData.data,
                    segmentData.initSegment.byteLength
                );

                this.queueSegment(mp4Segment, 'video');
            } else {
                console.warn('Incomplete transmuxer data:', segmentData);
            }
        });

        this.setup();
    }

    private createAudioTransmuxer() {
        if (this.audioTransmuxer) return;

        console.log('Creating separate audio transmuxer');
        this.audioTransmuxer = new muxjs.mp4.Transmuxer({
            keepOriginalTimestamps: true,
            remux: true,
        });

        this.audioTransmuxer.on('data', (segmentData: any) => {
            if (segmentData.initSegment && segmentData.data) {
                const mp4Segment = new Uint8Array(
                    segmentData.initSegment.byteLength +
                        segmentData.data.byteLength
                );
                mp4Segment.set(segmentData.initSegment, 0);
                mp4Segment.set(
                    segmentData.data,
                    segmentData.initSegment.byteLength
                );

                this.queueSegment(mp4Segment, 'audio');
            }
        });

        this.audioTransmuxer.on('error', (error: any) => {
            console.error('Audio transmuxer error:', error);
        });
    }

    private setup() {
        this.mediaSource.addEventListener('sourceopen', () => {
            console.log('MediaSource opened');

            this.initSourceBuffers();

            if (this.duration) {
                this.mediaSource.duration = this.duration;
            }

            this.startBufferMonitor();
        });
        this.video.addEventListener('seeking', this.onSeeking);
        this.video.addEventListener('seeked', this.onSeeked);
    }

    async reset(): Promise<void> {
        this.stopBufferMonitor();

        if (this.videoSourceBuffer) {
            try {
                this.mediaSource.removeSourceBuffer(this.videoSourceBuffer);
            } catch (e) {
                console.warn('Failed to remove video SourceBuffer:', e);
            }
        }

        if (this.audioSourceBuffer) {
            try {
                this.mediaSource.removeSourceBuffer(this.audioSourceBuffer);
            } catch (e) {
                console.warn('Failed to remove audio SourceBuffer:', e);
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

        this.setup();

        await this.clearBuffers();

        this.requestedSegments.video.clear();
        this.requestedSegments.audio.clear();
        this.currentSegmentIndex = 0;
        this.videoQueue = [];
        this.audioQueue = [];
    }

    destroy() {
        this.stopBufferMonitor();

        this.video.removeEventListener('seeking', this.onSeeking);
        if (this.mediaSource.readyState === 'open') {
            this.mediaSource.endOfStream();
        }
        URL.revokeObjectURL(this.video.src);
    }

    private detectSegmentFormat(url: string): 'ts' | 'fmp4' | 'unknown' {
        const ext = url.split('?')[0].split('.').pop()?.toLowerCase();

        if (ext === 'ts') return 'ts';
        if (ext === 'm4s' || ext === 'mp4') return 'fmp4';
        return 'unknown';
    }

    loadSegments(
        urls: {
            initSegmentUrls?: { video?: string; audio?: string };
            segmentUrls: { video: string[]; audio: string[] };
        },
        startTime: number
    ) {
        this.initSegmentUrls = urls.initSegmentUrls;
        this.segmentUrls = urls.segmentUrls;

        this.segmentDuration = this.calculateSegmentDuration();

        if (urls.segmentUrls.audio.length > 0) {
            const audioFormat = this.detectSegmentFormat(
                urls.segmentUrls.audio[0]
            );
            if (audioFormat === 'ts') {
                this.createAudioTransmuxer();
            }
        }

        const firstSegmentUrl = Array.isArray(urls.segmentUrls)
            ? urls.segmentUrls[0]
            : urls.segmentUrls.video[0] || urls.segmentUrls.audio[0];

        this.segmentFormat = this.detectSegmentFormat(firstSegmentUrl);

        this.currentSegmentIndex = Math.floor(startTime / this.segmentDuration);
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

    clearBuffers(): Promise<void> {
        const promises: Promise<void>[] = [];

        if (this.videoSourceBuffer) {
            promises.push(this.clearBuffer(this.videoSourceBuffer));
        }

        if (this.audioSourceBuffer) {
            promises.push(this.clearBuffer(this.audioSourceBuffer));
        }

        if (promises.length === 0) {
            this.requestedSegments.video.clear();
            this.requestedSegments.audio.clear();
            return Promise.resolve();
        }

        return Promise.all(promises).then(() => {
            this.requestedSegments.video.clear();
            this.requestedSegments.audio.clear();
        });
    }

    private calculateSegmentDuration(): number {
        const segmentCount =
            this.segmentUrls.video.length || this.segmentUrls.audio.length;

        if (segmentCount > 0 && this.duration > 0) {
            const calculatedDuration = this.duration / segmentCount;
            return calculatedDuration;
        }

        return DEFAULT_SEGMENT_DURATION;
    }

    private clearBuffer(sourceBuffer: SourceBuffer): Promise<void> {
        return new Promise((resolve) => {
            if (!sourceBuffer) {
                console.warn('No SourceBuffer to clear');
                resolve();
                return;
            }

            const isSourceBufferValid = Array.from(
                this.mediaSource.sourceBuffers
            ).some((buffer) => buffer === sourceBuffer);

            if (!isSourceBufferValid) {
                console.error('SourceBuffer is no longer valid');
                resolve();
                return;
            }

            const tryClear = () => {
                if (!sourceBuffer || sourceBuffer.updating) {
                    setTimeout(tryClear, 50);
                    return;
                }

                try {
                    const buffered = sourceBuffer.buffered;
                    const currentTime = this.video.currentTime;

                    if (buffered.length === 0) {
                        resolve();
                        return;
                    }

                    const handleUpdateEnd = () => {
                        sourceBuffer.removeEventListener(
                            'updateend',
                            handleUpdateEnd
                        );
                        resolve();
                    };

                    sourceBuffer.addEventListener('updateend', handleUpdateEnd);

                    for (let i = 0; i < buffered.length; i++) {
                        const start = buffered.start(i);
                        const end = buffered.end(i);
                        if (end < currentTime || start > currentTime + 5) {
                            sourceBuffer.remove(start, end);
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

    private async initSourceBuffers() {
        const videoCodecs: string[] = [];
        const audioCodecs: string[] = [];

        for (const codec of this.codecs) {
            if (
                codec.startsWith('avc1') ||
                codec.startsWith('hev1') ||
                codec.startsWith('hvc1')
            ) {
                videoCodecs.push(codec);
            } else if (codec.startsWith('mp4a')) {
                audioCodecs.push(codec);
            }
        }

        if (videoCodecs.length > 0) {
            const videoMimeType = `video/mp4; codecs="${videoCodecs[0]}"`;
            if (MediaSource.isTypeSupported(videoMimeType)) {
                this.videoSourceBuffer = this.createSourceBuffer(
                    videoMimeType,
                    'video'
                );
                console.log('Created video SourceBuffer with:', videoMimeType);
            }
        }

        if (audioCodecs.length > 0) {
            const audioMimeType = `audio/mp4; codecs="${audioCodecs[0]}"`;
            if (MediaSource.isTypeSupported(audioMimeType)) {
                this.audioSourceBuffer = this.createSourceBuffer(
                    audioMimeType,
                    'audio'
                );
            }
        }

        // Load init segments if needed (only for fMP4)
        if (this.segmentFormat === 'fmp4' && this.initSegmentUrls) {
            if (this.initSegmentUrls.video && this.videoSourceBuffer) {
                console.log('Loading video init segment');
                const videoInitSegment = await this.fetchSegment(
                    this.initSegmentUrls.video
                );
                this.queueSegment(videoInitSegment, 'video');
            }

            if (this.initSegmentUrls.audio && this.audioSourceBuffer) {
                console.log('Loading audio init segment');
                const audioInitSegment = await this.fetchSegment(
                    this.initSegmentUrls.audio
                );
                this.queueSegment(audioInitSegment, 'audio');
            }
        }
    }

    private createSourceBuffer(
        mimeType: string,
        type: 'video' | 'audio'
    ): SourceBuffer {
        const buffer = this.mediaSource.addSourceBuffer(mimeType);
        buffer.mode = 'segments';

        buffer.addEventListener('updateend', () => {
            if (type === 'video') {
                this.isVideoAppending = false;
                this.processVideoQueue();
            } else {
                this.isAudioAppending = false;
                this.processAudioQueue();
            }
        });

        buffer.addEventListener('error', (e) => {
            console.error(`${type} SourceBuffer Error:`, e);
        });

        return buffer;
    }

    private async fetchSegment(url: string): Promise<Uint8Array> {
        const startTime = performance.now();
        const response = await fetch(url);
        const data = new Uint8Array(await response.arrayBuffer());
        const endTime = performance.now();

        const downloadTimeMs = endTime - startTime;
        const sizeBytes = data.byteLength;

        if (this.networkManager) {
            this.networkManager.onSegmentDownloaded({
                durationSec: 3,
                sizeBytes,
                downloadTimeMs,
                url,
            });
        }

        return data;
    }

    private async fetchSegments(
        startIndex: number,
        batchSize: number
    ): Promise<{ video: Uint8Array[]; audio: Uint8Array[] }> {
        const result = { video: [] as Uint8Array[], audio: [] as Uint8Array[] };

        if (this.segmentUrls.video.length > 0) {
            const videoSegmentsToFetch = this.segmentUrls.video.slice(
                startIndex,
                startIndex + batchSize
            );

            for (let i = 0; i < videoSegmentsToFetch.length; i++) {
                const index = startIndex + i;
                if (this.requestedSegments.video.has(index)) continue;

                const url = videoSegmentsToFetch[i];
                try {
                    const data = await this.fetchSegment(url);
                    this.requestedSegments.video.add(index);
                    result.video.push(data);
                } catch (e) {
                    console.error('Error fetching video segment:', e);
                }
            }

            if (this.segmentUrls.audio.length > 0) {
                const audioSegmentsToFetch = this.segmentUrls.audio.slice(
                    startIndex,
                    startIndex + batchSize
                );

                for (let i = 0; i < audioSegmentsToFetch.length; i++) {
                    const index = startIndex + i;
                    if (this.requestedSegments.audio.has(index)) continue;

                    const url = audioSegmentsToFetch[i];
                    try {
                        const data = await this.fetchSegment(url);
                        this.requestedSegments.audio.add(index);
                        result.audio.push(data);
                    } catch (e) {
                        console.error('Error fetching audio segment:', e);
                    }
                }
            }
        }

        return result;
    }

    private async fetchAndProcessNextSegment() {
        if (this.isFetching) return;

        this.isFetching = true;

        const batchSize = 6;
        const startIndex = this.currentSegmentIndex;

        const fetchedSegments = await this.fetchSegments(startIndex, batchSize);

        for (const segment of fetchedSegments.video) {
            if (this.segmentFormat === 'ts') {
                this.transmuxer.push(segment);
                this.transmuxer.flush();
            } else if (this.segmentFormat === 'fmp4') {
                this.queueSegment(segment, 'video');
            }
        }

        for (const segment of fetchedSegments.audio) {
            console.log(
                'Processing audio segment, format:',
                this.segmentFormat,
                'size:',
                segment.byteLength
            );
            if (this.segmentFormat === 'ts') {
                if (this.audioTransmuxer) {
                    this.audioTransmuxer.push(segment);
                    this.audioTransmuxer.flush();
                } else {
                    console.warn(
                        'No separate audio transmuxer, using main transmuxer'
                    );
                    this.transmuxer.push(segment);
                    this.transmuxer.flush();
                }
            } else if (this.segmentFormat === 'fmp4') {
                this.queueSegment(segment, 'audio');
            }
        }

        this.currentSegmentIndex += batchSize;
        this.isFetching = false;
    }

    private queueSegment(data: Uint8Array, type: 'video' | 'audio') {
        if (type === 'video') {
            if (!this.videoSourceBuffer) {
                console.warn('No video source buffer available');
                return;
            }
            this.videoQueue.push(data);
            this.processVideoQueue();
        } else {
            if (!this.audioSourceBuffer) {
                console.warn('No audio source buffer available');
                return;
            }
            this.audioQueue.push(data);
            this.processAudioQueue();
        }
    }

    private processVideoQueue() {
        if (
            !this.videoSourceBuffer ||
            this.isVideoAppending ||
            this.videoSourceBuffer.updating ||
            this.videoQueue.length === 0
        ) {
            return;
        }

        const isSourceBufferValid = Array.from(
            this.mediaSource.sourceBuffers
        ).some((buffer) => buffer === this.videoSourceBuffer);

        if (!isSourceBufferValid) {
            console.error('Video SourceBuffer is no longer valid');
            return;
        }

        const segment = this.videoQueue.shift();
        if (!segment) return;

        this.isVideoAppending = true;
        try {
            this.videoSourceBuffer.appendBuffer(segment);
        } catch (e) {
            console.error('Error appending video buffer:', e);
            this.isVideoAppending = false;
        }
    }

    private processAudioQueue() {
        if (
            !this.audioSourceBuffer ||
            this.isAudioAppending ||
            this.audioSourceBuffer.updating ||
            this.audioQueue.length === 0
        ) {
            return;
        }

        const isSourceBufferValid = Array.from(
            this.mediaSource.sourceBuffers
        ).some((buffer) => buffer === this.audioSourceBuffer);

        if (!isSourceBufferValid) {
            console.error('Audio SourceBuffer is no longer valid');
            return;
        }

        const segment = this.audioQueue.shift();
        if (!segment) return;

        this.isAudioAppending = true;
        try {
            this.audioSourceBuffer.appendBuffer(segment);
        } catch (e) {
            console.error('Error appending audio buffer:', e);
            this.isAudioAppending = false;
        }
    }

    private onSeeking = async () => {
        const currentTime = this.video.currentTime;
        const isTimeBuffered = this.isTimeInBuffered(currentTime);

        if (!isTimeBuffered) {
            this.isSeeking = true;
            this.video.pause();

            await this.clearBuffers();

            this.requestedSegments.video.clear();
            this.requestedSegments.audio.clear();

            const maxSegmentIndex =
                Math.max(
                    this.segmentUrls.video.length,
                    this.segmentUrls.audio.length
                ) - 1;
            const calculatedIndex = Math.floor(
                currentTime / this.segmentDuration
            );
            const newSegmentIndex = Math.min(calculatedIndex, maxSegmentIndex);

            this.currentSegmentIndex = newSegmentIndex;

            this.fetchAndProcessNextSegment();
        }
    };

    private onSeeked = () => {
        if (!this.isSeeking) return;

        const checkBufferedAndResume = () => {
            if (this.isTimeInBuffered(this.video.currentTime)) {
                this.isSeeking = false;
                this.video.play();
            } else {
                setTimeout(checkBufferedAndResume, 100);
            }
        };

        checkBufferedAndResume();
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

            if (timeRemaining < 5 && !this.isFetching) {
                const isAnyAppending =
                    this.isVideoAppending || this.isAudioAppending;

                if (!isAnyAppending) {
                    console.log('Buffer low — fetching more segments...');
                    this.fetchAndProcessNextSegment();
                }
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

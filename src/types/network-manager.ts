export interface NetworkManager {
    /**
     * Called when a media segment is downloaded.
     */
    onSegmentDownloaded(info: {
        durationSec: number;
        sizeBytes: number;
        downloadTimeMs: number;
        url: string;
    }): void;

    /**
     * Current estimated throughput in bits per second.
     */
    getBandwidthEstimate(): number;

    /**
     * Optionally reset estimation (e.g. when switching networks).
     */
    reset(): void;

    destroy(): void;
}

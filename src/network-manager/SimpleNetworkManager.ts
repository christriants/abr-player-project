import { NetworkManager } from '../types/network-manager';

export class SimpleNetworkManager implements NetworkManager {
    private emaThroughputBps = 0;
    private alpha = 0.2;

    onSegmentDownloaded(info: {
        durationSec: number;
        sizeBytes: number;
        downloadTimeMs: number;
        url: string;
    }): void {
        const throughputBps = (info.sizeBytes * 8 * 1000) / info.downloadTimeMs;

        if (this.emaThroughputBps === 0) {
            this.emaThroughputBps = throughputBps;
        } else {
            this.emaThroughputBps =
                this.alpha * throughputBps +
                (1 - this.alpha) * this.emaThroughputBps;
        }
    }

    getBandwidthEstimate(): number {
        return this.emaThroughputBps;
    }

    reset(): void {
        this.emaThroughputBps = 0;
    }

    destroy(): void {
        this.reset();
    }
}

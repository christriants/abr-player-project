import { NetworkManager } from '../types/network-manager';

export class SimpleNetworkManager implements NetworkManager {
    private fastAlpha = Math.exp(Math.log(0.5) / 2);
    private slowAlpha = Math.exp(Math.log(0.5) / 5);
    private fastEstimate = 0;
    private slowEstimate = 0;
    private totalBytesSampled = 0;
    private minTotalBytes = 128 * 1024;
    private minBytes = 16 * 1024;

    onSegmentDownloaded(info: {
        durationSec: number;
        sizeBytes: number;
        downloadTimeMs: number;
        url: string;
    }): void {
        if (info.sizeBytes < this.minBytes) {
            console.warn('Ignoring small download for bandwidth estimation');
            return;
        }

        const throughputBps = (info.sizeBytes * 8 * 1000) / info.downloadTimeMs;
        const weight = info.downloadTimeMs / 1000;

        this.totalBytesSampled += info.sizeBytes;

        const fastAdjAlpha = Math.pow(this.fastAlpha, weight);
        this.fastEstimate =
            throughputBps * (1 - fastAdjAlpha) +
            fastAdjAlpha * this.fastEstimate;

        const slowAdjAlpha = Math.pow(this.slowAlpha, weight);
        this.slowEstimate =
            throughputBps * (1 - slowAdjAlpha) +
            slowAdjAlpha * this.slowEstimate;
    }

    getBandwidthEstimate(defaultEstimate: number = 1000000): number {
        if (this.totalBytesSampled < this.minTotalBytes) {
            return defaultEstimate;
        }
        return this.fastEstimate;
    }

    reset(): void {
        this.fastEstimate = 0;
        this.slowEstimate = 0;
        this.totalBytesSampled = 0;
    }

    destroy(): void {
        this.reset();
    }
}

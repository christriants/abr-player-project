import { MSEEngine } from '../playback-engine/MSEEngine';
import { NetworkManager } from './network-manager';
import { Rendition, Renditions } from './playback';

export interface ABRManager {
    initialize(
        videoEl: HTMLVideoElement,
        renditions: Renditions,
        engine: MSEEngine,
        networkManager: NetworkManager
    ): void;
    getRendition(): Rendition;
    selectRendition(): number;
    setManualRendition(index: number): void;
    clearManualRendition(): void;
    onPlaybackStall(): void;
    destroy(): void;
}

export type ABRManagerType = 'buffer-based' | 'fixed' | 'network-throughput';

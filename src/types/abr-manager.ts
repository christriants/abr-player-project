import { MSEEngine } from '../playback-engine/MSEEngine';
import { Renditions } from './playback';

export interface ABRManager {
    initialize(
        videoEl: HTMLVideoElement,
        renditions: Renditions[],
        engine: MSEEngine
    ): void;
    destroy(): void;
}

export type ABRManagerType = 'buffer-based' | 'fixed';

import { MSEEngine } from '../playback-engine/MSEEngine';
import { Renditions } from './playback';

export interface ABRManager {
    initialize(
        videoEl: HTMLVideoElement,
        renditions: Renditions[],
        engine: MSEEngine
    ): void;
    destroy(): void;
    onPlaybackTick?(currentTime: number): void;
    handleBufferUpdate?(): void;
    selectRendition?(url: string): void;
}

import { createStore } from 'zustand/vanilla';
import { useEffect, useState } from 'preact/hooks';
import type { Renditions } from '../types/playback';
import type { ABRManager } from '../types/abr-manager';
import type { MSEEngine } from '../playback-engine/MSEEngine';
import { TextTrack } from '../types/text-tracks';
import { TextTrackManager } from '../text-track-manager/text-track-manager';

interface PlayerState {
    videoEl: HTMLVideoElement | null;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    isMuted: boolean;
    isInitialLoading: boolean;
    isBuffering: boolean;
    bufferedRanges: TimeRanges | null;
    showControls: boolean;
    renditions: Renditions | null;
    abrManager: ABRManager | null;
    engine: MSEEngine | null;
    textTrackManager: TextTrackManager | null;
    textTracks: TextTrack[];
}

export const playerStore = createStore<PlayerState>(() => ({
    videoEl: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    isMuted: true,
    isInitialLoading: true,
    isBuffering: false,
    bufferedRanges: null,
    showControls: true,
    renditions: null,
    abrManager: null,
    engine: null,
    textTrackManager: null,
    textTracks: [],
}));

let prevState = playerStore.getState();

playerStore.subscribe((state) => {
    const { videoEl } = state;
    if (!videoEl) return;

    if (state.volume !== prevState.volume) {
        videoEl.volume = state.volume;
    }

    if (state.isMuted !== prevState.isMuted) {
        videoEl.muted = state.isMuted;
    }

    if (state.isPlaying !== prevState.isPlaying) {
        if (state.isPlaying && videoEl.paused) {
            videoEl.play().catch(console.error);
        } else if (!state.isPlaying && !videoEl.paused) {
            videoEl.pause();
        }
    }

    if (state.currentTime !== prevState.currentTime && Math.abs(state.currentTime - videoEl.currentTime) > 0.5) {
        videoEl.currentTime = state.currentTime;
    }

    prevState = state;
});

export function usePlayerStore<T>(selector: (state: PlayerState) => T): T {
    const [value, setValue] = useState(() => selector(playerStore.getState()));

    useEffect(() => {
        return playerStore.subscribe((state) => {
            setValue(selector(state));
        });
    }, [selector]);

    return value;
}

export const setPlayerState = playerStore.setState;
export const getPlayerState = playerStore.getState;

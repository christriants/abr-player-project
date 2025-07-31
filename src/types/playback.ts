export type Rendition = {
    resolution: string;
    bandwidth: number;
    url: string;
    totalDuration: number;
    codecs: string[];
    type: 'video' | 'audio';
};

export type Renditions = {
    video: Rendition[];
    audio: Rendition[];
};

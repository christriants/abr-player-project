export interface TextTrack {
    name: string;
    language: string;
    url: string;
    default: boolean;
    kind: 'captions' | 'subtitles' | 'chapters';
}

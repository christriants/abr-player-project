import { Rendition, Renditions } from '../types/playback';

export const fetchManifest = async (url: string): Promise<Renditions> => {
    const response = await fetch(url);
    const text = await response.text();
    const lines = text.split('\n').map((line) => line.trim());

    const videoRenditions: Rendition[] = [];
    const audioRenditions: Rendition[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Video renditions from EXT-X-STREAM-INF
        if (line.startsWith('#EXT-X-STREAM-INF')) {
            const bandwidth = line.match(/BANDWIDTH=(\d+)/)?.[1];
            const resolution = line.match(/RESOLUTION=(\d+x\d+)/)?.[1];
            const codecs = line.match(/CODECS="([^"]+)"/)?.[1];
            const relativeUrl = lines[i + 1];

            if (bandwidth && resolution && relativeUrl) {
                const absoluteUrl = new URL(relativeUrl, url).href;

                videoRenditions.push({
                    bandwidth: parseInt(bandwidth, 10),
                    resolution,
                    url: absoluteUrl,
                    totalDuration: 0,
                    codecs: codecs ? codecs.split(',') : [],
                    type: 'video',
                });
            }
        }

        // Audio renditions from EXT-X-MEDIA
        if (line.startsWith('#EXT-X-MEDIA:TYPE=AUDIO')) {
            const groupId = line.match(/GROUP-ID="([^"]+)"/)?.[1];
            const language = line.match(/LANGUAGE="([^"]+)"/)?.[1];
            const audioUrl = line.match(/URI="([^"]+)"/)?.[1];

            if (groupId && language && audioUrl) {
                const absoluteUrl = new URL(audioUrl, url).href;

                audioRenditions.push({
                    bandwidth: 0,
                    resolution: `${groupId}-${language}`,
                    url: absoluteUrl,
                    totalDuration: 0,
                    codecs: [],
                    type: 'audio',
                });
            }
        }
    }

    console.log('Available renditions:', [
        ...videoRenditions,
        ...audioRenditions,
    ]);

    return {
        video: videoRenditions,
        audio: audioRenditions,
    };
};

import { Rendition, Renditions } from '../types/playback';
import { TextTrack } from '../types/text-tracks';

export const fetchManifest = async (url: string): Promise<Renditions> => {
    const response = await fetch(url);
    const text = await response.text();
    const lines = text.split('\n').map((line) => line.trim());

    const videoRenditions: Rendition[] = [];
    const audioRenditions: Rendition[] = [];
    const textTracks: TextTrack[] = [];

    // baseUrl for resolving relative URIs in the manifest
    const baseUrl = (() => {
        try {
            const parsed = new URL(url);
            // keep origin + path up to last slash
            return parsed.origin + parsed.pathname.replace(/\/[^/]*$/, '/');
        } catch {
            // fallback: strip query and filename
            return url.split('?')[0].replace(/\/[^/]*$/, '/');
        }
    })();

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Video renditions from EXT-X-STREAM-INF
        if (line.startsWith('#EXT-X-STREAM-INF')) {
            const bandwidth = line.match(/BANDWIDTH=(\d+)/)?.[1];
            const resolution = line.match(/RESOLUTION=(\d+x\d+)/)?.[1];
            const codecs = line.match(/CODECS="([^"]+)"/)?.[1];
            const relativeUrl = lines[i + 1];

            if (
                bandwidth &&
                resolution &&
                relativeUrl &&
                !relativeUrl.startsWith('#')
            ) {
                const absoluteUrl = new URL(relativeUrl, url).href;

                videoRenditions.push({
                    bandwidth: parseInt(bandwidth, 10),
                    resolution,
                    url: absoluteUrl,
                    totalDuration: 0,
                    codecs: codecs
                        ? codecs.split(',').map((c) => c.trim())
                        : [],
                    type: 'video',
                });
            }
        }

        // Audio renditions from EXT-X-MEDIA
        if (line.startsWith('#EXT-X-MEDIA:') && line.includes('TYPE=AUDIO')) {
            const groupId = line.match(/GROUP-ID="([^"]+)"/)?.[1];
            const language = line.match(/LANGUAGE="([^"]+)"/)?.[1] || 'und';
            const audioUrl = line.match(/URI="([^"]+)"/)?.[1];

            if (groupId && audioUrl) {
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

        if (
            line.startsWith('#EXT-X-MEDIA:') &&
            line.includes('TYPE=SUBTITLES')
        ) {
            const groupId = line.match(/GROUP-ID="([^"]+)"/)?.[1];
            const name = line.match(/NAME="([^"]+)"/)?.[1] || 'Unknown';
            const language = line.match(/LANGUAGE="([^"]+)"/)?.[1] || 'en';
            const uri = line.match(/URI="([^"]+)"/)?.[1];
            const isDefault = line.includes('DEFAULT=YES');

            if (uri) {
                const trackUrl = new URL(uri, baseUrl).href;

                textTracks.push({
                    name,
                    language,
                    url: trackUrl,
                    default: isDefault,
                    kind: groupId === 'chapters' ? 'chapters' : 'subtitles',
                });
            }
        }
        console.log('Text tracks found:', textTracks);
    }

    console.log('Available renditions:', [
        ...videoRenditions,
        ...audioRenditions,
    ]);

    return {
        video: videoRenditions,
        audio: audioRenditions,
        textTracks: textTracks.length > 0 ? textTracks : undefined,
    };
};

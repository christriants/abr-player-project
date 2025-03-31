import { Renditions } from '../types/playback';

export const fetchManifest = async (url: string): Promise<Renditions[]> => {
    const response = await fetch(url);
    const text = await response.text();
    const lines = text.split('\n').map((line) => line.trim());

    const renditions: { bandwidth: number; resolution: string; url: string }[] =
        [];

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
            console.log('Found rendition:', lines[i]);
            const bandwidthMatch = lines[i].match(/BANDWIDTH=(\d+)/);
            const resolutionMatch = lines[i].match(/RESOLUTION=(\d+x\d+)/);
            const relativeUrl = lines[i + 1];

            if (bandwidthMatch && resolutionMatch && url) {
                renditions.push({
                    bandwidth: parseInt(bandwidthMatch[1], 10),
                    resolution: resolutionMatch[1],
                    url: new URL(relativeUrl, url).href,
                });
            }
        }
    }

    console.log('Available renditions:', renditions);
    return renditions;
};

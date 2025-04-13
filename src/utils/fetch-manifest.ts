import { Renditions } from '../types/playback';

export const fetchManifest = async (url: string): Promise<Renditions[]> => {
    const response = await fetch(url);
    const text = await response.text();
    const lines = text.split('\n').map((line) => line.trim());

    const renditions: Renditions[] = [];

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
            console.log('Found rendition:', lines[i]);
            const bandwidthMatch = lines[i].match(/BANDWIDTH=(\d+)/);
            const resolutionMatch = lines[i].match(/RESOLUTION=(\d+x\d+)/);
            const relativeUrl = lines[i + 1];

            if (bandwidthMatch && resolutionMatch && url) {
                const absoluteUrl = new URL(relativeUrl, url).href;

                // Fetch the media playlist for this rendition to calculate total duration
                const totalDuration = await calculateTotalDuration(absoluteUrl);
                console.log(
                    `Total duration for ${resolutionMatch[1]}: ${totalDuration}`
                );

                renditions.push({
                    bandwidth: parseInt(bandwidthMatch[1], 10),
                    resolution: resolutionMatch[1],
                    url: absoluteUrl,
                    totalDuration,
                });
            }
        }
    }

    console.log('Available renditions:', renditions);
    return renditions;
};

// Helper function to calculate total duration from a media playlist
const calculateTotalDuration = async (playlistUrl: string): Promise<number> => {
    const response = await fetch(playlistUrl);
    const text = await response.text();
    const lines = text.split('\n').map((line) => line.trim());

    let totalDuration = 0;

    for (const line of lines) {
        if (line.startsWith('#EXTINF')) {
            const durationMatch = line.match(/#EXTINF:([\d.]+)/);
            if (durationMatch) {
                totalDuration += parseFloat(durationMatch[1]);
            }
        }
    }

    return totalDuration;
};

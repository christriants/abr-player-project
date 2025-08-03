import { parseCodecsFromPlaylist } from './parse-codecs-from-playlist';

const playlistCache = new Map<string, string[]>();

export const fetchPlaylist = async (url: string): Promise<string[]> => {
    console.log(`Fetching playlist from URL: ${url}`);
    if (playlistCache.has(url)) {
        console.log(`Using cached playlist for URL: ${url}`);
        return playlistCache.get(url)!;
    }

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch playlist: ${url}`);
    }

    const text = await response.text();
    const playlist = text.split('\n').map((line) => line.trim());
    playlistCache.set(url, playlist);
    console.log(`Cached playlist for URL: ${url}`);

    return playlist;
};

export const clearPlaylistCache = () => {
    console.log('Clearing playlist cache');
    playlistCache.clear();
};

export const getRenditionDuration = (playlistContent: string[]): number => {
    let totalDuration = 0;

    for (const line of playlistContent) {
        if (line.startsWith('#EXTINF')) {
            const durationMatch = line.match(/#EXTINF:([\d.]+)/);
            if (durationMatch) {
                totalDuration += parseFloat(durationMatch[1]);
            }
        }
    }

    return totalDuration;
};

export const fetchPlaylistData = async (
    playlistTextResponse: string[],
    url: string
): Promise<{
    segmentUrls: string[];
    totalDuration: number;
    initSegmentUrl?: string;
}> => {
    const segmentUrls: string[] = [];
    let initSegmentUrl: string | undefined;

    for (const line of playlistTextResponse) {
        if (line.startsWith('#EXT-X-MAP:')) {
            const match = line.match(/URI="([^"]+)"/);
            if (match) {
                initSegmentUrl = new URL(match[1], url).href;
                console.log('Found init segment URL:', initSegmentUrl);
            }
        } else if (line && !line.startsWith('#')) {
            segmentUrls.push(new URL(line, url).href);
        }
    }

    const result = {
        segmentUrls,
        totalDuration: getRenditionDuration(playlistTextResponse),
        initSegmentUrl,
    };

    console.log('Playlist data result:', result);
    return result;
};

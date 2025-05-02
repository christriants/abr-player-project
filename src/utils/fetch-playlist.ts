const playlistCache = new Map<string, string[]>();

export const fetchPlaylist = async (url: string): Promise<string[]> => {
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
    console.log('[fetchPlaylist] Clearing playlist cache');
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
}> => {
    const segmentUrls: string[] = [];
    for (const line of playlistTextResponse) {
        if (line && !line.startsWith('#')) {
            segmentUrls.push(new URL(line, url).href);
        }
    }

    // Cache the fetched playlist
    playlistCache.set(url, segmentUrls);
    console.log(`Cached playlist for URL: ${url}`);

    return {
        segmentUrls,
        totalDuration: getRenditionDuration(playlistTextResponse),
    };
};

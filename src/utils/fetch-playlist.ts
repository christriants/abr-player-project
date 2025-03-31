const playlistCache = new Map<string, string[]>();

export const fetchPlaylist = async (url: string): Promise<string[]> => {
    if (playlistCache.has(url)) {
        console.log(`Using cached playlist for URL: ${url}`);
        return playlistCache.get(url)!;
    }

    // Fetch the playlist if not cached
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch playlist: ${url}`);
    }

    const text = await response.text();
    const lines = text.split('\n').map((line) => line.trim());

    const segmentUrls: string[] = [];
    for (const line of lines) {
        if (line && !line.startsWith('#')) {
            segmentUrls.push(new URL(line, url).href);
        }
    }

    // Cache the fetched playlist
    playlistCache.set(url, segmentUrls);
    console.log(`Cached playlist for URL: ${url}`);

    return segmentUrls;
};

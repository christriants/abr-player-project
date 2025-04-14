export const getRenditionDuration = (playlistContent: string): number => {
    const lines = playlistContent.split('\n').map((line) => line.trim());

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

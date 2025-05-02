export const parseCodecsFromPlaylist = (playlistText: string): string[] => {
    const codecRegex = /CODECS="([^"]+)"/g;
    const codecs: string[] = [];
    let match;

    while ((match = codecRegex.exec(playlistText)) !== null) {
        codecs.push(match[1]);
    }

    if (codecs.length === 0) {
        console.warn('[parseCodecsFromPlaylist] No codecs found in playlist');
    }

    return codecs;
};

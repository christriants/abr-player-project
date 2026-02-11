export const getLanguageName = (code: string) => {
    const languageNames: { [key: string]: string } = {
        'en': 'English',
        'es': 'Spanish',
        'de': 'German',
        'fr': 'French',
        'it': 'Italian',
        'pt': 'Portuguese',
        'ru': 'Russian',
        'ja': 'Japanese',
        'zh': 'Chinese',
        'ko': 'Korean',
    };
    return languageNames[code] || code.toUpperCase();
};

export const isM3u8Url = (url: string): boolean => {
    return url.toLowerCase().endsWith('.m3u8');
}

export const isVttUrl = (url: string): boolean => {
    return url.toLowerCase().endsWith('.vtt');
}

export function parseVtt(vttText: string): VTTCue[] {
    const cues: VTTCue[] = [];

    // Remove WEBVTT header
    const lines = vttText.replace(/^WEBVTT.*?\n\n/, '').split('\n');

    let i = 0;
    while (i < lines.length) {
        const line = lines[i].trim();

        // Skip empty lines and cue identifiers
        if (!line || !line.includes('-->')) {
            i++;
            continue;
        }

        // Parse timing line: 00:00:00.000 --> 00:00:03.000
        const timingMatch = line.match(
            /(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/
        );

        if (!timingMatch) {
            i++;
            continue;
        }

        const startTime = parseTimestamp(timingMatch[1]);
        const endTime = parseTimestamp(timingMatch[2]);

        // Collect cue text (may be multiple lines)
        i++;
        let text = '';
        while (i < lines.length && lines[i].trim() !== '') {
            text += (text ? '\n' : '') + lines[i];
            i++;
        }

        if (text) {
            const cue = new VTTCue(startTime, endTime, text);
            cues.push(cue);
        }
    }

    return cues;
}

function parseTimestamp(timestamp: string): number {
    // Parse "00:00:03.000" to seconds
    const parts = timestamp.split(':');
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    const secondsParts = parts[2].split('.');
    const seconds = parseInt(secondsParts[0]);
    const milliseconds = parseInt(secondsParts[1]);

    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

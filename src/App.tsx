import { Player } from './components';
import { useState } from 'preact/hooks';
import { ChangeEvent } from 'preact/compat';

export const App = () => {
    const [manifestUrl, setManifestUrl] = useState(
        'http://localhost:5173/hls/master.m3u8'
        // https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8
    );
    const [abrManager, setAbrManager] = useState<'buffer' | 'fixed'>('buffer');

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        const target = e.target as HTMLInputElement;
        setManifestUrl(target.value);
    };

    return (
        <>
            <div>
                <h1>Video Player</h1>
                <Player src={manifestUrl} abrManager={abrManager} />
            </div>
            <input
                type="text"
                placeholder="Enter manifest URL"
                value={manifestUrl}
                onChange={handleInputChange}
            />
            <div>
                <label>ABR Mode:</label>
                <select
                    value={abrManager}
                    onChange={(e) =>
                        setAbrManager(e.currentTarget.value as any)
                    }
                >
                    <option value="fixed">Fixed</option>
                    <option value="buffer">Buffer</option>
                </select>
            </div>
        </>
    );
};

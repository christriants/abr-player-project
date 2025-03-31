import { Player } from './components';
import { useState } from 'preact/hooks';
import { ChangeEvent } from 'preact/compat';

export const App = () => {
    const [manifestUrl, setManifestUrl] = useState(
        'http://localhost:5173/hls/master.m3u8'
    );

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        const target = e.target as HTMLInputElement;
        setManifestUrl(target.value);
    };

    return (
        <>
            <div>
                <h1>Video Player</h1>
                <Player src={manifestUrl} />
            </div>
            <input
                type="text"
                placeholder="Enter manifest URL"
                value={manifestUrl}
                onChange={handleInputChange}
            />
        </>
    );
};

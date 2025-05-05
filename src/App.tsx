import { Player } from './components';
import { useState } from 'preact/hooks';
import { ChangeEvent } from 'preact/compat';
import type { ABRManagerType } from './types/abr-manager';

export const App = () => {
    const [manifestUrl, setManifestUrl] = useState('');
    const [abrType, setAbrType] =
        useState<ABRManagerType>('network-throughput');

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        const target = e.target as HTMLInputElement;
        setManifestUrl(target.value);
    };

    return (
        <>
            <div>
                <h1>Video Player</h1>
                <Player src={manifestUrl} abr={abrType} />
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
                    value={abrType}
                    onChange={(e) => setAbrType(e.currentTarget.value as any)}
                >
                    <option value="fixed">Fixed</option>
                    <option value="buffer-based">Buffer-based</option>
                    <option value="network-throughput">
                        Network Throughput
                    </option>
                </select>
            </div>
        </>
    );
};

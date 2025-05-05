import { Player } from './components';
import { useState } from 'preact/hooks';
import { ChangeEvent } from 'preact/compat';
import type { ABRManagerType } from './types/abr-manager';
import { formatBandwidth } from './utils/format-bandwidth';

export const App = () => {
    const [manifestUrl, setManifestUrl] = useState('');
    const [abrType, setAbrType] =
        useState<ABRManagerType>('network-throughput');

    const [debugInfo, setDebugInfo] = useState({
        currentRendition: '',
        estimatedBandwidth: 0,
        bufferLength: 0,
    });

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        const target = e.target as HTMLInputElement;
        setManifestUrl(target.value);
    };

    return (
        <>
            <div>
                <h1>Video Player</h1>
                <Player
                    src={manifestUrl}
                    abr={abrType}
                    onDebugInfoUpdate={setDebugInfo}
                />
            </div>
            <div>
                <h2>Debug Panel</h2>
                <p>
                    <strong>Current Rendition:</strong>
                    {debugInfo.currentRendition}
                </p>
                <p>
                    <strong>Estimated Bandwidth:</strong>
                    {formatBandwidth(debugInfo.estimatedBandwidth)}
                </p>
                <p>
                    <strong>Buffer Length:</strong>
                    {debugInfo.bufferLength.toFixed(2)} seconds
                </p>
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

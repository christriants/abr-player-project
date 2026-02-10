import { Player } from './components';
import { useState } from 'preact/hooks';
import { ChangeEvent } from 'preact/compat';
import type { ABRManagerType } from './types/abr-manager';
import { formatBandwidth } from './utils/format-bandwidth';

export const App = () => {
    const [manifestUrl, setManifestUrl] = useState(
        'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8'
        // 'https://vod-adaptive-ak.vimeocdn.com/exp=1754257517~acl=%2Fccfaa6de-0af0-44cb-a61a-8ecebadb6ad1%2F%2A~hmac=c7763e68b9bae9db7c76124bdda19932339eee23bdb71dcaa44b5638617b05ec/ccfaa6de-0af0-44cb-a61a-8ecebadb6ad1/v2/playlist/av/primary/sub/170-de,171-es,140662-en,4678937-fr/playlist.m3u8?ext-subs=1&locale=en&omit=av1-hevc-opus&pathsig=8c953e4f~aij5c4-6HFmM6_PX2gVwCBSCthsLwdxgnEBzwYlj-i0&r=dXM%3D&rh=XRMgs&sf=fmp4'
    );
    const [abrType, setAbrType] = useState<ABRManagerType>('buffer-based');

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

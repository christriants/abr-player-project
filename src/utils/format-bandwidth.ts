export const formatBandwidth = (bps: number): string => {
    if (bps >= 1e9) {
        return `${(bps / 1e9).toFixed(2)} Gbps`;
    } else if (bps >= 1e6) {
        return `${(bps / 1e6).toFixed(2)} Mbps`;
    } else if (bps >= 1e3) {
        return `${(bps / 1e3).toFixed(2)} Kbps`;
    } else {
        return `${bps.toFixed(2)} bps`;
    }
};

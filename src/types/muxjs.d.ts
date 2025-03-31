declare module 'mux.js' {
    namespace mp4 {
        class Transmuxer {
            constructor(options?: any);
            push(data: Uint8Array): void;
            flush(): void;
            on(event: string, callback: (segment: any) => void): void;
        }
    }
}

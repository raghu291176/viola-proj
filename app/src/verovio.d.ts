// Minimal typings for the verovio WASM toolkit (the package ships JS without .d.ts for esm).
declare module 'verovio/wasm' {
  const createVerovioModule: () => Promise<unknown>;
  export default createVerovioModule;
}
declare module 'verovio/esm' {
  export class VerovioToolkit {
    constructor(module: unknown);
    loadData(data: string): boolean;
    renderToSVG(page: number): string;
    getPageCount(): number;
    setOptions(options: Record<string, unknown>): void;
    renderToTimemap(options?: Record<string, unknown>): unknown;
  }
}

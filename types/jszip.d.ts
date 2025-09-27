declare module 'jszip' {
  interface JSZipFileOptions { dir?: boolean }
  interface JSZipGenerateOptions { type: 'uint8array' }
  class JSZipObject {}
  class JSZip {
    file(name: string, data: Uint8Array | Buffer | string, opts?: JSZipFileOptions): this;
    generateAsync(opts: JSZipGenerateOptions): Promise<Uint8Array>;
  }
  export default JSZip;
}

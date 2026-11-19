// A font file imported by the client comes in as a data URL, inlined into the bundle
// (see webpack.config.client.js).

declare module "*.ttf" {
    const dataUrl: string;
    export default dataUrl;
}

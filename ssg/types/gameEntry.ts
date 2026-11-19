export default interface GameEntry
{
    dirName: string;
    title: string;
    playLinkImagePathOverride?: string;
    playLinkURL: string;
    videoTag?: string;
    lastmod: string;
    // The picture a link to the game's page is previewed with, in place of the site's (a path under the site's root).
    shareImage?: { path: string, width: number, height: number, alt: string };
}

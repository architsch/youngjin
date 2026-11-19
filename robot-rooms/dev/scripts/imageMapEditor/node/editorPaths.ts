// Where the editor reads and writes (see main.ts). A workspace puts all of it in one scratch directory and
// leaves the generated map alone.
export default interface EditorPaths
{
    repoRoot: string;
    // The map's root: manifest.json and the game images.
    imagesDir: string;
    // Full-resolution samples, kept to make an entry again at another size (never shipped).
    samplesDir: string;
    // Disabled entries' game images, kept out of the map's root so they don't ship.
    disabledImagesDir: string;
    recipesPath: string;
    noticesPath: string;
    // The source library: its photos (gitignored) and their index.
    sourcesDir: string;
    // Another library whose photos are read, never written (a workspace reads the repository's).
    fallbackSourcesDir?: string;
    // Bundles, thumbnails and the contact sheet (gitignored).
    workDir: string;
    // Whether a save rebuilds the map's thumbnails and generated table (see MapRebuilder).
    rebuildsMap: boolean;
}

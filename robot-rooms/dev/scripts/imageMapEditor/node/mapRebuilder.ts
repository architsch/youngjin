import path from "path";
import { spawn } from "child_process";
import EditorPaths from "./editorPaths";

// Rebuilds the map's thumbnails and generated table after a change, with the map's own builder (see
// buildPictureImageMap.ts), bundled from the source on every run so it is never stale. One run at a time: changes
// made during a run are picked up by one more run after it.
export default class MapRebuilder
{
    private readonly paths: EditorPaths;
    private readonly onFinished: (error: string | undefined) => void;
    private running = false;
    private pending = false;

    constructor(paths: EditorPaths, onFinished: (error: string | undefined) => void)
    {
        this.paths = paths;
        this.onFinished = onFinished;
    }

    request(): void
    {
        if (!this.paths.rebuildsMap)
            return;
        if (this.running)
        {
            this.pending = true;
            return;
        }
        this.running = true;
        this.run().then(
            () => this.finish(undefined),
            (err) => this.finish(String(err)));
    }

    // Resolves once no run is left to do.
    async whenIdle(): Promise<void>
    {
        while (this.running)
            await new Promise(resolve => setTimeout(resolve, 100));
    }

    private finish(error: string | undefined): void
    {
        this.running = false;
        this.onFinished(error);
        if (this.pending)
        {
            this.pending = false;
            this.request();
        }
    }

    private async run(): Promise<void>
    {
        const esbuild = await import("esbuild");
        const outfile = path.join(this.paths.workDir, "buildPictureImageMap.cjs");
        await esbuild.build({
            entryPoints: [path.join(this.paths.repoRoot, "dev/scripts/imageMapEditor/node/buildPictureImageMap.ts")],
            outfile,
            bundle: true,
            platform: "node",
            format: "cjs",
            target: "node18",
            external: ["sharp"],
            logLevel: "silent",
        });
        await new Promise<void>((resolve, reject) => {
            const child = spawn(process.execPath, [outfile], {cwd: this.paths.repoRoot, stdio: ["ignore", "ignore", "pipe"]});
            let stderr = "";
            child.stderr.on("data", (chunk) => stderr += chunk);
            child.on("error", reject);
            child.on("exit", (code) => (code == 0) ? resolve() : reject(new Error(stderr.trim() || `exit code ${code}`)));
        });
    }
}

import ErrorPageBuilder from "./builder/errorPageBuilder";
import PreEncodedCompositionBuilder from "./builder/preEncodedCompositionBuilder";
import InstancedMeshCapacityBuilder from "./builder/instancedMeshCapacityBuilder";
import ImageMapBuilder from "./builder/imageMapBuilder";
import VoxelTexturePackBuilder from "./builder/voxelTexturePackBuilder";
import CompositionThumbnailBuilder from "./builder/compositionThumbnailBuilder";
import { ImageMapSeeds } from "./data/imageMapSeeds";
import RoomMapBuilder from "./builder/roomMapBuilder";
import { RoomMapSeeds } from "./data/roomMapSeeds";
import AudioBundleBuilder from "./builder/audioBundleBuilder";
import PetLinesBuilder from "./builder/petLinesBuilder";
// Capacities decode compositions, which needs the part builders registered.
import "../../shared/graphics/mesh/composition/instancedMeshCompositionBuilderMapDependencies";

// Builds the game's static content into the site's folder: its error pages and the assets it loads from there. (The
// site's own pages are built by the generator in the repository's ssg/.)
// Loaded lazily by server.ts, so nothing here (sharp included, which the prod VPS CPU can't run) is part
// of the production server's startup.
export default async function SSG(): Promise<void>
{
    console.log("SSG START");

    // Generate Error Pages

    await new ErrorPageBuilder().build();

    // Generate Image Maps (after the voxel texture packs' atlases, which their map is made of)

    await new VoxelTexturePackBuilder(process.env.MODE == "ssg").build();
    for (const seed of Object.values(ImageMapSeeds))
        await new ImageMapBuilder(seed).build();

    // Generate Room Maps

    for (const seed of Object.values(RoomMapSeeds))
        await new RoomMapBuilder(seed).build();

    // Generate Pre-Encoded Compositions, the mesh capacities they need, and their thumbnails

    const preEncodedCompositions = await new PreEncodedCompositionBuilder().build();
    await new InstancedMeshCapacityBuilder(preEncodedCompositions).build();
    await new CompositionThumbnailBuilder(preEncodedCompositions, process.env.MODE == "ssg").build();

    // Write what pets chat in, for browsers to fetch

    await new PetLinesBuilder().build();

    // Generate the Audio Bundle, last: the dev server watches the map it writes, and restarts as soon as that changes.

    await new AudioBundleBuilder().build();

    console.log("SSG END");
}

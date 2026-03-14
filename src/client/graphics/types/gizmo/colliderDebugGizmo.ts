import * as THREE from "three";
import MeshFactory from "../../factories/meshFactory";
import MaterialFactory from "../../factories/materialFactory";
import GraphicsManager from "../../graphicsManager";
import { colliderDebugBoxMap, colliderDebugEnabledObservable } from "../../../../shared/system/sharedObservables";
import { roomChangedObservable } from "../../../system/clientObservables";
import RoomRuntimeMemory from "../../../../shared/room/types/roomRuntimeMemory";
import ColliderDebugBox from "../../../../shared/physics/types/colliderDebugBox";
import LineBasicMaterialParams from "../../types/material/lineBasicMaterialParams";

const DEFAULT_COLOR = "#ff8800";

const lineSegmentsById = new Map<string, THREE.LineSegments>();

async function getBoxLineSegments(colorHex: string): Promise<THREE.LineSegments>
{
    const lineSegments = await MeshFactory.loadLineSegments("Box", colorHex);
    return lineSegments.clone();
}

async function addOrUpdateBox(id: string, box: ColliderDebugBox)
{
    const colorHex = box.colorHex ?? DEFAULT_COLOR;
    let lineSegments = lineSegmentsById.get(id);

    if (lineSegments)
    {
        // If color changed, swap material.
        const currentColor = (lineSegments.userData as { colorHex: string }).colorHex;
        if (currentColor !== colorHex)
        {
            lineSegments.material = await MaterialFactory.load(new LineBasicMaterialParams(colorHex));
            (lineSegments.userData as { colorHex: string }).colorHex = colorHex;
        }
    }
    else
    {
        lineSegments = await getBoxLineSegments(colorHex);

        // After await, another call may have already created an entry for this id.
        // Clean up the stale one to prevent orphaned visuals in the scene.
        const stale = lineSegmentsById.get(id);
        if (stale)
            stale.removeFromParent();

        lineSegments.userData = { colorHex };
        GraphicsManager.getScene().add(lineSegments);
        lineSegmentsById.set(id, lineSegments);
    }

    lineSegments.position.set(box.x, box.y, box.z);
    lineSegments.scale.set(box.halfSizeX * 2, box.halfSizeY * 2, box.halfSizeZ * 2);
    lineSegments.visible = true;
}

function removeBox(id: string)
{
    const lineSegments = lineSegmentsById.get(id);
    if (lineSegments)
    {
        lineSegments.removeFromParent();
        lineSegmentsById.delete(id);
    }
}

function clearAll()
{
    lineSegmentsById.forEach((ls) => ls.removeFromParent());
    lineSegmentsById.clear();
}

colliderDebugBoxMap.addListener("colliderDebugGizmo", async (map: {[key: string]: ColliderDebugBox}) => {
    if (!colliderDebugEnabledObservable.peek())
        return;

    // Determine which IDs were added, updated, or removed.
    const currentIds = new Set(Object.keys(map));

    // Remove meshes whose IDs are no longer in the map.
    const existingIds: string[] = [];
    lineSegmentsById.forEach((_, id) => existingIds.push(id));
    for (const id of existingIds)
    {
        if (!currentIds.has(id))
            removeBox(id);
    }

    // Add or update meshes for all current entries.
    for (const [id, box] of Object.entries(map))
        await addOrUpdateBox(id, box);
});

colliderDebugEnabledObservable.addListener("colliderDebugGizmo", async (enabled: boolean) => {
    if (!enabled)
        clearAll();
});

roomChangedObservable.addListener("colliderDebugGizmo", async (_roomRuntimeMemory: RoomRuntimeMemory) => {
    clearAll();
});

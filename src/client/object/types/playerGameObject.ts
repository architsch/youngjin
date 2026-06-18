import GameObject from "./gameObject";
import InstancedMeshGraphics from "../components/instancedMeshGraphics";
import PlayerBodyConfig from "./playerBodyConfig";
import { MAX_PLAYERS_PER_ROOM } from "../../../shared/system/sharedConstants";
import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";

// A player character is a "floating-limb creature": several detached, rigid body parts hovering in a
// fixed formation around the body, distinguished by gaps, distinct smooth shapes, size contrast, and
// per-part color/texture. Each part has its own geometry but every part shares ONE texture atlas, so all
// parts are loaded with the same material — the atlas image is fetched once and reused. Parts sharing a
// geometry (the two hands) also share one InstancedMesh + instance pool; each part is one rented instance,
// differentiated by its per-instance transform/scale, atlas-cell UV, and color.
//
// The body layout, geometries, defaults, and atlas live in PlayerBodyConfig — the single source of truth
// shared with the customization menu UI (CustomizePlayerForm). The textureIndex/colorHex applied per
// instance come from the per-player appearance metadata, falling back to each part's config default.

// Far below the world; where a part is parked while the player is hidden.
const OFFSCREEN_Y = -9999;

export default class PlayerGameObject extends GameObject
{
    private instancedMeshGraphics: InstancedMeshGraphics | undefined;
    private partInstanceIds: number[] = [];
    private hidden: boolean = false;

    async onSpawn(): Promise<void>
    {
        await super.onSpawn();

        // Only other players are rendered; the local player is in first-person and has no visible body
        // (the instancedMeshGraphics component is declared only under the "spawnedByOther" condition).
        this.instancedMeshGraphics = this.components.instancedMeshGraphics as InstancedMeshGraphics;
        if (!this.instancedMeshGraphics)
            return;

        try
        {
            // One shared InstancedMesh per distinct body-part geometry, all built from the same atlas
            // material (so the image loads once). Each pool is sized for every player's parts of that
            // shape. loadInstancedMesh is idempotent per geometry, so later players just rent from these.
            for (const { geometryId, partsPerPlayer } of PlayerBodyConfig.distinctGeometries())
                await this.instancedMeshGraphics.loadInstancedMesh(geometryId,
                    PlayerBodyConfig.getMaterialParams(), geometryId,
                    MAX_PLAYERS_PER_ROOM * partsPerPlayer, true);

            // Rent one instance per body part from its geometry's shared pool.
            for (const part of PlayerBodyConfig.parts)
                this.partInstanceIds.push(this.instancedMeshGraphics.rentInstanceFromPool(part.geometryId));

            // Apply the user's saved customization (restored into this object's metadata at spawn),
            // falling back to the per-part defaults for anything unspecified.
            const entry = this.params.metadata[ObjectMetadataKeyEnumMap.PlayerAppearance];
            this.applyAppearance(PlayerBodyConfig.resolveAppearance(entry?.str));

            if (!this.hidden) // A player can come into proximity before its parts finish loading.
                this.updateParts();
        }
        catch (error)
        {
            // Degrade gracefully (player simply has no visible body) rather than aborting the spawn.
            console.error(`Failed to load player body parts (objectId = ${this.params.objectId}). Is the parts atlas present at the configured path?`, error);
        }
    }

    async onDespawn(): Promise<void>
    {
        await super.onDespawn();

        if (this.instancedMeshGraphics)
        {
            for (let i = 0; i < this.partInstanceIds.length; ++i)
                this.instancedMeshGraphics.returnInstanceToPool(
                    PlayerBodyConfig.parts[i].geometryId, this.partInstanceIds[i]);
            this.partInstanceIds.length = 0;
        }
    }

    // Re-bakes the detached parts every frame so they follow the body's position and yaw (and any
    // cosmetic bounce on visualObj). Cheap — a handful of instance writes per visible player.
    update(deltaTime: number): void
    {
        if (!this.hidden)
            this.updateParts();
    }

    // If another player gets too close to the user, hide its body so it doesn't clip through the camera.
    onPlayerProximityStart()
    {
        if (this.isMine())
            return;
        this.hidden = true;
        for (let i = 0; i < this.partInstanceIds.length; ++i)
            this.instancedMeshGraphics?.updateInstanceTransform(
                PlayerBodyConfig.parts[i].geometryId, this.partInstanceIds[i], 0, OFFSCREEN_Y, 0, 0, -1, 0);
    }

    // Once it is no longer too close, show it again (the next update() re-bakes it at the live position).
    onPlayerProximityEnd()
    {
        if (this.isMine())
            return;
        this.hidden = false;
    }

    // Re-applies the customization whenever it changes (the user edited their own character, broadcast
    // to everyone). The base call fans the change out to components (e.g. the speech bubble).
    onSetMetadata(key: ObjectMetadataKey, value: string)
    {
        super.onSetMetadata(key, value);
        if (key === ObjectMetadataKeyEnumMap.PlayerAppearance)
            this.applyAppearance(PlayerBodyConfig.resolveAppearance(value));
    }

    // Sets each part's atlas cell + tint from the resolved appearance (one fully-specified entry per part,
    // in PlayerBodyConfig order — defaults already substituted by PlayerBodyConfig.resolveAppearance).
    private applyAppearance(parts: { textureIndex: number; colorHex: number }[])
    {
        if (!this.instancedMeshGraphics || this.partInstanceIds.length === 0)
            return;
        for (let i = 0; i < PlayerBodyConfig.parts.length; ++i)
        {
            const geometryId = PlayerBodyConfig.parts[i].geometryId;
            this.instancedMeshGraphics.updateInstanceTextureUV(geometryId, this.partInstanceIds[i], parts[i].textureIndex);
            this.instancedMeshGraphics.updateInstanceColor(geometryId, this.partInstanceIds[i], parts[i].colorHex);
        }
    }

    private updateParts()
    {
        if (!this.instancedMeshGraphics || this.partInstanceIds.length === 0)
            return;

        // All parts face the body's forward direction; their offsets are in the body's local frame, so
        // the formation revolves with the body's yaw.
        const forward = this.direction;
        for (let i = 0; i < PlayerBodyConfig.parts.length; ++i)
        {
            const part = PlayerBodyConfig.parts[i];
            this.instancedMeshGraphics.updateInstanceTransform(part.geometryId, this.partInstanceIds[i],
                part.offsetX, part.offsetY, part.offsetZ,
                forward.x, forward.y, forward.z,
                part.scaleX, part.scaleY, part.scaleZ);
        }
    }
}

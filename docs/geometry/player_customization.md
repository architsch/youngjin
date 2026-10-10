# Player Customization System

Reference: @src/shared/graphics/mesh/composition/types/compositionCodec/playerCompositionCodec.ts , @src/shared/graphics/mesh/composition/types/compositionBuilder/playerCompositionBuilder.ts , @src/client/object/types/gameObject/playerGameObject.ts , @src/shared/object/types/objectTypeConfig/npcObjectTypeConfig.ts , @src/client/object/types/gameObject/npcGameObject.ts , @src/client/ui/components/panel/customizePlayerPanel.tsx

The character's appearance is an `InstancedMeshComposition` (see [instanced_mesh_composition.md](../graphics/instanced_mesh_composition.md)). Its parameters are encoded as a compact base-94 string that is stored in the user's `playerMetadata`. The customization panel is visible while the user's own character is selected in edit mode.

- A color is stored as an index into the player's own palette of vivid "tin toy" hues. **Palette entries are only ever appended**, because reordering them would change every saved character.
- The face is drawn with the unlit material, so its colors are kept dim enough to read as paint rather than as a light.

## Design standards
The body is built from primitives placed on a discrete grid. Offsets are counted in grid cells rather than raw coordinates.

![Player Customization Grid](figures/player_customization_1.jpg)

- **Circular shapes**: a cylinder in an N×N space is sized to fully cover the middle two cells on each side, and no larger. Its area then roughly matches the square's, and neighbors attach without gaps.

  ![Circular Shape in Player Customization](figures/player_customization_2.jpg)
- **Eyes on a cylinder**: the head's side is padded with a box so the flat eyes have a flat surface.

  ![Player Eyes on a Cylinder](figures/player_customization_3.jpg)

## NPCs
An NPC is a character nobody plays, with a player's body (`NpcObjectTypeConfig`). It is an attached object that stands on a floor (see [object_attachment.md](object_attachment.md)), is kept with the room, and is laid and edited by admins only (see [admin.md](../gameplay/admin.md)).
- Its look is stored on the object in the same encoded form and edited in the same panel. One that stores none is given a look drawn from its own id, the same for everyone.
- Its name is its `Label` metadata, kept short, and comes before whatever it says. The way it faces is its `QuarterTurns`.
- What it says and does is up to a room's steps (see [single_player_mode.md](../networking/single_player_mode.md)).

Reference designs: `PlayerHat` type 1 ([figure](figures/player_customization_4.jpg)); `PlayerBottom` components ([figure](figures/player_customization_5.jpg)) and types 0–2 ([figure](figures/player_customization_6.jpg)).

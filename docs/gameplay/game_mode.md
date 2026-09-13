# Game Mode

Reference: @src/client/system/util/gameModeUtil.ts , @src/client/graphics/util/worldSpaceSelectionUtil.ts , @src/client/object/types/objectTypeClientConfig/objectTypeClientConfig.ts , @src/client/ui/util/closablePanelUtil.ts

A `GameMode` decides the camera behavior, whether the player can walk, and which tools are shown. `GameModeUtil` publishes the current mode, and everything mode-dependent observes it.

- **Play mode**: first-person view, the player walks, and nothing can be selected. A click acts on the room (e.g. walking through a door).
- **Edit mode**: the camera orbits the current selection, the player stands still, and the selection's editing tools are shown.

The mode is stored separately from camera state, because the camera briefly has no target while one selection replaces another.

## Switching
- Edit mode can only be entered through the top-bar toggle. It opens on the nearest voxel quad or object in the middle of the view that can be selected, looking past objects that refuse (e.g. other players) but never through a room surface. If there is none, it opens on the user's own character, even past a step's selection lock.
- It is left through the toggle or the back gesture (Escape / device Back). The back gesture closes popups and closable panels first (`ClosablePanelUtil`). Leaving clears the selection.
- Selecting or deselecting never changes the mode.
- Edit mode is open to everyone. Permissions are checked per edit (see [restricted_zone.md](restricted_zone.md)).
- A single-player step can lock the mode (see [single_player_mode.md](../networking/single_player_mode.md)). The lock is checked in `GameModeUtil`, so every way of switching respects it.

## Selection
- A selection is a single voxel quad or object. Nothing is selected in play mode, and something is always selected in edit mode. When the selected thing is removed, the selection moves to something nearby.
- Clicking the current selection or an unselectable spot keeps the current selection.
- Each object type declares its selection behavior in `ObjectTypeClientConfig`: who may select it, the tool panel it opens, and whether it slides along walls. Every selection also requires edit mode and reach. A refused click passes through silently.
- The outline and camera framing come from the object's collider. Anyone who may select an object may also move it, and each move is validated.

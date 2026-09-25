# Game Mode

Reference: @src/client/system/util/gameModeUtil.ts , @src/client/graphics/util/worldSpaceSelectionUtil.ts , @src/client/object/types/objectTypeClientConfig/objectTypeClientConfig.ts , @src/client/ui/util/closablePanelUtil.ts

A `GameMode` decides the camera behavior, whether the player can walk, and which tools are shown. `GameModeUtil` publishes the current mode, and everything mode-dependent observes it.

- **Play mode**: first-person view, the player walks, and nothing can be selected. A click acts on the room (e.g. walking through a door).
- **Edit mode**: the camera orbits the current selection, the player stands still, and the selection's editing tools are shown.

The mode is stored separately from camera state, because the camera briefly has no target while one selection replaces another.

## Switching
- Edit mode can only be entered through the top-bar toggle. It opens on the nearest voxel quad or object in the middle of the view that can be selected, within a limited reach, looking past objects that refuse (e.g. other players) but never through a room surface. If there is none, the same look is tried again tilted toward the ground. If that finds nothing either, it opens on the user's own character, even past a step's selection lock.
- It is left through the toggle or the back gesture (Escape / device Back). The back gesture closes popups and closable panels first (`ClosablePanelUtil`). Leaving clears the selection.
- Selecting or deselecting never changes the mode.
- Edit mode is open to everyone. Permissions are checked per edit (see [restricted_zone.md](restricted_zone.md)).
- A single-player step can lock the mode (see [single_player_mode.md](../networking/single_player_mode.md)). The lock is checked in `GameModeUtil`, so every way of switching respects it.
- A single-player step can also pick the voxel quad edit mode opens on, in place of the look. The pick is made when the mode opens, and falls back to the look if it can't be selected.

## Selection
- A selection is a single voxel quad or object. Nothing is selected in play mode, and something is always selected in edit mode. When the selected thing is removed, the selection moves to something nearby.
- Clicking the current selection or an unselectable spot keeps the current selection.
- Each object type declares its selection behavior in `ObjectTypeClientConfig`: who may select it, the tool panel it opens, and whether it can be dragged along walls by its outline. Every selection also requires edit mode and reach. A refused click passes through silently.
- A sub-panel opened from those tools (see `EditOptionsProps`) stays open while clicks move the selection to any object whose type declares the same panel, whatever its type; selecting anything else closes it.
- The outline and camera framing come from the object's collider at the object's own size. Anyone who may select an object may also move it, dragging inside the outline, and resize it by the outline's corners if its type scales that way; a lamp instead picks one of its sizes from its tools (see [object_attachment.md](../geometry/object_attachment.md)). Each placement is validated as it previews, and the result is sent once, on release.

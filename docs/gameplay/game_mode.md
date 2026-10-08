# Game Mode

Reference: @src/client/system/util/gameModeUtil.ts , @src/client/graphics/util/worldSpaceSelectionUtil.ts , @src/client/graphics/util/selectionStepUtil.ts , @src/client/graphics/util/selectionEditGizmoUtil.ts , @src/client/graphics/types/gizmo/voxelQuadEditGizmos.ts , @src/client/object/types/objectTypeClientConfig/objectTypeClientConfig.ts , @src/client/ui/util/closablePanelUtil.ts , @src/client/ui/util/shortcutKeyUtil.ts

A `GameMode` decides the camera behavior, whether the player can walk, and which tools are shown. `GameModeUtil` publishes the current mode, and everything mode-dependent observes it.

- **Play mode**: first-person view, the player walks, and nothing can be selected. A click acts on the room: a door walks through, and any other object runs its type's callback in `PlayModeClickCallbackMap`, picked by a metadata value (a prop's by its image). Any click that hits a voxel quad or object also pitches the view toward it (see [camera_control.md](../graphics/camera_control.md)).
- **Edit mode**: the camera orbits the current selection, the player stands still, and the selection's editing tools are shown.

The mode is stored separately from camera state, because the camera briefly has no target while one selection replaces another.

## Switching
- Edit mode can only be entered through the top-bar toggle. It opens on the nearest voxel quad or object in the middle of the view that can be selected, within a limited reach, looking past objects that refuse (e.g. other players) and through a picture where its image is see-through, but never through a room surface. If there is none, the same look is tried again tilted toward the ground. If that finds nothing either, it opens on the user's own character, even past a step's selection lock.
- It is left only through the toggle, which clears the selection. The back gesture (Escape, Backspace outside a text field, device Back) closes popups and closable panels (`ClosablePanelUtil`), an open color palette before whatever it is open over, and never the mode.
- Shortcut keys stand for clicks on the controls that declare them (`ShortcutKeyUtil`): M on the toggle, Delete on the selection tools' remove button, Enter on a popup's answer (a confirm popup's Yes, a welcome popup's OK). A press reaches its control only where a click could: Enter while its popup is on top; the others not under a popup or while a text field has the keyboard, and Delete not with a panel open over the tools.
- A confirm popup takes no Yes, clicked or keyed, for a moment after it appears (`CONFIRM_ARMING_DELAY_MS`), and shows no sign of it.
- Selecting or deselecting never changes the mode.
- Edit mode is open to everyone. Permissions are checked per edit (see [restricted_zone.md](restricted_zone.md)).
- A single-player step can lock the mode (see [single_player_mode.md](../networking/single_player_mode.md)). The lock is checked in `GameModeUtil`, so every way of switching respects it.
- A single-player step can also pick the voxel quad edit mode opens on, in place of the look. The pick is made when the mode opens, and falls back to the look if it can't be selected.

## Selection
- A selection is a single voxel quad or object. Nothing is selected in play mode, and something is always selected in edit mode.
- When the selected thing is removed or hidden, or a block is added or removed, the selection moves on by one search (`VoxelQuadSelection`), starting from where the edit points:
  - the nearest voxel quad that is near enough and clear enough of attached objects (`AUTO_SELECTION_MAX_DISTANCE`, `AUTO_SELECTION_MIN_COVERAGE_FREE_RATIO`);
  - with none, an attached object near there that the user may select (`nearbyObjectSelectorObservable`);
  - failing that, whatever quad is left, the clear enough first.
- Clicking the current selection or an unselectable spot keeps the current selection.
- The movement keys (the arrows, and W, A, S and D by their places) step the selection the way they point on screen (`SelectionStepUtil`), a press at a time:
  - a face goes to the face the room's surface runs on into that way (`VoxelQueryUtil`): the face of whatever stands in its way, else the one carrying straight on, else the next one round the edge of its own block. So a step climbs from a floor onto a wall and turns corners;
  - never onto a face turned away from the camera, since no step swings the camera round to look. One such face is passed over for the face the surface runs on into beyond it (a riser, going down steps seen from above), though a face reached directly comes first; where the one beyond is turned away too, the key does nothing. A face is judged from where the camera will stand once it has slid alongside;
  - an object goes to the nearest object lying that way that the user may select, within `SELECTION_STEP_OBJECT_REACH` and not turned away from the camera. Reach and direction are both read off the gap between the two, so size doesn't count against a large one;
  - a step with nowhere to go changes nothing, and a face is never traded for an object;
  - the keys are a focused input's first, and nobody's under a popup;
  - a step of a face, or to an object facing the same way, slides the camera alongside (see [camera_control.md](../graphics/camera_control.md)), so a run of presses keeps its direction. An object facing another way is looked at from where the camera stands.
- A click takes the nearest thing **drawn** under it. Where a picture's image is see-through (around the object in a prop's), it goes on to what shows there: the face behind a prop, a canvas's board (see [texture.md](../geometry/texture.md)). The selected object's outline still takes every press inside it, so a prop is dragged by its see-through parts too.
- Each object type declares its selection behavior in `ObjectTypeClientConfig`: who may select it, the tool panel it opens, and whether it can be dragged along walls by its outline. Every selection also requires edit mode and reach. A refused click passes through silently.
- A face's tools add an object only once its look is picked, from a chooser its add button raises (a canvas's painting, a prop's image, a lamp's size, a label's frame, a door's finish): a pick adds the object, and putting the chooser away adds nothing.
- The tools' sub-panels (an object's, see `EditOptionsProps`, and a face's choosers) follow one of two flows, which `SUB_PANELS_BENEATH_SELECTION_TOOLS` picks:

  | | Off: in the tools' place | On: beneath the tools |
  |---|---|---|
  | The tool row | stands down for the panel | stays, the buttons that raise panels its toggles |
  | Putting a panel away | its close button, or a back gesture | a face's chooser by its toggle or a back gesture; an object's never, one of its type's always showing (its first to begin with) |
  | The selection moves to another object | the panel stays open if that object's type declares it too, whatever its type; anything else closes it | the panel stays if that type declares it too; otherwise that type's first shows |
  | An object just added | stays selected; a type with more to pick opens on that panel (`ObjectTypeClientConfig.installPanel`: a canvas's frame, frameless unless picked), which closing it or selecting anything else ends | stays selected; a type with more to pick opens on that panel too, as on any other of its own; otherwise, tools that open on the chooser it was picked in carry on from where that was left |
  | The same, with `DISABLE_AUTO_SELECTION_ON_OBJECT_INSTALLATION` off | the selection moves on by the same search once the object's look is complete (at once, or on the pick from that panel), so the next can be added from a face near it; picks made for an object selected later keep it selected | the selection moves on by that search at once, with more to pick or not |
- Where no face will do for that search, the new object ends up selected.
- A chooser with nothing picked yet opens on the tab and at the place where the last one for the same thing was left, edits included (see `ThumbnailPanel`); the first time, on All and at the start.
- The outline and camera framing come from the object's collider at the object's own size. Anyone who may select an object may also move it, dragging inside the outline, and resize it by the outline's corners if its type scales that way; a lamp instead picks one of its sizes from its tools (see [object_attachment.md](../geometry/object_attachment.md)). Each placement is validated as it previews, and the result is sent once, on release.

## Editing a block by its outline
- A press the selection's outline takes is a gizmo's, not the camera's (`GizmoDragUtil`). `SelectionEditGizmoUtil` owns what every kind of selection shares: the handles, which of them a press takes, and holding the view still while a drag lasts. Each kind supplies its own handles and drags (`SelectionEditGizmoProvider`).
- A kind offers only the handles a drag could resize its selection by, and says of each move whether the selection could do what the pointer asks. While it can't, the drag is blocked (`selectionEditBlockedObservable`): the outline, the handles and the cell's wireframe show red.
- A selected block face has a handle on each edge that is a bound of its block across XZ: the side edges of a wall face, all four of a top or bottom face. A handle carries its bound between the cell's side and mid-cell, and shows only where the bound has another place it may go: one that leaves a block, and strands nothing hung on it.
- A block's drag is blocked while its bound is carried on toward a place it can't take: out of its cell, or in past mid-cell.
- The face itself takes no press, so a drag that starts on it turns the view. A block is reshaped where it stands, never dragged elsewhere.
- The whole cell layer of the selected face's block is drawn as a thin wireframe (`VoxelQuadSelection`), whole block or shrunk, so it is plain which cell a shrunk block belongs to.
- A reshape that hides the selected face sends the selection to another face of the same block.
- The handles are not offered on the room's own floor and ceiling, where the user may not edit the block, or while a step holds the selection or sets `FeatureFlag.DisableManualVoxelBlockResize`.

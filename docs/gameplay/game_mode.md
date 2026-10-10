# Game Mode

Reference: @src/client/system/util/gameModeUtil.ts , @src/client/graphics/util/worldSpaceSelectionUtil.ts , @src/client/graphics/util/selectionStepUtil.ts , @src/client/graphics/util/selectionEditGizmoUtil.ts , @src/client/object/types/objectTypeClientConfig/objectTypeClientConfig.ts , @src/client/ui/util/closablePanelUtil.ts , @src/client/ui/util/shortcutKeyUtil.ts , @src/client/system/util/clientEventHistoryUtil.ts , @src/client/system/util/roomEditUtil.ts

A `GameMode` decides the camera behavior, whether the player can walk, and which tools are shown. `GameModeUtil` publishes the current mode, and everything mode-dependent observes it.

- **Play mode**: first-person view, the player walks, and nothing can be selected. A click acts on the room: a door walks through, and any other object runs its type's callback in `PlayModeClickCallbackMap`, picked by a metadata value (a prop's by its image). Any click that hits a voxel quad or object also pitches the view toward it (see [camera_control.md](../graphics/camera_control.md)).
- **Edit mode**: the camera orbits the current selection, the player stands still, and the selection's editing tools are shown.

The mode is stored separately from camera state, because the camera briefly has no target while one selection replaces another.

## Switching
- Edit mode can only be entered through the top-bar toggle. It opens on the nearest voxel quad or object in the middle of the view that can be selected, within a limited reach, looking past objects that refuse (e.g. other players) and through a picture where its image is see-through, but never through a room surface. If there is none, the same look is tried again tilted toward the ground. If that finds nothing either, it opens on the user's own character, even past a step's selection lock.
- It is left only through the toggle, which clears the selection. The back gesture (Escape, Backspace outside a text field, device Back) closes popups and closable panels (`ClosablePanelUtil`), an open color palette before whatever it is open over, and never the mode.
- Shortcut keys stand for clicks on the controls that declare them (`ShortcutKeyUtil`): M on the toggle, Delete on the selection tools' remove button, Enter on a popup's answer (a confirm popup's Yes, a welcome popup's OK). A press reaches its control only where a click could: Enter while its popup is on top; the others not under a popup or while a text field has the keyboard, and Delete not with a panel open over the tools (`ClosablePanelUtil`). A face's chooser beneath the tools is not over them, so Delete still removes the block.
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
- A **volume** (see [single_player_mode.md](../networking/single_player_mode.md#rooms)) has no surface to click, which would stand in the way of everything inside it. In edit mode, whoever may edit one (see [restricted_zone.md](restricted_zone.md#volumes)) sees each as the dim outline of its box under its name, with a button over its top. Only that button selects it: no click on the box does, and no key step leads onto it. Selected, its outline is the selection's own.
- A face's tools add an object only once its look is picked, from a chooser its add button raises (a canvas's painting, a prop's image, a lamp's size, a label's frame, a door's finish): a pick adds the object, and putting the chooser away adds nothing. Selecting another face puts it away.
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

## Editing a selection by its outline
- A press the selection's outline takes is a gizmo's, not the camera's (`GizmoDragUtil`). `SelectionEditGizmoUtil` owns what every kind of selection shares: the handles, which of them a press takes, and the view while a drag lasts (held still, or following the pointer that carries a selection to its edge; see [camera_control.md](../graphics/camera_control.md)). Each kind supplies its own handles and drags (`SelectionEditGizmoProvider`).
- A kind offers only the handles a drag could resize its selection by, and says of each move whether the selection could do what the pointer asks. While it can't, the drag is blocked (`selectionEditBlockedObservable`): the outline and the handles show red.
- A selection further from the camera than `SELECTION_HANDLE_MAX_DISTANCE` has no handles, since they keep their size on screen and would crowd it. The one a drag holds stays, and an object still moves by its inside. A kind may keep its handles at any distance, as a volume does, being seen whole only from afar.
- Attached objects supply them (see [object_attachment.md](../geometry/object_attachment.md)), and so does a volume: one at each corner of its box. A drag carries the corner across the side of the box that faces the camera most squarely, a block at a time, while the opposite corner holds still. A volume is resized only, never moved whole.
- A block face's outline takes no press, so a drag that starts on it turns the view.

## Undo and redo
- In edit mode Ctrl+Z undoes the latest thing the user did there, and Ctrl+Y or Ctrl+Shift+Z redoes the one last undone (`KeyPressUtil`; Command stands in for Ctrl). A press is one step, and a held chord doesn't repeat. The keys reach the room where the HUD's keys do, and not during a drag of the selection; in a text field they are the field's own.
- What can be undone is of two kinds, taken in the order they were made:
  - an edit by the selection's tools or outline: a block added, removed with what hung on it, or retextured; an object added, removed, moved, resized, turned or given another value. Room settings and the user's own character are not;
  - a selection the user made by hand: a click on a face or an object, or a movement key's step. Not one the user didn't make: what edit mode opens on, or where a tool or somebody else's edit moves the selection.
- Each is entered in `ClientEventHistoryUtil` as a `ClientEvent` that carries how to undo and redo it. The history lasts one stay in edit mode: it starts over as the mode ends, and so on every room arrival.
- A new edit or selection ends what could be redone. A text typed into a field is one edit, not one for each letter.
- `RoomEditUtil` builds how to undo and redo an edit from signals: the ones the edit was sent by, and the ones that take it back. A step makes those signals' edits as the user's own: checked by the shared rules, applied, then sent. So the server and the other users see ordinary edits, and one step can be refused like any other.
- An edit the room no longer allows (something hung on the block since, a restricted zone laid over it) is dropped with a notification, and the next press reaches the step before it.
- The selection goes back with an edit while it is still where the edit's other end left it, as a step back through the history finds it: onto the face a block or object was added from, or onto an object whose removal is undone. Where something else has moved it since, it stays, or moves on by the usual search if the step took it away or covered it.
- A selection made by hand is announced by `WorldSpaceSelectionUtil` (`manualSelectionObservable`), with what it left and what it took. Undone, what it left is selected again; redone, what it took: as a click on it would, except that the camera slides alongside where the selection's own step had it slide (see [camera_control.md](../graphics/camera_control.md)).
- A selection whose place is gone, hidden or selected already is passed over without a word, and the same press goes on to the step before it.
- A single-player step can block undo and redo (`FeatureFlag.DisableUndoRedo`), which the tutorial does throughout.

# Camera Control

Reference: @src/client/object/components/playerController.ts , @src/client/object/components/helpers/player/playerCamera.ts , @src/client/object/components/helpers/player/firstPersonCameraPose.ts , @src/client/object/components/helpers/player/orbitCameraPose.ts , @src/client/object/components/helpers/player/orbitOcclusionHider.ts , @src/client/object/components/helpers/player/playerPointerInput.ts , @src/client/graphics/util/gizmoDragUtil.ts , @src/client/graphics/util/worldSpaceSelectionUtil.ts

![Player Control Scheme](figures/player_control.jpg)

Only the user's own player has a `PlayerController`. It reads input, steers the player's `Rigidbody`, and drives `PlayerCamera`. The camera updates in the components' late pass, after this frame's input and physics.

## Input
- `PlayerPointerInput` arbitrates canvas pointer gestures:
  - Gizmo drags (`GizmoDragUtil`): every press is offered to the registered drag sources first (e.g. the selected attached object's outline). A press one takes never reaches the camera or reads as a click; it becomes a drag only past the tap tolerance, and is cancelled otherwise. Hovering shows the cursor of what a press would take.
  - `PointerDragInput`: one held pointer. It exposes a joystick offset (for steering) and a 1:1 per-frame delta (for orbiting). Its tap-versus-drag tolerance depends on the pointer type.
  - `PointerZoomInput`: pinch or mouse wheel, reported as a **scale factor** rather than a distance.
  - Click: a press that did not move, raycast through `CameraUtil` to find the clicked object.
  - A second finger cancels the drag, and any finger lifting ends it.
- `FirstPersonKeyInput`: smoothed movement keys, ignored while a UI input has focus.
- **Steering**: in first person, horizontal input yaws the player and vertical input sets forward velocity. In orbit, the player stands still and a drag orbits the camera.

## Camera modes
`cameraModeObservable` publishes a `CameraMode`:
- **firstPerson** (play mode): the camera sits at eye level.
- **orbit** (edit mode): the camera orbits a **target volume** (not a point) that travels with the mode. The volume's extent sets the framing distance and what must be cleared from view. Target volumes come from the physics colliders.

`WorldSpaceSelectionUtil` points the orbit at the current selection. A voxel quad frames its block, and an object frames itself; the target follows the object's live position, so the orbit moves with it. While a gizmo drag moves or resizes the selection, the target is held as a copy, so the view stays still under the pointer, and it is traded back for the live one on release. A selection dropped mid-edit leaves the camera where it is. A single-player step can override the target, request view angles, or zoom the camera into a distance range that holds for every point of the target at any angle.

Selection reach is a fixed arm's length in first person. While orbiting, it extends to the camera's distance, so anything visible can be selected.

The user's own body is shown only in orbit mode when the camera is not inside it, and never while a single-player step hides it. Hidden parts are parked out of the room, so raycasts pass through them. Other players are hidden while they are too close to the camera.

## PlayerCamera
The camera is parented to the player object. Each frame, the active pose helper supplies a target pose in the player's frame and the camera eases toward it, so mode and target changes glide rather than snap.

- **`FirstPersonCameraPose`**: pitch is the only freedom. It tilts down according to how far the visible room ahead drops below the player's standing level (`ClientVoxelQueryUtil`). Open space overhead is ignored, so storeys behave the same as the ground floor. While falling (nothing solid under the feet within a gap deeper than a stair, probed through the physics colliders), it looks fully down instead, since the drop ahead shrinks on the way down and would lift the gaze. After landing, the gaze rises back from wherever the camera got to at a slower rate than it looks down; only rising is slowed, so a drop ahead can still pull it down straight away.
- **Trailing physics**: in first person, the part of each move that physics made rather than the steering (a step climbed, a drop, a push; reported by `Rigidbody`) is trailed on a critically damped spring, outside the pose easing. Steering is followed exactly, so walking never lags, and so is a move held back by a wall or a crowd, so the camera never goes where the body couldn't.
- **`OrbitCameraPose`**:
  - The drag maps 1:1 to orbit angles, with the polar angle clamped away from the poles. The aim point sits slightly above the target's center, by a share of its height.
  - The framing distance scales with the target's size, and a selection can require a minimum distance (a block or wall object is framed with its surroundings). Zoom is a multiple of the framing distance, published logarithmically through `orbitCameraZoomObservable` for the zoom slider, whose middle is the framing distance. The range covers edit mode's opening reach (see [game_mode.md](../gameplay/game_mode.md)), so an orbit can start from there without moving the camera.
  - Zooming in stops a small clearance short of the target's side facing the camera (its extent along the view, not its bounding sphere), so the camera comes right up to tall or wide targets without clipping them.
  - An orbit starts at the camera's **current** distance and direction, unless the camera is inside the target's footprint (e.g. orbiting the user's own body), in which case it uses an over-the-shoulder default. Zoom persists across targets and resets when edit mode ends.
  - Angles are published in world terms (`orbitCameraAnglesObservable`). A requested view is applied right after the target is framed.
  - The orbit is computed in world space and converted into the player's frame, which avoids re-parenting mid-glide.
- The head light stands at a point on the view axis, at most a fixed distance in front of the eased camera: the camera itself up close, otherwise a stand-in for a player standing near the subject. The fog is measured from there too, and so is the room light the head light yields to. Nothing about them grows with the camera's distance, and the far plane is fixed wide enough for the whole room from any orbit (`GraphicsManager`).

## Clearing the line of sight (`OrbitOcclusionHider`)
While orbiting, anything that blocks the target is hidden.
- **What can be hidden**: objects with an `OrbitOccluder` component (walls, floor, ceiling, doors, pictures) and voxel blocks. Characters and gizmos are never hidden.
- **Sampling**: the target is covered by a grid of sample points on its surface as the camera sees it. Each ray is pushed past its aim point to land on the target's surface. Samples on faces that are permanently walled in (a buried block side, the back of a picture) are dropped. A candidate is hidden if it blocks more than a small share of the surviving samples.
- **Candidates**: voxels are found by sweeping the target's box toward the camera through the grid, and a blocking block is hidden whole. Other meshes are raycast along the samples, and a hit hides the entire object.
- **Exemptions**: a voxel target spares its neighboring blocks and anything attached to them. Any other target spares only its own volume.
- Checks follow the eased camera and are throttled (frequent while moving, rare at rest). The speech bubble of the framed character trusts this result instead of running its own occlusion test.
- **Hiding** parks individual instances through `InstancedMeshBinding` (see [instanced_mesh_composition.md](instanced_mesh_composition.md)). Everything is restored when the orbit ends or the player object is removed.

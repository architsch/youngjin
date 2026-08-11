# Camera Control

Reference: @src/client/object/components/playerController.ts , @src/client/object/components/helpers/player/playerCamera.ts , @src/client/object/components/helpers/player/firstPersonCameraPose.ts , @src/client/object/components/helpers/player/orbitCameraPose.ts , @src/client/object/components/helpers/player/orbitOcclusionHider.ts , @src/client/object/components/helpers/player/playerPointerInput.ts , @src/client/object/components/helpers/player/pointer/pointerDragInput.ts , @src/client/object/components/helpers/player/pointer/pointerZoomInput.ts , @src/client/object/components/helpers/player/pointer/pointerClickRaycaster.ts

## Overview

![Player Control Scheme](figures/player_control.jpg)

The user's own player object carries the `PlayerController` component (only the user's own player is allowed to have it). It gathers the user's inputs, steers the player's movement, and drives the player camera through a set of helper modules:

- `PlayerPointerInput` — watches the game canvas for pointer activity, independently of the camera mode, and hands each event to the module that reads that kind of gesture (see below).
- `FirstPersonKeyInput` — turns the movement keys into smoothed steering input, accelerating toward the pressed direction, and ignoring keystrokes while a UI input element is focused.
- `PlayerCamera` — owns the camera itself (see below).

Each frame, the controller updates the input helpers before the camera, so the camera reacts to the same frame's drag.

### Pointer Gestures

The gestures a pointer can make on the canvas are not distinguishable event by event — a drag and a pinch are the same events until a second finger arrives, and a click is only a click by virtue of the drag that did not happen — so `PlayerPointerInput` listens in one place and holds the arbitration between them, while a module per gesture holds the reading of it:

- `PointerDragInput` — one pointer moving while held down. It exposes the drag in two readings, since the two things it drives want different ones: a joystick-style offset from the press point (used for steering), and a grab-style per-frame delta that follows the pointer 1:1 (used by the orbit). It also answers whether the gesture that has just ended stayed still enough to count as a tap rather than a drag, measured against the kind of pointer that made it — a finger is a far coarser pointer than a mouse, and holding it to a mouse's precision would make an ordinary tap read as a drag.
- `PointerZoomInput` — two fingers pinching, or the mouse wheel. Both are reported as one reading, since they mean the same thing. That reading is a *scale of what the user sees* rather than a change of camera distance: a pinch grabs the view and a view that is grabbed is expected to follow the fingers, and being a multiple also keeps a wheel notch meaning the same thing at every distance, where a fixed length added or subtracted would be a leap up close and imperceptible from far away.
- `PointerClickRaycaster` — a press and release that stayed in one place, raycast into the scene to notify the game object drawn under it.

A second finger settles what a gesture is: the drag is given up on, since reading the same fingers as both a drag and a pinch would spin the view while it is being zoomed. Likewise, any finger leaving ends the drag rather than letting it carry on with whichever finger is left, which is nowhere near where the drag it would inherit began.

## Steering

Steering input (pointer drag + keys) accumulates into a horizontal and a vertical component. In the first-person mode, the horizontal component yaws the player object around the vertical axis, while the vertical component pushes the player forward or backward along its facing direction — expressed as a desired velocity on the player's `Rigidbody`, so the physics engine resolves the actual motion. In the orbit mode the player stands still: the desired velocity is zeroed, and drag input orbits the camera instead.

## Camera Modes

The active mode is a `CameraMode` value published through `cameraModeObservable`:

- **"firstPerson"** — the default gameplay mode. The camera sits at the player's eye and looks where the player faces.
- **"orbit"** — an inspection mode in which the camera pulls back from a target anywhere in the room and looks right at it, so the user can see it from any angle.

The mode carries its own target rather than having it published separately, so the camera can never be left orbiting around something other than what it was pointed at. The target is a *volume*, not a point: its center is what the camera orbits around, while its extent decides how far back the camera sits and how much of the room has to be cleared out of the way.

The user's own body — and the speech bubble hanging over it — is in view only while the camera orbits the character himself. First-person hides it so it never clips the camera, and so does an active selection, since the camera then circles the selection from angles that keep putting the character in front of the very thing he is editing; character customization is the one orbit that is about the body, and nothing can be selected while it is open. `PlayerGameObject` watches the camera mode and both selections to decide this. (Other players' bodies are governed by proximity instead: a player who comes too close to the user is temporarily hidden so it does not clip through the camera.)

### What puts the camera into an orbit

- **Character customization.** While the player-customization UI is open, the camera orbits the user's own body, so the character can be seen from any side as it is edited (see [player_customization.md](../geometry/player_customization.md)).
- **A world-space selection.** Selecting a voxel-quad puts the camera into an orbit around the whole voxel block that quad belongs to (or around the room's floor/ceiling tile, which belongs to no block); selecting an object orbits that object. This is what makes room editing bearable: the user can walk up to a wall, select a face, and then look at it — and at what is being built onto it — from any angle without having to reposition the player. Dropping the selection (the selection's close button, the back gesture, or selecting the same thing again) returns the camera to the first-person view.

Circling a selection is an editing convenience, and it costs the user the run of the room while it lasts. So it is offered only to a user who may actually edit the room (`RoomValidationUtil`): for anyone else, selecting something leaves the camera in the first-person view, which pitches toward the selection as it always has.

### How far the user can reach to select

A click only selects what it lands on if that is close enough to the camera, so that a click cannot pick out something across the room that the user can barely make out. Ordinarily this reach is an arm's length into the room, a fixed distance. But an orbit around a selection is the user's to move: he may take the camera right back to see what he is editing among its surroundings, and everything he has thereby brought into view is something he expects to be able to click. So while the camera orbits a selection, the reach follows the distance the camera has been taken to, and whatever he can see he can select. `WorldSpaceSelectionUtil` decides this, and every object that can be selected asks it rather than measuring for itself.

Both volumes are taken from the physics side, which is where the volume that every other system means by "this block" or "this object" is already defined.

## PlayerCamera

`PlayerCamera` attaches the global camera to the player object, so the camera inherits the player's position and yaw automatically. Every frame it asks the active mode's pose helper for a desired pose (a position and rotation in the player's frame) and eases the camera toward it. Because both modes feed the same interpolation, switching modes — and re-pointing the orbit at something else — glides the camera from one framing to the other rather than snapping.

### First-Person Pose (`FirstPersonCameraPose`)

The camera rests at the player's eye level, and its pitch is the only degree of freedom, chosen automatically:

- **View target.** When the player has an active view target (published through `playerViewTargetPosObservable`, e.g. the position of a selected voxel-quad or object), the camera pitches up or down toward it, within a clamped range, so the target stays in focus. If the target remains outside the camera's view frustum for a short duration, the selection is automatically cleared so that the camera can recover its neutral pitch.
- **Altitude.** With no view target, the pitch follows the player's altitude: the higher the player stands above the floor, the more the camera tilts downward, giving an overview of the room; at ground level it looks straight ahead.

### Orbit Pose (`OrbitCameraPose`)

The camera orbits around the center of the mode's target and looks at it. Grab-style pointer drags rotate the orbit angles 1:1 with the pointer's movement (like Three.js's OrbitControls), with the polar angle clamped away from the poles so the camera never ends up directly above or below the target. How far back it sits follows the target's own size, which is what lets the same orbit frame a whole character and a single block without either filling the screen or being lost in it.

That framing distance is a reference rather than where the camera actually ends up. A pinch or a wheel scales the view around the target, within a range on either side of the framing distance, so the user can lean in on a detail or pull back for the room around it. The zoom is expressed as a multiple of that distance rather than as a distance in its own right, which is what lets it mean the same thing whatever is being framed. It is published as a position within that range (`orbitCameraZoomObservable`), which is what lets the on-screen zoom slider — shown beside the mode's exit button for as long as the camera orbits — both show it and set it, so a pinch or a wheel notch moves the handle exactly as dragging it would. That position is logarithmic in distance, so a step of the slider means what a notch of the wheel means anywhere in the range.

An orbit *begins* at the distance the camera already stands at, not at the framing distance. Where the user stood when he pointed the camera at something is a view he chose — he walked up to the wall he is editing, or stayed back to take it in whole — and pulling him to a fixed distance from it throws that choice away and leaves him zooming back to where he already was. (A camera standing within the target's own footprint has no distance of its own to keep, any more than it has a direction to keep, and starts from the framing distance instead; that is the character-customization case.) From there the zoom is the user's, and it survives the orbit being pointed at something else, since how close he wants to look is a preference he expressed rather than a property of what he was looking at. Leaving the mode drops it: the next orbit begins from wherever he is standing then. Whatever the zoom is asked for, the camera stays within the range above and outside the target itself, from within which there would be nothing left to inspect.

Whoever points the camera may also ask for a minimum distance of its own, which is what a selection does. Sizing the framing to the target answers "how big does this look", and that is the wrong question for a block or a picture being edited in place: what it is *part of* — the wall it belongs to, the room it stands in — is what the edit is judged against, and none of it is in view from arm's length. Framing a character is the opposite case, and asks for nothing beyond its size. Since the framing distance is what the zoom range is measured against, asking for a larger one also gives the user a longer leash on either side of it.

The light the room is lit by rides with the camera, so it follows the orbit out: its range grows with the distance the camera has been taken to, and its intensity grows with its range by exactly the falloff it decays by. It is eased on the same terms as the camera, since the pose is where the camera is *headed* — a light that answered the pose directly would light the target as if from the new distance while still standing at the old one, flaring on every notch of a zoom. A light sized for the player's own eye simply goes out past its range, which would leave a target the user has pulled back from lit by nothing but the ambient light; widening the range alone would only spread the same light more thinly. Between them, what is being framed stays as bright as it was from up close.

The orbit is described in world space, while the camera hangs off the player object — which is what makes the first-person view follow the player's eye for free. The orbit pose is therefore converted into the player's frame, the frame both modes are eased in, rather than the camera being taken off the player for the duration of the mode: expressing one pose in another frame costs a pair of conversions, whereas re-parenting mid-glide would split the easing across two frames of reference.

Each time the mode is entered, and each time it is pointed at something else, the camera keeps the direction it already views the new target from. Swinging around to a fixed side of the target instead would, for a target inside a wall, mean jumping to the far side of that wall. A camera that stands within the target's own footprint has no such direction to keep — which is the case when the user orbits his own body — and gets a default framing instead: above, slightly off to the side, and out front of the player, looking back at it.

### Clearing the Line of Sight (`OrbitOcclusionHider`)

Since the orbit swings freely, the camera regularly ends up with a wall, the ceiling, a canvas, or another player between itself and what it is framing — and the mode exists precisely so the user can see that. So, while the orbit is active, whatever stands in the way is hidden until it no longer does.

Standing in the way is a matter of degree, however, and emptying something's place in the room is a heavy-handed answer to it: geometry that clips a corner of the target costs the user next to nothing, while geometry that covers the target costs him the whole point of the mode. The target is therefore reduced to a grid of sample points spread over its silhouette *as the camera sees it* — the whole target rather than a line to its middle, since a wall block is a fraction of a body's height and clearing only what a central ray crosses would leave most of the body behind the wall — and every candidate is judged by how many of those samples it stands in front of, i.e. by the share of the target it actually takes away. Only what covers a fair share is hidden; everything else keeps its place, however near the line of sight it passes.

Where those samples sit matters as much as how many of them there are. Each is placed where the camera's own ray toward it first meets the target, so that it stands on the target's surface with a clear line back — and a sample that lands on a face the room's geometry is pressed flat against is dropped rather than counted, since it stands for a part of the target that is out of sight whatever the camera does about it. Sampling the inside of the target instead would misjudge everything the target is embedded in: a selected block belongs to a wall and a picture hangs flat on one, so a point taken from within either lies behind that wall's face, and its line back to the camera runs away down the length of the wall — condemning block after block of it, none of which stands in front of anything the user could see. How much of the target counts as "enough" is measured against however many samples survive, so it stays a share of what is actually on view.

Candidates are gathered by two different means, because their costs are nothing alike:

- **The room's own geometry.** The target's box is first swept toward the camera through the voxel grid, which settles almost all of a room's worth of voxel quads in one cheap test each — far too many to raycast repeatedly — and only the solid blocks and floor/ceiling tiles that survive that pass are measured against the samples. A block found to be in the way is hidden whole, so the target is seen through a clean opening rather than through a single missing face.
- **Everything else.** Canvases, doors, and players are found by raycasting the remaining meshes — few enough to raycast cheaply — along the samples themselves. What a ray strikes counts against the whole object it belongs to rather than the piece struck: a player is drawn as the set of parts he is composed of, so those parts cover the target together, and taking away only the part a sample happened to land on would leave the rest of the body standing in front of the target.

Whatever the orbit is looking *at* is exempt from both: the block the target's center falls in, every block touching that one (diagonals, and the layers above and below, included), and anything whose own volume reaches into that neighbourhood. What is being framed is rarely alone in its block — a selected face belongs to a wall, and a picture hangs on one — so hiding its surroundings would take away the very thing the user asked to look at. The user's own body falls under the same exemption whenever it stands that close to what is being framed, which is what keeps it in view while the camera orbits the character itself; anywhere else, it is hidden like anything else that gets in the way.

Both means follow the eased camera, i.e. the one actually rendered, and are paced rather than run every frame — promptly once the camera has moved, slowly while it rests, which is when only a moving occluder could change the answer. The raycasting half shows what it hid before looking again, since a hidden instance is parked out of the room where no ray can reach it; the grid half needs no such thing, as the grid describes the room regardless of what is currently drawn.

Hiding an occluder is not simply a matter of switching a mesh off. Bodies, walls, and canvases are each drawn as instances of a shared instanced mesh, and a mesh's visibility governs its whole draw call — switching it off would take every other object drawn from it down as well. A single instance is therefore hidden by parking it out of the room, through `InstancedMeshBinding`, which holds on to the transforms its owner keeps baking meanwhile instead of drawing them. The owner runs its usual display/hide lifecycle throughout, unaware that anything is going on, and gets its instance back wherever it last asked for it. Whatever is hidden is shown again when the orbit mode is left, or when the player object goes away.

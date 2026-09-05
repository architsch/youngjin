# Restricted Zones

Reference: @src/shared/voxel/types/restrictedZone.ts , @src/shared/voxel/util/restrictedZoneUtil.ts , @src/shared/room/util/roomValidationUtil.ts , @src/client/ui/components/input/restrictedZonesSection.tsx , @src/client/voxel/util/restrictedZoneOutlineUtil.ts

## Why they exist

Rooms are joined to one another by doors, so a pair of connected rooms reads as a pair of rooms side
by side. That reading survives only as long as the wall between them looks like a wall. A hole cut
through a boundary wall says that what lies beyond it is open sky — which is the opposite of what the
room next door is — and once the scene's background is a view rather than blackness, it says so
plainly.

A room's owner has a second reason to want the same thing: to hand visitors part of his room to build
in while keeping the rest of it to himself. Collaboration and privacy in one room, drawn as a line
across the floor.

A **restricted zone** is that line. It is a rectangular stretch of the room within which the right to
change anything belongs to one person, and everybody else may look but not touch.

## What a zone is

A rectangle on the room's plan, reaching from the room's floor to its ceiling. Its height is not a
choice, because what a zone protects is the room's shape as seen from outside it: a zone that stopped
partway up would leave the wall above it open to exactly the hole it was drawn to prevent.

A room may hold a small number of them. The cap is about how many a person can keep track of on a
plan rather than about what the room could carry.

## Who a zone does not apply to

The **superuser** — the person the room answers to. Who that is depends on the kind of room, because
the answer comes from a different place in each:

- In a **Hub**, which belongs to the game rather than to anybody in it, the superuser is an admin
  (see [admin.md](admin.md)).
- In a **Regular** room, which belongs to one person, it is that person — its owner (see
  [my_room.md](../networking/my_room.md)).
- In a **single-player** room there is nobody but the player, so there is nobody a zone could be
  protecting the room from.

`RoomValidationUtil` is where this is asked, alongside every other question about what a user may do.

## What is forbidden inside one

For anybody who is not the superuser:

- Adding, removing or moving a voxel block.
- Repainting a face of the room — **except** the faces along the zone's own outermost edge, which are
  the surface the zone is seen through from outside it. Holding a wall shut is a different thing from
  choosing what it is finished in.
- Adding, moving or removing an object the room keeps, or changing what it shows. What a picture
  hanging inside a zone shows is as much a part of that stretch of the room as the wall behind it, so
  it goes out of reach along with the wall. Something the room does not keep — a player walking
  through — is never in question: a zone says who may build here, not who may stand here.

Moving a kept object *out* of a zone is refused along with moving one in, since allowing the way out
would leave the removal rule undone in two steps instead of one.

Drawing a zone over something already standing there does not take it away. It stops anybody else
touching it.

Every one of these is asked through the same two modules every other edit goes through, on the client
and on the server alike, so a client talked into ignoring a zone is turned away by the server on the
same grounds.

## What is not forbidden inside one

**Picking something out.** A zone forbids editing and nothing else, and selecting a face or an object
is not an edit — it is how the user finds out what the thing is. Edit mode itself is likewise open to
anybody who may edit the room at all, whatever the selection happens to be standing in.

What a zone withholds is answered by the tools a selection opens, each of which turns itself down on
its own: the buttons that would change the block work grey out, and so do the strip of textures that
would repaint the face and the choosers that would change what a picture shows. That is the same way
every other unaffordable action in this UI already answers, so something inside a zone reads as
something there is nothing to be done to rather than as a click that went nowhere.

A zone drawn over what the user already has picked out reaches those tools without his touching
anything: the selection is announced afresh whenever the room changes under it, so the tools work
themselves out again against the room as it now stands.

## Where a zone is seen

**On the room itself**, while the room is being edited: a red border painted around every face of
every voxel a zone stands over, so a zone is seen as the block work it has actually taken over. The
outermost faces are outlined along with the rest — they may still be repainted, but the block behind
them may not be removed, and what is being shown is where the zone is rather than one rule at a time.

The border is painted by the material the room's faces are already drawn with, told per face whether
to draw one, rather than by a second thing laid over the room. Everybody in edit mode is shown them,
not only the superuser whose zones they are — the person a zone applies to is precisely the one who
needs to see where it is.

**On the room's plan**, in the room's settings form, where the superuser draws them: a grid of the
room seen from above, with each zone as a rectangle that is dragged about by its middle and resized by
handles on its edges, the way a selection is dragged around an image editor. Every edge snaps to a
voxel, and the room is told only once the user lets go.

The plan is drawn at a size a fingertip can work at rather than fitted to the panel, so the panel
scrolls — by its bars, or by dragging the plan itself anywhere a zone is not.

## How a change travels

A zone change is sent as the room's whole list of zones rather than as the one zone that changed.
Drawing one, dragging one, resizing one and taking one away are then the same message, none of them
needs a way to name a zone, and two people editing the same room's zones at once resolve to the last
one to speak rather than to two half-applied edits meeting in the middle. The list is small enough
that this costs nothing.

The zones are stored with the room's voxels, in the same blob, so a room arriving at a client arrives
with its zones already on it and only the incremental change travels separately (see
[voxel_grid_update.md](../networking/voxel_grid_update.md)). A zone edit marks the room to be saved
by the ordinary periodic save rather than writing it out on the spot — a zone is dragged about, and
each frame of that is not worth a room's worth of storage.

## What a generated room comes with

Nothing. Every room is born with no zones, and that is generation's decision rather than an omission:
a zone is a judgement about which stretch of one particular room its owner means to keep to himself,
and there is nothing generation could draw that would be that judgement (see
[room_generation.md](../geometry/room_generation.md)).

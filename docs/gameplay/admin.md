# The Admin Privilege

Reference: @src/shared/room/util/roomValidationUtil.ts , @src/shared/object/types/objectTypeConfig/doorObjectTypeConfig.ts , @src/server/room/util/spawnHotspotUtil.ts , @src/server/user/util/userIdentificationUtil.ts

## Why it exists

Rooms are joined to one another by doors, and a world of many rooms is therefore a graph: each room a
point, each pair of doors between two rooms an edge. Nothing can draw that graph for us. Which rooms
should lead where, what each way through should be called, and where a traveller should come out are
questions about how the world reads to somebody walking it — so they are made by hand, from inside
the game, by a user who has been given the **admin** privilege.

Being an admin is a property of the person, granted by hand in the database and by nothing in the
product, and it means the same thing wherever he stands — unlike owning a room, which is a fact about
one particular room and says nothing anywhere else.

## What an admin may do

- **Lay a room's doors.** Put one up on any wall wide enough, slide it along the wall or up and down
  it, take it down, and set what it says, what that is written in, and where it goes.
- **Finish a door.** Choose the three colours a door is made of, the same way a user finishes his own
  character (see [door_design.md](../geometry/door_design.md)).
- **Open a new hub.** Hubs are the rooms the game hands to everybody and the thoroughfares the world
  is built out of. One is normally opened by the server when every existing hub is too crowded (see
  [room_population.md](../networking/room_population.md)); an admin opens one because he needs
  somewhere new to lead.
- **Re-skin a hub.** A hub belongs to nobody, so its texture pack is nobody's to change but an
  admin's.
- **Draw a hub's restricted zones.** A hub is everybody's to build in, which is exactly why the parts
  of it that hold the world together — the walls it shares with the rooms it leads to — have to be
  somebody's to hold shut (see [restricted_zone.md](restricted_zone.md)).

**Doors are a Hub-only tool.** A Regular room belongs to one person, and keeps the one door
generation gave it — an admin shapes the world out of the rooms the game owns rather than
rearranging the way into somebody's own room.

Everything else an admin does, he does as any user would. A Hub is already editable by anyone, so an
admin builds and hangs pictures in one on the same terms as everybody else.

## Where the privilege is checked

In one place, `RoomValidationUtil`, which every other check reads. Two questions are asked there:
whether the user is an admin at all, and whether the doors of *this* room are his to lay. Every door
operation — putting one up, taking one down, moving it, changing anything it carries — goes through
the second, and it is asked on the client and on the server alike, from the object type config a door
is described by.

The HTTP routes an admin uses ask the same question their own way, since a request arrives with no
room attached: the user's type is re-read from the database on every request (see
`UserIdentificationUtil`), so what the browser claims about itself never enters into it.

## What a door means

The semantics an admin is setting are described in
[room_entrance.md](../geometry/room_entrance.md) — what a door carries, how a traveller's arrival
point is chosen from the doors a room holds, and what a door with no destination does.

Two of them are worth restating here, because they are what a world is actually built out of:

- **A label is a name to be found by**, not only text on a plate. Pointing one door at another names
  it, and the destination room is searched for a door by that name when the traveller arrives. Two
  doors may share a name on purpose — several ways into the same place, one of them drawn at random.
- **A room's own way in is also its way out.** The door generation gives every room is marked as one
  the room offers arrivals, and it leads nowhere until somebody points it somewhere; rather than
  shutting a visitor in, it falls back on taking him out to a hub. A door an admin hung and has not
  yet wired up says it is locked instead, since that is what it is.

## Reaching the admin UI

There is no admin mode to enter. What an admin has is a few more things on screen in the places they
belong: an extra option when a wall is selected, a door that can be picked out rather than only
walked through, and a room-settings button in a room nobody owns.

Picking a door out puts him in edit mode along with it. There is nothing else he would pick one out
for — a door he only meant to go through he goes through — so the tools come out with the door
rather than leaving him holding one and looking for the way to the tools. Going through the door is
then one of those tools, since a door being worked on is still a door.

Locally, the development server seeds an admin among its dev users, reachable through the
`?devuser=` query parameter (see [local_dev.md](../devOps/local_dev.md)).

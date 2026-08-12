import ManualEditKind from "../../../shared/system/types/manualEditKind";
import RoomRuntimeMemory from "../../../shared/room/types/roomRuntimeMemory";
import { manualEditCountsObservable, roomChangedObservable } from "../clientObservables";

// The tally of what the user has changed with his own hands (see manualEditCountsObservable). Kept
// by whoever carries out such a change, and read by whoever needs to know that the user has done a
// thing at all rather than that the world has ended up a particular way — a scripted step teaching
// an edit, where the user picks what to edit and the act itself is the lesson.
const ManualEditCountUtil =
{
    count: (kind: ManualEditKind) =>
    {
        manualEditCountsObservable.change(
            (counts) => ({...counts, [kind]: counts[kind] + 1}));
    },
    getCount: (kind: ManualEditKind): number =>
    {
        return manualEditCountsObservable.peek()[kind];
    },
}

// The tally is about what the user has done *here*, so it starts over with every room he arrives in.
// It watches for that itself rather than being reset by whoever loads the room, since what it counts
// reaches beyond any one of them — the room's voxels and the user's own character alike.
roomChangedObservable.addListener("manualEditCount", (_roomRuntimeMemory: RoomRuntimeMemory) => {
    manualEditCountsObservable.set({
        voxelBlockAdded: 0,
        voxelBlockRemoved: 0,
        voxelQuadTextureChanged: 0,
        playerPartChanged: 0,
    });
});

export default ManualEditCountUtil;

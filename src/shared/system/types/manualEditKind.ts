// The kinds of edit the user can make by hand, each of which the client keeps a running tally of
// (see manualEditCountsObservable). A scripted step teaching one of these waits for the tally to
// move rather than for a particular cell of the world to end up a particular way, since the user
// picks what to edit and the lesson is the act itself.
type ManualEditKind =
    | "voxelBlockAdded"
    | "voxelBlockRemoved"
    | "voxelQuadTextureChanged"
    | "playerPartChanged";

export default ManualEditKind;

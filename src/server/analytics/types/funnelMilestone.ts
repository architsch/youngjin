// Funnel steps in order. One letter each, stored as a string on the user row (like FTUE, but never
// reset). Counted once per account. Codes are permanent.

export type FunnelMilestone = string;

export const FunnelMilestoneEnumMap: Record<string, FunnelMilestone> =
{
    // Arrived at the site and was given an account. The denominator for everything below.
    Arrived: "a",
    // Left the tutorial, by finishing or skipping it.
    TutorialDone: "t",
    // Multiplayer rooms only (the tutorial is single-player).
    EnteredRoom: "r",
    // Sent a voxel or object edit (chat excluded; see Chatted).
    Built: "b",
    // Sent a chat message (arrives as a metadata edit, distinguished by key). Needs another person present.
    Chatted: "c",
    // Came to own a room.
    OwnedRoom: "o",
    // Converted from guest to member by signing up.
    SignedUp: "s",
    // A distinct login after the first visit (see LOGIN_COUNT_MIN_GAP_MS), not a refresh.
    Returned: "n",
    // Came back again, on a third distinct occasion. Separates a one-off return from a habit.
    RetainedRepeat: "d",
};

// Report order; forces each new milestone to be placed.
export const FUNNEL_MILESTONE_ORDER: FunnelMilestone[] =
[
    FunnelMilestoneEnumMap.Arrived,
    FunnelMilestoneEnumMap.TutorialDone,
    FunnelMilestoneEnumMap.EnteredRoom,
    FunnelMilestoneEnumMap.Built,
    FunnelMilestoneEnumMap.Chatted,
    FunnelMilestoneEnumMap.OwnedRoom,
    FunnelMilestoneEnumMap.SignedUp,
    FunnelMilestoneEnumMap.Returned,
    FunnelMilestoneEnumMap.RetainedRepeat,
];

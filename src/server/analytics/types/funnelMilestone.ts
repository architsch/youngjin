// The steps of the acquisition funnel, in the order a player passes through them.
//
// Each milestone is one letter, because a user's whole funnel history is stored as a single string
// on their row — the same compact form the FTUE flags use. The two are kept apart on purpose: FTUE
// records which one-off hints a player has been shown and is reset whenever that guidance should
// play again, whereas this is a measurement and is never reset or replayed.
//
// A milestone counts once per account, the first time it is reached. Codes are permanent: changing
// what a letter means would silently rewrite the meaning of every count already recorded under it.

export type FunnelMilestone = string;

export const FunnelMilestoneEnumMap: Record<string, FunnelMilestone> =
{
    // Arrived at the site and was given an account. The denominator for everything below.
    Arrived: "a",
    // Left the tutorial, by finishing or skipping it.
    TutorialDone: "t",
    // Entered a multiplayer room. Single-player rooms do not count — the tutorial is one, so
    // counting them would mark every visitor as having reached this step on arrival.
    EnteredRoom: "r",
    // Changed the world: sent an edit to a voxel or an object. The clearest evidence that somebody
    // did more than look around.
    Built: "b",
    // Came to own a room.
    OwnedRoom: "o",
    // Converted from guest to member by signing up.
    SignedUp: "s",
    // Came back after the first visit. "Distinct login" is defined by LOGIN_COUNT_MIN_GAP_MS, which
    // is a day — so this is a returning visitor, not a page refresh.
    Returned: "n",
    // Came back again, on a third distinct occasion. Separates a one-off return from a habit.
    RetainedRepeat: "d",
};

// The order the funnel is reported in. Kept beside the codes so a milestone cannot be added
// without deciding where in the funnel it belongs.
export const FUNNEL_MILESTONE_ORDER: FunnelMilestone[] =
[
    FunnelMilestoneEnumMap.Arrived,
    FunnelMilestoneEnumMap.TutorialDone,
    FunnelMilestoneEnumMap.EnteredRoom,
    FunnelMilestoneEnumMap.Built,
    FunnelMilestoneEnumMap.OwnedRoom,
    FunnelMilestoneEnumMap.SignedUp,
    FunnelMilestoneEnumMap.Returned,
    FunnelMilestoneEnumMap.RetainedRepeat,
];

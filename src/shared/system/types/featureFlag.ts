export enum FeatureFlag
{
    DisableAllSelectionChange,
    DisableVoxelQuadSelectionChange,
    // Holds whichever object the user currently has picked out, his own character included: it can
    // neither be dropped nor replaced by another (see ObjectSelection).
    DisableObjectSelectionChange,
    DisableManualVoxelBlockAddition,
    DisableManualVoxelBlockRemoval,
    DisableManualObjectAddition,
    DisableManualObjectRemoval,
    HideChatInput,
    DisableChatSend,
    UseFallbackChatMessage,
    // Holds the user in whichever game mode he is currently in: both ways across the line between
    // play and edit mode are refused, and the controls that offer them are taken off screen with
    // them (see GameModeUtil).
    DisableGameModeTransition,
    HideUserIdentityLabels,
}

export enum FeatureFlag
{
    DisableAllSelectionChange,
    DisableVoxelQuadSelectionChange,
    DisableObjectSelectionChange,
    DisablePlayerSelectionChange,
    DisableManualVoxelBlockAddition,
    DisableManualVoxelBlockRemoval,
    DisableManualObjectAddition,
    DisableManualObjectRemoval,
    ExitSinglePlayerOnDoorClick,
    HideChatInput,
    DisableChatSend,
    UseFallbackChatMessage,
    // Holds the user in whichever game mode he is currently in: both ways across the line between
    // play and edit mode are refused, and the controls that offer them are taken off screen with
    // them (see GameModeUtil).
    DisableGameModeTransition,
    HideUserIdentityLabels,
}

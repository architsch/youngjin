export enum FeatureFlag
{
    DisableAllSelectionChange,
    DisableVoxelQuadSelectionChange,
    // Locks the current object selection (see ObjectSelection).
    DisableObjectSelectionChange,
    DisableManualVoxelBlockAddition,
    DisableManualVoxelBlockRemoval,
    DisableManualVoxelQuadTextureChange,
    DisableManualObjectAddition,
    DisableManualObjectRemoval,
    HideChatInput,
    DisableChatSend,
    UseFallbackChatMessage,
    // Locks the current game mode; both transitions are refused (see GameModeUtil).
    DisableGameModeTransition,
}

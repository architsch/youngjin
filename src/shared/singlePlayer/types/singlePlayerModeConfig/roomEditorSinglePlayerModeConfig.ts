import SinglePlayerModeConfig from "./singlePlayerModeConfig";

// Opens on the empty room, unless the admin brought a file of their own to open (see RoomEditorUtil).
const RoomEditorSinglePlayerModeConfig: SinglePlayerModeConfig =
{
    roomPath: "empty",
    adminOnly: true,
};

export default RoomEditorSinglePlayerModeConfig;

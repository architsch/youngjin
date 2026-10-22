export type ObjectMetadataKey = number;

export const ObjectMetadataKeyEnumMap: Record<string, number> =
{
    SentMessage: 0, // for objects that can send object-messages (e.g. players)
    ImagePath: 1, // for objects that are meant to display an image from the web
    InstancedMeshComposition: 2, // properties of the mesh instances that are being used to render the 3D object
    // Retired (slot reserved): a canvas's "{col},{row}" frame atlas cell, now its InstancedMeshComposition.
    // Read only by ObjectGroup's migration.
    CanvasFrameCoords: 3,
    // Text drawn by LabelText. Generic (not door-specific) so every labeled object reads the same key.
    Label: 4,
    DestinationRoomId: 5, // for doors: which room this one opens onto ("" if it opens onto nowhere)
    DestinationDoorLabel: 6, // for doors: which door of that room to arrive behind (by its Label)
    DoorType: 7, // for doors: whether the door offers itself as a room's default entrance
    // Label ink as a "LabelColor" palette position, separate from the text.
    LabelColor: 8,
    // Lamp color and strength as two quantized characters (see LampObjectTypeConfig), always read and
    // written together.
    LightProperties: 9,
    // Label lettering: whether its size fits the text to the patch, and the size used when it doesn't (see
    // LabelTextUtil).
    LabelFont: 10,
    // Preferences only an admin may set (see AdminPrefsUtil), e.g. a player's ghost mode.
    AdminPrefs: 11,
    // Clockwise quarter-turns of a flat object's content about its facing, as seen from the front (see
    // QuarterTurnsUtil). Generic, so any flat type may read it.
    QuarterTurns: 12,
    // Comma-separated keywords an admin gives an object of any type, for scripts to find it by (see ObjectTagUtil).
    Tags: 13,
    // For volumes: the name of the user a volume's stretch of the room is kept for, besides the room's
    // superuser, which makes it a restricted zone (see RestrictedZoneUtil); or ZONE_USER_NAME_FOR_NOBODY,
    // for the superuser alone. Absent or empty, it is no zone.
    ZoneUserName: 14,
    // A fan's setting, which sets its blades, how hard its wind pushes and how far it reaches: one quantized
    // character (see FanObjectTypeConfig).
    ForceProperties: 15,
    // A fan's color as one character, a position in its palette, which paints its housing and tints its wind (see
    // FanObjectTypeConfig).
    FanColor: 16,
    // "1" on an AI agent's player, set by the server at spawn (see ServerUserManager.addUserToRoom). No signal may set it.
    AgentMark: 17,
    // Which way a helper faces as the server plays it, shown to its room and never kept (see NpcFacingUtil). No signal
    // may set it.
    Facing: 18,
    // How far from home a helper goes, in world units, as an admin sets it (see NpcObjectTypeConfig).
    WanderRadius: 19,
    // The character a helper is played as, by its id, as an admin picks it (see NpcPersonalityMap).
    Personality: 20,
    // "1" while a helper thinks of an answer, until it says it: shown to its room and never kept (see
    // HelperBehaviorUtil). No signal may set it.
    Thinking: 21,
}

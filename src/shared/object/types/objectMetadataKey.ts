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
    // Lamp color and strength as two quantized characters (see WallLampObjectTypeConfig), always read and
    // written together.
    LightProperties: 9,
}

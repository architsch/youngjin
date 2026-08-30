export type ObjectMetadataKey = number;

export const ObjectMetadataKeyEnumMap: Record<string, number> =
{
    SentMessage: 0, // for objects that can send object-messages (e.g. players)
    ImagePath: 1, // for objects that are meant to display an image from the web
    InstancedMeshComposition: 2, // properties of the mesh instances that are being used to render the 3D object
    CanvasFrameCoords: 3, // "{col},{row}" cell coordinates of the canvas's picture frame within the frame atlas
    // The text written on the object, which the LabelText component draws onto whatever patch of it
    // was set aside for one. Deliberately not named after any one kind of object: a door's plate is
    // the first thing to carry one, but a sign or a fence post is the same idea, and a second key
    // meaning the same thing would only let two objects disagree about which one to read.
    Label: 4,
    DestinationRoomId: 5, // for doors: which room this one opens onto ("" if it opens onto nowhere)
    DestinationDoorLabel: 6, // for doors: which door of that room to arrive behind (by its Label)
    DoorType: 7, // for doors: whether the door offers itself as a room's default entrance
    // What color the Label above is written in — a position in the "LabelColor" palette. Kept apart
    // from the text for the same reason it is kept apart from the object's own finish: which color
    // reads on a plate depends on what the plate was painted, and the name written there does not
    // change when the answer to that does.
    LabelColor: 8,
}

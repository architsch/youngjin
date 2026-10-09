import Vec3 from "../../math/types/vec3";

// A type whose objects are attached to a voxel face (see ObjectAttachmentUtil).
export type ObjectAttachmentConfig = {
    // Facings the object may take, each the normal of the face it rests on: +y stands on a floor, -y hangs
    // from a ceiling, and the horizontal axes hang on walls.
    allowedDirections: Vec3[],
    // How far behind its face the object needs solid, in world units. Absent, the blocks right behind it
    // are enough.
    supportDepth?: number,
    // Whether a move turns the object a quarter where it fits under the pointer no other way (see
    // ObjectAttachmentEditGizmos): for a type that can't be resized to fit instead. Absent, it never does.
    turnsToFit?: boolean,
};

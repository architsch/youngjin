import Vec3 from "../../math/types/vec3";

// A type whose objects are attached to a voxel face (see ObjectAttachmentUtil).
export type ObjectAttachmentConfig = {
    // Facings the object may take, each the normal of the face it rests on: +y stands on a floor, -y hangs
    // from a ceiling, and the horizontal axes hang on walls.
    allowedDirections: Vec3[],
};

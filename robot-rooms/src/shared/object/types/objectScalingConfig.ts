import Vec3 from "../../math/types/vec3";
import { ObjectMetadata } from "./objectMetadata";

// How far a type may be resized, and in what increments. A type without one is fixed at unit scale
// (see ObjectScaleUtil, which snaps every stored scale onto this grid before anything reads it).
export type ObjectScalingConfig = {
    scaleStep: Vec3,
    minScale: Vec3,
    maxScale: Vec3,
    // What a new one is added at, given which scales fit where it goes (fits searches around that spot, as adding
    // one does; see ObjectScaleUtil.getDefaultScale). On the grid, within the limits.
    getDefaultScale: (fits: (scale: Vec3) => boolean) => Vec3,
    // Whether its selection outline's corner handles resize it (see ObjectAttachmentEditGizmos). Absent
    // means they do; false for a type whose edit options offer its sizes instead (e.g. a lamp's).
    cornerHandles?: boolean,
    // The scale an object's metadata pins it to (e.g. a prop showing an image that keeps its own size), or
    // undefined when it may take any. A pinned object can't be resized, and a change to the metadata that
    // moves the pin carries the transform it needs (see SetObjectMetadataSignal.transform).
    getFixedScale?: (metadata: ObjectMetadata) => Vec3 | undefined,
};

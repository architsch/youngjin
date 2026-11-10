import Vec3 from "../../../shared/math/types/vec3";
import NumUtil from "../../../shared/math/util/numUtil";
import { MAX_ROOM_X } from "../../../shared/system/sharedConstants";

// Within this distance of the camera, in world units, a sound is at its loudest, and heard from the middle at the
// closest.
export const SPATIAL_AUDIO_MIN_DISTANCE = 1;
// How far a sound carries unless its player says otherwise: across half the room.
export const SPATIAL_AUDIO_DEFAULT_RANGE = 0.5 * MAX_ROOM_X;
// How far to one side a sound right beside the camera is heard. Short of one ear alone, as a head hears it.
export const SPATIAL_AUDIO_MAX_PAN = 0.7;
// What a wall between a sound and the camera leaves of it: this share of its loudness, and nothing above this frequency,
// an octave lower again for each further wall, up to the most that muffle it.
export const SPATIAL_AUDIO_WALL_GAIN = 0.5;
export const SPATIAL_AUDIO_WALL_CUTOFF_HZ = 1600;
export const SPATIAL_AUDIO_MAX_OCCLUDING_WALLS = 3;
// A cutoff that lets every frequency through.
export const SPATIAL_AUDIO_OPEN_CUTOFF_HZ = 20000;

// How a sound at a position in the world is heard from the camera (see SpatialAudioVoice).
const SpatialAudioUtil =
{
    // Full at the minimum distance (or within half the range, if that is nearer), easing out to silence at the range.
    getDistanceGain: (distance: number, range: number): number =>
    {
        if (range <= 0)
            return 0;
        const near = Math.min(SPATIAL_AUDIO_MIN_DISTANCE, 0.5 * range);
        const t = NumUtil.clampInRange((distance - near) / (range - near), 0, 1);
        return (1 - t) * (1 - t);
    },
    // From -1 (left of the camera) to 1 (right), by how far to that side the sound is. listenerRight is of unit length.
    getPan: (listenerPosition: Vec3, listenerRight: Vec3, position: Vec3): number =>
    {
        const dx = position.x - listenerPosition.x;
        const dy = position.y - listenerPosition.y;
        const dz = position.z - listenerPosition.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (distance == 0)
            return 0;
        const side = NumUtil.clampInRange(
            (dx * listenerRight.x + dy * listenerRight.y + dz * listenerRight.z) / distance, -1, 1);
        return SPATIAL_AUDIO_MAX_PAN * side * Math.min(1, distance / SPATIAL_AUDIO_MIN_DISTANCE);
    },
    // walls: how many stand between the sound and the camera.
    getOcclusionGain: (walls: number): number =>
    {
        return SPATIAL_AUDIO_WALL_GAIN ** Math.min(walls, SPATIAL_AUDIO_MAX_OCCLUDING_WALLS);
    },
    getOcclusionCutoff: (walls: number): number =>
    {
        return (walls <= 0) ? SPATIAL_AUDIO_OPEN_CUTOFF_HZ
            : SPATIAL_AUDIO_WALL_CUTOFF_HZ / 2 ** (Math.min(walls, SPATIAL_AUDIO_MAX_OCCLUDING_WALLS) - 1);
    },
    getDistance: (a: Vec3, b: Vec3): number =>
    {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dz = a.z - b.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    },
}

export default SpatialAudioUtil;

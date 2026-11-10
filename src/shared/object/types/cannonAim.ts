// Which way a cannon's barrel points, in radians, in the frame of the face it stands on (see CannonAimUtil): its turn
// about the face's normal, and its rise from the face.
export default interface CannonAim
{
    yaw: number;
    pitch: number;
}

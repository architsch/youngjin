export default interface AABB3 // 3D Axis-Aligned Bounding Box
{
    x: number; // center x position
    y: number; // center y position
    z: number; // center z position
    halfSizeX: number;
    halfSizeY: number;
    halfSizeZ: number;
}
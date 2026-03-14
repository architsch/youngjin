export default interface ColliderDebugBox
{
    x: number; // world X center
    y: number; // world Y center
    z: number; // world Z center
    halfSizeX: number;
    halfSizeY: number;
    halfSizeZ: number;
    colorHex?: string; // wireframe color (defaults to "#ff8800")
}

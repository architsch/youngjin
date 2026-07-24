// One flat face of a projected 3D form, ready to be drawn: an outline expressed in
// the target viewBox's coordinates, plus the relative brightness (1 = fully lit) that
// stands in for the lighting a real 3D view would have given it.
export default interface IsometricFace
{
    d: string;
    shade: number;
}

// Something round seen at an angle (a pan, a plate, a clock), made round again (see PrepRenderUtil): the picture is
// stretched across the short axis of the ellipse it is seen as.
export default interface PrepRound
{
    // Five or more points on its outline, as fractions of the picture's width and height.
    outline: [number, number][];
    // Degrees the result is turned clockwise. Absent: 0.
    turn?: number;
}

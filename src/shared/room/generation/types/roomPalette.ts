// This is an optional piece of information that is attached to a RoomVolume,
// for the purpose of telling how the RoomVolume should be textured.
export default class RoomPalette
{
    floor: number;
    ceiling: number;
    wall: number;
    prop: number;

    constructor(floor: number, ceiling: number, wall: number, prop: number)
    {
        this.floor = floor;
        this.ceiling = ceiling;
        this.wall = wall;
        this.prop = prop;
    }
}
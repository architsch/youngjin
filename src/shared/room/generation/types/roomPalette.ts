// Optional texturing info for a RoomVolume.
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
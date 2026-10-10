// The textures one space of a room is finished in, as positions in its texture pack.
export default class RoomPalette
{
    floor: number;
    ceiling: number;
    wall: number;
    prop: number; // what stands in the space (block work, furniture)

    constructor(floor: number, ceiling: number, wall: number, prop: number)
    {
        this.floor = floor;
        this.ceiling = ceiling;
        this.wall = wall;
        this.prop = prop;
    }
}

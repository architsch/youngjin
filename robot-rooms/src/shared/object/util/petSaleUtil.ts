import { PET_PRICE_DOLLARS } from "../../system/sharedConstants";

// How many steps a pet's worth falls in as its health does.
export const PET_SALE_PRICE_STEPS = 3;

const PetSaleUtil =
{
    // What its owner is paid for a pet in such health (from 0 to 1) as they sell it: all of its price down to two thirds
    // of its health, two thirds of it down to one third, and one third below that.
    getPrice: (health: number): number =>
    {
        const step = Math.min(PET_SALE_PRICE_STEPS, Math.floor(Math.max(0, health) * PET_SALE_PRICE_STEPS) + 1);
        return Math.round(PET_PRICE_DOLLARS * step / PET_SALE_PRICE_STEPS);
    },
}

export default PetSaleUtil;

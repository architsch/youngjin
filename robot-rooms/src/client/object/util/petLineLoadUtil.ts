import PetLineMap, { PET_LINES_ASSET_PATH } from "../../../shared/object/maps/petLineMap";
import PetLineData from "../../../shared/object/types/petLineData";

const MAX_TRIES = 4;
const RETRY_MS = 5000;

let loading: Promise<void> | undefined = undefined;

// What pets chat in, fetched once the game has loaded rather than carried in its bundle (see PetLinesBuilder): until it
// comes, the user's pets only react (see PetLineMap).
const PetLineLoadUtil =
{
    load: (assetsURL: string): Promise<void> =>
    {
        loading ??= fetchLines(assetsURL);
        return loading;
    },
}

async function fetchLines(assetsURL: string): Promise<void>
{
    for (let i = 0; i < MAX_TRIES; ++i)
    {
        try
        {
            const response = await fetch(`${assetsURL}/${PET_LINES_ASSET_PATH}`);
            if (response.ok)
            {
                PetLineMap.use(await response.json() as PetLineData);
                return;
            }
        }
        catch
        {
            // Tried again below.
        }
        await new Promise(resolve => setTimeout(resolve, RETRY_MS));
    }
    console.warn("PetLineLoadUtil :: What pets chat in couldn't be fetched, so they only react");
}

export default PetLineLoadUtil;

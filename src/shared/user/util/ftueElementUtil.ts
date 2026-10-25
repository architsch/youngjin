import { FTUEElementCode } from "../types/ftueElementCode";

// Experienced elements are stored as one string, one letter per element (positions are permanent).
// Letters only, since the user record is embedded verbatim in the page (the server enforces this).
const FTUE_ELEMENT_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

// How a user's FTUE record (User.ftue) holds each element, as both sides read it: the client records most (see FTUEUtil),
// the server those its helpers see to (see HelperAgentUtil).
const FTUEElementUtil =
{
    toChar: (ftueElementCode: FTUEElementCode): string =>
    {
        const element = FTUE_ELEMENT_CHARS[ftueElementCode];
        if (element == undefined)
            throw new Error(`FTUE element code is out of range (code = ${ftueElementCode})`);
        return element;
    },
    has: (ftue: string, ftueElementCode: FTUEElementCode): boolean =>
    {
        return ftue.includes(FTUEElementUtil.toChar(ftueElementCode));
    },
}

export default FTUEElementUtil;

// The zodiac signs pets are born under, each a number: its place in the year, from Aries (0) to Pisces (11). A sign is
// drawn toward two others and put off by two, as in The Sims; how it takes to any other is nobody's to say.
export const NUM_ZODIAC_SIGNS = 12;

const NAMES = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn",
    "Aquarius", "Pisces"];
const [ARIES, TAURUS, GEMINI, CANCER, LEO, VIRGO, LIBRA, SCORPIO, SAGITTARIUS, CAPRICORN, AQUARIUS, PISCES] =
    NAMES.map((_, sign) => sign);

const DRAWN_TO: number[][] = [];
const PUT_OFF_BY: number[][] = [];
DRAWN_TO[ARIES] = [GEMINI, TAURUS];
PUT_OFF_BY[ARIES] = [CANCER, LIBRA];
DRAWN_TO[TAURUS] = [ARIES, LIBRA];
PUT_OFF_BY[TAURUS] = [VIRGO, CANCER];
DRAWN_TO[GEMINI] = [PISCES, VIRGO];
PUT_OFF_BY[GEMINI] = [CAPRICORN, ARIES];
DRAWN_TO[CANCER] = [TAURUS, SCORPIO];
PUT_OFF_BY[CANCER] = [GEMINI, ARIES];
DRAWN_TO[LEO] = [SAGITTARIUS, CANCER];
PUT_OFF_BY[LEO] = [CAPRICORN, GEMINI];
DRAWN_TO[VIRGO] = [AQUARIUS, SAGITTARIUS];
PUT_OFF_BY[VIRGO] = [LEO, TAURUS];
DRAWN_TO[LIBRA] = [VIRGO, CANCER];
PUT_OFF_BY[LIBRA] = [PISCES, SCORPIO];
DRAWN_TO[SCORPIO] = [PISCES, LEO];
PUT_OFF_BY[SCORPIO] = [LIBRA, AQUARIUS];
DRAWN_TO[SAGITTARIUS] = [PISCES, CAPRICORN];
PUT_OFF_BY[SAGITTARIUS] = [LIBRA, SCORPIO];
DRAWN_TO[CAPRICORN] = [AQUARIUS, TAURUS];
PUT_OFF_BY[CAPRICORN] = [LEO, GEMINI];
DRAWN_TO[AQUARIUS] = [CAPRICORN, SAGITTARIUS];
PUT_OFF_BY[AQUARIUS] = [SCORPIO, VIRGO];
DRAWN_TO[PISCES] = [SCORPIO, GEMINI];
PUT_OFF_BY[PISCES] = [LEO, ARIES];

const PetZodiacUtil =
{
    getName: (sign: number): string =>
    {
        return NAMES[sign] ?? NAMES[0];
    },
    // A sign picked at random, as each new pet is given one.
    pick: (): number =>
    {
        return Math.floor(Math.random() * NUM_ZODIAC_SIGNS);
    },
    // How one sign takes to another: 1 for one it is drawn to, -1 for one it is put off by, 0 for any other. Not
    // mutual: the other may take to it differently.
    getPull: (sign: number, toward: number): number =>
    {
        if (DRAWN_TO[sign]?.includes(toward))
            return 1;
        return PUT_OFF_BY[sign]?.includes(toward) ? -1 : 0;
    },
}

export default PetZodiacUtil;

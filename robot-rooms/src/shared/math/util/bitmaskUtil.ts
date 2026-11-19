const BitmaskUtil =
{
    // Offset of the rightmost 1-bit, or -1 if none (e.g. 00011010 -> 1, 11110000 -> 4).
    offsetOfRightmostOne: (mask: number): number =>
    {
        if (mask === 0)
            return -1;
        let offset = 0;
        while ((mask & 1) === 0)
        {
            ++offset;
            mask >>= 1;
        }
        return offset;
    },
    // Counts the number of 1-bits in the mask and returns it.
    countOnes: (mask: number): number =>
    {
        let count = 0;
        while (mask != 0)
        {
            count += (mask & 1);
            mask >>= 1;
        }
        return count;
    },
    // Returns true if there is no 0-bit between a pair of 1-bits.
    allOnesAreContinuous: (mask: number): boolean =>
    {
        let oneFound = false;
        let zeroFoundAfterOne = false;
        while (mask != 0)
        {
            const isOne = (mask & 1) != 0;
            if (isOne) // 1-bit found
            {
                // A 1-bit after a 1-bit then a 0-bit means the run is discontinuous.
                if (oneFound && zeroFoundAfterOne)
                    return false;
                if (!oneFound)
                    oneFound = true;
            }
            else // 0-bit found
            {
                // 1-bit was discovered previously? Then "zeroFoundAfterOne" must be true.
                if (oneFound)
                    zeroFoundAfterOne = true;
            }
            mask >>= 1;
        }
        return true;
    },
    // True if every 1-bit in myMask is also set in otherMask.
    isSubsetOf: (myMask: number, otherMask: number): boolean =>
    {
        return myMask === (myMask & otherMask);
    },
}

export default BitmaskUtil;
const BitmaskUtil =
{
    // Returns the offset (from the rightmost bit) of the rightmost 1-bit.
    // Examples:
    // 00000000 -> returns -1 ("-1" means "no 1-bit found")
    // 11001011 -> returns 0
    // 00011010 -> returns 1
    // 00111100 -> returns 2
    // 10001000 -> returns 3
    // 11110000 -> returns 4
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
                // Another 1-bit found after discovering both a 1-bit and a 0-bit which came after?
                // Then there must be a discontinuity in the stream of 1-bits.
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
    // Returns true if, for any nonzero integer N, there is no instance where
    // the N-th bit of myMask is "1" but the N-th bit of otherMask is "0".
    isSubsetOf: (myMask: number, otherMask: number): boolean =>
    {
        return myMask === (myMask & otherMask);
    },
}

export default BitmaskUtil;
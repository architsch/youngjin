// Tints packed into one float of the instance buffer: the sRGB bytes of "#rrggbb" as one integer, which a
// float holds exactly (below 2^24). particleShader unpacks and linearizes it.
const ParticleColorUtil =
{
    WHITE: 0xffffff,
    packHex: (hex: string): number =>
    {
        const value = parseInt(hex.replace("#", ""), 16);
        return Number.isFinite(value) ? Math.min(0xffffff, Math.max(0, value)) : ParticleColorUtil.WHITE;
    },
}

export default ParticleColorUtil;

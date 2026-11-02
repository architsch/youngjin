import { CSSProperties, useEffect, useLayoutEffect, useRef, useState } from "react";
import LockIcon from "../../svg/icons/lockIcon";

const DURATION_MS = 1100;
const NUM_SPARKS = 24;
const SPARK_COLORS = ["#fde047", "#ffffff", "#86efac", "#fb923c"];

// A burst over the tile it is put in, whose lock flies off. Fixed to the screen around the tile, since what the tile lies
// in clips it, and over the tiles after it; so nothing around it may be transformed meanwhile, which would make that the
// screen.
export default function UnlockFanfare({ onFinished }: Props)
{
    const anchorRef = useRef<HTMLSpanElement>(null);
    const [center, setCenter] = useState<{x: number, y: number} | undefined>(undefined);

    useLayoutEffect(() => {
        const rect = anchorRef.current?.getBoundingClientRect();
        if (rect)
            setCenter({x: rect.left + 0.5 * rect.width, y: rect.top + 0.5 * rect.height});
    }, []);

    useEffect(() => {
        const timeout = setTimeout(onFinished, DURATION_MS);
        return () => clearTimeout(timeout);
    }, []);

    return <span ref={anchorRef} className="absolute inset-0 pointer-events-none">
        {center && <span className="fixed z-10 size-0" style={{left: center.x, top: center.y}}>
            <span className="absolute -inset-28 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,1)_0%,rgba(253,224,71,0.9)_25%,rgba(251,146,60,0.5)_50%,rgba(251,146,60,0)_72%)] animate-unlock-flash"/>
            <span className="absolute -inset-36 rounded-full border-8 border-yellow-200 animate-unlock-ring"/>
            {Array.from({length: NUM_SPARKS}, (_, index) =>
                <span key={index} className="absolute -left-2.5 -top-2.5 size-5 [clip-path:polygon(50%_0,62%_38%,100%_50%,62%_62%,50%_100%,38%_62%,0_50%,38%_38%)] animate-unlock-spark"
                    style={getSparkStyle(index)}/>)}
            <span className="absolute -left-6 -top-6 size-12 text-yellow-100 drop-shadow-[0_0_6px_rgba(251,146,60,1)] animate-unlock-lock"><LockIcon/></span>
        </span>}
    </span>;
}

// Evenly around, in three reaches, so that it reads as a burst rather than a ring.
function getSparkStyle(index: number): CSSProperties
{
    return {
        backgroundColor: SPARK_COLORS[index % SPARK_COLORS.length],
        "--unlock-spark-angle": `${index * 360 / NUM_SPARKS}deg`,
        "--unlock-spark-reach": `${-100 - 36 * (index % 3)}px`,
    } as CSSProperties;
}

interface Props
{
    onFinished: () => void;
}

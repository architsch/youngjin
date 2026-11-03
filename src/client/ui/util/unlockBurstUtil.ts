import ScreenInputBlockUtil from "./screenInputBlockUtil";

// Sparks thrown out of a tile's edges, in CSS px and seconds: how many, how fast, across how wide a fan either side of
// straight out of the edge (radians), how much faster upward, and how long each burns. The air slows them by this share a
// second, and gravity pulls them no faster than a drift (its pull over that share), so that the burst blooms out over the
// tile, which lies low on the screen, and hangs there as it burns out, as a firework's does. Glitter is smaller and slower,
// and twinkles more.
const NUM_SPARKS = 140;
const SPARK_SPEED = [300, 850];
const SPARK_SPREAD = 0.8;
const SPARK_RISE = [150, 400];
const SPARK_LIFE = [1.8, 3];
const SPARK_SIZE = [2, 3.6];
const NUM_GLITTER = 60;
const GLITTER_SPEED = [40, 220];
const GLITTER_LIFE = [1.2, 2.4];
const GLITTER_SIZE = [1, 2];
const DRAG = 2;
const GRAVITY = 360;
// How long the edges flash as the sparks leave them, the most of that time a frame moves on, and the longest a burst stays
// on the page, however slowly its frames come, in seconds.
const FLASH_SECONDS = 0.35;
const MAX_STEP_SECONDS = 0.05;
const MAX_SECONDS = 10;
// How long the screen takes no input as a burst starts, in its own seconds: through the tile's pop and the sparks' bloom,
// which a click taking the grid away from under them would cut short. What is left only drifts down and fades, on a canvas
// nothing else can take away. Should its frames stop coming (a hidden page), the hold ends after this long all the same.
const HOLD_SECONDS = 1.5;
const MAX_HOLD_MS = 4000;
// How far under the screen's bottom a spark is gone for good, in CSS px.
const OFF_SCREEN_MARGIN = 40;
// A spark's glow, as wide as its size this many times, and its streak, as long as it goes in this long.
const GLOW_SCALE = 4.5;
const STREAK_SECONDS = 0.03;
// Gold and white mostly, with the green of a price.
const COLORS = ["#fff7c2", "#fde047", "#facc15", "#ffffff", "#fde047", "#86efac", "#fdba74"];
const GLOW_SPRITE_SIZE = 64;

type Spark = {
    x: number, y: number, vx: number, vy: number, age: number, life: number, size: number, color: number,
    twinkleRate: number, twinklePhase: number, twinkleDepth: number, streak: boolean,
};

let glowSprites: HTMLCanvasElement[] | undefined = undefined;

// A firework of sparks over a tile just unlocked: thrown out all round its edges as they flash, then blooming up and
// drifting down, glowing and twinkling as they burn out.
const UnlockBurstUtil =
{
    // Once, over an element where it is on the screen now: on a canvas of its own over the whole screen, outside anything
    // the element lies in, which would clip it or come and go, and gone once its sparks have burnt out, whatever has become
    // of the element by then. The screen takes no input meanwhile, for a while (see HOLD_SECONDS).
    burstOver: (element: Element): void =>
    {
        const canvas = document.createElement("canvas");
        canvas.className = "fixed inset-0 z-55 w-screen h-screen pointer-events-none";
        document.body.appendChild(canvas);
        const endHold = ScreenInputBlockUtil.hold();
        const holdTimeout = setTimeout(endHold, MAX_HOLD_MS);
        const letGo = () => {
            clearTimeout(holdTimeout);
            endHold();
        };
        play(canvas, element.getBoundingClientRect(), seconds => {
            if (seconds >= HOLD_SECONDS)
                letGo();
        }, () => {
            letGo();
            canvas.remove();
        });
    },
}

// Frame by frame until it is over, telling onStep how far it has got by its own clock after each, then calls onFinished.
function play(canvas: HTMLCanvasElement, tile: DOMRect, onStep: (seconds: number) => void, onFinished: () => void): void
{
    const context = canvas.getContext("2d");
    if (context == null)
    {
        onFinished();
        return;
    }
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * pixelRatio);
    canvas.height = Math.round(window.innerHeight * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    const sparks = [...Array.from({length: NUM_SPARKS}, () => createSpark(tile, false)),
        ...Array.from({length: NUM_GLITTER}, () => createSpark(tile, true))];
    // Its own time goes no faster than a frame's worth at once, so that a slow frame holds it back rather than making it
    // jump; how long it has been on the page only bounds it.
    let startTime: number | undefined = undefined;
    let lastTime = 0;
    let seconds = 0;
    requestAnimationFrame(function step(time: number)
    {
        startTime ??= time;
        if (time > startTime)
        {
            const deltaTime = Math.min(MAX_STEP_SECONDS, (time - lastTime) / 1000);
            sparks.forEach(spark => moveSpark(spark, deltaTime));
            seconds += deltaTime;
        }
        lastTime = time;
        draw(context, tile, sparks, seconds);
        onStep(seconds);
        if ((time - startTime) / 1000 >= MAX_SECONDS
            || (seconds >= FLASH_SECONDS && sparks.every(spark => spark.age >= spark.life)))
        {
            onFinished();
            return;
        }
        requestAnimationFrame(step);
    });
}

// Somewhere on the tile's edges, thrown out of it.
function createSpark(tile: DOMRect, glitter: boolean): Spark
{
    const along = Math.random() * 2 * (tile.width + tile.height);
    let x: number, y: number, outward: number;
    if (along < tile.width)
        [x, y, outward] = [tile.left + along, tile.top, -0.5 * Math.PI];
    else if (along < tile.width + tile.height)
        [x, y, outward] = [tile.right, tile.top + along - tile.width, 0];
    else if (along < 2 * tile.width + tile.height)
        [x, y, outward] = [tile.right - (along - tile.width - tile.height), tile.bottom, 0.5 * Math.PI];
    else
        [x, y, outward] = [tile.left, tile.bottom - (along - 2 * tile.width - tile.height), Math.PI];
    const angle = outward + (2 * Math.random() - 1) * (glitter ? Math.PI : SPARK_SPREAD);
    const speed = randomIn(glitter ? GLITTER_SPEED : SPARK_SPEED);
    return {
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (glitter ? 0 : randomIn(SPARK_RISE)),
        age: 0,
        life: randomIn(glitter ? GLITTER_LIFE : SPARK_LIFE),
        size: randomIn(glitter ? GLITTER_SIZE : SPARK_SIZE),
        color: Math.floor(Math.random() * COLORS.length),
        twinkleRate: randomIn(glitter ? [25, 45] : [12, 30]),
        twinklePhase: 2 * Math.PI * Math.random(),
        twinkleDepth: glitter ? 0.8 : 0.4,
        streak: !glitter,
    };
}

function moveSpark(spark: Spark, deltaTime: number): void
{
    const keep = Math.exp(-DRAG * deltaTime);
    spark.vx *= keep;
    spark.vy = spark.vy * keep + GRAVITY * deltaTime;
    spark.x += spark.vx * deltaTime;
    spark.y += spark.vy * deltaTime;
    spark.age += deltaTime;
    if (spark.y > window.innerHeight + OFF_SCREEN_MARGIN)
        spark.age = spark.life;
}

function draw(context: CanvasRenderingContext2D, tile: DOMRect, sparks: Spark[], seconds: number): void
{
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    context.globalCompositeOperation = "lighter";
    if (seconds < FLASH_SECONDS)
        drawFlash(context, tile, 1 - seconds / FLASH_SECONDS);

    const sprites = getGlowSprites();
    context.lineCap = "round";
    for (const spark of sparks)
    {
        if (spark.age >= spark.life)
            continue;
        const left = 1 - spark.age / spark.life;
        const twinkle = 1 - spark.twinkleDepth * (0.5 + 0.5 * Math.sin(spark.twinklePhase + spark.twinkleRate * spark.age));
        const alpha = Math.min(1, 2.5 * left) * twinkle;
        if (spark.streak)
        {
            context.globalAlpha = 0.7 * alpha;
            context.strokeStyle = COLORS[spark.color];
            context.lineWidth = spark.size;
            context.beginPath();
            context.moveTo(spark.x - spark.vx * STREAK_SECONDS, spark.y - spark.vy * STREAK_SECONDS);
            context.lineTo(spark.x, spark.y);
            context.stroke();
        }
        const glow = spark.size * GLOW_SCALE;
        context.globalAlpha = alpha;
        context.drawImage(sprites[spark.color], spark.x - glow, spark.y - glow, 2 * glow, 2 * glow);
    }
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
}

// The tile's edges lit up, and a glow over it.
function drawFlash(context: CanvasRenderingContext2D, tile: DOMRect, strength: number): void
{
    context.globalAlpha = strength;
    context.shadowColor = "#fde047";
    context.shadowBlur = 24;
    context.strokeStyle = "#fffbe0";
    context.lineWidth = 4;
    context.beginPath();
    context.roundRect(tile.left, tile.top, tile.width, tile.height, 6);
    context.stroke();
    context.shadowBlur = 0;
    context.fillStyle = "rgba(255, 244, 190, 0.45)";
    context.fill();
    context.globalAlpha = 1;
}

// A soft round glow for each color, white at its middle.
function getGlowSprites(): HTMLCanvasElement[]
{
    glowSprites ??= COLORS.map(color => {
        const sprite = document.createElement("canvas");
        sprite.width = sprite.height = GLOW_SPRITE_SIZE;
        const context = sprite.getContext("2d")!;
        const middle = 0.5 * GLOW_SPRITE_SIZE;
        const gradient = context.createRadialGradient(middle, middle, 0, middle, middle, middle);
        gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
        gradient.addColorStop(0.18, color);
        gradient.addColorStop(0.45, withAlpha(color, 0.35));
        gradient.addColorStop(1, withAlpha(color, 0));
        context.fillStyle = gradient;
        context.fillRect(0, 0, GLOW_SPRITE_SIZE, GLOW_SPRITE_SIZE);
        return sprite;
    });
    return glowSprites;
}

// A "#rrggbb" color at an opacity.
function withAlpha(color: string, alpha: number): string
{
    const value = parseInt(color.slice(1), 16);
    return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

function randomIn(range: number[]): number
{
    return range[0] + Math.random() * (range[1] - range[0]);
}

export default UnlockBurstUtil;

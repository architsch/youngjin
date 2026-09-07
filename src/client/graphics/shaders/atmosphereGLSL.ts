import VALUE_NOISE_GLSL from "./valueNoiseGLSL";

// The room's air, in the two places it is seen: as the emptiness past the room (the sky), and as the
// haze things fade into on their way to it (the fog).
//
// **They are two fields, not one, and which coordinate each is read on is the whole of the
// difference.** The sky's is read on the *direction* the fragment is being looked at; the fog's on
// the *world position* the fragment actually stands at. Everything else about how they behave follows
// from that one choice, and the choice is forced, because a direction and a place are what the two
// things genuinely are:
//
//   - The sky has no positions in it. It is at infinity, so the only thing that can vary across it is
//     which way the viewer is facing, and a field read off a direction is exactly right: the weather
//     stays put overhead as the player walks, and looks the same from a pace outside the wall as from
//     the far end of the world.
//   - The room's air does have positions in it, and the player is standing *inside* them. Read off a
//     direction, a thickening of the air is painted on the inside of a dome — it slides across the
//     walls as the player turns their head, and it subtends the same angle whatever it lands on, so
//     it reads as weather a mile off and as a stain on the wall two paces away. Read off the world
//     position, it is somewhere: the player walks around it, it passes between them and the far wall,
//     and it holds still when they turn.
//
// **What that costs is worth stating, because it was once the reason these were one field.** Whatever
// has faded completely into the fog is standing directly in front of the sky, so if the two do not
// agree there, the horizon can show as a seam rather than as a distance. They no longer agree by
// construction. The two cannot both be had: a fully fogged wall matching a cloudy sky *means* cloud
// shapes on that wall, which is the thing the volumetric field exists to stop. Where it can be seen
// at all is a room whose fog closes well inside it — see @docs/graphics/lighting.md .
//
// A skybox would have been the other way to do the sky, and it is still the wrong one. It is a large
// image to send over the network for something the room barely looks at, and — being geometry at
// infinity rather than a property of the air — it could not carry the room's own color at all.
//
// The land below the horizon belongs to the sky alone for a third reason again; see the note above
// atmosphereGround.

// How far the field is dragged aside by a sample of itself. **This is the whole difference between
// noise and cloud.** Sampled straight, a fractal field is an even mottle — every mass the same
// rounded blob, because nothing has pushed one side of it past the other. Warping the coordinate by
// the field itself shears each mass along its own gradient, which is what produces the piled edge of
// a cumulus and the drag and curl of smoke, for the cost of one extra sample.
const ATMOSPHERE_WARP = 0.9;

// Where the field is cut into cloud and clear air. A cloud is legible because it has an *edge*: a
// region that is definitely cloud, a region that is definitely not, and a boundary between the two.
// A fractal field on its own has no edge anywhere — it is haze everywhere — which is why it reads as
// an even wash however strongly it is colored. Cutting it at a level is what makes shapes out of it.
//
// The level is fixed and only the *width* of the boundary around it is the room's to choose, because
// the two are not independent: the field is symmetric about its own middle, so moving the level is
// mostly a way of asking for more or less sky covered — which is a further question, and one nobody
// has asked for yet.
const ATMOSPHERE_COVERAGE_LEVEL = 0.52;

// How much lighter the air is toward the horizon than overhead, which is the other half of what makes
// a flat color read as a sky rather than as a wall. Not a room's to choose: it is what makes a sky
// legible as a sky, rather than a matter of weather.
const ATMOSPHERE_HORIZON_DEPTH = 0.16;

// How far below the horizon the clouds are gone by.
//
// **Cloud belongs over the land, not on it.** The clouds are painted on a dome of directions, and
// below the horizon that dome is beneath the viewer — so cloud drawn there is cloud underneath the
// ground, which is why it reads as a stain on the landscape rather than as weather over it. It is
// also what a downward ray actually meets: from a viewer near the ground, a ray that goes down never
// climbs to a cloud layer, so there is genuinely nothing of the sort along it.
//
// Faded over a band rather than stopped at the horizon, and the band is the whole point. In the world
// the cut is abrupt — that is what a horizon *is* — but the world also has land visible right up to
// it, while here the land has hazed away to air a little short of it. Stopping the cloud dead would
// draw a hard line across open air. Instead it fades out over roughly the band the land fades in
// over, so the two cross and the horizon stays a distance rather than an edge.
const ATMOSPHERE_CLOUD_FLOOR = 0.18;

// The three the room *does* choose — what color the clouds are, how fine, and how fast — arrive as
// uniforms rather than as baked constants, because they are dragged on sliders. A constant is part of
// the shader's source, so turning one into a value would mean rebuilding and recompiling every
// material in the scene on every frame of the drag (which is the same trap the fog's own on/off flag
// sets; see GraphicsManager). A uniform costs a single upload and no compilation at all.
export const ATMOSPHERE_PARS_GLSL = `
    uniform float atmosphereTime;
    // (how fine the clouds are, how fast they cross the sky, how far toward their own color they
    // reach, how wide their edge runs)
    uniform vec4 atmosphereClouds;
    uniform vec3 atmosphereCloudColor;
    ${VALUE_NOISE_GLSL}

    const float ATMOSPHERE_WARP = ${ATMOSPHERE_WARP.toFixed(4)};
    const float ATMOSPHERE_COVERAGE_LEVEL = ${ATMOSPHERE_COVERAGE_LEVEL.toFixed(4)};
    const float ATMOSPHERE_HORIZON_DEPTH = ${ATMOSPHERE_HORIZON_DEPTH.toFixed(4)};
    const float ATMOSPHERE_CLOUD_FLOOR = ${ATMOSPHERE_CLOUD_FLOOR.toFixed(4)};

    // How much cloud stands in a given direction, from none to solid.
    //
    // Sampled over the dome of directions rather than through the room, because the sky is at
    // infinity and a direction is the only thing that can vary across it (see this module's own
    // note). It also means walking across a room does not drag the weather along with the player —
    // the sky stays put overhead, as a sky does, and looks the same from a pace outside the wall as
    // from the far end of the world.
    float atmosphereCloudAmount(vec3 dir)
    {
        // The drift is added to the *direction*, before the scale is applied, so that it is an
        // angular rate: the clouds cross the sky at the same apparent speed however fine they have
        // been set. Added to the sampling point instead, the two dials would fight — asking for
        // finer clouds would also appear to slow them, since a finer feature subtends a smaller
        // angle while still taking as long to travel its own width.
        float t = atmosphereTime * atmosphereClouds.y;
        vec3 p = (dir + vec3(t, 0.4 * t, -0.7 * t)) * atmosphereClouds.x;

        // Three samples of one field, read as a direction to push the coordinate in. Offset from
        // each other rather than drawn from separate fields, which costs nothing and decorrelates
        // them just as well.
        vec3 warp = vec3(
            valueNoise(p),
            valueNoise(p.yzx + 19.7),
            valueNoise(p.zxy + 43.1)) - 0.5;
        float field = valueNoiseFbm(p + warp * ATMOSPHERE_WARP);

        // The room's own edge width, held open by however much the field changes across one pixel.
        // The per-pixel term is a floor rather than a setting: an edge finer than the screen can
        // resolve crawls and sparkles as it crosses pixel centres, so the tightest edge a room can
        // ask for is the tightest one that can be drawn without shimmering — the same reason the
        // instance outline fades over a pixel rather than switching at a threshold.
        float edge = max(atmosphereClouds.w, fwidth(field));
        return smoothstep(ATMOSPHERE_COVERAGE_LEVEL - edge, ATMOSPHERE_COVERAGE_LEVEL + edge, field);
    }

    // What the air looks like in a given direction: the room's own two colors, the fog's where the
    // sky is clear and the cloud's where it is not.
    //
    // A *blend between two chosen colors* rather than a brightening and darkening of one. The
    // difference is the whole point: a cloud drawn as a shade of the air it hangs in is barely a
    // cloud, and against the dark air a room lit for atmosphere actually asks for, it is nothing at
    // all however hard it is pushed. Given its own color it stands out on any sky, including the
    // emptiness past the room where there is no surface to give the eye anything else to read.
    //
    // A room wanting no weather picks the same palette entry twice, which is what every room that has
    // never been configured already holds — so none of them shows so much as a change of shade.
    vec3 atmosphereColor(vec3 airColor, vec3 viewDir)
    {
        vec3 dir = normalize(viewDir);

        // Full at the horizon and above it, gone a little way below (see the note on the floor).
        float presence = smoothstep(-ATMOSPHERE_CLOUD_FLOOR, 0.0, dir.y);

        // Skipped outright where there is no cloud to find, rather than multiplied out afterwards.
        // The field is the most expensive thing this shader does, and everything below the band is
        // the half of the sky that also pays for the land — so this is where the saving is worth
        // having, and it costs nothing to take: the test is on the fragment's own direction, which
        // divides the screen along a line, so all but the few shading groups the line crosses take
        // one side of it together.
        //
        // The field reads the slope across a pixel, which is only defined while neighbouring pixels
        // are taking the same branch — so on the line itself it is reading whatever the lanes that
        // left held. That is harmless here and not by luck: the branch closes exactly where presence
        // reaches nothing, so anything the field returns along it is multiplied away.
        vec3 air = airColor;
        if (presence > 0.0)
        {
            // How much cloud stands here, and how far toward its color that much of it reaches. The
            // two are separate on purpose: one is the shape of the weather and the other is its
            // strength, and dialing the strength back is how two colors picked far apart are brought
            // within sight of each other without either being repicked.
            air = mix(airColor, atmosphereCloudColor,
                atmosphereCloudAmount(dir) * atmosphereClouds.z * presence);
        }

        float horizon = smoothstep(-0.25, 0.6, dir.y);
        return air * (1.0 - ATMOSPHERE_HORIZON_DEPTH * (horizon - 0.5));
    }
`;

// How far the land is dragged aside by a sample of itself — the same trick the clouds use, and for
// the same reason, but held back. A coastline sheared as hard as a cumulus stops reading as ground:
// what makes land land is that it is a *surface*, and a surface cannot fold over itself.
const ATMOSPHERE_GROUND_WARP = 0.7;

// The level the land is split at: below it the low color, above it the high, with the room's own
// softness deciding how wide the slope between them runs.
//
// **It sits above where the field ends up, not astride it**, so the low color is the country and the
// high one is what stands out of it. The crest term below lifts the whole field, so a level left
// where the raw field's middle was would spend its time at the bottom of the range and paint almost
// everything the high color — a snowfield with the land showing through, which is the picture the
// other way up. Placed honestly at the middle, the two would split the ground evenly and neither
// would read as the accent; a landscape is mostly its own ground, with ridges and summits as the
// exception.
//
// Only the level is fixed, and the width around it is the room's, for the reason the clouds' cut
// level is fixed and their edge is not: moving the level is really a way of asking how much of the
// country is upland, which is a different question from how sharply the two meet.
const ATMOSPHERE_GROUND_LEVEL = 0.685;

// How far the crest lines are lifted above the land they run along. Small, and deliberately: this is
// an accent on the slopes, not the shape of the country. Pushed up far enough to lead, it takes over
// the whole surface — every point becomes either crest or crease with no flat ground anywhere, which
// is the ripple pattern again by another route.
const ATMOSPHERE_GROUND_CREST = 0.14;

// How quickly the land is lost into the air with distance. Measured in drops — the distance the
// ground plane sits below the eye — so that it sets one thing only: how wide a band below the
// horizon carries land, whatever coarseness the room has picked for it.
//
// **This is what makes the horizon a distance rather than a line.** Ground and sky are two different
// things drawn either side of a hard cut in the shader, and if the cut were visible the whole effect
// would collapse into a stripe across the screen. It is not visible, because a ray approaching level
// meets the land further and further away, so by the time it is level the land is infinitely far off
// and has faded into the air completely — which is the color the sky on the other side of the cut is
// already painted in. The two meet in the same color without either being told about the other.
const ATMOSPHERE_GROUND_HAZE = 0.12;

// How level a ray may get before it is simply treated as level. Only a guard against the division
// below: by this angle the land is far past the distance any of it survives to.
const ATMOSPHERE_GROUND_MIN_DIP = 0.002;

// How much is added to the room's own slope width for each feature width of distance. Distant land is
// compressed, so a slope that reads as a hillside close to hand reads as a flicker far off; widening
// it with distance flattens it back toward one color, which is both what distance does to land anyway
// and what keeps land near the horizon from crawling — a field sampled faster than the screen can
// carry sparkles, and this has smoothed it away before it ever gets that fine.
//
// In feature widths rather than in drops, unlike the haze, because it is answering a question about
// resolution rather than about air: it is the coarseness of the land, not the depth of the plane it
// is drawn on, that decides how much of the field lands inside one pixel.
const ATMOSPHERE_GROUND_SPREAD = 0.008;

// The land under the sky — everything below the horizon, which without it is the same empty air as
// everything above it. Only the sky reads this: the fog is the air *in and around the room*, and a
// floor at the far end of a room fading into a hillside would be wrong.
//
// Sampled the way the clouds are, over the dome of directions, so it costs the room nothing to be
// walked across. Land is the one place that could have argued for real parallax instead — but the
// land is a backdrop at the scale of a country and the room is thirty-odd paces wide, so there is no
// parallax to be had at any scale that still looks like distance.
export const ATMOSPHERE_GROUND_PARS_GLSL = `
    uniform vec3 atmosphereGroundColor;
    uniform vec3 atmospherePeakColor;
    // (how coarse the country is, how far it holds its color against the air, how wide the slope
    // between its two colors runs)
    uniform vec3 atmosphereGroundShape;

    const float ATMOSPHERE_GROUND_WARP = ${ATMOSPHERE_GROUND_WARP.toFixed(4)};
    const float ATMOSPHERE_GROUND_LEVEL = ${ATMOSPHERE_GROUND_LEVEL.toFixed(4)};
    const float ATMOSPHERE_GROUND_CREST = ${ATMOSPHERE_GROUND_CREST.toFixed(4)};
    const float ATMOSPHERE_GROUND_HAZE = ${ATMOSPHERE_GROUND_HAZE.toFixed(4)};
    const float ATMOSPHERE_GROUND_MIN_DIP = ${ATMOSPHERE_GROUND_MIN_DIP.toFixed(4)};
    const float ATMOSPHERE_GROUND_SPREAD = ${ATMOSPHERE_GROUND_SPREAD.toFixed(4)};

    // How high the land stands at a point on it, from the floor of a valley to the top of a ridge.
    //
    // The fractal field is the country itself — it spends most of its time near its own middle and
    // reaches out either side of it, which is what gives broad plains and broad uplands with slopes
    // running between them. Warped first, so those masses are sheared along their own gradients
    // rather than left as the rounded swells an unwarped field gives, which is what erosion is not.
    //
    // Folded about its middle, the same field gives a second one: high exactly where the first is
    // halfway up, which is to say along the contour running through every slope. A contour of a
    // fractal field is a long winding line that branches and rejoins, so adding a little of it lays
    // a ridgeline down the middle of each slope with valleys running out of it — the accent that
    // makes the country read as carved rather than as poured, without becoming the country.
    float atmosphereGroundHeight(vec2 p)
    {
        vec2 warp = vec2(
            valueNoise(vec3(p, 0.0)),
            valueNoise(vec3(p.yx, 11.3))) - 0.5;
        float field = valueNoiseFbm(vec3(p + warp * ATMOSPHERE_GROUND_WARP, 0.0));
        float crest = 1.0 - abs(field * 2.0 - 1.0);
        return field + ATMOSPHERE_GROUND_CREST * crest * crest;
    }

    // What stands in a given direction below the horizon, over the air that was already worked out
    // for it. Above the horizon nothing does, and the air is handed straight back.
    vec3 atmosphereGround(vec3 air, vec3 dir)
    {
        if (dir.y >= 0.0)
            return air;

        // Where the ray meets the ground. The land is drawn on a plane under the eye rather than on
        // the dome the clouds are on, which is the whole of why it reads as ground: a plane seen
        // from above it runs away from the viewer, so its features stretch and crowd toward the
        // horizon exactly as real ground does, while anything painted on the dome would keep the
        // same apparent size all the way down and read as a wall.
        //
        // How far under the eye that plane sits is not a setting, because it cannot be told apart
        // from how far the air reaches — halving the drop and halving the haze give the same
        // picture. So the plane is one unit down and the haze constant above carries both, and this
        // distance is in units of that drop. The room's own scale is applied only to the point being
        // sampled, so that asking for coarser country changes how big its hills are and nothing else.
        vec2 groundRay = dir.xz / max(-dir.y, ATMOSPHERE_GROUND_MIN_DIP);
        float groundRange = length(groundRay);
        vec2 groundPoint = groundRay * atmosphereGroundShape.x;

        // The room's own slope width, opened further by however much of the field lands inside one
        // pixel at this distance. The per-pixel term is a floor rather than a setting, exactly as it
        // is for the clouds: the tightest edge a room may ask for is the tightest one that can be
        // drawn without crawling.
        float height = atmosphereGroundHeight(groundPoint);
        float slope = atmosphereGroundShape.z + length(groundPoint) * ATMOSPHERE_GROUND_SPREAD;
        vec3 land = mix(atmosphereGroundColor, atmospherePeakColor,
            smoothstep(ATMOSPHERE_GROUND_LEVEL - slope, ATMOSPHERE_GROUND_LEVEL + slope, height));

        // The room's solidity divides the rate the land is lost at rather than lifting its coverage
        // off zero. **That distinction is what keeps the horizon a distance.** Land held even
        // slightly opaque at the horizon would meet the sky in a color the sky is not, and draw the
        // seam this whole arrangement exists to avoid; dividing the rate leaves it still arriving at
        // nothing exactly there, having simply taken longer to go.
        return mix(air, land,
            exp(-groundRange * ATMOSPHERE_GROUND_HAZE / atmosphereGroundShape.y));
    }
`;

// How far the smoke is dragged aside by a sample of itself, which is the clouds' trick again but
// gentler. The clouds want the piled edge of a cumulus; smoke wants a drag and a curl, and since this
// field is never cut into shapes, a shear as hard as theirs shows up as a crease rather than a curl.
const ATMOSPHERE_SMOKE_WARP = 0.6;

// How much slower the field doing the shearing travels than the smoke it is shearing.
//
// **Without it the smoke would not move so much as scroll.** A field that only translates is a
// printed sheet being pulled past the room: however slowly it is set, nothing about it is changing,
// and the eye reads the rigidity immediately. Letting the warp lag behind gives the two a relative
// motion, so every mass stretches and folds as it goes — which is the difference between air moving
// and a texture sliding, for no extra samples at all.
const ATMOSPHERE_SMOKE_CHURN = 0.35;

// Between which two levels of the field the air actually thins.
//
// **This is what makes the fog gentler than the sky, and it is a deliberate absence.** The clouds cut
// their field at a level to give every mass an edge, because a cloud is only legible as a shape. Air
// is not a shape — the player is standing inside it — and an edge in it reads as a crease drawn
// across the room. So there is no cut here at all: only a slow lean from thick air to thin.
//
// Set well inside what the field can reach, rather than around it. A fractal field is not spread
// evenly over its range — it crowds around its own middle and reaches the ends only in small pockets
// — so a ramp stretched across the whole range spends the dial's travel on a variation of a few
// tenths and never arrives anywhere. Bringing the two levels in gives the top of the dial somewhere
// to get to, which is what makes it able to open the air right up while the ramp stays smooth.
const ATMOSPHERE_SMOKE_LOW = 0.30;
const ATMOSPHERE_SMOKE_HIGH = 0.72;

// The fog's own field: the room's air being unevenly thick, which is what smoke and dry ice actually
// are. Nothing here is shared with the sky (see this module's note) — not the coordinate it is read
// on, not the shaping, and not what it does with the answer.
export const ATMOSPHERE_SMOKE_PARS_GLSL = `
    uniform float atmosphereTime;
    // (how fine the smoke is, how fast it travels in world units a second, how far it thins the air
    // where it lies thickest)
    uniform vec3 atmosphereSmoke;
    // Which way it travels, as a unit vector in the world's own axes.
    uniform vec3 atmosphereSmokeDrift;
    ${VALUE_NOISE_GLSL}

    const float ATMOSPHERE_SMOKE_WARP = ${ATMOSPHERE_SMOKE_WARP.toFixed(4)};
    const float ATMOSPHERE_SMOKE_CHURN = ${ATMOSPHERE_SMOKE_CHURN.toFixed(4)};
    const float ATMOSPHERE_SMOKE_LOW = ${ATMOSPHERE_SMOKE_LOW.toFixed(4)};
    const float ATMOSPHERE_SMOKE_HIGH = ${ATMOSPHERE_SMOKE_HIGH.toFixed(4)};

    // How far the air has thinned at a point in the room, from not at all to as far as the room
    // allows.
    //
    // Volumetric in the plain sense: the field is three-dimensional and is read at the point the
    // fragment stands at, so a thinning of the air occupies a region of the room rather than a patch
    // of the screen. Two surfaces meeting in a corner agree about the air in front of them because
    // they are asking about the same place, and a wall passing behind a thin patch shows through it.
    //
    // The drift is subtracted from the world position before the scale is applied, so it is a rate
    // through the room in world units rather than through the field — asking for finer smoke does not
    // also appear to speed it up. That is the same separation the clouds keep between their scale and
    // their speed, arrived at from the other side, since theirs is an angular rate and this is a
    // linear one.
    float atmosphereSmokeThinning(vec3 worldPos)
    {
        vec3 travel = atmosphereSmokeDrift * (atmosphereTime * atmosphereSmoke.y);
        vec3 p = (worldPos - travel) * atmosphereSmoke.x;

        // The shearing field travels at a fraction of the smoke's own speed, which is what leaves the
        // two sliding against each other. Offset as well, so the two are decorrelated rather than
        // merely out of step.
        vec3 q = (worldPos - travel * (1.0 - ATMOSPHERE_SMOKE_CHURN)) * atmosphereSmoke.x + 13.7;
        vec3 warp = vec3(
            valueNoise(q),
            valueNoise(q.yzx + 31.4),
            valueNoise(q.zxy + 57.8)) - 0.5;

        float field = valueNoiseFbm(p + warp * ATMOSPHERE_SMOKE_WARP);
        return smoothstep(ATMOSPHERE_SMOKE_LOW, ATMOSPHERE_SMOKE_HIGH, field);
    }
`;

// The fog's half needs where the fragment actually *is*, since the smoke is a volume standing in the
// room rather than a pattern on a dome. The vertex stage is where that is cheapest: the instancing
// and the model transform are both already to hand there, so it is two multiplies rather than the
// per-vertex matrix inverse that recovering it from the projection would take.
export const ATMOSPHERE_FOG_VERTEX_PARS_GLSL = `
    #ifdef USE_FOG
        varying vec3 vAtmosphereWorldPos;
    #endif
`;

// Assembled from the same pieces three.js's own projection is assembled from, and in the same order,
// so an instanced mesh lands where its instance actually stands.
export const ATMOSPHERE_FOG_VERTEX_GLSL = `
    #ifdef USE_FOG
        vec4 atmosphereWorld = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
            atmosphereWorld = instanceMatrix * atmosphereWorld;
        #endif
        vAtmosphereWorldPos = (modelMatrix * atmosphereWorld).xyz;
    #endif
`;

export const ATMOSPHERE_FOG_FRAGMENT_PARS_GLSL = `
    #ifdef USE_FOG
        varying vec3 vAtmosphereWorldPos;
    #endif
    ${ATMOSPHERE_SMOKE_PARS_GLSL}
`;

// Replaces three.js's own fog chunk rather than following it, because what changes is *how much fog
// there is* — and by the time the stock chunk has run it has already been applied. The distances
// themselves are the stock chunk verbatim, so they behave exactly as they always have.
//
// **The smoke thins the fog rather than coloring it**, which is the other half of what separates it
// from the sky's clouds. A cloud is a thing standing in the air and is painted its own color. Smoke
// is the air itself being unevenly thick, and what unevenly thick air does is let more or less of
// what is behind it through — so this scales the coverage the distance asked for, and the color mixed
// toward is the room's own fog color with nothing done to it. Where the smoke lies thickest the room
// shows through; where it is absent the fog closes as it always did.
//
// The test is on a uniform, so every fragment in the frame takes the same branch and none of them
// pays for the other. A room that has asked for even air therefore pays nothing at all for this.
export const ATMOSPHERE_FOG_FRAGMENT_GLSL = `
    #ifdef USE_FOG
        #ifdef FOG_EXP2
            float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
        #else
            float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
        #endif
        if (atmosphereSmoke.z > 0.0)
        {
            fogFactor *= 1.0 -
                atmosphereSmoke.z * atmosphereSmokeThinning(vAtmosphereWorldPos);
        }
        gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
    #endif
`;

import { PLAYER_HEIGHT, PLAYER_RADIUS_XZ } from "../../../../../system/sharedConstants";
import InstancedMeshIdUtil from "../../../util/instancedMeshIdUtil";

//------------------------------------------------------------------------
// Core dimensions:
//------------------------------------------------------------------------

const colliderTopY = PLAYER_HEIGHT;
const eyeY = 0.8 * PLAYER_HEIGHT;
const colliderCenterY = 0.5 * PLAYER_HEIGHT;
const minHoverHeightY = 0.1 * PLAYER_HEIGHT;
const colliderSizeXZ = 2 * PLAYER_RADIUS_XZ;

//------------------------------------------------------------------------
// Constraints:
// (Note: We are assuming here that the diameter of each spherical body part is identical to its scale, in all X,Y,Z axes)
//------------------------------------------------------------------------

// Each of the player's two eyes consists of two circles - inner and outer.
// The inner circle ("pupil") has its own radius and color,
// and the outer circle ("iris") has its own radius and color as well.
// The inner circle ("pupil") takes priority when it comes to rendering.
// That is, when the two circles overlap, the color of the inner circle ("pupil")
// will be rendered in front and that of the outer circle ("iris") will be hidden.
// Note that the radius of either circle cannot be less than the minimum value
// (i.e. minimum radius required for anyone to easily recognize at least as a distinct dot)
// and no greater than that which is required to ensure that the gap between the
// two eyes is not too negligibly small.
const distBetweenEyeCenters = 0.3333 * colliderSizeXZ;
const minGapBetweenEyes = 0.01 * PLAYER_HEIGHT;
const maxEyeRadius = 0.5 * (distBetweenEyeCenters - minGapBetweenEyes); // Eyes can be as wide as possible, but only as long as the minimum gap between them is preserved.
const minEyeRadius = 0.01 * PLAYER_HEIGHT;

// The neck refers to the hollow space between:
//      (1) The bottom y-coordinate of the player's head, and
//      (2) The top y-coordinate of the player's torso.
// "neckY" points to the center of the neck
// (i.e. the midpoint between the head's bottom and torso's top).
const neckHeight = 0.05 * PLAYER_HEIGHT; // neckHeight = Amount of gap (in the y-axis), between the head's bottom and the torso's top.
const maxNeckY = eyeY - maxEyeRadius - 0.5 * neckHeight; // Neck must not overlap with the eyes.
const minNeckY = colliderCenterY;

// "headTopY" points to the top y-coordinate of the player's head,
// which is adjustable.
// However, it must not be lower than the top of the player's eyes (plus some margin),
// and not be higher than the top edge of the player's collider (see "hitboxSize" in PlayerObjectTypeConfig). 
const maxHeadTopY = colliderTopY;
const minHeadTopY = eyeY + maxEyeRadius; // Eyes must not stick out above the head.

// "torsoBottomY" points to the bottom y-coordinate of the player's torso,
// which is adjustable.
// However, it must not be lower than the "min hover height",
// and not be higher than some margin above the "min hover height".
// "min hover height" refers to the minimum gap between the player's body
// and the ground upon which the player is hovering.
// (Note: Players don't have legs; I made them simply float
// above the ground because legs are too hard to animate.)
const maxTorsoBottomY = colliderCenterY - 0.2 * PLAYER_HEIGHT;
const minTorsoBottomY = minHoverHeightY;
const maxTorsoTopY = maxNeckY - 0.5 * neckHeight;
const minTorsoTopY = minNeckY - 0.5 * neckHeight;
const maxTorsoLength = maxTorsoTopY - minTorsoBottomY;
const minTorsoLength = minTorsoTopY - maxTorsoBottomY;

// The player has two arms, one on the left side of the torso
// and the other one on the right side of the torso.
// Each arm's top is set to be slightly lower than the top of the torso
// (i.e. at a fixed distance from the top of the torso),
// yet the arms' length (represented by "armLength") is adjustable.
// It should be noted, though, that the bottom of the arms must not
// extend beneath the torso.
const armsOffsetFromTorsoTop = 0.05 * PLAYER_HEIGHT; // = Distance between the arms' top and the torso's top.
const maxArmLength = minTorsoLength - armsOffsetFromTorsoTop; // Arms must not stretch beneath the torso.
const minArmLength = 0.1 * maxTorsoLength; // Arms must be at least 10% of the torso's height.

// The parameters listed below determine how fat the player's body parts
// will be. However, they do have some range constraints,
// which are stated as the following:

// The head must be wide enough to fully contain both of the eyes,
// no matter how big the eyes are.
// The head must not be wider than the collider's
// XZ size (see "hitboxSize" in PlayerObjectTypeConfig)
const maxHeadSizeXZ = colliderSizeXZ; // Head must not be wider than the collider.
const minHeadSizeXZ = 4 * maxEyeRadius + minGapBetweenEyes; // Head must be wide enough to span the diameters of the biggest possible pair of eyes, plus the gap between them.

// The torso must be wide enough to ensure that the two arms have
// a considerable margin between them, no matter how thick the arms are.
// The torso must not be wider than the collider's
// XZ size (see "hitboxSize" in PlayerObjectTypeConfig)
const maxTorsoSizeXZ = colliderSizeXZ; // Torso must not be wider than the collider.
const minTorsoSizeXZ = 0.5 * colliderSizeXZ;

// The arms must be wide enough to ensure that they don't look like thin rods.
// The arms must not be wider than the torso's minimum XZ size.
const maxArmSizeXZ = minTorsoSizeXZ;
const minArmSizeXZ = 0.05 * PLAYER_HEIGHT;

export const PlayerCompositionParams = {
    ids: {
        instancedMeshId_body: InstancedMeshIdUtil.getInstancedMeshId("Icosphere", "InstancedColor"),
        instancedMeshId_eye: InstancedMeshIdUtil.getInstancedMeshId("Square", "InstancedEye"),
    },
    points: {
        colliderCenterY,
        eyeY,
        distBetweenEyeCenters,
        neckHeight,
        armsOffsetFromTorsoTop,
    },
    ranges: {
        headTopY: [minHeadTopY, maxHeadTopY],
        neckY: [minNeckY, maxNeckY],
        torsoBottomY: [minTorsoBottomY, maxTorsoBottomY],
        armLength: [minArmLength, maxArmLength],
        headSizeXZ: [minHeadSizeXZ, maxHeadSizeXZ],
        torsoSizeXZ: [minTorsoSizeXZ, maxTorsoSizeXZ],
        armSizeXZ: [minArmSizeXZ, maxArmSizeXZ],
        pupilRadius: [minEyeRadius, maxEyeRadius],
        irisRadius: [minEyeRadius, maxEyeRadius],
    },
}
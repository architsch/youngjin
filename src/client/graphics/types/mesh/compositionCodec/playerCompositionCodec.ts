import ColorUtil from "../../../../../shared/math/util/colorUtil";
import NumUtil from "../../../../../shared/math/util/numUtil";
import StringUtil from "../../../../../shared/math/util/stringUtil";
import { PlayerCompositionParams } from "../compositionParams/playerCompositionParams";
import InstancedMeshCompositionPart from "../instancedMeshCompositionPart";
import InstancedMeshCompositionCodec from "./instancedMeshCompositionCodec";

const ids = PlayerCompositionParams.ids;
const p = PlayerCompositionParams.points;
const r = PlayerCompositionParams.ranges;

export const PlayerCompositionCodec: InstancedMeshCompositionCodec = {
    encode: (encodeInput: InstancedMeshCompositionPart[]): string =>
    {
        const head = encodeInput[0];
        const torso = encodeInput[1];
        const arm1 = encodeInput[2];
        const eye1 = encodeInput[4];
        
        const headTopY = p.colliderCenterY + head.offset.y + 0.5 * head.scale.y;
        const headBottomY = headTopY - head.scale.y;
        const torsoTopY = p.colliderCenterY + torso.offset.y + 0.5 * torso.scale.y;
        const torsoBottomY = torsoTopY - torso.scale.y;
        const neckY = 0.5 * (headBottomY + torsoTopY);
        const armLength = arm1.scale.y;
        const headSizeXZ = head.scale.x;
        const torsoSizeXZ = torso.scale.x;
        const armSizeXZ = arm1.scale.x;
        const pupilRadius = eye1.pupilRadius;
        const irisRadius = eye1.irisRadius;
        const headColor = ColorUtil.rgbToBase94Index(head.color);
        const torsoColor = ColorUtil.rgbToBase94Index(torso.color);
        const armColor = ColorUtil.rgbToBase94Index(arm1.color);
        const pupilColor = ColorUtil.rgbToBase94Index(eye1.pupilColor);
        const irisColor = ColorUtil.rgbToBase94Index(eye1.irisColor);

        // Each value becomes a single visible-ASCII character, mirroring the decode order below.
        return [
            StringUtil.convertNumberToVisibleASCII(headTopY, r.headTopY[0], r.headTopY[1]),
            StringUtil.convertNumberToVisibleASCII(neckY, r.neckY[0], r.neckY[1]),
            StringUtil.convertNumberToVisibleASCII(torsoBottomY, r.torsoBottomY[0], r.torsoBottomY[1]),
            StringUtil.convertNumberToVisibleASCII(armLength, r.armLength[0], r.armLength[1]),
            StringUtil.convertNumberToVisibleASCII(headSizeXZ, r.headSizeXZ[0], r.headSizeXZ[1]),
            StringUtil.convertNumberToVisibleASCII(torsoSizeXZ, r.torsoSizeXZ[0], r.torsoSizeXZ[1]),
            StringUtil.convertNumberToVisibleASCII(armSizeXZ, r.armSizeXZ[0], r.armSizeXZ[1]),
            StringUtil.convertNumberToVisibleASCII(pupilRadius, r.pupilRadius[0], r.pupilRadius[1]),
            StringUtil.convertNumberToVisibleASCII(irisRadius, r.irisRadius[0], r.irisRadius[1]),
            StringUtil.convertRawNumberToVisibleASCII(headColor),
            StringUtil.convertRawNumberToVisibleASCII(torsoColor),
            StringUtil.convertRawNumberToVisibleASCII(armColor),
            StringUtil.convertRawNumberToVisibleASCII(pupilColor),
            StringUtil.convertRawNumberToVisibleASCII(irisColor),
        ].join("");
    },
    decode: (strToDecode: string, decodeOutput: InstancedMeshCompositionPart[]): void =>
    {
        // First two chars are for the codec's type and version, respectively.
        let charOffset = 2;

        const headTopY = StringUtil.convertVisibleASCIIToNumber(strToDecode, charOffset++, r.headTopY[0], r.headTopY[1]);
        const neckY = StringUtil.convertVisibleASCIIToNumber(strToDecode, charOffset++, r.neckY[0], r.neckY[1]);
        const torsoBottomY = StringUtil.convertVisibleASCIIToNumber(strToDecode, charOffset++, r.torsoBottomY[0], r.torsoBottomY[1]);
        const armLength = StringUtil.convertVisibleASCIIToNumber(strToDecode, charOffset++, r.armLength[0], r.armLength[1]);
        const headSizeXZ = StringUtil.convertVisibleASCIIToNumber(strToDecode, charOffset++, r.headSizeXZ[0], r.headSizeXZ[1]);
        const torsoSizeXZ = StringUtil.convertVisibleASCIIToNumber(strToDecode, charOffset++, r.torsoSizeXZ[0], r.torsoSizeXZ[1]);
        const armSizeXZ = StringUtil.convertVisibleASCIIToNumber(strToDecode, charOffset++, r.armSizeXZ[0], r.armSizeXZ[1]);
        const pupilRadius = StringUtil.convertVisibleASCIIToNumber(strToDecode, charOffset++, r.pupilRadius[0], r.pupilRadius[1]);
        const irisRadius = StringUtil.convertVisibleASCIIToNumber(strToDecode, charOffset++, r.irisRadius[0], r.irisRadius[1]);

        // Each color will be encoded as an index in a color palette,
        // which consists of 94 color choices in total.
        const headColor = ColorUtil.base94IndexToRGB(StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charOffset++, 0));
        const torsoColor = ColorUtil.base94IndexToRGB(StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charOffset++, 0));
        const armColor = ColorUtil.base94IndexToRGB(StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charOffset++, 0));
        const pupilColor = ColorUtil.base94IndexToRGB(StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charOffset++, 0));
        const irisColor = ColorUtil.base94IndexToRGB(StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charOffset++, 0));

        //------------------------------------------------------------------------
        // Construction of Parts
        //------------------------------------------------------------------------

        const headBottomY = neckY + 0.5 * p.neckHeight;
        const headCenterY = 0.5 * (headTopY + headBottomY);
        const torsoTopY = neckY - 0.5 * p.neckHeight;
        const torsoCenterY = 0.5 * (torsoTopY + torsoBottomY);
        const armTopY = torsoTopY - p.armsOffsetFromTorsoTop;
        const armCenterY = armTopY - 0.5 * armLength;
        const eyeRadius = Math.max(pupilRadius, irisRadius);

        decodeOutput.push({ // head
            instancedMeshId: ids.instancedMeshId_body,
            dir: {x: 0, y: 1, z: 0},
            offset: {x: 0, y: headCenterY - p.colliderCenterY, z: 0},
            scale: {x: headSizeXZ, y: headTopY - headBottomY, z: headSizeXZ},
            color: headColor,
        });
        decodeOutput.push({ // torso
            instancedMeshId: ids.instancedMeshId_body,
            dir: {x: 0, y: 1, z: 0},
            offset: {x: 0, y: torsoCenterY - p.colliderCenterY, z: 0},
            scale: {x: torsoSizeXZ, y: torsoTopY - torsoBottomY, z: torsoSizeXZ},
            color: torsoColor,
        });
        decodeOutput.push({ // arm 1
            instancedMeshId: ids.instancedMeshId_body,
            dir: {x: 0, y: 1, z: 0},
            offset: {x: 0.5 * torsoSizeXZ, y: armCenterY - p.colliderCenterY, z: 0},
            scale: {x: armSizeXZ, y: armLength, z: armSizeXZ},
            color: armColor,
        });
        decodeOutput.push({ // arm 2
            instancedMeshId: ids.instancedMeshId_body,
            dir: {x: 0, y: 1, z: 0},
            offset: {x: -0.5 * torsoSizeXZ, y: armCenterY - p.colliderCenterY, z: 0},
            scale: {x: armSizeXZ, y: armLength, z: armSizeXZ},
            color: armColor,
        });
        decodeOutput.push({ // eye 1
            instancedMeshId: ids.instancedMeshId_eye,
            dir: {x: 0, y: 0, z: -1},
            offset: {x: 0.5 * p.distBetweenEyeCenters, y: p.eyeY - p.colliderCenterY, z: -0.5 * headSizeXZ},
            scale: {x: eyeRadius, y: eyeRadius, z: 1},
            pupilRadius, irisRadius, pupilColor, irisColor,
        });
        decodeOutput.push({ // eye 2
            instancedMeshId: ids.instancedMeshId_eye,
            dir: {x: 0, y: 0, z: -1},
            offset: {x: -0.5 * p.distBetweenEyeCenters, y: p.eyeY - p.colliderCenterY, z: -0.5 * headSizeXZ},
            scale: {x: eyeRadius, y: eyeRadius, z: 1},
            pupilRadius, irisRadius, pupilColor, irisColor,
        });
    },
    getRandomComposition: (): InstancedMeshCompositionPart[] =>
    {
        const parts: InstancedMeshCompositionPart[] = [];

        const headTopY = NumUtil.randomFloat(r.headTopY[0], r.headTopY[1]);
        const neckY = NumUtil.randomFloat(r.neckY[0], r.neckY[1]);
        const torsoBottomY = NumUtil.randomFloat(r.torsoBottomY[0], r.torsoBottomY[1]);
        const armLength = NumUtil.randomFloat(r.armLength[0], r.armLength[1]);
        const headSizeXZ = NumUtil.randomFloat(r.headSizeXZ[0], r.headSizeXZ[1]);
        const torsoSizeXZ = NumUtil.randomFloat(r.torsoSizeXZ[0], r.torsoSizeXZ[1]);
        const armSizeXZ = NumUtil.randomFloat(r.armSizeXZ[0], r.armSizeXZ[1]);
        const pupilRadius = NumUtil.randomFloat(r.pupilRadius[0], r.pupilRadius[1]);
        const irisRadius = NumUtil.randomFloat(r.irisRadius[0], r.irisRadius[1]);
        const headColor = ColorUtil.base94IndexToRGB(NumUtil.randomInt(0, 93));
        const torsoColor = ColorUtil.base94IndexToRGB(NumUtil.randomInt(0, 93));
        const armColor = ColorUtil.base94IndexToRGB(NumUtil.randomInt(0, 93));
        const pupilColor = ColorUtil.base94IndexToRGB(NumUtil.randomInt(0, 93));
        const irisColor = ColorUtil.base94IndexToRGB(NumUtil.randomInt(0, 93));

        const eyeRadius = Math.max(pupilRadius, irisRadius);
        const headBottomY = neckY + 0.5 * p.neckHeight;
        const headCenterY = 0.5 * (headTopY + headBottomY);
        const torsoTopY = neckY - 0.5 * p.neckHeight;
        const torsoCenterY = 0.5 * (torsoTopY + torsoBottomY);
        const armTopY = torsoTopY - p.armsOffsetFromTorsoTop;
        const armCenterY = armTopY - 0.5 * armLength;

        parts.push({ // head
            instancedMeshId: ids.instancedMeshId_body,
            dir: {x: 0, y: 1, z: 0},
            offset: {x: 0, y: headCenterY - p.colliderCenterY, z: 0},
            scale: {x: headSizeXZ, y: headTopY - headBottomY, z: headSizeXZ},
            color: headColor,
        });
        parts.push({ // torso
            instancedMeshId: ids.instancedMeshId_body,
            dir: {x: 0, y: 1, z: 0},
            offset: {x: 0, y: torsoCenterY - p.colliderCenterY, z: 0},
            scale: {x: torsoSizeXZ, y: torsoTopY - torsoBottomY, z: torsoSizeXZ},
            color: torsoColor,
        });
        parts.push({ // arm 1
            instancedMeshId: ids.instancedMeshId_body,
            dir: {x: 0, y: 1, z: 0},
            offset: {x: 0.5 * torsoSizeXZ, y: armCenterY - p.colliderCenterY, z: 0},
            scale: {x: armSizeXZ, y: armLength, z: armSizeXZ},
            color: armColor,
        });
        parts.push({ // arm 2
            instancedMeshId: ids.instancedMeshId_body,
            dir: {x: 0, y: 1, z: 0},
            offset: {x: -0.5 * torsoSizeXZ, y: armCenterY - p.colliderCenterY, z: 0},
            scale: {x: armSizeXZ, y: armLength, z: armSizeXZ},
            color: armColor,
        });
        parts.push({ // eye 1
            instancedMeshId: ids.instancedMeshId_eye,
            dir: {x: 0, y: 0, z: -1},
            offset: {x: 0.5 * p.distBetweenEyeCenters, y: p.eyeY - p.colliderCenterY, z: -0.5 * headSizeXZ},
            scale: {x: eyeRadius, y: eyeRadius, z: 1},
            pupilRadius, irisRadius, pupilColor, irisColor,
        });
        parts.push({ // eye 2
            instancedMeshId: ids.instancedMeshId_eye,
            dir: {x: 0, y: 0, z: -1},
            offset: {x: -0.5 * p.distBetweenEyeCenters, y: p.eyeY - p.colliderCenterY, z: -0.5 * headSizeXZ},
            scale: {x: eyeRadius, y: eyeRadius, z: 1},
            pupilRadius, irisRadius, pupilColor, irisColor,
        });

        return parts;
    },
}
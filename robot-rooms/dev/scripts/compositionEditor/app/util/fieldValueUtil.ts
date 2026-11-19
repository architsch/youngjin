import PreEncodingSourcePart from "../../../../../src/shared/graphics/mesh/composition/types/preEncodingSourcePart";
import { PRE_ENCODING_INDETERMINATE } from "../../../../../src/shared/graphics/mesh/composition/util/preEncodingSourceUtil";
import ColorUtil from "../../../../../src/shared/math/util/colorUtil";
import { DIR_VEC_BY_NAME } from "../../../../../src/shared/system/sharedConstants";
import FieldDomain from "../types/fieldDomain";
import FieldDomainUtil from "./fieldDomainUtil";
import PathUtil from "./pathUtil";

const FieldValueUtil =
{
    // A choice of RGB vectors is a palette.
    isColorDomain: (domain: FieldDomain): boolean =>
    {
        return domain.kind == "choice" && domain.options.length > 0 && domain.options.every(isRGB);
    },

    // All channels -1: filled in by the object after decoding (see PreEncodingSourceUtil).
    isIndeterminate: (value: any): boolean =>
    {
        return value?.x == PRE_ENCODING_INDETERMINATE && value?.y == PRE_ENCODING_INDETERMINATE
            && value?.z == PRE_ENCODING_INDETERMINATE;
    },

    getIndeterminateColor: (): {x: number, y: number, z: number} =>
    {
        return {x: PRE_ENCODING_INDETERMINATE, y: PRE_ENCODING_INDETERMINATE, z: PRE_ENCODING_INDETERMINATE};
    },

    findOption: (options: any[], value: any): number =>
    {
        const json = JSON.stringify(value);
        return options.findIndex(option => JSON.stringify(option) == json);
    },

    getNearestNumberIndex: (values: number[], value: number): number =>
    {
        let nearestIndex = 0;
        for (let i = 1; i < values.length; ++i)
        {
            if (Math.abs(values[i] - value) < Math.abs(values[nearestIndex] - value))
                nearestIndex = i;
        }
        return nearestIndex;
    },

    toHex: (rgb: {x: number, y: number, z: number}): string =>
    {
        return ColorUtil.rgbToHex(rgb);
    },

    // A facing by its axis name, anything else by its components.
    getChoiceLabel: (value: any): string =>
    {
        const json = JSON.stringify(value);
        const dirName = Object.keys(DIR_VEC_BY_NAME).find(name => JSON.stringify(DIR_VEC_BY_NAME[name]) == json);
        if (dirName != undefined)
            return dirName;
        if (value != undefined && typeof value == "object")
            return `(${Object.values(value).join(", ")})`;
        return String(value);
    },

    // The part as another material would take it: the fields that material has, kept where they fit it (a
    // color moves to the nearest one in the new palette) and the material's first stored value elsewhere.
    conformPartToMaterial: (part: PreEncodingSourcePart, materialId: string): PreEncodingSourcePart =>
    {
        let conformed: any = FieldDomainUtil.getDefaultPart(materialId, part.geometryId);
        for (const field of FieldDomainUtil.getPartFields(materialId))
        {
            const path = PathUtil.split(field.path);
            const value = PathUtil.get(part, path);
            if (value == undefined)
                continue;
            if (field.domain.kind == "number" && typeof value == "number")
                conformed = PathUtil.set(conformed, path, value);
            else if (field.domain.kind == "boolean" && typeof value == "boolean")
                conformed = PathUtil.set(conformed, path, value);
            else if (FieldValueUtil.isColorDomain(field.domain) && FieldValueUtil.isIndeterminate(value))
                conformed = PathUtil.set(conformed, path, value);
            else if (FieldValueUtil.isColorDomain(field.domain) && isRGB(value))
                conformed = PathUtil.set(conformed, path, getNearestColor(field.domain.kind == "choice" ? field.domain.options : [], value));
            else if (field.domain.kind == "choice" && FieldValueUtil.findOption(field.domain.options, value) >= 0)
                conformed = PathUtil.set(conformed, path, value);
        }
        return conformed;
    },
}

export default FieldValueUtil;

function isRGB(value: any): boolean
{
    return value != undefined && typeof value == "object" && Object.keys(value).sort().join() == "x,y,z"
        && [value.x, value.y, value.z].every(channel => Number.isInteger(channel) && channel >= 0 && channel <= 255);
}

function getNearestColor(options: any[], rgb: {x: number, y: number, z: number}): any
{
    let nearest = options[0];
    let nearestDistSqr = Infinity;
    for (const option of options)
    {
        const distSqr = (option.x - rgb.x) ** 2 + (option.y - rgb.y) ** 2 + (option.z - rgb.z) ** 2;
        if (distSqr < nearestDistSqr)
        {
            nearest = option;
            nearestDistSqr = distSqr;
        }
    }
    return nearest;
}

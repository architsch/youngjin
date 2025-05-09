const limitPropValueTextSize_internal = (obj, propName, propValueTextSizeLimit) =>
{
    for (const [key, value] of Object.entries(obj))
    {
        if (key == propName)
        {
            if (typeof value !== "string")
                throw new Error(`Property "${propName}" is not a string. (obj = ${JSON.stringify(obj)})`);
            const value2 = value.substring(0, propValueTextSizeLimit);
            obj[key] = (value2.length < value.length) ? (value2 + "...") : value2;
            return;
        }

        if (value.constructor == Object)
        {
            limitPropValueTextSize_internal(value, propName, propValueTextSizeLimit);
        }
    }
};

export const objUtil =
{
    limitPropValueTextSize: (obj, propName, propValueTextSizeLimit) =>
    {
        const objCopy = objUtil.deepCopyObj(obj);
        limitPropValueTextSize_internal(objCopy, propName, propValueTextSizeLimit);
        return objCopy;
    },
    deepCopyObj: (obj) =>
    {
        const objCopy = {};
        for (const [key, value] of Object.entries(obj))
        {
            if (Array.isArray(value)) // array
            {
                const arrayCopy = new Array(value.length);
                for (let i = 0; i < value.length; ++i)
                    arrayCopy[i] = value[i];
                objCopy[key] = arrayCopy;
            }
            else if (value.constructor == Object) // object (i.e. key-value pairs)
            {
                objCopy[key] = objUtil.deepCopyObj(value);
            }
            else // number, bool, string, etc.
            {
                objCopy[key] = value;
            }
        }
        return objCopy;
    },
}
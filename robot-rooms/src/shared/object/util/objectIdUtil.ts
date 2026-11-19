const alphanumeric = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

const ObjectIdUtil =
{
    generateRandomObjectId(): string
    {
        let id = "";
        for (let i = 0; i < 8; i++)
            id += alphanumeric[Math.floor(Math.random() * alphanumeric.length)];
        return id;
    },
    // One that no object among these has.
    generateUniqueObjectId(objectById: {[objectId: string]: unknown}): string
    {
        let objectId = ObjectIdUtil.generateRandomObjectId();
        while (objectById[objectId] != undefined)
            objectId = ObjectIdUtil.generateRandomObjectId();
        return objectId;
    },
}

export default ObjectIdUtil;
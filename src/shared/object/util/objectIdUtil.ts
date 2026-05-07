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
}

export default ObjectIdUtil;
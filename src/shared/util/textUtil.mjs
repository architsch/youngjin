export const textUtil =
{
    findErrorInUserName: (text) =>
    {
        if (text.length < 4)
            return "UserName must be at least 4 characters long.";
        if (text.length > 16)
            return "UserName cannot be longer than 16 characters.";
        if (text != textUtil.sanitizeUserName(text))
            return "UserName can only contain alphabets, numbers and underbar(_).";
        return null;
    },
    findErrorInPassword: (text) =>
    {
        if (text.length < 6)
            return "Password must be at least 6 characters long.";
        if (text.length > 24)
            return "Password cannot be longer than 24 characters.";
        if (text != textUtil.sanitizePassword(text))
            return "Password can only contain alphabets, numbers, and the following special characters:\n~`!@#$%^&*()-_+={}[]|\\:;\"'<>,.?/";
        return null;
    },
    findErrorInEmailAddress: (text) =>
    {
        if (text.length > 64)
            return "Email address is too long. It must be less than 64 characters.";
        const regex = /^[^\s@]+@[^\s@]+.[^\s@]+$/;
        if (!regex.test(text))
            return "Please enter a valid email address."
        return null;
    },
    sanitizeUserName: (text) => {
        if (text.length > 16)
            text = text.substring(0, 16);
        return text.replace(/[^a-zA-Z0-9_]/g, "");
    },
    sanitizePassword: (text) => {
        if (text.length > 24)
            text = text.substring(0, 24);
        return text.replace(/[^a-zA-Z0-9~`!@#\$%\^&\*\(\)-_\+=\{\[\}\]\|\\:;"'<,>\.\?\/]/g, "");
    },
}
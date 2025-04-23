export const textUtil =
{
    // character escape

    escapeHTMLChars: (text) =>
    {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },

    // input validation

    findErrorInUserName: (text) =>
    {
        if (text.length < 4 || text.length > 16)
            return textUtil.inputRule.userName.length;
        if (text != textUtil.sanitizeUserName(text))
            return textUtil.inputRule.userName.chars;
        return null;
    },
    findErrorInPassword: (text) =>
    {
        if (text.length < 6 || text.length > 24)
            return textUtil.inputRule.password.length;
        if (text != textUtil.sanitizePassword(text))
            return textUtil.inputRule.password.chars;
        return null;
    },
    findErrorInEmailAddress: (text) =>
    {
        if (text.length > 64)
            return textUtil.inputRule.email.length;
        const regex = /^[^\s@]+@[^\s@]+.[^\s@]+$/;
        if (!regex.test(text))
            return "Please enter a valid email address."
        return null;
    },
    findErrorInRoomName: (text) =>
    {
        if (text.length < 4 || text.length > 64)
            return textUtil.inputRule.roomName.length;
        if (text != textUtil.sanitizeRoomName(text))
            return textUtil.inputRule.roomName.chars;
        return null;
    },
    
    sanitizeUserName: (text) =>
    {
        if (text.length > 16)
            text = text.substring(0, 16);
        return text.replace(/[^a-zA-Z0-9_]/g, "");
    },
    sanitizePassword: (text) =>
    {
        if (text.length > 24)
            text = text.substring(0, 24);
        return text.replace(/[^a-zA-Z0-9~`!@#\$%\^&\*\(\)-_\+=\{\[\}\]\|\\:;"'<>,\.\?\/]/g, "");
    },
    sanitizeRoomName: (text) =>
    {
        if (text.length > 64)
            text = text.substring(0, 64);
        return text.replace(/[^a-zA-Z0-9~`!@#\$%\^&\*\(\)-_\+=\{\[\}\]\|\\:;"'<>,\.\?\/]/g, "")
            .replace(/\s+/g, " ") // replace multiple consecutive spaces with a single space.
            .trim();
    },

    // input rules

    inputRule: {
        userName: {
            length: "Username must be between 4 and 16 characters long.",
            chars: "Username can only contain alphabets, numbers, and underbar(_).",
        },
        password: {
            length: "Password must be between 6 and 24 characters long.",
            chars: "Password can only contain alphabets, numbers, and the following special characters: ~`!@#$%^&*()-_+={}[]|\\:;\"'<>,.?/",
        },
        email: {
            length: "Email cannot contain more than 64 characters."
        },
        roomName: {
            length: "Room name must be between 4 and 64 characters long.",
            chars: "Room name can only contain alphabets, numbers, spaces, and the following special characters: ~`!@#$%^&*()-_+={}[]|\\:;\"'<>,.?/",
        },
    },
}
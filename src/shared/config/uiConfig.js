const UIConfig =
{
    displayText: {
        pageName: {
            "index": "Home", // static
            "arcade": "Arcade", // static
            "library": "Library", // static
            "portfolio": "Portfolio", // static
            "register": "Create Account", // dynamic
            "mypage": "My Page", // dynamic
            "chat": "Chat", // dynamic
        },
        message: {
            "error/userName/length": "Username must be between 4 and 16 characters long.",
            "error/userName/chars": "Username can only contain alphabets, numbers, and underbar(_).",
            "error/password/length": "Password must be between 6 and 24 characters long.",
            "error/password/chars": "Password can only contain alphabets, numbers, and the following special characters: ~`!@#$%^&*()-_+={}[]|\\:;\"'<>,.?/",
            "error/email/length": "Email address must not contain more than 64 characters.",
            "error/email/chars": "Please enter a valid email address.",
            "error/roomName/length": "Room name must be between 4 and 64 characters long.",
            "error/roomName/chars": "Room name can only contain alphabets, numbers, spaces, and the following special characters: ~`!@#$%^&*()-_+={}[]|\\:;\"'<>,.?/",

            "rule/userName/length": "Username must be between 4 and 16 characters long.",
            "rule/userName/chars": "Username can only contain alphabets, numbers, and underbar(_).",
            "rule/password/length": "Password must be between 6 and 24 characters long.",
            "rule/password/chars": "Password can only contain alphabets, numbers, and the following special characters: ~`!@#$%^&*()-_+={}[]|\\:;\"'<>,.?/",
            "rule/email/length": "Email address must not contain more than 64 characters.",
            "rule/roomName/length": "Room name must be between 4 and 64 characters long.",
            "rule/roomName/chars": "Room name can only contain alphabets, numbers, spaces, and the following special characters: ~`!@#$%^&*()-_+={}[]|\\:;\"'<>,.?/",
        },
    },
}

export default UIConfig;
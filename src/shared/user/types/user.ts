import { UserType, UserTypeEnumMap } from "./userType";

export default class User
{
    id: string;
    userName: string;
    userType: UserType;
    email: string;
    tutorialStep: number;
    lastRoomID: string;
    ownedRoomID: string;

    constructor(id: string | undefined, userName: string, userType: UserType, email: string,
        tutorialStep: number, lastRoomID: string = "", ownedRoomID: string = "")
    {
        this.id = (id != undefined) ? id : "";
        this.userName = userName;
        this.userType = userType;
        this.email = email;
        this.tutorialStep = tutorialStep;
        this.lastRoomID = lastRoomID;
        this.ownedRoomID = ownedRoomID;
    }

    static fromString(userString: string): User
    {
        const fields = userString.split(" ");
        const id = fields.length > 0 ? fields[0] : "";
        const userName = fields.length > 1 ? fields[1] : "";
        const userType = fields.length > 2 ? parseInt(fields[2]) : UserTypeEnumMap.Guest;
        const email = fields.length > 3 ? fields[3] : "";
        const tutorialStep = fields.length > 4 ? parseInt(fields[4]) : 0;
        const ownedRoomID = fields.length > 5 ? fields[5] : "";

        if (isNaN(userType))
            throw new Error(`userType is NaN (userString = "${userString}")`);
        if (isNaN(tutorialStep))
            throw new Error(`tutorialStep is NaN (userString = "${userString}")`);

        return new User(id, userName, userType, email, tutorialStep, "", ownedRoomID);
    }

    toString(): string
    {
        return `${this.id} ${this.userName} ${this.userType} ${this.email} ${this.tutorialStep} ${this.ownedRoomID}`;
    }
}

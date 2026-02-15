import { UserType } from "./userType";

export default class User
{
    id: string;
    userName: string;
    userType: UserType;
    email: string;
    tutorialStep: number;
    lastRoomID: string;
    lastX: number;
    lastY: number;
    lastZ: number;
    lastDirX: number;
    lastDirY: number;
    lastDirZ: number;
    playerMetadata: {[key: string]: string};

    constructor(id: string | undefined, userName: string, userType: UserType, email: string,
        tutorialStep: number,
        lastRoomID: string = "", lastX: number = 16, lastY: number = 0, lastZ: number = 16,
        lastDirX: number = 0, lastDirY: number = 0, lastDirZ: number = 1,
        playerMetadata: {[key: string]: string} = {})
    {
        //super();
        this.id = (id != undefined) ? id : "";
        this.userName = userName;
        this.userType = userType;
        this.email = email;
        this.tutorialStep = tutorialStep;
        this.lastRoomID = lastRoomID;
        this.lastX = lastX;
        this.lastY = lastY;
        this.lastZ = lastZ;
        this.lastDirX = lastDirX;
        this.lastDirY = lastDirY;
        this.lastDirZ = lastDirZ;
        this.playerMetadata = playerMetadata;
    }

    static fromString(userString: string): User
    {
        const fields = userString.split(" ");
        const id = fields[0];
        const userName = fields[1];
        const userType = parseInt(fields[2]);
        const email = fields[3];
        const tutorialStep = parseInt(fields[4]);

        if (isNaN(userType))
            throw new Error(`userType is NaN (userString = "${userString}")`);
        if (isNaN(tutorialStep))
            throw new Error(`tutorialStep is NaN (userString = "${userString}")`);

        return new User(id, userName, userType, email, tutorialStep);
    }

    toString(): string
    {
        return `${this.id} ${this.userName} ${this.userType} ${this.email} ${this.tutorialStep}`;
    }
}
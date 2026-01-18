import DB from "../db";
import SQLQuery from "../types/sqlQuery";

export default async function dbTask_init(): Promise<boolean>
{
    return await DB.runTransaction([
        new SQLQuery(`
            CREATE TABLE IF NOT EXISTS users (
                userID INT NOT NULL AUTO_INCREMENT,
                userName VARCHAR(32) NOT NULL,
                userType TINYINT NOT NULL,
                passwordHash VARCHAR(72) NOT NULL,
                email VARCHAR(64) NOT NULL,
                tutorialStep TINYINT NOT NULL,
                PRIMARY KEY (userID),
                UNIQUE KEY (userName),
                UNIQUE KEY (email)
            );
        `),
        new SQLQuery(`
            CREATE TABLE IF NOT EXISTS rooms (
                roomID INT NOT NULL AUTO_INCREMENT,
                roomName VARCHAR(64) NOT NULL,
                roomType TINYINT NOT NULL,
                ownerUserName VARCHAR(16) NOT NULL,
                texturePackURL VARCHAR(128) NOT NULL,
                voxelGrid BLOB NOT NULL,
                persistentObjectGroup BLOB NOT NULL,
                PRIMARY KEY (roomID),
                UNIQUE KEY (roomName)
            );
        `),
        new SQLQuery(`INSERT INTO globalData (dbVersion) VALUES (0);`),
    ]);
}
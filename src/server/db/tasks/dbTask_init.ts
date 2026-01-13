import DB from "../db";
import SQLQuery from "../types/sqlQuery";

export default async function dbTask_init(): Promise<boolean>
{
    return await DB.runTransaction([
        new SQLQuery(`
            CREATE TABLE IF NOT EXISTS users (
                userID INT NOT NULL AUTO_INCREMENT,
                userName VARCHAR(16) NOT NULL,
                userType VARCHAR(16) NOT NULL,
                passwordHash VARCHAR(72) NOT NULL,
                PRIMARY KEY (userID),
                UNIQUE KEY (userName)
            );
        `),
        new SQLQuery(`
            CREATE TABLE IF NOT EXISTS rooms (
                roomID INT NOT NULL AUTO_INCREMENT,
                roomName VARCHAR(64) NOT NULL,
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
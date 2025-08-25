CREATE DATABASE IF NOT EXISTS main;
USE main;

-- Tables

CREATE TABLE IF NOT EXISTS users(
    userID INT NOT NULL AUTO_INCREMENT,
    userName VARCHAR(16) NOT NULL,
    userType VARCHAR(16) NOT NULL,
    passwordHash VARCHAR(72) NOT NULL,
    email VARCHAR(64) NOT NULL,
    ownedRoomCount INT NOT NULL DEFAULT 0,
    ownedRoomCountMax INT NOT NULL DEFAULT 5,
    PRIMARY KEY (userID),
    UNIQUE KEY (userName, email)
);

CREATE TABLE IF NOT EXISTS rooms(
    roomID INT NOT NULL AUTO_INCREMENT,
    roomName VARCHAR(64) NOT NULL,
    ownerUserName VARCHAR(16) NOT NULL,
    PRIMARY KEY (roomID),
    UNIQUE KEY (roomName)
);

CREATE TABLE IF NOT EXISTS roomMemberships(
    roomID INT NOT NULL,
    userID INT NOT NULL,
    userStatus VARCHAR(16) NOT NULL,
    PRIMARY KEY (roomID, userID)
);

CREATE TABLE IF NOT EXISTS emailVerifications(
    email VARCHAR(64) NOT NULL,
    verificationCode VARCHAR(8) NOT NULL,
    expirationTime BIGINT,
    PRIMARY KEY (email)
);

-- Default data entries

INSERT INTO users (userName, userType, passwordHash, email)
    VALUES ('admin', 'admin', '$2b$10$iNuggeyC0AeJlbAICleDDusa2/PfYtMv3n3fmtvXgMqIfhW8hmGUe', 'architsch@gmail.com');

INSERT INTO users (userName, userType, passwordHash, email)
    VALUES ('test1', 'member', '$2b$10$iNuggeyC0AeJlbAICleDDusa2/PfYtMv3n3fmtvXgMqIfhW8hmGUe', 'test1@example.com');

INSERT INTO users (userName, userType, passwordHash, email)
    VALUES ('test2', 'member', '$2b$10$iNuggeyC0AeJlbAICleDDusa2/PfYtMv3n3fmtvXgMqIfhW8hmGUe', 'test2@example.com');
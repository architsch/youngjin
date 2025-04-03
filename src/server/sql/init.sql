CREATE DATABASE IF NOT EXISTS main;
USE main;

CREATE TABLE IF NOT EXISTS users(
    userID INT NOT NULL AUTO_INCREMENT,
    userName VARCHAR(16) NOT NULL,
    passwordHash VARCHAR(72) NOT NULL,
    email VARCHAR(64) NOT NULL,
    PRIMARY KEY (userID),
    UNIQUE KEY (userName, email)
);

CREATE TABLE IF NOT EXISTS rooms(
    roomID INT NOT NULL AUTO_INCREMENT,
    roomName VARCHAR(32) NOT NULL,
    PRIMARY KEY (roomID),
    UNIQUE KEY (roomName)
);

CREATE TABLE IF NOT EXISTS user_rooms(
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
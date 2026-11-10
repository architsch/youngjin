// A number of the game's (a price, a reward, a distance, a time or a limit) in text written by hand, which would stay
// behind when its constant changed: a dollar amount, or a number in digits or words before a unit. A date, a version, a
// step's number, a fixed rule written with a hyphen ("one-block steps") or a plain "one" ("one request") isn't one.
const NUMBER = "\\d+|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|sixteen|twenty";
const UNIT = "cells?|blocks?|layers?|seconds?|minutes?|hours?|days?|weeks?|degrees|characters|letters|requests?|shapes?"
    + "|edits?|bubbles?|calls?|bills?|dollars?|balls?|cannons?";

export const GAME_NUMBER = new RegExp(`\\$\\d|\\b(${NUMBER})(\\s+\\w+)?\\s+(${UNIT})\\b`, "i");

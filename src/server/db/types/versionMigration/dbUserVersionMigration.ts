import { TUTORIAL_SINGLE_PLAYER_MODE } from "../../../../shared/system/sharedConstants";
import { DBVersionMigration } from "./dbVersionMigration";

const DBUserVersionMigration: DBVersionMigration = [
    // v0 -> v1: add playerMetadata; drop totalPlaytimeMs (stale-guest tiers use loginCount alone).
    async (row: any) => {
        row.playerMetadata = {};
        delete row.totalPlaytimeMs;
        return row;
    },
    // v1 -> v2: drop "tutorialStep" and add "singlePlayerMode".
    async (row: any) => {
        row.singlePlayerMode = (row.tutorialStep > 0) ? "" : TUTORIAL_SINGLE_PLAYER_MODE;
        delete row.tutorialStep;
        return row;
    },
    // v2 -> v3: add "ftue" (first-time user experience).
    async (row: any) => {
        row.ftue = "";
        return row;
    },
    // v3 -> v4: drop the stored "id" field (older write-backs stored it), as with rooms
    // (see DBRoomVersionMigration).
    async (row: any) => row,
    // v4 -> v5: add "acquisitionSource" and "funnel". Defaulted, not assigned: analytics writes
    // "funnel" outside DBQuery, so a row may already have one before migrating. Pre-existing accounts
    // get an empty source (unattributed, not "direct").
    async (row: any) => {
        row.acquisitionSource = row.acquisitionSource ?? "";
        row.funnel = row.funnel ?? "";
        return row;
    },
];

export default DBUserVersionMigration;

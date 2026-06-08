import { TUTORIAL_SINGLE_PLAYER_MODE } from "../../../../shared/system/sharedConstants";
import { DBVersionMigration } from "./dbVersionMigration";

const DBUserVersionMigration: DBVersionMigration = [
    // v0 -> v1: add playerMetadata (per-user, survives room switches and reconnects)
    // and drop totalPlaytimeMs (stale-guest tier classification now uses loginCount alone).
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
];

export default DBUserVersionMigration;

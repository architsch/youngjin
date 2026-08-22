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
    // v2 -> v3: add "ftue" (first-time user experience).
    async (row: any) => {
        row.ftue = "";
        return row;
    },
    // v3 -> v4: drop the stored "id" field, for the same reason the rooms do (see
    // DBRoomVersionMigration). A user was never written with one, but a user *migrated* was:
    // the write-back used to store the row exactly as the reader had it, identity included, so
    // every account old enough to have been brought up through a schema change carries a copy of
    // its own key. Nothing changes here — the version bump is what makes the row be rewritten,
    // and every write already drops the field (DBRowIdentityUtil).
    async (row: any) => row,
    // v4 -> v5: add "acquisitionSource" and "funnel" (ServerAnalyticsManager).
    //
    // Both are defaulted rather than assigned, which is the difference that matters here. Analytics
    // writes "funnel" straight to the document, outside the DBQuery path that runs these
    // migrations, so a row can already carry a value before it is ever migrated — and an
    // unconditional assignment would erase the very measurement this step exists to make room for.
    // Accounts that predate the change keep an empty source, meaning they are attributed to nothing
    // rather than being counted as direct traffic they were never observed to be.
    async (row: any) => {
        row.acquisitionSource = row.acquisitionSource ?? "";
        row.funnel = row.funnel ?? "";
        return row;
    },
];

export default DBUserVersionMigration;

import website from "./website";
import ssg from "./ssg/ssg";
import db from "./db/db";

require("./dependencyInjector");
require("./test/test");

switch (process.env.TYPE)
{
    case "website": website(); break;
    case "ssg": ssg(); break; // Static Site Generator
    case "db_clear": db.runSQLFile("clear.sql"); break; // Run the SQL script which clears out the DB.
    case "db_init": db.runSQLFile("init.sql"); break; // Run the SQL script which initializes the DB.
    default: throw new Error(`Unknown TYPE :: ${process.env.TYPE}`);
}
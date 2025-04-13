const envUtil = require("./envUtil.js");
const dbUtil = require("./dbUtil.js");
const textUtil = require("../../shared/util/textUtil.mjs").textUtil;
require("dotenv").config();

const socialUtil =
{
    search: async (req, res) =>
    {
        try {
            return await dbUtil[req.body.tableName].selectList(res, req.body.orderBy, req.body.asc, req.body.limit, req.body.start);
        }
        catch (err) {
            res.status(500).send(`ERROR: Failed to get entries from '${req.body.tableName}' (${err}).`);
        }
    },
    room: {
        create: async (req, res) =>
        {
            // TODO: Implement
        },
        leave: async (req, res) =>
        {
            // TODO: Implement
        },
        kickOutUser: async (req, res) =>
        {
            // TODO: Implement
        },
        invitation: {
            make: async (req, res) =>
            {
                // TODO: Implement
            },
            cancel: async (req, res) =>
            {
                // TODO: Implement
            },
            accept: async (req, res) =>
            {
                // TODO: Implement
            },
            ignore: async (req, res) =>
            {
                // TODO: Implement
            },
        },
        joinRequest: {
            make: async (req, res) =>
            {
                // TODO: Implement
            },
            cancel: async (req, res) =>
            {
                // TODO: Implement
            },
            accept: async (req, res) =>
            {
                // TODO: Implement
            },
            ignore: async (req, res) =>
            {
                // TODO: Implement
            },
        },
    },
}

module.exports = socialUtil;
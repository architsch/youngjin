const networkUtil =
{
    onRouteResponse: (res, resJSON = undefined) => {
        if (res.statusCode >= 200 && res.statusCode <= 299)
        {
            // End response if its status is OK
            if (resJSON != undefined)
                res.json(resJSON);
            else
                res.end();
        }
    },
}

module.exports = networkUtil;
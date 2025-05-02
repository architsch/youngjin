require("dotenv").config();

function init(server)
{
    const io = require('socket.io')(8080);
    io.listen(server);

    require("./consoleIO").init(io);
    //require("./chatIO").init(io);
}

module.exports.init = init;
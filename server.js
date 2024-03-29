require('./config.js');
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, prettyPrint } = format;

const logger = createLogger({
  format: combine(
    format.timestamp({format:'MM-YY-DD HH:mm:ss'}),
    prettyPrint()
  ),
  transports: [
      new transports.Console(),
      // - Write all logs with importance level of `error` or less to `error.log`
      // - Write all logs with importance level of `info` or less to `combined.log`
      new transports.File({ filename: 'logs/combined.log' }),
      new transports.File({ filename: 'logs/error.log', level: 'error' })
    ]
})

const express = require('express');
const app     = express();
app.use("/", express.static(__dirname + '/public'));

app.get("/", function (req, res) {
  res.sendFile(__dirname + '/public/index.html');
});
 
const server = app.listen(8081, function () {
  console.log(`Listening on ${server.address().port}`);
  logger.info(`Listening on ${server.address().port}`);
});

const io = require('socket.io')(server, {
    pingInterval: 10000,
    pingTimeout: 30000
});

let players = {};

const gameRooms = {

    // roomKey: key,
    // randomTasks: [],
    // gameScore: 0,
    // scores: {},
    // players: {},
    // numPlayers: 0,
    // roundsPlayed: 0,
    // star: generateLocation(),
    // trap: generateLocation(),
    // trapButton: {},
    // trapActive: false,
    // roomType: "",

};
var availableRoomKey = "";


let star = {
    x: Math.floor(Math.random() * 700) + 50,
    y: Math.floor(Math.random() * 500) + 50
};
let trap = {
    x: Math.floor(Math.random() * 700) + 50,
    y: Math.floor(Math.random() * 500) + 50
};
let walls = {};
let scores = {
    green: 0,
    red: 0
};
let trapButton = {};
let trapActive = false;


// app.use(express.static(__dirname));
// app.use(express.static(__dirname + '/public/'));


io.on('connection', function (socket) {
    console.log('a user connected');
    logger.log({
        level: 'info',
        message: 'A user connected',
        socket_id: socket.id
    });


    // Menu:
    // join next available game
    // join specific game
    // join game by code

    // TODO: start new game here. 
    // Each game should have a separate game_id, even if taking place in the same room.
    

    // Player matching happens by room assignment!
    // (backup option: if no partner found within 60 seconds, use AI?)
    // => use pilot data to record how long matching usually takes


    socket.on("getRoomKey", function() {





        // get room ID of room with <2 players, or open new room
        availableRoomKey = assignRoomKey();
        socket.emit("sendRoomKey", availableRoomKey);
        socket.join(availableRoomKey);

        let roomInfo = gameRooms[availableRoomKey];

        // when player joins a room:
        // create a new player and add to players object
        roomInfo.players[socket.id] = {
            rotation: 0,
            x: Math.floor(Math.random() * 700) + 50,
            y: Math.floor(Math.random() * 500) + 50,
            playerId: socket.id,
            team: 'green',
            points: 0,
            pointsOther: 0,
            trapped: false,
            roomKey : availableRoomKey,
        };

        // also store info in global players object
        players[socket.id] = roomInfo.players[socket.id];
        gameRooms[availableRoomKey].numPlayers += 1;
        gameRooms[availableRoomKey] = roomInfo;
        console.log("roomInfo", roomInfo);
        logger.info("Player " + socket.id + " is added to room " + availableRoomKey);
        logger.info("Room " + availableRoomKey + " now has " + gameRooms[availableRoomKey].numPlayers + " players.")

        if(roomInfo.numPlayers == 2) {
            io.sockets.in(roomInfo.roomKey).emit("startGame", availableRoomKey);
            console.log("## Sending start signal! \n## Room with roomKey " + availableRoomKey + " is good to go.");
            logger.log({
                level: "info",
                message: "Sending start signal! Room with roomKey " + availableRoomKey + " is good to go.",
                roomKey: availableRoomKey
            });

            io.sockets.in(roomInfo.roomKey).emit("setStartingState", roomInfo);
             // send players object to players in rooom
            io.sockets.in(roomInfo.roomKey).emit("currentPlayers", players);
        } 


    });


    console.log("socket.id: " + socket.id);

    socket.on('disconnecting', function() {
        console.log('user with socket id ' + socket.id + ' disconnected');
        logger.log({
            level: "info",
            message: "User disconnected",
            socket_id: socket.id
        });

        
        // TODO delete traps

        if (players[socket.id]) {
            // emit a message to all players to remove this player
            if (players[socket.id].roomKey) {

                // if this player was trapped then trap is no longer active
                if (players[socket.id].trapped == true) {
                    gameRooms[players[socket.id].roomKey].trapActive = false;
                    gameRooms[players[socket.id].roomKey].trapButton = {};

                }

                // remove player from room, and inform others in room
                logger.log({
                    level: "info",
                    message: "Removing user from room",
                    socket_id: socket.id,
                    roomKey: players[socket.id].roomKey
                });
        

                socket.broadcast.to(players[socket.id].roomKey).emit('userDisconnect', socket.id);
                gameRooms[players[socket.id].roomKey].numPlayers -= 1;
                delete gameRooms[players[socket.id].roomKey].players[socket.id];

                

            }
            // remove this player from players object
            console.log(players[socket.id]);
            console.log('removing user with socket id:' + socket.id);
            delete players[socket.id];
        }
       
    });
    
    // when a player moves, update the player data
    socket.on('playerMovement', function (movementData) {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            players[socket.id].rotation = movementData.rotation;

            // also store player data in gameRooms object
            gameRooms[players[socket.id].roomKey].players[socket.id] = players[socket.id];

            // emit a message to all other players about the player that moved
            socket.broadcast.to(players[socket.id].roomKey).emit('playerMoved', players[socket.id]);
        }
    });
    
    socket.on('starCollected', function () {
        if(players[socket.id]) {
            players[socket.id].points += 10;
            console.log("old star location: ", gameRooms[players[socket.id].roomKey].star);
            star = generateLocation();
            gameRooms[players[socket.id].roomKey].star = star;
            console.log("new star location: ", star);
            io.sockets.in(players[socket.id].roomKey).emit('starLocation', star);
            io.to(socket.id).emit("scoreUpdateYou", players[socket.id].points);
            socket.broadcast.to(players[socket.id].roomKey).emit("scoreUpdateOther", players[socket.id].points);
    
            console.log("sending updateState to room " + players[socket.id].roomKey, roomInfo);
            io.sockets.in(players[socket.id].roomKey).emit("updateState", roomInfo);
        }
    });

    socket.on('playerEntrapment', function() {


        if(players[socket.id]) {

            // this player is now trapped
            players[socket.id].trapped = true;
            gameRooms[players[socket.id].roomKey].players[socket.id].trapped = players[socket.id].trapped;


            // // emit a message to all other players about the player that got trapped
            // socket.broadcast.to(players[socket.id].roomKey).emit('playerTrapped', players[socket.id]);

            // create new button location only if nobody was in the trap before
            if (gameRooms[players[socket.id].roomKey].trapActive == false) {

                // trapButton = generateLocation();
                // TODO TRY THIS
                trapButton = generateTrapButtonLocation(gameRooms[players[socket.id].roomKey].trap);
                gameRooms[players[socket.id].roomKey].trapButton = trapButton;
                io.sockets.in(players[socket.id].roomKey).emit("trapButtonLocation", trapButton); 

                // update and send room info to all
                gameRooms[players[socket.id].roomKey].trapActive = true;
                roomInfo = gameRooms[players[socket.id].roomKey];
                console.log("sending updateState to room " + players[socket.id].roomKey, roomInfo);
                logger.log({
                    level: 'info',
                    message: 'A user is now trapped in room',
                    roomKey: players[socket.id].roomKey
                })
                io.sockets.in(players[socket.id].roomKey).emit("updateState", roomInfo);

            } else {
                // if someone was in the trap before, both are trapped now 
                // (TODO: check to make sure)
                // if yes, 

                io.sockets.in(players[socket.id].roomKey).emit("bothPlayersTrapped"); 
                logger.log({
                    level: 'info',
                    message: 'Both users are now trapped in room',
                    roomKey: players[socket.id].roomKey
                })
                
                // generate location for new trap, but do not send yet
                // (it only gets sent upon client request, after trap fades out)

                trap = generateLocation();
                gameRooms[players[socket.id].roomKey].trap = trap;
                gameRooms[players[socket.id].roomKey].trapActive = false;
                gameRooms[players[socket.id].roomKey].trapButton = {};

                players[socket.id].trapped = false;
                gameRooms[players[socket.id].roomKey].players[socket.id].trapped = players[socket.id].trapped;

                console.log("upcoming trap location: ",  gameRooms[players[socket.id].roomKey].trap);
            }
            


        }
    });

    socket.on('trapReleased', function () {

        if(players[socket.id]) {
            socket.broadcast.to(players[socket.id].roomKey).emit('playerFreed');
            gameRooms[players[socket.id].roomKey].trapActive = false;
            gameRooms[players[socket.id].roomKey].trapButton = {};

            players[socket.id].trapped = false;
            gameRooms[players[socket.id].roomKey].players[socket.id].trapped = players[socket.id].trapped;
            
            console.log("free all players:", freeAllPlayers(players[socket.id].roomKey));
            logger.log({
                level: 'info',
                message: 'Free all players in room',
                roomKey: players[socket.id].roomKey
            })
    
            console.log("old trap location: ", gameRooms[players[socket.id].roomKey].trap);
            trap = generateLocation();
            logger.log({
                level: 'info',
                message: 'Trap moved to new location',
                oldTrapLocation: gameRooms[players[socket.id].roomKey].trap,
                newTrapLocation: trap,
                roomKey: players[socket.id].roomKey
            })
            
            gameRooms[players[socket.id].roomKey].trap = trap;
            console.log("new trap location: ",  gameRooms[players[socket.id].roomKey].trap);
            io.sockets.in(players[socket.id].roomKey).emit('trapLocation', trap);
    
            console.log("sending updateState to room " + players[socket.id].roomKey, roomInfo);
            io.sockets.in(players[socket.id].roomKey).emit("updateState", roomInfo);
        }

        
    // todo adjust scores
    });


    // Send updated state of the world when requested
    socket.on("requestCurrentState", function() {

        // if said game room exists, send room info to player
        // (e.g. if connection was lost client-side)
        if (gameRooms[players[socket.id].roomKey]) {

            roomInfo = gameRooms[players[socket.id].roomKey];
//            io.to(socket.id).emit("updateState", roomInfo);
            console.log("emitting updateState");
            io.sockets.in(players[socket.id].roomKey).emit("updateState", roomInfo);
        } else {
            console.log("No gameRoom found for socket.id: ", socket.id);
            logger.log({
                level: 'info',
                message: 'No gameRoom found for user with socket.id ' + socket.id,
                socket_id: socket.id
            })
        }

        // if server crashed, everything above (player assignment, rooms) has to be done again

        // TODO
        // this throws a bug when server was offline
        // io.to(socket.id).emit("updateState", gameRooms[players[socket.id].roomKey]);
    });


    socket.on('requestNextTrap', function () {

        if(players[socket.id]) {
            roomInfo = gameRooms[players[socket.id].roomKey];

            console.log("sending updateState to room " + players[socket.id].roomKey, roomInfo);
            io.sockets.in(players[socket.id].roomKey).emit("updateState", roomInfo);

    
            console.log("sending next trap location: ", gameRooms[players[socket.id].roomKey].trap);

            trap = gameRooms[players[socket.id].roomKey].trap;
            io.to(socket.id).emit("trapLocation", trap);    

        }

        
    // todo adjust scores
    });

});

function generateLocation() {
    return {
        x: Math.floor(Math.random() * 700) + 50,
        y: Math.floor(Math.random() * 500) + 50
    };
}

function generateTrapButtonLocation(trap) {
    trapButtonLocation = generateLocation();
    while (Math.abs(trapButtonLocation.x - trap.x) < 100 & Math.abs(trapButtonLocation.y - trap.y) < 100) {
        trapButtonLocation = generateLocation();
    }
    return(trapButtonLocation);
}

function generateString() {
    let my_string = "";
    let characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    for (let i = 1; i < 6; i++) {
        my_string += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return my_string;
}

function createGameRoom() {
     // generate room with new id
     let key = generateString();
     Object.keys(gameRooms).includes(key) ? (key = generateString()) : key;
     gameRooms[key] = {
         roomKey: key,
         randomTasks: [],
         gameScore: 0,
         scores: {},
         players: {},
         numPlayers: 0,
         roundsPlayed: 0,
         star: generateLocation(),
         trap: generateLocation(),
         trapButton: {},
         trapActive: false,
         roomType: "",
         gameID: Date.now(),    
    };
     return key;
}

// find rooms where game has not started yet, and only one player

function assignRoomKey() {
    availableRoomKey = "";
    if (Object.values(gameRooms).some(e => e.numPlayers == 1 && e.roundsPlayed == 0)) {
        availableRoomKey = Object.values(gameRooms).find(e => e.numPlayers == 1 && e.roundsPlayed == 0).roomKey;
        
        // new game ID for this room, and player scores should be reset
        roomInfo = gameRooms[availableRoomKey];
        roomInfo.gameID = Date.now();
        roomInfo.scores = {};
        io.sockets.in(availableRoomKey).emit("updateState", roomInfo);

    } else {
      // generate new room, put player there
        availableRoomKey =  createGameRoom();
    }
    return availableRoomKey;
}

function freeAllPlayers(roomKey) {
    Object.keys(gameRooms[roomKey].players).forEach(key => {
        gameRooms[roomKey].players[key].trapped = false;
    });
    return gameRooms[roomKey];
}
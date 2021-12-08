
require('./config.js');


const express = require('express');
const app     = express();
app.use("/", express.static(__dirname + '/public'));

app.get("/", function (req, res) {
  res.sendFile(__dirname + '/public/index.html');
});
 
const server = app.listen(8081, function () {
  console.log(`Listening on ${server.address().port}`);
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

    // TODO: when player joins a room:
    // create a new player and add to players object

    // socket.on("joinRoom", function(roomKey) {
    //     socket.join(roomKey);
    //     const roomInfo = gameRooms[roomKey];
    //     console.log("roomInfo", roomInfo);
    //     // update players such that room key is stored in players object
    //     roomInfo.players[socket.id] = {
    //         rotation: 0,
    //         x: Math.floor(Math.random() * 700) + 50,
    //         y: Math.floor(Math.random() * 500) + 50,
    //         playerId: socket.id,
    //         team: 'green',
    //         trapped: false        
    //     };
    //     io.sockets.in(roomKey).emit("setStartingState", roomInfo);
    //     console.log("sending setStartingState to roomKey " + roomKey)
    // });

    // players[socket.id] = {
    //     rotation: 0,
    //     x: Math.floor(Math.random() * 700) + 50,
    //     y: Math.floor(Math.random() * 500) + 50,
    //     playerId: socket.id,
    //     team: 'green',
    //     trapped: false
    // };



    // TODO: build waiting room
    // add player to queue
    // when two players are in queue, game ID is generated
    // and game starts automatically



    // (backup option: if no partner found within 60 seconds, use AI?)
    // => use pilot data to record how long matching usually takes

    // Menu:
    // join next available game
    // join specific game
    // join game by code

    // TODO: start new game here. 
    // Each game should have a separate game_id.
    // Generate star and trap coordinates for each game separately. 
    


    socket.on("getRoomKey", function() {

        // get room ID of room with <2 players, or new room
        availableRoomKey = assignRoomKey();
        socket.emit("sendRoomKey", availableRoomKey);
        socket.join(availableRoomKey);


        let roomInfo = gameRooms[availableRoomKey];
        roomInfo.players[socket.id] = {
            rotation: 0,
            x: Math.floor(Math.random() * 700) + 50,
            y: Math.floor(Math.random() * 500) + 50,
            playerId: socket.id,
            team: 'green',
            trapped: false,
            roomKey : availableRoomKey,
        };

        // also store info in global players object
        players[socket.id] = roomInfo.players[socket.id];
        gameRooms[availableRoomKey].numPlayers += 1;
        gameRooms[availableRoomKey] = roomInfo;
        console.log("roomInfo", roomInfo);

        if(roomInfo.numPlayers == 2) {
            io.sockets.in(roomInfo.roomKey).emit("startGame", availableRoomKey);
            console.log("## Sending start signal! \n## Room with roomKey " + availableRoomKey + " is good to go.");
            io.sockets.in(roomInfo.roomKey).emit("setStartingState", roomInfo);
             // send players object to players in rooom
            io.sockets.in(roomInfo.roomKey).emit("currentPlayers", players);
        } else if(roomInfo.numPlayers < 2) {
            io.sockets.in(roomInfo.roomKey).emit("goToWaitingRoom");
        }


    });


    // Emit room info when player joins a game
    

    // send star object to new player
    socket.emit('starLocation', star);
    // send trap object to new player
    socket.emit('trapLocation', trap);
    // send out trap button info only if someone is trapped
    if (trapActive == true) { 
        // todo emit new trap button location, room-specific
        socket.broadcast.to(players[socket.id].roomKey).emit('trapButtonLocation', trapButton);
    }

    // send current scores to new player
    socket.emit('scoreUpdate', scores);
    // create walls     
    socket.emit('createWalls', walls);
    // update all other players of the new player
    // socket.broadcast.emit('newPlayer', players[socket.id]);

    console.log("socket.id: " + socket.id);

    socket.on('disconnect', function() {
        console.log('user disconnected');
        // remove this player from players object
        delete players[socket.id];
        // emit a message to all players to remove this player
        io.emit('disconnect', socket.id);
    });
    
    // when a player moves, update the player data
    socket.on('playerMovement', function (movementData) {
        players[socket.id].x = movementData.x;
        players[socket.id].y = movementData.y;
        players[socket.id].rotation = movementData.rotation;

        // emit a message to all other players about the player that moved
        socket.broadcast.to(players[socket.id].roomKey).emit('playerMoved', players[socket.id]);
    });
    
    socket.on('starCollected', function () {
        if (players[socket.id].team === 'red') {
            scores.red += 10;
        } else {
            scores.green += 10;
        }
        star = generateLocation();
        io.sockets.in(players[socket.id].roomKey).emit('starLocation', star);
        io.sockets.in(players[socket.id].roomKey).emit('scoreUpdate', scores);
    });

    socket.on('playerEntrapment', function() {
        players[socket.id].trapped = true;

        // emit a message to all other players about the player that got trapped
        socket.broadcast.to(players[socket.id].roomKey).emit('playerTrapped', players[socket.id]);
        // create new button location only if nobody was in the trap before
        if (trapActive == false) {
            trapButton = generateLocation();
        }
        trapActive = true;
        io.sockets.in(players[socket.id].roomKey).emit('trapButtonLocation', trapButton);        
    });

    socket.on('trapReleased', function () {
        // if (players[socket.id].team === 'red') {
        //     scores.red += 10;
        // } else {
        //     scores.green += 10;
        // }
        socket.broadcast.to(players[socket.id].roomKey).emit('playerFreed');
        trapActive = false;
        trap = generateLocation();
        io.sockets.in(players[socket.id].roomKey).emit('trapLocation', trap);
        // io.emit('scoreUpdate', scores);
    });


});

function generateLocation() {
    return {
        x: Math.floor(Math.random() * 700) + 50,
        y: Math.floor(Math.random() * 500) + 50
    };
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
     };
     return key;
}

// find rooms where game has not started yet, and only one player

function assignRoomKey() {
    availableRoomKey = "";
    if (Object.values(gameRooms).some(e => e.numPlayers <= 1 && e.roundsPlayed == 0)) {
        availableRoomKey = Object.values(gameRooms).find(e => e.numPlayers <= 1 && e.roundsPlayed == 0).roomKey;
    } else {
      // generate new room, put player there
        availableRoomKey =  createGameRoom();
    }
    return availableRoomKey;
}

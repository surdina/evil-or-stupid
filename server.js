
require('./config.js');


var express = require('express');
var app     = express();
app.use("/", express.static(__dirname + '/public'));

app.get("/", function (req, res) {
  res.sendFile(__dirname + '/public/index.html');
});
 
var server = app.listen(8081, function () {
  console.log(`Listening on ${server.address().port}`);
});

var io = require('socket.io')(server, {
    pingInterval: 10000,
    pingTimeout: 30000
});

var players = {};
var star = {
    x: Math.floor(Math.random() * 700) + 50,
    y: Math.floor(Math.random() * 500) + 50
};
var trap = {
    x: Math.floor(Math.random() * 700) + 50,
    y: Math.floor(Math.random() * 500) + 50
};
var walls = {};
var scores = {
    green: 0,
    red: 0
};
var trapButton = {};
var trapActive = false;


// app.use(express.static(__dirname));
// app.use(express.static(__dirname + '/public/'));


io.on('connection', function (socket) {
    console.log('a user connected');
    // create a new player and add to players object
    players[socket.id] = {
        rotation: 0,
        x: Math.floor(Math.random() * 700) + 50,
        y: Math.floor(Math.random() * 500) + 50,
        playerId: socket.id,
        team: 'green',
        trapped: false
    };
    // send players object to new player
    socket.emit('currentPlayers', players);
    
    // send star object to new player
    socket.emit('starLocation', star);
    // send trap object to new player
    socket.emit('trapLocation', trap);
    // send out trap button info only if someone is trapped
    if (trapActive == true) { 
        socket.emit('trapButtonLocation', trapButton);
    }

    // send current scores to new player
    socket.emit('scoreUpdate', scores);
    // create walls     
    socket.emit('createWalls', walls);
    // update all other players of the new player
    socket.broadcast.emit('newPlayer', players[socket.id]);
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
        // emit a message to all players about the player that moved
        socket.broadcast.emit('playerMoved', players[socket.id]);
    });
    
    socket.on('starCollected', function () {
        if (players[socket.id].team === 'red') {
            scores.red += 10;
        } else {
            scores.green += 10;
        }
        star = generateLocation();
        io.emit('starLocation', star);
        io.emit('scoreUpdate', scores);
    });

    socket.on('playerEntrapment', function() {
        players[socket.id].trapped = true;

        // emit a message to all players about the player that got trapped
        socket.broadcast.emit('playerTrapped', players[socket.id]);
        // create new button location only if nobody was in the trap before
        if (trapActive == false) {
            trapButton = generateLocation();
        }
        trapActive = true;
        io.emit('trapButtonLocation', trapButton);
        // TODO display button to deactivate trap
        
    });

    socket.on('trapReleased', function () {
        // if (players[socket.id].team === 'red') {
        //     scores.red += 10;
        // } else {
        //     scores.green += 10;
        // }
        io.emit('playerFreed');
        trapActive = false;
        trap = generateLocation();
        io.emit('trapLocation', trap);
        // io.emit('scoreUpdate', scores);
    });

});

function generateLocation() {
    return {
        x: Math.floor(Math.random() * 700) + 50,
        y: Math.floor(Math.random() * 500) + 50
    };
}


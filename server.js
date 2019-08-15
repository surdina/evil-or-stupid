/*var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);*/

var express = require('express');
var http = require('http');
var app = express();
var server = http.createServer(app);
var io = require('socket.io')(server);


var players = {};
var star = {
    x: Math.floor(Math.random() * 700) + 50,
    y: Math.floor(Math.random() * 500) + 50
};
var walls = {};
var scores = {
    blue: 0,
    red: 0
};


app.use(express.static(__dirname + '/public'));

app.get('/', function(req, res) {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', function (socket) {
    console.log('a user connected');
    // create a new player and add to players object
    players[socket.id] = {
        rotation: 0,
        x: Math.floor(Math.random() * 700) + 50,
        y: Math.floor(Math.random() * 500) + 50,
        playerId: socket.id,
        team: (Math.floor(Math.random() * 2) == 0) ? 'red' : 'blue'
    };
    // send players object to new player
    socket.emit('currentPlayers', players);
    // send star object to new player
    socket.emit('starLocation', star);
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
            scores.blue += 10;
        }
        star.x = Math.floor(Math.random() * 700) + 50;
        star.y = Math.floor(Math.random() * 500) + 50;
        io.emit('starLocation', star);
        io.emit('scoreUpdate', scores);
    });
});

server.listen(8081, function() {
    console.log(`Listening on ${server.address().port}`);
});
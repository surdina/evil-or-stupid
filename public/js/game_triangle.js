const gameRooms = {
    // [roomKey]: {
    //     users: [],
    //     randomTasks: [],
    //     scores: [],
    //     gameScore: 0,
    //     players: {},
    //     numPlayers: 0
    // }
}
var gameStarted = 0;
var gameJoined = 0;


class Game extends Phaser.Game {
    constructor() {
        super(config);

        // add scenes here
        this.scene.add("MainScene", MainScene);
        this.scene.add("WelcomeScene", WelcomeScene);
        this.scene.add("WaitingScene", WaitingScene);
        this.scene.add("GameScene", GameScene);


        // start first scene
        this.scene.start("MainScene");
    }

    
}



class MainScene extends Phaser.Scene {
    constructor() {
        super({key: "MainScene"});
        this.state = {};
    }

    preload() {
        this.load.image('otherPlayer', 'assets/enemyBlack5.png');
        this.load.image('background', 'graphics/background2.png');
        this.load.image('ground', 'graphics/ground.png');
        this.load.image('ship', 'graphics/triangle_grey.png');
        this.load.image('vwall', 'graphics/vwall.png');
        this.load.image('hwall', 'graphics/hwall.png');
        this.load.image('orange_dot', 'graphics/orange_dot.png');
        this.load.image('star', 'graphics/star.png');
        this.load.image('purple_block', 'graphics/purple_block.png');
        this.load.image('exit', 'graphics/exit2.png');
        this.load.image('trap', 'graphics/trap_large.png');
        this.load.image('trapButton', 'graphics/trap_switch.png');
    }

    create() {
        this.socket = io();
        const scene = this;
        // console.log("this socket: " + this.socket.id);
        this.socket.on("connect", function() {
            console.log('io socket id assigned: ' + scene.socket.id);
            scene.scene.launch("WelcomeScene", { socket: scene.socket });
        });

        



    }
}

class GameScene extends Phaser.Scene {
    constructor() {
        super({key: "GameScene"});
    }

    init(data) {
        this.socket = data.socket;
        this.roomInfo = data.roomInfo;
        console.log("Room info: " + this.roomInfo);
        this.players = data.roomInfo.players;
    }

    preload() {
    }

    create() {
       const self = this;
       this.scene.stop("WaitingScene");
       console.log("game scene starting");
       console.log("socket id when gameStarted: " + this.socket.id);
  
    
        // extract info about other player from starting state
        
        this.otherPlayers = this.physics.add.group();
        //var walls;
        this.walls = this.physics.add.group();

        Object.keys(self.players).forEach(function (id) {
            if (self.players[id].playerId === self.socket.id) {
                addPlayer(self, self.players[id]);
            } else {
                addOtherPlayers(self, self.players[id]);
        }});
      
    
    
        this.socket.on('currentPlayers', function (players) {
            console.log(players);
            Object.keys(players).forEach(function (id) {
                if (players[id].playerId === self.socket.id) {
                    addPlayer(self, players[id]);
                } else {
                    addOtherPlayers(self, players[id]);
                }
            });
        });
        // this.socket.on('newPlayer', function (playerInfo) {
        //     addOtherPlayers(self, playerInfo);
    
        // });
    
        this.socket.on('disconnect', function (playerId) {
            self.otherPlayers.getChildren().forEach(function (otherPlayer) {
                if (playerId === otherPlayer.playerId) {
                    otherPlayer.destroy();
                }
            });
        });
    
        this.socket.on('playerMoved', function (playerInfo) {
            self.otherPlayers.getChildren().forEach(function (otherPlayer) {
                if (playerInfo.playerId === otherPlayer.playerId) {
                    otherPlayer.setRotation(playerInfo.rotation);
                    otherPlayer.setPosition(playerInfo.x, playerInfo.y);
                }
            });
        });
    
        this.cursors = this.input.keyboard.createCursorKeys();
    
        this.greenScoreText = this.add.text(16, 16, '', { fontSize: '32px', fill: '#1fc888' });
        this.redScoreText = this.add.text(584, 16, '', { fontSize: '32px', fill: '#FF0000' });
    
        this.socket.on('scoreUpdate', function (scores) {
            self.greenScoreText.setText('You: ' + scores.green);
            self.redScoreText.setText('Other: ' + scores.red);
        });
    
        this.socket.on('starLocation', function (starLocation) {
            if (self.star) self.star.destroy();
            self.star = self.physics.add.image(starLocation.x, starLocation.y, 'star');
            self.physics.add.overlap(self.ship, self.star, function () {
                this.socket.emit('starCollected');
            }, null, self);
        });
    
        this.socket.on('trapLocation', function (trapLocation) {
            if (self.trap) self.trap.destroy();
            if (self.trapButton) self.trapButton.destroy();
    
            self.ship.trapped = false;
    
    
            console.log('creating traps ...')
            self.trap = new Trap(self, trapLocation.x, trapLocation.y);   
    
            self.physics.add.overlap(self.ship, self.trap, function () {
                // do the following only if player was not trapped before
                if (this.ship.trapped == false) {
                    this.socket.emit('playerEntrapment');
                    console.log('player trapped');
                    activateTrap(self);
                }
            }, null, self);
        });
        
        this.socket.on('trapButtonLocation', function (trapButtonLocation) {
            if (self.trapButton) self.trapButton.destroy();
            self.trapButton = new TrapButton(self, trapButtonLocation.x, trapButtonLocation.y);
            self.physics.add.overlap(self.ship, self.trapButton, function() {
              self.trapButton.destroy();
              this.socket.emit('trapReleased');
            }, null, self);
        });
    
     
    
        this.socket.on('playerFreed', function () {
            console.log('all players are freeeeeeeeeeeeeee');
            if (this.trap) this.trap.destroy();
        });
    
    }

    update() {

        if (this.ship && this.ship.trapped == false) {
    
            if (this.cursors.left.isDown) {
                this.ship.setAngularVelocity(-150);
            } else if (this.cursors.right.isDown) {
                this.ship.setAngularVelocity(150);
            } else {
                this.ship.setAngularVelocity(0);
            }
    
            if (this.cursors.up.isDown) {
                this.physics.velocityFromRotation(this.ship.rotation + 1.5, 100, this.ship.body.acceleration);
            } else {
                this.ship.setAcceleration(0);
            }
    
            // no walls
            //this.physics.world.wrap(this.ship, 5);
    
            // emit player movement
            var x = this.ship.x;
            var y = this.ship.y;
            var r = this.ship.rotation;
            if (this.ship.oldPosition && (x !== this.ship.oldPosition.x || y !== this.ship.oldPosition.y || r !== this.ship.oldPosition.rotation)) {
                this.socket.emit('playerMovement', { x: this.ship.x, y: this.ship.y, rotation: this.ship.rotation });
            }
            // save old position data
            this.ship.oldPosition = {
                x: this.ship.x,
                y: this.ship.y,
                rotation: this.ship.rotation
            };
    
        } else if (this.ship && this.ship.trapped == true) {
            // make trap absorb player and only allow rotation
            this.physics.moveToObject(this.ship, this.trap, 60, 300);
    
            if (this.cursors.left.isDown) {
                this.ship.setAngularVelocity(-150);
            } else if (this.cursors.right.isDown) {
                this.ship.setAngularVelocity(150);
            } else {
                this.ship.setAngularVelocity(0);
            }
    
            // emit player movement
            x = this.ship.x;
            y = this.ship.y;
            r = this.ship.rotation;
            if (this.ship.oldPosition && (x !== this.ship.oldPosition.x || y !== this.ship.oldPosition.y || r !== this.ship.oldPosition.rotation)) {
                this.socket.emit('playerMovement', { x: this.ship.x, y: this.ship.y, rotation: this.ship.rotation });
            }
            // save old position data
            this.ship.oldPosition = {
                x: this.ship.x,
                y: this.ship.y,
                rotation: this.ship.rotation
            };
        }
    }
}


class WaitingScene extends Phaser.Scene {
    constructor() {
        super({key: "WaitingScene"});
    }

    init(data) {
        this.socket = data.socket;
        console.log("Starting WaitingScene for socket id: ", this.socket.id);
    }

    create() {
        const scene = this;
        this.socket.emit("getRoomKey");
        this.add.text(20, 20, 'Waiting for second player to join')

        this.socket.on("startGame", function(availableRoomKey){
            console.log("starting signal received! RoomKey: " + availableRoomKey);
        });


        this.socket.on("sendRoomKey", function(availableRoomKey) {
            console.log("Joining room with roomKey: " + availableRoomKey);
        });



        this.socket.on("setStartingState", function(roomInfo) {
            console.log("setStartingState: " + roomInfo);
            // const { roomKey, players, numPlayers } = roomInfo;

            
            // scene.physics.resume();

              // TODO update to actual data sent in state info
            // state
            // this.state.roomKey = roomKey;
            // this.state.players = players;
            console.log("starting game scene from waiting scene");
            scene.scene.start("GameScene", { socket: scene.socket,
            roomInfo: roomInfo });

            console.log(roomInfo);

        });
    }

    update() {
        
        
    }
}
class WelcomeScene extends Phaser.Scene {

    constructor() {
        super({key: "WelcomeScene"});

    }

    init(data) {
        this.socket = data.socket;
        console.log("Starting WelcomeScene for socket id: ", this.socket.id);
    }

    create() {
        const scene = this;
        this.add.text(20, 20, 'Press any key to start game...')


        this.input.keyboard.on('keydown', function() {
            console.log("requesting to start gamescene");
            gameStarted = 1;


        // Ask server if a room is available!
        // If yes, go to game scene
        // If no, go to waiting scene


        });

        // this.socket.on("setState", function(roomInfo) {
        //     console.log("setState: " + roomInfo);
        //     const { roomKey, players, numPlayers } = roomInfo;
        //     scene.physics.resume();


        //     // TODO update to actual data sent in state info
        //     // state
        //     scene.state.roomKey = roomKey;
        //     scene.state.players = players;

        //     console.log(roomInfo);
        //     if (roomInfo.numPlayers < 2) {
        //         scene.scene.start("WaitingScene", { socket: scene.socket });
        //     } else {
        //         scene.scene.start("GameScene", { socket: scene.socket });
        //     }
        // });

        // TODO: add other listeners
    }

    update() {        
        if (gameStarted == 1 && gameJoined == 0) {
            this.scene.start("WaitingScene", { socket: this.socket });
        }

    }
}

var config = {
    type: Phaser.AUTO,
    parent: 'phaser-example',
    width: 800,
    height: 600,
    physics: {
        default: 'arcade',
        arcade: {
            debug: false,
            gravity: { y: 0 },
            checkCollision: {
                up: true,
                down: true,
                left: true,
                right: true
            }
        }
    },
    scene: []
};


// New game instance
window.onload = function() {
    window.game = new Game();
};



class Trap extends Phaser.Physics.Arcade.Sprite {

    constructor (scene, x, y)
    {
        super(scene, x, y, 'trap');

 

        this.setTexture('trap');
        this.setPosition(x, y);
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.body.setCircle(100);
        this.setCollideWorldBounds(true);
        this.setBounce(1, 1);


    }

    preUpdate (time, delta)
    {
        super.preUpdate(time, delta);
        this.rotation += 0.005;
    }

}

class TrapButton extends Phaser.Physics.Arcade.Image {
    
    constructor (scene, x, y)
    {
        super(scene, x, y, 'trapButton');

 

        this.setTexture('trapButton');
        this.setPosition(x, y);
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.setCollideWorldBounds(true);
        this.setBounce(1, 1);


    }
}


function addPlayer(self, playerInfo) {
    self.ship = self.physics.add.image(playerInfo.x, playerInfo.y, 'ship').setOrigin(0.5, 0.5).setDisplaySize(36, 42);
    self.ship.trapped = false;
    self.ship.setBounce(1, 1);
    self.ship.setCollideWorldBounds(true);
    //self.ship.onWorldBounds=true;
    // own ship: green
    self.ship.setTint(0x00ffaa);
    self.ship.setDrag(50);
    self.ship.setAngularDrag(50);
    self.ship.setMaxVelocity(400);
}

function addOtherPlayers(self, playerInfo) {
    const otherPlayer = self.add.sprite(playerInfo.x, playerInfo.y, 'ship').setOrigin(0.5, 0.5).setDisplaySize(36, 42);
    //    if (playerInfo.team === 'green') {
    //        otherPlayer.setTint(0x0000ff);
    //    } else {
    //        otherPlayer.setTint(0xff0000);
    //    }

    // other ship: grey
    otherPlayer.setTint(0x666666);
    otherPlayer.playerId = playerInfo.playerId;
    self.otherPlayers.add(otherPlayer);
}


function activateTrap(self) {
    //self.physics.add.collider(self.ship, self.trap)
    self.ship.trapped = true;
    // if no overlap,reflect back
    
}
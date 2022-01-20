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
        this.load.image('title', 'graphics/title.png');

    }

    create() {
        this.socket = io();

        this.add.image(5, 5, 'title').setOrigin(0, 0);

        const scene = this;
        // console.log("this socket: " + this.socket.id);
        this.socket.on("connect", function() {
            console.log('io socket id assigned: ' + scene.socket.id);
            // start game
            if (!scene.scene.isActive("GameScene")) {
                scene.scene.launch("WelcomeScene", { socket: scene.socket });
            // if game was already running, get new info on state
            } else {
                console.log("requesting up-to-date game state from server");
                scene.socket.emit("requestCurrentState");
            }
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
        this.starLocation = data.roomInfo.star;
        this.trapLocation = data.roomInfo.trap;
        this.trapButton = data.roomInfo.trapButton;
        this.trapActive = data.roomInfo.trapActive;
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
                self.otherPlayers.getChildren().forEach(function (otherPlayer) {
                    otherPlayer.destroy();
                });
                addOtherPlayers(self, self.players[id]);
        }});
        
        
        // extract info about trap and star from starting state

        this.star = this.physics.add.image(this.starLocation.x, this.starLocation.y, 'star');
            self.physics.add.overlap(this.ship, this.star, function () {
                this.star.destroy();
                this.socket.emit('starCollected');
                console.log("star collected!");
            }, null, self);
    

        this.trap = new Trap(this, this.trapLocation.x, this.trapLocation.y);   
        this.physics.add.overlap(this.ship, this.trap, function () {
            // do the following only if player was not trapped before
            if (this.ship.trapped == false) {
                this.socket.emit('playerEntrapment');
                console.log('This player is now trapped.');
                activateTrap(self);
            }
        }, null, self);

        // if joining an existing room with an active trap, show release button
        if (this.trapActive && this.trapButton) {
            console.log("trap is active. creating trap button");
            this.trapButton = new TrapButton(this, this.trapButton.x, this.trapButton.y);
            this.physics.add.overlap(this.ship, this.trapButton, function() {
                this.trapButton.destroy();
              this.socket.emit('trapReleased');
            }, null, self);
        }

    
        this.socket.on('currentPlayers', function (players) {
            console.log(players);
            if(self.infoText) {
                self.infoText.setText('');
            }

            Object.keys(players).forEach(function (id) {
                if (players[id].playerId === self.socket.id) {
                    addPlayer(self, players[id]);
                } else {
                    addOtherPlayers(self, players[id]);
                }
            });
        });
 
    
        this.socket.on('userDisconnect', function (playerId) {
            self.otherPlayers.getChildren().forEach(function (otherPlayer) {
                console.log("other player disconnected");
                self.infoText.setText('> Game paused \n> [other player disconnected; waiting for new player]');
                
                otherPlayer.destroy();
            });
        });

        this.socket.on('disconnect', function () {
            console.log("connection to server lost");
            // otherPlayer.destroy();
            // self.scene.stop("GameScene");

            if (reason && reason === "io server disconnect") {
                // the disconnection was initiated by the server, you need to reconnect manually
                console.log("connection was ended by the server")
            }
        });

       
        this.socket.on('connect_error', function(e){
            console.log("connect error: ", e);
         });

        this.socket.on("updateState", function(roomInfo) {
            console.log("updateState received!");
            console.log("roomInfo: ", roomInfo);

            self.roomInfo = roomInfo;

            let playerInfo = roomInfo.players;
            self.otherPlayers.getChildren().forEach(function (otherPlayer) {
                if (playerInfo.playerId === otherPlayer.playerId) {
                    otherPlayer.setRotation(playerInfo.rotation);
                    otherPlayer.setPosition(playerInfo.x, playerInfo.y);
                } 

                // TODO HERE 

                // UPDATE ALL COORDINATES ON SCREEN 
                // TODO EMOVE ALL PLAYERS NOT MENTIONED IN PLAYER INFO
            });

            if (
                self.trap.scene && (
                    self.trap.x != roomInfo.trap.x || 
                    self.trap.y != roomInfo.trap.y
                )
            ) {
                self.trap.setPosition(roomInfo.trap.x, roomInfo.trap.y);
            }

            // update trap coordinates
            // TODO

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
        this.scoreText = this.add.text(650, 10, "Score", { fontSize: '24px', fontStyle: 'bold'});
        this.greenScoreText = this.add.text(650, 35, "You:    0", { fontSize: '24px', fill: '#1fc888' });
        this.redScoreText = this.add.text(650, 60, "Other:  0", { fontSize: '24px', fill: '#FF0000' });
        this.infoText = this.add.text(10, 550, "", { fontSize: '16px' });
        this.oldInfoText = this.add.text(10, 550, "", { fontSize: '16px', fill: '#CCCCCC' });


        this.socket.on('scoreUpdateYou', function (points) {
            self.greenScoreText.setText('You:    ' + points);
        });

        this.socket.on("scoreUpdateOther", function (pointsOther) {
            self.redScoreText.setText('Other: ' + pointsOther);
        });
    
        this.socket.on('starLocation', function (starLocation) {

            self.roomInfo.star.x = starLocation.x;
            self.roomInfo.star.y = starLocation.y;
            if (self.star) self.star.destroy();
            self.star = self.physics.add.image(starLocation.x, starLocation.y, 'star');
            console.log("star location received!")
            self.physics.add.overlap(self.ship, self.star, function () {
                self.star.destroy();
                self.socket.emit('starCollected');
                console.log("star collected!");
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
            if (self.trapButton.scene) {self.trapButton.destroy();}
            self.trapButton = new TrapButton(self, trapButtonLocation.x, trapButtonLocation.y);
            self.physics.add.overlap(self.ship, self.trapButton, function() {
              self.trapButton.destroy();
              this.socket.emit('trapReleased');
            }, null, self);
        });
    
     
        this.socket.on("bothPlayersTrapped", function() {

            console.log("both players trapped :( :( :(");
            self.infoText.setText('> Both players trapped! \n> Game will continue in 3 seconds');
            self.tweens.add({
                targets: self.trap,
                alpha: { value: 0.3, duration: 400, ease: 'Power0', loop: 3},
                yoyo: true,
                loop: 3,
            });

            self.time.addEvent({
                delay: 3000,
                callback: ()=>{
                    console.log("delayed event");
                    console.log("self.trap:", self.trap);
                    if (self.trap.x) self.trap.destroy();
                    if (self.trapButton.x) self.trapButton.destroy();
                    console.log("self.trap:", self.trap);
                    self.ship.trapped = false;
                    self.socket.emit("requestNextTrap");
                    console.log("requesting upcoming trap coordinates");
                    //self.infoText.setText("");
                }
            })
            
        });
    
        this.socket.on('playerFreed', function () {
            console.log('all players are freeeeeeeeeeeeeee');
            if (this.trap) this.trap.destroy();
        });
    
    }

    update() {

        // update to new star coordinates
        if (this.star.x && this.roomInfo.star.x) {
            if (
                this.star.x != this.roomInfo.star.x || 
                this.star.y != this.roomInfo.star.y 
                ) {
                    console.log("current star coordinates: ", this.star);
                    console.log("roomInfo star coordinates: ", this.roomInfo.star);

                    this.star.x = this.roomInfo.star.x;
                    this.star.y = this.roomInfo.star.y; 
                }
                
            }


        


        // ship movement

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
        this.add.text(5, 50, 'Waiting for second player to join')

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
            if (!scene.scene.isActive("GameScene")) {
                console.log("game scene is not active; running game scene")
                scene.scene.run("GameScene", { socket: scene.socket,
                    roomInfo: roomInfo });
            } 

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
        this.add.text(5, 50, 'Press any key to start game...')


        this.input.keyboard.on('keydown', function() {
            console.log("requesting to start gamescene");
            gameStarted = 1;


        // Ask server if a room is available!
        // If yes, go to game scene
        // If no, go to waiting scene


        });
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
        this.setAlpha(1);


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
    if (!self.ship) {
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

}

function addOtherPlayers(self, playerInfo) {
    //otherPlayer = self.add.sprite(playerInfo.x, playerInfo.y, 'ship').setOrigin(0.5, 0.5).setDisplaySize(36, 42);
    otherPlayer = self.physics.add.image(playerInfo.x, playerInfo.y, 'ship').setOrigin(0.5, 0.5).setDisplaySize(36, 42);



    // other ship: grey
    otherPlayer.setTint(0x666666);
    otherPlayer.playerId = playerInfo.playerId;
    self.otherPlayers.add(otherPlayer);

}


function activateTrap(self) {
    self.ship.trapped = true;
    // if no overlap,reflect back
    
}

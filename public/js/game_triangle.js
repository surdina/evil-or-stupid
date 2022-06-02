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
var gamePaused = false;
var tutorialStarted = 0;


class Game extends Phaser.Game {
    constructor() {
        super(config);

        // add scenes here
        this.scene.add("MainScene", MainScene);
        this.scene.add("WelcomeScene", WelcomeScene);
        this.scene.add("TutorialScene", TutorialScene);
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
        // console.log("Room info: " + this.roomInfo);
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
                console.log("ship paused while waiting for new player");
                // todo game pause      
                gamePaused = true;
            });

            // request updated state
            self.socket.emit("requestCurrentState");
            

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
        this.oldInfoText = this.add.text(10, 525, "", { fontSize: '16px', fill: '#CCCCCC' });


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

        if (this.ship && this.ship.trapped == false && gamePaused == false) {
    
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
    
        } else if (this.ship && this.ship.trapped == true && gamePaused == false) {
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
        // console.log("Starting WaitingScene for socket id: ", this.socket.id);
    }

    create() {
        const scene = this;
        this.socket.emit("getRoomKey");
        this.add.text(5, 50, 'Waiting for second player to join')

        this.socket.on("startGame", function(availableRoomKey){
            console.log("Starting new game in room with roomKey: " + availableRoomKey);
            gamePaused = false;


        });


        this.socket.on("sendRoomKey", function(availableRoomKey) {
            console.log("Joining room with roomKey: " + availableRoomKey);
        });



        this.socket.on("setStartingState", function(roomInfo) {
            // console.log("setStartingState: " + roomInfo);
            // const { roomKey, players, numPlayers } = roomInfo;

            
            // scene.physics.resume();

              // TODO update to actual data sent in state info
            // state
            // this.state.roomKey = roomKey;
            // this.state.players = players;
            if (!scene.scene.isActive("GameScene")) {
                console.log("Game scene is not active; running game scene now.")
                scene.scene.run("GameScene", { socket: scene.socket,
                    roomInfo: roomInfo });
            } 

            // console.log(roomInfo);

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
        // console.log("Starting WelcomeScene for socket id: ", this.socket.id);
    }

    create() {
        const scene = this;
        this.add.text(5, 60, 'Press T key to start tutorial...')

        this.add.text(5, 80, 'Press G key to start game...')




        this.input.keyboard.on('keydown_T', function() {
            console.log("starting tutorial");
            tutorialStarted = 1;
        });


        this.input.keyboard.on('keydown_G', function() {
            // console.log("requesting to start gamescene");
            gameStarted = 1;

            


        // Ask server if a room is available!
        // If yes, go to game scene
        // If no, go to waiting scene


        });
    }

    update() {        
        if (gameStarted == 1 && gameJoined == 0) {
            this.scene.start("WaitingScene", { socket: this.socket });
        } else if (gameStarted == 0 && tutorialStarted == 1) {
            this.scene.start("TutorialScene", { socket: this.socket });
        }

    }
}

class TutorialScene extends Phaser.Scene {
    constructor() {
        super({key: "TutorialScene"});

    }

    init(data) {
        this.socket = data.socket;

        // const tutorialInfo = {
        //     rotation: 0,
        //     x: Math.floor(Math.random() * 700 / 2) + 50,
        //     y: Math.floor(Math.random() * 500 / 2) + 50,
        //     playerId: this.socket.id,
        //     team: 'green',
        //     points: 0,
        //     pointsOther: 0,
        //     trapped: false,
        //     roomKey : "tutorialPart1"
        // };


        console.log("Starting TutorialScene for socket id: ", this.socket.id);
    }

    // todo make tutorial part that depends on what other player is doing
    create() {
        const self = this;


        const tutorialInfo = {
            "tutorialPart1": {
                tutorialInstruction: {
                    0: "Use the left and right arrow keys to turn towards the star.",
                    1: "Use the up arrow key to move forward, onto the star!",
                    2: "Move onto each star to collect it.",
                },
                players: {
                    "tutorialPlayer" : {
                        playerId: "tutorialPlayer",
                        rotation: 0,
                        x: 150,
                        y: 200,
                    }
                },
                roomKey: "tutorialPart1",
                roomType: "tutorial",
                roundsPlayed: 0,
                scores: {},
                star: {
                    0: { x: 500, y: 200 },
                    1: { x: 500, y: 200 },
                    2: { x: 150, y: 200 },
                },
                trap:  { x: 150, y: 200 },
                trapActive: false,
                trapButton: {},
            },

            "tutorialPart2": {
                tutorialInstruction: {
                    3: "Stars give you points! Move onto the next star.",
                    4: "Stars give you points! Move onto the next star.",
                    5: "This is a trap. You cannot move forward while trapped.",
                    6: "Collect the star without getting trapped.",
                    7: "You can deactivate a trap from the outside by moving to the trap button. Try it out!",
                },
                roomKey: "tutorialPart2",
                roomType: "tutorial",
                roundsPlayed: 0,
                scores: {},
                star: {
                    3: { x: 500, y: 500 },
                    4: { x: 150, y: 200 },
                    5: { x: 500, y: 500 },
                    6: { x: 300, y: 300 },
                },
                trap: {
                    3: { x: 150, y: 200 },
                    4: { x: 150, y: 200 },
                    5: { x: 150, y: 200 },
                    6: { x: 500, y: 500 },
                },
                trapActive: false,
                trapButton: {},
            },
            "tutorialPart3": {
                tutorialInstruction: {
                    1: "Other players may be on your team (friendly, green), or on the opposite team and playing against you (enemies, red).",
                    2: "Helping other players on your team gives you points.",
                    3: "If you collect a star while an enemy player is trapped, you get more points.",
                },
                players: {
                    "tutorialPlayer" : {
                        playerId: "tutorialPlayer",
                        rotation: 0,
                        x: 150,
                        y: 300,
                    }
                },
                roomKey: "tutorialPart3",
                roomType: "tutorial",
                roundsPlayed: 0,
                scores: {},
                star: {x: 600, y: 400},
                trap: {},
                trapActive: false,
                trapButton: {},
            },
           
        };

        this.tutorialInfo = tutorialInfo;
        this.roomInfo = tutorialInfo.tutorialPart1;
        // console.log("Room info: " + this.roomInfo);
        this.players = this.roomInfo.players;
        this.starLocation = this.roomInfo.star;
        this.trapLocation = this.roomInfo.trap;
        this.trapButton = this.roomInfo.trapButton;
        this.trapActive = this.roomInfo.trapActive;

        if (!this.ship) {
            this.ship = this.physics.add.image(
                this.roomInfo.players["tutorialPlayer"].x, 
                this.roomInfo.players["tutorialPlayer"].y, 
                'ship'
                ).setOrigin(0.5, 0.5).setDisplaySize(36, 42);
                this.ship.trapped = false;
                this.ship.setBounce(1, 1);
                this.ship.setCollideWorldBounds(true);
            //self.ship.onWorldBounds=true;
            // own ship: green
            this.ship.setTint(0x00ffaa);
            this.ship.setDrag(50);
            this.ship.setAngularDrag(50);
            this.ship.setMaxVelocity(400);
        }

        function makeTutorialStar(i, star_x, star_y) {
            self.star = self.physics.add.image(
                star_x,
                star_y,
                'star'
                );
                self.physics.add.overlap(self.ship, self.star, function () {
                    // todo
                    if (self.star) self.star.destroy();
                    self.tutorialStarsCollected += 1;
                    i += 1;
                    console.log(self.tutorialStarsCollected + " stars collected!");
                    self.tutorialStep = self.tutorialStarsCollected + 1;
                    if (i <= 2) {
                        star_x = tutorialInfo.tutorialPart1.star[i].x, 
                        star_y = tutorialInfo.tutorialPart1.star[i].y, 
                        makeTutorialStar(i, star_x, star_y);
                    } else if (i >= 3 & i <= 7) {
                        self.tutorialInfo.roomKey = "tutorialPart2";
                        star_x = tutorialInfo.tutorialPart2.star[i].x, 
                        star_y = tutorialInfo.tutorialPart2.star[i].y, 
                        makeTutorialStar(i, star_x, star_y);
                        console.log("going to part2");
                        self.subtitleText.setText("Tutorial Part 2 of 3: Points and traps");
                    } else if (i >= 8) {
                        self.tutorialInfo.roomKey = "tutorialPart3";
                        console.log("going to part3");
                        self.subtitleText.setText("Tutorial Part 3 of 3: Other players");

                    }
                }, null, self);
        }

        function makeTutorialTrap(i) {
            if (self.trap) self.trap.destroy();
            self.ship.trapped = false;    
            self.trap = new Trap(self, 
                tutorialInfo.tutorialPart2.trap.x,
                tutorialInfo.tutorialPart2.trap.y);   
            self.physics.add.overlap(self.ship, self.trap, function () {
                if (this.ship.trapped == false) {
                    console.log('player trapped');
                    activateTrap(self);
                }
            }, null, self);
        }

        makeTutorialStar(
            1, 
            tutorialInfo.tutorialPart1.star[1].x, 
            tutorialInfo.tutorialPart1.star[1].y,
            );
        /* 
        this.star = this.physics.add.image(
            tutorialInfo.tutorialPart1.star[1].x, 
            tutorialInfo.tutorialPart1.star[1].y, 
            'star'
            );
            self.physics.add.overlap(self.ship, self.star, function () {
                // todo
                if (self.star) self.star.destroy();
                self.tutorialStarsCollected += 1;
                makeTutorialStar(2);
                console.log(self.tutorialStarsCollected + " stars collected!");
            }, null, self); */


            

        this.input.keyboard.on('keydown', function() {
            tutorialStarted = 1;
        });

        this.cursors = this.input.keyboard.createCursorKeys();
        this.tutorialStep = 0;
        this.tutorialStarsCollected = 0;

        this.subtitleText = this.add.text(5, 60, "", { fontSize: '16px' });

        this.infoText = this.add.text(10, 570, "", { fontSize: '16px' });
        this.oldInfoText = this.add.text(10, 545, "", { fontSize: '16px', fill: '#555555' });
        
        this.scoreText = this.add.text(650, 10, "", { fontSize: '24px', fontStyle: 'bold'});
        this.greenScoreText = this.add.text(650, 35, "", { fontSize: '24px', fill: '#1fc888' });

        this.infoText.setText(this.tutorialInfo.tutorialPart1.tutorialInstruction[0]);
        this.subtitleText.setText("Tutorial Part 1 of 3: How to move");

        console.log(this.infoText.text);

  
    }

    update() {
        
        
        function addTextLine(self, new_text) {
            var old_text = self.infoText.text;
            if (old_text != new_text) {
                self.oldInfoText.setText(old_text);
                self.infoText.setText(new_text);
            }
        }


        if (this.ship) {
    
            if (this.cursors.left.isDown) {
                this.ship.setAngularVelocity(-150);

            } else if (this.cursors.right.isDown) {
                this.ship.setAngularVelocity(150);
            } else {
                this.ship.setAngularVelocity(0);
            }
    
            if (this.cursors.up.isDown && this.tutorialStep >= 1) {
                this.physics.velocityFromRotation(this.ship.rotation + 1.5, 100, this.ship.body.acceleration); 
            } else {
                this.ship.setAcceleration(0);
            }
    
            
            // no walls
            //this.physics.world.wrap(this.ship, 5);
            if (this.tutorialStep == 0 &&
                this.ship.rotation <= -0.8 &&
                this.ship.rotation >= -1.2) {
                    this.tutorialStep = 1;
                    console.log("Can now move forward");
                } else if (this.tutorialStep == 1) {

                    addTextLine(this, this.tutorialInfo.tutorialPart1.tutorialInstruction[1]);

                } else if (this.tutorialStep == 2) {

                    addTextLine(this, this.tutorialInfo.tutorialPart1.tutorialInstruction[2]);

                } else if (this.tutorialStep >= 3) {

                    this.roomInfo = this.tutorialInfo.tutorial3;

                    addTextLine(this, this.tutorialInfo.tutorialPart2.tutorialInstruction[this.tutorialStep]);

                    // TODO update instructions more

                    this.scoreText.setText("Score");
                    this.greenScoreText.setText("You:    " + this.tutorialStarsCollected * 10);
                } 

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



    // other ship: if no info, then grey
    otherPlayer.setTint(0x666666);
    otherPlayer.playerId = playerInfo.playerId;
    self.otherPlayers.add(otherPlayer);

    // TODO other ship: if different team, then red
    // otherPlayer.setTint(0xcf4f45);


    // TODO other ship: if same team, then greenish
    // otherPlayer.setTint(0x77aa8e);

}


function activateTrap(self) {
    self.ship.trapped = true;
    // if no overlap,reflect back
    
}
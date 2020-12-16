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
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

var game = new Phaser.Game(config);

function preload() {
    this.load.image('otherPlayer', 'assets/enemyBlack5.png');
    this.load.image('background', 'graphics/background2.png');
    this.load.image('ground', 'graphics/ground.png');
    this.load.image('ship', 'graphics/triangle_grey.png');
    this.load.image('vwall', 'graphics/vwall.png');
    this.load.image('hwall', 'graphics/hwall.png');
    this.load.image('orange_dot', 'graphics/orange_dot.png');
    this.load.image('purple_dot', 'graphics/star.png');
    this.load.image('purple_block', 'graphics/purple_block.png');
    this.load.image('exit', 'graphics/exit2.png');
    this.load.image('trap', 'graphics/trap_large.png');

}

function create() {
    var self = this;

    //    var graphics = this.add.graphics();
    //    var rect = new Phaser.Geom.Rectangle(0, 0, 800, 600);
    //    graphics.lineStyle(10, 0x999999, 1);
    //    graphics.strokeRectShape(rect);

    // create outer walls
    //    make_wall(0, 0, 'h', this.physics.world.width);
    //    make_wall(0, this.physics.world.height - 10, 'h', this.physics.world.width);
    //    make_wall(0, 0, 'v', this.physics.world.height);
    //    make_wall(this.physics.world.width - 10, 0, 'v', this.physics.world.height);




    // this.socket = io.connect('/', {
    //     path: "/evil-or-stupid"
    // });
    this.socket = io();

    // this.socket = io({
    //     transports: ['websocket']
    //   });

    this.otherPlayers = this.physics.add.group();
    //var walls;
    this.walls = this.physics.add.group();
    this.traps = this.physics.add.group();




    this.socket.on('currentPlayers', function (players) {
        Object.keys(players).forEach(function (id) {
            if (players[id].playerId === self.socket.id) {
                addPlayer(self, players[id]);
            } else {
                addOtherPlayers(self, players[id]);
            }
        });
    });
    this.socket.on('newPlayer', function (playerInfo) {
        addOtherPlayers(self, playerInfo);

    });

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
        self.star = self.physics.add.image(starLocation.x, starLocation.y, 'purple_dot');
        self.physics.add.overlap(self.ship, self.star, function () {
            this.socket.emit('starCollected');
        }, null, self);
    });

    this.socket.on('trapLocation', function (trapLocation) {
        // if (self.trap) self.trap.destroy();
        self.trap = self.physics.add.image(trapLocation.x, trapLocation.y, 'trap');
        self.trap.body.setCircle(100);
        self.trap.setCollideWorldBounds(true);
        self.trap.setBounce(1, 1);




        self.physics.add.overlap(self.ship, self.trap, function () {
            // TODO
            // do the following only if player was not trapped before
            if (self.ship.trapped == false) {
                this.socket.emit('playerEntrapment');
                console.log('player trapped');
                activateTrap(self)
                // self.physics.world.enable(self.trap);
    
            }
        }, null, self);
    });
    
    this.socket.on('playerTrapped', function () {
    // TODO: 
    // - if player is self, restrict movement range to trap coordinates
    // - show 'remove trap' button
    });

    this.socket.on('playerFreed', function () {
    if (self.trap) self.trap.destroy();
    // TODO
    // - When trap is destroyed, button is also destroyed
    // - the trapped player is no longer trapped: player.trapped = false
    });

    /*    this.socket.on('createWalls', function (self, createWalls) {
            // create outer walls
            make_wall(0, 0, 'h', self.physics.world.width);
            make_wall(0, self.physics.world.height - 10, 'h', self.physics.world.width);
            make_wall(0, 0, 'v', self.physics.world.height);
            make_wall(self.physics.world.width - 10, 0, 'v', self.physics.world.height);
            // create separation between players
            make_wall(0, self.physics.world.height / 2, 'h', self.physics.world.width);
            walls.enableBody = true;
            self.physics.arcade.collide(self.ship, self.walls);
            self.physics.world.setBounds(0, 0, 800, 600);
        });
            */
}

function update() {

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
        this.physics.moveToObject(this.ship, this.trap, 60, 300);

        if (this.cursors.left.isDown) {
            this.ship.setAngularVelocity(-150);
        } else if (this.cursors.right.isDown) {
            this.ship.setAngularVelocity(150);
        } else {
            this.ship.setAngularVelocity(0);
        }

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
    }
}

function addPlayer(self, playerInfo) {
    self.ship = self.physics.add.image(playerInfo.x, playerInfo.y, 'ship').setOrigin(0.5, 0.5).setDisplaySize(36, 42);
    self.ship.trapped = false;
    self.ship.setBounce(1, 1);
    self.ship.setCollideWorldBounds(true);
    //self.ship.setCollideWorldBounds=true;
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

//function make_wall(self, x, y, orientation, length) {
//    var wall;
//    if (orientation === 'h') {
//        wall = this.walls.create(x, y, 'hwall');
//        wall.width = length;
//        wall.height = 10;
//    } else if (orientation === 'v') {
//        wall = this.walls.create(x, y, 'vwall');
//        wall.width = 10;
//        wall.height = length;
//    }


function activateTrap(self) {
    //self.physics.add.collider(self.ship, self.trap)
    self.ship.trapped = true;
    // if no overlap,reflect back
    
}
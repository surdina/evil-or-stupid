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

new Phaser.Game(config);

function preload() {
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

function create() {
    var self = this;
    this.socket = io();
    
    this.otherPlayers = this.physics.add.group();
    //var walls;
    this.walls = this.physics.add.group();
    // this.traps = this.physics.add.group({
    //     defaultKey: 'trap',
    //     classType: Traps,
    //     createCallback: function (trap) {
    //         trap.setName('trap' + this.getLength());
    //         console.log('Created', trap.name);
    //     },
    //     removeCallback: function (trap) {
    //         console.log('Removed', trap.name);
    //     }
    // });



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
        // self.trapButton = self.physics.add.image(
        //     trapButtonLocation.x, 
        //     trapButtonLocation.y,
        //     'trapButton'
        // );

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
/*jslint node: true*/
'use strict';

var game = new Phaser.Game(800, 600, Phaser.AUTO, '', { preload: preload, create: create, update: update });

function preload() {

    game.load.image('background', 'graphics/background2.png');
    game.load.image('ground', 'graphics/ground.png');
    game.load.image('player', 'graphics/triangle.png');
    game.load.image('vwall', 'graphics/vwall.png');
    game.load.image('hwall', 'graphics/hwall.png');
    game.load.image('orange_dot', 'graphics/orange_dot.png');
    game.load.image('purple_dot', 'graphics/purple_dot.png');
    game.load.image('purple_block', 'graphics/purple_block.png');
    game.load.image('exit', 'graphics/exit2.png');

}

// create variables for walls and player groups
var walls;
var player;
var cursors;
var dots1;
var dots2;
var twalls1;
var twalls2;

function create() {

    // add background image
    game.add.sprite(0, 0, 'background');

    // enable Arcade Physics system
    game.physics.startSystem(Phaser.Physics.ARCADE);

    // add walls
    walls = game.add.group();

    // enable physics for walls
    walls.enableBody = true;

    // create outer walls
    make_wall(0, 0, 'h', game.world.width);
    make_wall(0, game.world.height - 10, 'h', game.world.width);
    make_wall(0, 0, 'v', game.world.height);
    make_wall(game.world.width - 10, 0, 'v', game.world.height);

    // create separation between players
    make_wall(0, game.world.height / 2, 'h', game.world.width);



    // add player
    player = game.add.sprite(32, game.world.height - 150, 'player');
    // make triangle a bit smaller
    player.scale.setTo(0.5, 0.5);

    // enable Physics
    game.physics.arcade.enable(player);

    // make player bounce
    player.body.bounce.y = 0.5;
    player.body.bounce.x = 0.5;
    player.body.gravity.y = 0;
    player.body.collideWorldBounds = true;

    // make dots
    dots1 = game.add.group();
    // enable physics for them
    dots1.enableBody = true;

    //dots1.create(30, game.world.height - 100, 'purple_dot');
    dots1.create(30, 500, 'purple_dot');

    
    cursors = game.input.keyboard.createCursorKeys();

    // add temporary walls and turn on physics
    twalls1 = game.add.group();
    twalls1.enableBody = true;

    // add one temporary wall
    var twall1 = twalls1.create(100, 50, 'purple_block')
}

var friction = 0.1;
var max_acceleration = 100;

function update() {

    // add collision between player and platforms
    game.physics.arcade.collide(player, walls);
    game.physics.arcade.collide(dots1, walls);
    game.physics.arcade.overlap(player, dots1, bumpDot, null, this);
    game.physics.arcade.collide(player, twalls1);
    game.physics.arcade.collide(player, twalls2);

    // calculate angle of the direction player is facing
    var angle = Math.atan2(player.body.velocity.y, player.body.velocity.x) * (180 / Math.PI);

    // reset acceleration
    player.body.acceleration.x = 0;
    player.body.acceleration.y = 0;
    if (cursors.left.isDown && player.body.acceleration.x > -max_acceleration) {
        // move to the left
        player.body.acceleration.x -= 10;
        player.body.velocity.x += player.body.acceleration.x;
        update_angle(player, angle);
    } else if (cursors.right.isDown && player.body.acceleration.x < max_acceleration) {
        // move to the right
        player.body.acceleration.x += 10;
        player.body.velocity.x += player.body.acceleration.x;
        update_angle(player, angle);
    } else if (cursors.up.isDown && player.body.acceleration.y > -max_acceleration) {
        // move up
        player.body.acceleration.y -= 10;
        player.body.velocity.y += player.body.acceleration.y;
        update_angle(player, angle);
    } else if (cursors.down.isDown && player.body.acceleration.y < max_acceleration) {
        // move down
        player.body.acceleration.y += 10;
        player.body.velocity.y += player.body.acceleration.y;
        update_angle(player, angle);
    } else {
      // slow down player (friction)
       // player.body.velocity.x *= 0.99;
        // player.body.velocity.y *= 0.99;
        player.body.acceleration.x = 0;
        player.body.acceleration.y = 0;
        update_angle(player, angle);
    }
}

function update_angle(player, angle) {
    if (player.body.rotation != angle) {
      // angle update code here
    }
}

function make_wall(x, y, orientation, length) {
    var wall;
    if (orientation === 'h') {
        wall = walls.create(x, y, 'hwall');
        wall.width = length;
        wall.height = 10;
    } else if (orientation === 'v') {
        wall = walls.create(x, y, 'vwall');
        wall.width = 10;
        wall.height = length;
    }

    wall.body.immovable = true;
    wall.body.moves = false;
    wall.body.allowGravity = false;
}

// function that removes other player's temporary walls
function help_other_player(player) {
    if (player == player) { // change to player1
        twalls1.kill();
    } else if (player == player2) {
        twalls2.kill();
    }
}

function bumpDot(player, dots_i) {
    console.log("dotbump");
    // Removes the dot from the screen
    dots_i.kill();
    help_other_player(player);
}

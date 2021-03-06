/*
 * GameServer
 * 
 * Wrapper class for ws server, log, player list, and msg manager
 * 
 */

module.exports = GameServer;

var util = require('util');
var EventEmitter = require('events').EventEmitter;
util.inherits(GameServer, EventEmitter);

var ServerLog = require('./ServerLog');
var GameMsgManager = require('./GameMsgManager');

var Utils = require('nodegame-client').Utils;
var GameState = require('nodegame-client').GameState;
var GameMsg = require('nodegame-client').GameMsg;

var PlayerList = require('nodegame-client').PlayerList;
var Player = require('nodegame-client').Player;

function GameServer(options) {
	EventEmitter.call(this);

	this.options = options;
	this.user_options = options.user_options;
	
	this.io = options.io;
	this.channel = '/' + options.channel;
	this.socket = null; // to be init after a connection is created
	this.parent = options.parent;
	this.name = this.user_options.name;

	this.log = new ServerLog({
		name : '[' + this.parent + ' - ' + this.name + ']',
		dumpmsg : ('undefined' === typeof this.user_options.dumpmsg) ? false : this.user_options.dumpmsg,
		dumpsys : ('undefined' === typeof this.user_options.dumpsys) ? true : this.user_options.dumpsys,
		verbosity : ('undefined' === typeof this.user_options.verbosity) ? 1 : this.user_options.verbosity
	});

	this.server = options.server;

	this.gmm = new GameMsgManager(this);

	this.pl = new PlayerList();
	
	// List of players who have disconnected recently
	this.disconnected = new PlayerList();

	this.partner = null;
}

GameServer.prototype.setPartner = function(node) {
	this.partner = node;
};

/**
 * Attach standard and custom listeners to the server.
 * 
 */
GameServer.prototype.listen = function() {
	this.attachListeners();
	this.attachCustomListeners();
};

// Parse the newly received message
GameServer.prototype.secureParse = function(msg) {

	try {
		var gameMsg = GameMsg.clone(JSON.parse(msg));
		this.log.msg('R, ' + gameMsg);
		return gameMsg;
	} catch (e) {
		this.log.log("Malformed msg received: " + e, 'ERR');
		return false;
	}

};

GameServer.prototype.attachListeners = function() {
	var that = this;
	var log = this.log;

	log.log('Listening for connections');

	this.channel = this.server.of(this.channel).on(
			'connection',
			function(socket) {
				// Register the socket as a class variable
				that.socket = socket;

				// Send Welcome Msg and notify others
				that.welcomeClient(socket.id);

				socket.on('message', function(message) {

					var msg = that.secureParse(message);

					if (msg) { // Parsing Successful
						// that.log.log('JUST RECEIVED P ' + util.inspect(msg));

						var target = (this.target === GameMsg.targets.DATA) ? this.text : this.target;
						
						// TODO: KEEP THE
						// FORWADING!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! ?
						// that.gmm.forward(msg);
						
						log.log(that.name + ' About to emit ' + msg.toEvent());
						log.log(msg.toEvent() + ' ' + msg.to + '-> ' + msg.from);
						
						that.emit(msg.toEvent(), msg);
					}
				});

				socket.on('disconnect', function() {
					
					console.log('DISCONNECTED');
					var player = that.pl.pop(socket.id);
					that.disconnected.add(player);
					
					var txt = player + " disconnected";
					that.gmm.sendTXT(txt, 'ALL');
					log.log(txt);
					
					
					// Notify all server
					that.emit('closed', socket.id);
				});

			});

	// TODO: Check this
	this.server.sockets.on("shutdown", function(message) {
		log.log("Server is shutting down.");
		that.pl.clear(true);
		that.gmm.sendPLIST(that);
		log.close();
	});
};

// Will be overwritten
GameServer.prototype.attachCustomListeners = function() {};

GameServer.prototype.welcomeClient = function(client) {
	var connStr = "Welcome <" + client + ">";
	this.log.log(connStr);

	// Send HI msg to the newly connected client
	this.gmm.sendHI(connStr, client);
};

GameServer.prototype.checkSync = function() {
	// TODO: complete function checkSync
	return true;
};

GameServer.prototype.getConnections = function() {

	var clientids = [];
	for ( var i in this.channel.sockets) {
		if (this.channel.sockets.hasOwnProperty(i)) {
			clientids.push(i);
			this.log(i);
		}
	}
	return clientids;
};

GameServer.prototype.isValidRecipient = function (to) {
	if (to !== null && to !== 'SERVER') {
		return true;
	}
	return false;
};

var net = require('net');

var defaults = {
  port:     10001
, password: 'bk4441'
, loginWelcomeMessage: 'Welcome to the MockNMT!'
, streamPeriod: 500
, currentLevel: 55
, variance: 1.5
};

var MockNMT = module.exports = function( options ){
  this.options = options || {};

  for ( var key in defaults ){
    if ( !(key in this.options) ) this.options[ key ] = defaults[ key ];
  }

  this._loggedIn  = false;
  this._streaming = false;

  this.server = net.createServer( this.onSocketReceived.bind( this ) );

  return this;
};

MockNMT.prototype.listen = function( callback ){
  this.server.listen( this.options.port, callback);
  return this;
};

MockNMT.prototype.login = function(){
  this._loggedIn = true;
  return this;
};

MockNMT.prototype.startStreaming = function(){
  var this_ = this;

  this._streaming = true;

  this.streamInterval = setInterval(
    this.onStreamTick.bind( this )
  , this.options.streamPeriod
  );

  return this;
};

MockNMT.prototype.onStreamTick = function(){
  if ( !this.socket ) return;

  var to    = this.options.currentLevel + this.options.variance;
  var from  = this.options.currentLevel - this.options.variance;
  var val   = Math.floor( Math.random() * ( to - from + 1 ) + from );

  this.socket.write( val + ', ' + val + '\n' );
};

MockNMT.prototype.parseData = function( data ){
  if ( !this.isLoggedIn() ){
    if ( data == this.options.password ){
      this.login();
      return this.options.loginWelcomeMessage + '\n\n$ ';
    } else {
      return '* ';
    }
  }

  switch ( data ){
    default:            return 'MockNMT.parseData cannot make sense of `' + data + '`\n$ ';
    case 'ec off':      return '$ ';
    case '\u0003':      return this.onCancel(), '$ ';
    case 'level repe':  return this.startStreaming(), '\n';
  }

  return this;
};

MockNMT.prototype.isLoggedIn = function(){
  return this._loggedIn;
};

MockNMT.prototype.onSocketReceived = function( socket ){
  if ( this.socket ) this.socket.end();

  this.socket = socket;

  this.socket.on( 'data',   this.onSocketData.bind( this ) );
  this.socket.on( 'drain',  this.onSocketDrain.bind( this ) );
  this.socket.on( 'end',    this.onSocketEnd.bind( this ) );

  if ( !this.isLoggedIn() ){
    this.socket.write('* ');
  } else if ( this._streaming ){
    this.startStreaming();
  } else {
    this.socket.write('$ ');
  }
};

MockNMT.prototype.onSocketData = function( data ){
  var this_ = this;

  data.toString().split('\n').forEach( function( d ){
    d = d.trim();

    if ( !d ) return;
    
    this_.socket.write( this_.parseData( d ) );
  });
};

MockNMT.prototype.onSocketEnd = function( data ){
  this.socket.destroy();
  delete this.socket;
  clearInterval( this.streamInterval );
};

MockNMT.prototype.onSocketDrain = function( data ){
  this.socket.write('');
};

MockNMT.prototype.onCancel = function() {
  var this_ = this;
  setTimeout(function(){ this_.socket.pause(); }, 500);
  setTimeout(function(){ this_.socket.resume(); }, 1000);
  // setTimeout(function(){ this_.socket.write('blah'); }, 1500)
};
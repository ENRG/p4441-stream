// TODO: use a FSM implementation

var util    = require('util');
var net     = require('net');
var Stream  = require('stream');

util.inherits( Nmt, Stream.Duplex );

function Nmt( options ){
  options = options || {};

  Stream.Duplex.call( this, options );

  var defaults = {
    port:     10001
  , password: 'bk4441'
  , address:  'localhost'
  };

  for ( var key in defaults ){
    if ( !(key in options) ) options[key] = defaults[key];
  }

  this.buffer = "";
  this.source = new net.Socket();

  var this_ = this;
  this.source.on('end', function() {
    this_.push(null);
    this_.emit('end');
  });

  this.source.on('close', function() {
    this_.emit('close');
  });

  // give it a kick whenever the source is readable
  // read(0) will not consume any bytes
  this.source.on('readable', function() {
    this_.read(0);
  });

  // NMT Settings
  this.address  = options.address;
  this.port     = options.port;
  this.password = options.password;

  this.state = {
    loggingIn:          false
  , loggedIn:           false
  , enteringRealTime:   false
  , realTime:           false
  , pendingTransaction: false
  , connecting:         false
  , atLogin:            false
  };

  return this;
};

Nmt.prototype.setNmt = function( nmt ){
  this.address  = nmt.address;
  this.port     = nmt.port;
  this.password = nmt.password;

  return this;
};

Nmt.prototype.pendingTransaction = function( isPending ){
  return;

  if ( this.state.pendingTransaction && !isPending ){
    this.emit('transaction-complete');
  } else if ( !this.state.pendingTransaction && isPending ){
    this.emit('transaction-begin');
  }

  this.state.pendingTransaction = !!isPending;
};

Nmt.prototype.connect = function( callback ){
  var this_ = this;

  if ( this.state.connecting ){
    if ( callback ) callback();
    return;
  }

  this.state.connecting = true;
  this.pendingTransaction( true );

  this.source.connect( this.port, this.address, function( error ){
    this_.state.connecting = false;

    if ( error ){

      if ( error ) this_.emit( 'error', error );
      if ( callback ) callback( error );

      return;
    }

    this_.cancel();

    var onceAtLogin = function(){
      this_.login( function( error ){
        if ( error ){
          return callback ? callback( error ) : null;
        }
      });
    };

    var onceAtPrompt = function(){
      // If we happened to already be logged in, remove listener
      this_.removeListener( 'at-login', onceAtLogin );
      this_.enterRealTime( callback );
    };

    this_.once( 'at-login',  onceAtLogin );
    this_.once( 'at-prompt', onceAtPrompt );
  });

  return this;
};

Nmt.prototype.enterRealTime = function( callback ){
  var this_ = this;

  if ( this.state.realTime || this.state.enteringRealTime ) return this;

  if ( this.state.pendingTransaction ){
    return this.once('transaction-complete', function(){
      this_.enterRealTime();
    });
  }

  this.state.enteringRealTime = true;

  this.cancel();

  this.once('at-prompt', function(){
    this_.write("level repe\n");
    this_.pendingTransaction( true );

    this.once('reading-leqs', function(){
      this_.state.enteringRealTime = false;
      this_.pendingTransaction( false );

      this_.state.realTime = true;
      this_.emit('entered-real-time');
      return callback ? callback() : null;
    });
  });

  return this;
};

Nmt.prototype.login = function( callback ){
  var this_ = this;

  if ( this.state.pendingTransaction ){
    return this.once('transaction-complete', function(){
      this_.login( callback );
    });
  }

  if ( this.state.loggedIn ){
    return callback ? callback() : null;
  }

  var onceAtPrompt = function(){
    // In case upon canceling we were already at prompt
    this_.removeListener( 'at-login', onceAtLogin );
    this_.state.loggingIn = false;
    this_.state.loggedIn = true;
    this_.pendingTransaction(false);
    if ( callback ) callback();
  };

  var onceAtLogin = function(){
    var onceReturnToLogin = function(){
      this_.loggingIn = false;
      this_.emit('invalid-password');
      if ( callback ) return callback('invalid-password');
    };

    this_.write( this.password + "\n" );
    this_.once( 'at-login', onceReturnToLogin );
  };

  this.state.loggingIn = true;
  this.cancel();

  this.once( 'at-prompt', onceAtPrompt );
  this.once( 'at-login', onceAtLogin );

  return this;
};

Nmt.prototype.cancel = function(){
  this.write("\x03\n");
  this.state.realTime = false;
  return this;
};

Nmt.prototype._write = function( data, encoding, callback ){
  // Ensure we do not currently have a transaction pending
  // that would cause catastrophic failure if we were to write
  if ( this.state.pendingTransaction ){
    return this.once( 'transaction-complete', function(){
      this._write( data, encoding, callback );
    });
  }

  return this.source.write( data, encoding, callback );
};

Nmt.prototype._read = function( size ){
  var chunk = this.source.read( this, size );

  if ( !chunk ) return this.push('');

  this.emit('reading');

  chunk = chunk.toString();

  // Check state
  // Login Prompt
  if ( chunk.indexOf('*') > -1 ){
    this.emit('at-login');
    this.state.loggedIn = false;
    this.state.atLogin = true;
    return this.push('');
  }

  // Logged in Prompt
  if ( chunk.indexOf('$') > -1 ){
    this.emit('at-prompt');
    this.state.loggedIn = true;
    this.state.atLogin = false;
    return this.push('');
  }

  this.emit('reading-leqs');

  var leq, leqs = [];

  var checkBuffer = function( b ){
    return b.indexOf('\n') != b.lastIndexOf('\n');
  };

  this.buffer += chunk;

  if ( !checkBuffer( this.buffer ) ) return this.push('');

  // At least 2 new lines in the buffer
  while ( checkBuffer( this.buffer ) ){
    // Slice off first new line
    this.buffer = this.buffer.substring( this.buffer.indexOf('\n') + 1 );
    // Parse out leq from chunk
    leq = this.buffer.substring( 0, this.buffer.indexOf('\n') );

    leq = parseFloat( leq.split(',')[1] );

    // Remove oldness from buffer
    this.buffer = this.buffer.substring( this.buffer.indexOf('\n') );

    // Leq is number and !NaN
    if (+leq > 0){
      this.emit( 'leq', leq );
      leqs.push( leq.toString() );
    }
  }

  this.push( leqs.join(', ') );
};

Nmt.prototype.destroy = function(){
  this.source.destroy();
  this.state.connected = false;
};

module.exports = Nmt;
var assert  = require('assert');
var async   = require('async');
var nmt     = require('../');

var servers = [
  { port: 10001 }
, { port: 10002 }
];

// Start Mock Servers
before( function( done ){
  var fns = servers.map( function( server ){
    return function( cb ){
      nmt.createMockServer( server ).listen( cb );
    };
  });

  async.series( fns, done );
});

describe ('Leq Stream', function(){
  it ('should connect, logout, and close', function( done ){
    var stream = nmt.createLeqStream( servers[0] );

    stream.connect( function( error ){
      assert( !error );

      stream.logout( function( error ){
        assert( !error );

        stream.destroy();
        stream.on( 'close', done );
      });
    });
  });

  it ('should connect and read some dBs', function( done ){
    this.timeout( 5000 );

    var numToGet = 3, i = 0;
    var stream = nmt.createLeqStream( servers[0] );

    stream.on( 'leq', function( leq ){
      if ( ++i === numToGet ) return done();

      assert.equal( typeof leq, 'number' );
      assert.equal( leq > 0, true );
    });

    stream.connect();
  });
});
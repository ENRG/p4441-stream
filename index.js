module.exports.LeqStream  = require('./lib/leq-stream');
module.exports.MockServer = require('./lib/mock-server');

module.exports.createLeqStream = function( options ){
  return new module.exports.LeqStream( options );
};

module.exports.createMockServer = function( options ){
  return new module.exports.MockServer( options );
};
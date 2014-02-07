# P4441 Stream

This is a [Duplex Stream](http://nodejs.org/api/stream.html) implementation used to facilitate access to p4441 or rather the noise monitoring terminals. At it's heart is a socket, however, it handles all of the statefulness from Brüel & Kjær's analyzer interface.

The primary use of this stream is to simply get the NMT to enter its real-time dB `flow mode`. Many things can go wrong along the way, and users of the interface only care about reading and writing data, not the various outputs of the interface.

__Install__

```
npm install p4441-stream
```

## Usage

This module exports a contstructor for this stream object, but also exposes a factory function as a property on the constructor.

```javascript
var nmt = require('p4441-stream');

var leqStream = nmt.getLeqStream({
  address: 'localhost'
, port:     10001
, password: 'my-password'
});

leqStream.pipe( process.stdout );

leqStream.connect( function( error ){
  /* You may handle errors in callback or in `error` events */

  leqStream.login().enterRealTime();
});
```

## Static

### getLeqStream( object nmt )

Equivalent to running:

```javascript
var Nmt = require('p4441-stream');
var nmt1 = new Nmt();
```

## Methods

### setNmt( object nmt )

Sets the NMT object if one did not pass the value into the factory function.

### connect( callback )

Calls `connect` on the underlying source socket. Will callback with `callback( error )`. Also emits `connected`.

### login( callback )

Attempts to login to the NMT. Depending on the current state, it will write `nmt.password` to the underlying socket. Once a response comes back, it will callback with `callback( error )`. If the socket emits a chunk containing an `*`, then we know the password was incorrect and we emit an error; If the socket emits a chunk containing a `$`, then we know that either the login was successful or we were already logged in.

### enterRealTime( callback )

Attempts to get the NMT in dB flow mode by writing `level repe` to the underlying socket. Emits: `reading-leqs`, and `entered-real-time`.

## Events

* error
* data
* leq
* end
* close
* transaction-complete
* transaction-begin
* entered-real-time
* invalid-password
* reading
* at-login
* at-prompt
* reading-leqs
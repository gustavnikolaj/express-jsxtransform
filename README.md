# express-jsxtransform

[![NPM version](https://badge.fury.io/js/express-jsxtransform.svg)](http://badge.fury.io/js/express-jsxtransform)
[![Build Status](https://travis-ci.org/gustavnikolaj/express-jsxtransform.svg?branch=master)](https://travis-ci.org/gustavnikolaj/express-jsxtransform)
[![Dependency Status](https://david-dm.org/gustavnikolaj/express-jsxtransform.png)](https://david-dm.org/gustavnikolaj/express-jsxtransform)

Middleware that compiles jsx on-the-fly. Intended to be used in a
development setting with the `express.static` middleware, but should
work with any middleware further down the stack, even an http proxy.

The response will be rewritten under these circumstances:

* If the response is a file with the `.js` extension and has the
`/** @jsx ... */` annotation on the first line.
* If the response is a file with the `.jsx` extension. In this case
the annotation is optional.

jsxtranform plays nice with conditional GET. If the original response
has an ETag, jsxtransform will add to it so the ETag of the compiled
response never clashes with the original ETag. That prevents the
middleware issuing the original response from being confused into
sending a false positive `304 Not Modified` if jsxtransform is turned
off or removed from the stack later.


## Installation

Make sure you have node.js and npm installed, then run:

    npm install express-jsxtransform

## Example usage

```javascript
var express = require('express'),
    jsxtransform = require('express-jsxtransform'),
    root = '/path/to/my/static/files';

express.createServer()
    .use(jsxtransform())
    .use(express.static(root))
    .listen(1337);
```

## License

3-clause BSD license -- see the `LICENSE` file for details.

## Credit

This module is heavily based on the work of Andreas Lind Petersen
([@papandreou](https://github.com/papandreou)) in his module
[express-compiless](https://github.com/papandreou/express-compiless).

/*global describe,it,before,after*/
var express = require('express'),
    Path = require('path'),
    request = require('request'),
    passError = require('passerror'),
    expect = require('unexpected'),
    jsxtransform = require('../lib/jsxtransform');

var root = Path.resolve(__dirname, 'root'),
    // Pick a random TCP port above 10000 (.listen(0) doesn't work anymore?)
    portNumber = 10000 + Math.floor(55536 * Math.random()),
    baseUrl = 'http://127.0.0.1:' + portNumber,
    server;

expect.addAssertion('to respond', function (expect, subject) {
    var args = Array.prototype.slice.call(arguments, 2);
    var lines = args.slice(0, -1);
    var done = args[args.length - 1];

    request(baseUrl + '/' + subject, passError(done, function (response, body) {
        expect(body, 'to equal', lines.join('\n') + '\n');
        done();
    }));
});

describe('test server with jsxtransform', function () {
    before(function (done) {
        server = express.createServer()
            .use(function (req, res, next) {
                next();
            })
            .use(jsxtransform())
            .use(express['static'](root))
            .listen(portNumber, done);
    });

    after(function () {
        server.close();
    });

    it('should not mess with request for txt file', function (done) {
        expect('/something.txt',
               'to respond',
               'foo',
               done);
    });
    it('should not mess with request for js file that contains no jsx syntax', function (done) {
        expect('/something.js',
               'to respond',
               'foo();',
               done);
    });
    it('should transform a js file with jsx content and jsx annotation', function (done) {
        expect('/helloWorldJsx.js',
               'to respond',
               '/** @jsx React.DOM */',
               'React.renderComponent(',
               '  React.DOM.h1(null, "Hello, world!"),',
               '  document.getElementById(\'example\')',
               ');',
               done);
    });
});
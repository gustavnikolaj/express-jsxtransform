require('express-hijackresponse');
require('bufferjs');

var React = require('react-tools');

module.exports = function (options) {

    return function (req, res, next) {
        // Prevent If-None-Match revalidation with the downstream middleware with ETags that aren't suffixed with "-jsxtransform":
        var ifNoneMatch = req.headers['if-none-match'];
        if (ifNoneMatch) {
            var validIfNoneMatchTokens = ifNoneMatch.split(' ').filter(function (etag) {
                return /-jsxtransform\"$/.test(etag);
            });
            if (validIfNoneMatchTokens.length > 0) {
                req.headers['if-none-match'] = validIfNoneMatchTokens.join(' ');
            } else {
                delete req.headers['if-none-match'];
            }
        }
        delete req.headers['if-modified-since']; // Prevent false positive conditional GETs after enabling jsxtransform
        res.hijack(function (err, res) {
            if (res.statusCode === 200 && /\.js$/.test(req.originalUrl)) {
                var chunks = [];
                res.on('error', function () {
                    res.unhijack();
                    next();
                }).on('data', function (chunk) {
                    chunks.push(chunk);
                }).on('end', function () {
                    if (!chunks.length) {
                        return res.send(res.statusCode);
                    }
                    var jsText = Buffer.concat(chunks).toString('utf-8');

                    var firstLine = jsText.split('\n')[0];

                    // if the first line has the jsx annotation
                    if (/^\/\*\*(\s)@jsx/.test(firstLine)) {
                        jsText = React.transform(jsText, {});
                    }

                    res.setHeader('Content-Type', 'text/javascript');
                    res.setHeader('Content-Length', Buffer.byteLength(jsText));
                    res.end(jsText);
                });
            } else {
                res.unhijack(true);
            }
        });
        next();
    };
};

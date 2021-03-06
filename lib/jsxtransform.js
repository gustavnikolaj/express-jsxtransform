var hijackResponse = require('hijackresponse');

var React = require('react-tools');

function getErrorScript(errorMessage) {
    var cleanErrorMessage = errorMessage.replace('\n', '\\n').replace('"', '\\"');
    return [
        '/**********************************************************',
        errorMessage.split('\n').map(function (str) {
            return ' * ' + str;
        }).join('\n'),
        ' *********************************************************/',
        ';(function () {',
        '    var element = document.createElement("DIV");',
        '    element.style.position = "absolute";',
        '    element.style.top = 0;',
        '    element.style.left = 0;',
        '    element.style.right = 0;',
        '    element.style.bottom = 0;',
        '    element.style.backgroundColor = "white";',
        '    element.style.zIndex = 999999;',
        '    element.style.fontSize = "24px";',
        '    element.style.color = "red";',
        '    element.style.padding = "20px";',
        '    element.style.textAlign = "left";',
        '    element.style.whiteSpace = "pre";',
        '    element.style.fontFamily = "monospace";',
        '    element.innerText = "' + cleanErrorMessage + '";',
        '    document.body.appendChild(element);',
        '}());',
        ''
    ].join('\n');
}

module.exports = function (options) {
    return function (req, res, next) {
        var fileType = (req.originalUrl.match(/\.(js|jsx)$/) || []).shift();
        // Prevent If-None-Match revalidation with the downstream middleware with ETags that aren't suffixed with "-jsxtransform":
        var ifNoneMatch = req.headers['if-none-match'];

        if (ifNoneMatch) {
            var validIfNoneMatchTokens = ifNoneMatch.split(' ').filter(function (etag) {
                return /-jsxtransform\"$/.test(etag);
            });

            if (validIfNoneMatchTokens.length > 0) {
                // Give the upstream middleware a chance to reply 304:
                req.headers['if-none-match'] = validIfNoneMatchTokens.map(function (validIfNoneMatchToken) {
                    return validIfNoneMatchToken.replace(/-jsxtransform(["-])$/, '$1');
                }).join(" ");
            } else {
                delete req.headers['if-none-match'];
            }
        }

        delete req.headers['if-modified-since']; // Prevent false positive conditional GETs after enabling jsxtransform

        hijackResponse(res, function (err, res) {
            var annotationInserted = false;
            var upstreamETag;

            if (err) {
                res.unhijack();
                return next(err);
            }
            if (!fileType) {
                res.unhijack();
            }

            if (res.statusCode === 304) {
                upstreamETag = res.getHeader('ETag');
                if (upstreamETag && !(/-jsxtransform"$/.test(upstreamETag))) {
                    res.setHeader('ETag', upstreamETag.replace(/"$/, '-jsxtransform"'));
                    return res.unhijack();
                }
            } else if (res.statusCode !== 200) {
                return res.unhijack();
            }

            var bodyChunks = [];
            res.on('data', function (chunk) {
                bodyChunks.push(chunk);
            }).on('end', function () {
                var body = Buffer.concat(bodyChunks).toString();
                var firstLine = body.split('\n')[0];

                if (fileType === '.jsx') {
                    if (!/^\/\*\*(\s)@jsx/.test(firstLine)) {
                        body = '/** @jsx React.DOM */\n' + body;
                        annotationInserted = true;
                    }
                }

                if (fileType === '.jsx' || /^\/\*\*(\s)@jsx/.test(firstLine)) {
                    try {
                        body = React.transform(body, {});

                        if (annotationInserted) {
                            body = body.split('\n').splice(1).join('\n');
                        }

                        upstreamETag = res.getHeader('ETag');
                        if (upstreamETag) {
                            res.setHeader('ETag', upstreamETag.replace(/"$/, '-jsxtransform"'));
                        }
                    } catch (e) {
                        // If parsing the file throws an error, build a
                        // meaningful error response.
                        var errorMessage = e.message + '\nIn file: ' + req.originalUrl;
                        body = getErrorScript(errorMessage);
                    }
                }

                res.setHeader('Content-Type', 'text/javascript; charset=UTF-8');
                res.setHeader('Content-Length', Buffer.byteLength(body));

                res.end(body);
            });
        });
        return next();
    };
};

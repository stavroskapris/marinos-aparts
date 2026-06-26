function handler(event) {
    var request = event.request;
    var uri = request.uri;

    var redirects = {
        '/': '/en/',
        '/home.html': '/en/',
        '/kimon.html': '/en/kimon',
        '/irida.html': '/en/irida',
        '/location.html': '/en/location',
        '/contact.html': '/en/contact'
    };

    if (redirects.hasOwnProperty(uri)) {
        return {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers: { 'location': { value: redirects[uri] } }
        };
    }

    // Map clean/directory URLs to their S3 index.html object.
    if (uri.charAt(uri.length - 1) === '/') {
        request.uri = uri + 'index.html';
    } else {
        var lastSegment = uri.substring(uri.lastIndexOf('/') + 1);
        if (lastSegment.indexOf('.') === -1) {
            request.uri = uri + '/index.html';
        }
    }
    return request;
}

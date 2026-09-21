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
        // 302 (not 301) for the duration of the post-cutover soak: browsers cache a
        // 301 indefinitely, which would strand visitors on /en/* even after a
        // rollback to the legacy bucket. Flip to 301 once prod is settled
        // (docs/superpowers/runbook-cutover.md, Phase E).
        return {
            statusCode: 302,
            statusDescription: 'Found',
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

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
        // 301: the cutover has soaked and these targets are permanent, so let
        // browsers and search engines cache the redirect. This was deliberately
        // a 302 during the soak, because a cached 301 survives a rollback and
        // would have stranded visitors on /en/* (see the cutover runbook).
        return {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers: { 'location': { value: redirects[uri] } }
        };
    }

    // Astro's sitemap integration emits sitemap-index.xml; the legacy site
    // published /sitemap.xml and that URL is what search engines already know.
    // Rewrite (not redirect) so the old address keeps serving a valid sitemap.
    if (uri === '/sitemap.xml') {
        request.uri = '/sitemap-index.xml';
        return request;
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

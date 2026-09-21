function handler(event) {
    // Staging serves a byte-identical copy of production. Without this the
    // mirror is crawlable and competes with the real domain as duplicate
    // content. Attached as viewer-response on the STAGING distribution only.
    var response = event.response;
    response.headers['x-robots-tag'] = { value: 'noindex, nofollow' };
    return response;
}

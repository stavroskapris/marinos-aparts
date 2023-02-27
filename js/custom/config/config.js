/**
 *
 * @type {{contact: string, recaptcha: string}}
 */
App.apiEndPoints = {
    // your api gateway endpoint that triggers email sent function
    contact: 'https://8vgfxd8lde.execute-api.eu-west-1.amazonaws.com/dev/contact',
    // your api gateway endpoint that triggers recaptcha verify
    recaptcha: 'https://8vgfxd8lde.execute-api.eu-west-1.amazonaws.com/dev/validaterecaptcha'
};

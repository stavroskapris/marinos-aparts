//TODO MINIFY JS AND CSS BEFORE FINAL COMMIT
const App = window.App || {};

/**
 * Holds selected language
 *
 */
let lang;

/**
 * Holds current page
 *
 */
let page;

/**
 * On page load
 *
 */
$(function ($) {
    // scroll to top button
    App.handleScrollToTop();
    // get lang if exists
    lang = localStorage.getItem('lang') || 'en';
    // get current page
    page = $('#whichPage').val();
    // configure language menu
    App.configureLangMenu(lang);
    // decide which weather widget to show(en|gr)
    App.configureWeatherWidget(lang);
    // translate current page
    App.translate(page);
    // map
    App.initializeMap();
    // initialize photo galley
    App.galleryInit();
    // reset and validate contact form
    if (page === 'contact') {
        // reset contact form
        App.resetContactForm();
        // contact form field validation
        App.validateContactForm();
    }
    //TODO
    App.handleAnimations();
});

(function scopeWrapper($) {
    /**
     * En language menu
     *
     * @type {string}
     */
    App.langMenuEn = '<a href="javascript:void(0)" data-lang="en" class="js-langanchor" id="anchoren">\n' +
        '                                <li><img src="img/nav/en.png" height="13" width="18"></li>\n' +
        '                            </a>\n' +
        '                            <a href="javascript:void(0)" data-lang="gr" class="js-langanchor" id="anchorgr">\n' +
        '                                <li><img src="img/nav/gr.jpg" height="13" width="18"></li>\n' +
        '                            </a>';

    /**
     * Gr language menu
     *
     * @type {string}
     */
    App.langMenuGr = ' <a href="javascript:void(0)" data-lang="gr" class="js-langanchor" id="anchorgr">\n' +
        '                                <li><img src="img/nav/gr.jpg" height="13" width="18"></li>\n' +
        '                            </a>\n' +
        '                            <a href="javascript:void(0)" data-lang="en" class="js-langanchor" id="anchoren">\n' +
        '                                <li><img src="img/nav/en.png" height="13" width="18"></li>\n' +
        '                            </a>';

    /**
     * En weather widget
     *
     * @type {string}
     */
    App.weatherWidgetEn = '<div id="c_228566d27061cf3918f08479a88a7daa" class="completo"><h2\n' +
        'style="color: #999999; margin: 0 0 3px; padding: 2px; font: bold 13px/1.2 Arial; text-align: center; width=100%">\n' +
        '<a href="https://www.okairos.gr/%CF%83%CF%8D%CE%B2%CE%BF%CF%84%CE%B1.html"\n' +
        'style="color: #999999; text-decoration: none; font: bold 13px/1.2 Arial;">Sivota Weather</a></h2>\n' +
        '<div id="w_228566d27061cf3918f08479a88a7daa" class="completo" style="height:100%"></div>\n' +
        '</div>\n' +
        '<script type="text/javascript" src="http://www.okairos.gr/widget/loader/228566d27061cf3918f08479a88a7daa"></script>';

    /**
     * Gr weather widget
     *
     * @type {string}
     */
    App.weatherWidgetGr = '<div id="c_f21dc8791fa9a5d228373b93621a21e1" class="completo"><h2\n' +
        'style="color: #999999; margin: 0 0 3px; padding: 2px; font: bold 13px/1.2 Arial; text-align: center; width:100%">\n' +
        '<a href="https://www.okairos.gr/%CF%83%CF%8D%CE%B2%CE%BF%CF%84%CE%B1.html"\n' +
        'style="color: #999999; text-decoration: none; font: bold 13px/1.2 Arial;">Σύβοτα Καιρός</a></h2>\n' +
        '<div id="w_f21dc8791fa9a5d228373b93621a21e1" class="completo" style="height:100%"></div>\n' +
        '</div>\n' +
        '<script type="text/javascript" src="http://www.okairos.gr/widget/loader/f21dc8791fa9a5d228373b93621a21e1"></script>';

    /**
     * Handles page translation
     *
     * @param page
     */
    App.translate = page => {
        //lang items
        $('.lang').each(function () {
            // navbar
            $(this).html(App.langData['languages'][lang]['pages'][page]['navbar'][$(this).data('key')]);
            // if in kimon.html or irida.html translate facilities
            (page === 'irida' || page === 'kimon') ? $(this).html(App.langData['languages'][lang]['pages'][page]['facilities'][$(this).data('key')]) : '';
            //rest of the page
            $(this).html(App.langData['languages'][lang]['pages'][page][$(this).data('key')]);
        });
        // gallery images description
        $('a.js-descdata').each(function () {
            $(this).attr('data-caption', App.langData['languages'][lang]['pages'][page]
                ['galleryDescriptions'][$(this).parents('.location').find('h4').data('key')]);
        });
    };


    /**
     * Populate map div with osm map
     *
     */
    App.initializeMap = () => {
        // Create Leaflet map on map element.
        let map = L.map(document.getElementById('osm-map'));

        // Add OSM tile leayer to the Leaflet map.
        L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        // Target's GPS coordinates.
        let kimonPin = L.latLng('39.410685', '20.239593');
        let iridaPin = L.latLng('39.408755', '20.240425');

        switch (page) {
            case  'kimon' :
                // Set map's center to target with zoom 14.
                map.setView(kimonPin, 15);
                // Place a marker on the same location.
                L.marker(kimonPin).addTo(map);
                break;
            case 'irida' :
                // Set map's center to target with zoom 14.
                map.setView(iridaPin, 15);
                // Place a marker on the same location.
                L.marker(iridaPin).addTo(map);
                break;
            default :
                // Set map's center to target with zoom 14.
                map.setView(kimonPin, 15);
                map.setView(iridaPin, 15);
                // Place a marker on the same location.
                L.marker(kimonPin).addTo(map);
                L.marker(iridaPin).addTo(map);
                break;
        }
    };

    /**
     * Configure language dropdown
     *
     * @param lang
     */
    App.configureLangMenu = lang => {
        let langMenu = $('#js-langmenu');
        lang === 'en' ? langMenu.html(App.langMenuEn) : langMenu.html(App.langMenuGr);
    };

    /**
     * Decide which weather widget to show(gr|en)
     *
     * @param lang
     */
    App.configureWeatherWidget = lang => {
        let weatherWidget = $('#weather-widget');
        lang === 'en' ? weatherWidget.html(App.weatherWidgetEn) : weatherWidget.html(App.weatherWidgetGr);
    };


    /**
     * Initialize photo gallery
     *
     */
    App.galleryInit = () => {
        // Init empty gallery array
        let container = [];
        // Loop over gallery items and push it to the array
        $('#gallery').find('figure').each(function () {

            let $link = $(this).find('a'),
                item = {
                    src: $link.attr('href'),
                    w: $link.data('width'),
                    h: $link.data('height'),
                    title: $link.data('caption')
                };
            container.push(item);
        });

        // Define click event on gallery item
        $('.gallery').on('click', 'a', function (event) {
            // Prevent location change
            event.preventDefault();

            // Define object and gallery options
            let $pswp = $('.pswp')[0],
                options = {
                    index: $(this).parent('figure').index(),
                    bgOpacity: 0.85,
                    showHideOpacity: true
                };

            // Initialize PhotoSwipe
            let gallery = new PhotoSwipe($pswp, PhotoSwipeUI_Default, container, options);
            gallery.init();
        });
    };


    /**
     * Handles scroll to top button
     *
     */
    App.handleScrollToTop = () => {
        $('.scroll-top').hide();
        // Check to see if the window is top if not then display button
        $(window).scroll(function () {

            if ($(this).scrollTop() > 500) {
                $('.scroll-top').fadeIn();
            } else {
                $('.scroll-top').fadeOut();
            }
        });
    };

    /**
     * TODO are we doing it???
     */
    App.handleAnimations = () => {
        // animated fadeInLeft,animated fadeIn,animated fadeInRight
        $(window).scroll(function () {

            if ($(this).scrollTop() > 600) {
                $('.leftanimation').addClass('animated fadeInLeft');
                $('.rightanimation').addClass('animated fadeInRight');
                $('.inanimation').addClass('animated fadeIn');
            }
        });
    };

    /**
     * Flushes success/error messages
     *
     * @param message
     */
    App.flushMessage = message => {
        $('#' + message).fadeIn();

        setTimeout(function () {
            $('#' + message).fadeOut("slow");
        }, 1500);
    };


    /**
     * Resets contact form
     *
     */
    App.resetContactForm = () => {
        $("form#contact-form")[0].reset();
    };

    /**
     * Hides loader
     *
     */
    App.hideLoader = () => {
        $('#generic-loader').hide();
    };

    /**
     * Shows loader
     *
     */
    App.showLoader = () => {
        $('#generic-loader').show();
    };


    /**
     * Validates reCaptcha check
     *
     * @param e
     * @returns {boolean}
     */
    App.checkRecaptcha = e => {
        // get captcha response
        let captchaResponse = grecaptcha.getResponse();
        let result = false;
        // validate response
        if (captchaResponse.length === 0) {
            e.preventDefault();
            App.flushMessage('recaptcha_message');
            return false;
        }
        // wait for apis response to proceed
        return $.when(App.verifyCaptcha(captchaResponse));
    };

    /**
     * Ajax call to api gateway captcha verify endpoint
     *
     * @param captchaResponse
     * @return boolean
     */
    App.verifyCaptcha = captchaResponse => {
        // verify captcha endpoint
        let apiRecaptchaEndPoint = App.apiEndPoints.recaptcha;

        let verifyData = {
            captchaResponse: captchaResponse,
        };
        // verify captcha
        $.post(apiRecaptchaEndPoint, JSON.stringify(verifyData)).done(function (data) {
            console.log(data.statusCode);
            console.log(data.body);
            //TODO HANDLE BOT;
            return true;
        }).fail(function (data) {

            return false;
        });
    };

    /**
     * Ajax call to api gateway contact endpoint
     *
     * @param e
     */
    App.submitToAPI = e => {
        if ($("form#contact-form").valid()) {
            e.preventDefault();
            if (!App.checkRecaptcha(e)) {

                return;
            }
            App.showLoader();
            // get api contact endpoint
            let apiContactEndPoint = App.apiEndPoints.contact;
            let contact_name = $("#contact_name").val();
            let contact_email = $("#contact_email").val();
            let contact_subject = $("#contact_subject").val();
            let contact_message = $("#contact_message").val();
            let emailData = {
                name: contact_name,
                email: contact_email,
                subject: contact_subject,
                message: contact_message
            };
            // send the email
            $.post(apiContactEndPoint, JSON.stringify(emailData)).done(function (data) {

                App.hideLoader();
                // clear form and show a success message
                App.resetContactForm();
                App.flushMessage('success_message');
                // reset captcha
                grecaptcha.reset()
            }).fail(function (data) {
                App.hideLoader();
                App.flushMessage('error_message')
            });
        }
    };


    /**
     * Contact form field validation
     *
     */
    App.validateContactForm = () => {
        $("form#contact-form").validate({
            rules: {
                contact_name: {
                    required: true,
                    minlength: 3
                },
                contact_email: {
                    required: true,
                    email: true
                },
                contact_subject: {
                    required: true,
                    minlength: 5
                },
                contact_message: {
                    required: true,
                    minlength: 10
                },
            },
            messages: {
                contact_name: {
                    required: App.langData['languages'][lang]['pages']['contact']['form']['errorMessages']['required'],
                    minlength: App.langData['languages'][lang]['pages']['contact']['form']['errorMessages']['minlength3'],
                },
                contact_email: {
                    required: App.langData['languages'][lang]['pages']['contact']['form']['errorMessages']['required'],
                    email: App.langData['languages'][lang]['pages']['contact']['form']['errorMessages']['validEmail'],
                },
                contact_subject: {
                    required: App.langData['languages'][lang]['pages']['contact']['form']['errorMessages']['required'],
                    minlength: App.langData['languages'][lang]['pages']['contact']['form']['errorMessages']['minlength5'],
                },
                contact_message: {
                    required: App.langData['languages'][lang]['pages']['contact']['form']['errorMessages']['required'],
                    minlength: App.langData['languages'][lang]['pages']['contact']['form']['errorMessages']['minlength10'],
                },
            }
        });
    };
}(jQuery));

/**
 * Language menu on click function
 *
 */
$("#js-langmenu").on('click', '.js-langanchor', function () {
    // get selected lang
    lang = $(this).data('lang');
    // store selected lang
    localStorage.setItem('lang', lang);
    //reload
    location.reload();
});

/**
 * Toggled navbar Language menu on click function
 *
 */
$("#toggle-js-langmenu").on('click', '.js-langanchor', function () {
    // get selected lang
    lang = $(this).data('lang');
    // store selected lang
    localStorage.setItem('lang', lang);
    // reload
    location.reload();
});

/**
 * Scroll to top button
 *
 */
$("a.scroll-top").on('click', e => {
    e.preventDefault();
    $('html,body').animate({scrollTop: 0}, 350);
    return false;
});
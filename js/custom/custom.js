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
 * En language menu
 *
 * @type {string}
 */
let langMenuEn = '<a href="javascript:void(0)" data-lang="en" class="js-langanchor" id="anchoren">\n' +
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
let langMenuGr = ' <a href="javascript:void(0)" data-lang="gr" class="js-langanchor" id="anchorgr">\n' +
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
let weatherWidgetEn = '<div id="c_228566d27061cf3918f08479a88a7daa" class="completo"><h2\n' +
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
let weatherWidgetGr = '<div id="c_f21dc8791fa9a5d228373b93621a21e1" class="completo"><h2\n' +
    'style="color: #999999; margin: 0 0 3px; padding: 2px; font: bold 13px/1.2 Arial; text-align: center; width:100%">\n' +
    '<a href="https://www.okairos.gr/%CF%83%CF%8D%CE%B2%CE%BF%CF%84%CE%B1.html"\n' +
    'style="color: #999999; text-decoration: none; font: bold 13px/1.2 Arial;">Σύβοτα Καιρός</a></h2>\n' +
    '<div id="w_f21dc8791fa9a5d228373b93621a21e1" class="completo" style="height:100%"></div>\n' +
    '</div>\n' +
    '<script type="text/javascript" src="http://www.okairos.gr/widget/loader/f21dc8791fa9a5d228373b93621a21e1"></script>';


/**
 * On page load
 *
 */
$(function ($) {
    // scroll to top button
    handleScrollToTop();
    // get lang if exists
    lang = localStorage.getItem('lang') || 'en';
    // get current page
    page = $('#whichPage').val();
    // configure language menu
    configureLangMenu(lang);
    // decide which weather widget to show(en|gr)
    configureWeatherWidget(lang)
    // translate current page
    translate(page);
    // map
    initializeMap();
    // initialize photo galley
    galleryInit();
});

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
 * Language menu on click function
 *
 */
$("#toggle-js-langmenu").on('click', '.js-langanchor', function () {
    // get selected lang
    lang = $(this).data('lang');
    // store selected lang
    localStorage.setItem('lang', lang);
    //reload
    location.reload();
});


/**
 * Populate map div with osm map
 *
 */
function initializeMap() {
    // Create Leaflet map on map element.
    let map = L.map(document.getElementById('osm-map'));

    // Add OSM tile leayer to the Leaflet map.
    L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Target's GPS coordinates.
    let kimonPin = L.latLng('39.410562', '20.239852');

    let iridaPin = L.latLng('39.409889', '20.240984');

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
}

/**
 * Configure language dropdown
 *
 * @param lang
 */
function configureLangMenu(lang) {
    let langMenu = $('#js-langmenu');
    lang === 'en' ? langMenu.html(langMenuEn) : langMenu.html(langMenuGr);
}

/**
 * Decide which weather widget to show(gr|en)
 *
 * @param lang
 */
function configureWeatherWidget(lang) {
    lang === 'en' ? $('#weather-widget').html(weatherWidgetEn) : $('#weather-widget').html(weatherWidgetGr);
}

/**
 * Handles page translation
 *
 * @param page
 */
function translate(page) {
    //lang items
    $('.lang').each(function () {
        //navbar
        $(this).html(langData['languages'][lang]['pages'][page]['navbar'][$(this).data('key')]);
        //rest of the page
        $(this).html(langData['languages'][lang]['pages'][page][$(this).data('key')]);
    });
    //gallery images description
    $('a.js-descdata').each(function () {
        $(this).attr('data-caption', langData['languages'][lang]['pages'][page]
            ['galleryDescriptions'][$(this).parents('.location').find('h4').data('key')]);
    });
}

/**
 * Initialize photo gallery
 *
 */
function galleryInit() {
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
}

/**
 * Scroll to top button
 *
 */
$("a.scroll-top").on('click', function (e) {
    // e.preventDefault();
    $('html,body').animate({scrollTop: 0}, 350);
    return false;
});

/**
 * Handles scroll to top button
 */
function handleScrollToTop() {
    $('.scroll-top').hide();
    // Check to see if the window is top if not then display button
    $(window).scroll(function () {
        if ($(this).scrollTop() > 500) {
            $('.scroll-top').fadeIn();
        } else {
            $('.scroll-top').fadeOut();
        }
    });
}


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
 * Language menu
 *
 * @type {string}
 */
let langMenuEn = '<a href="javascript:void(0)" data-lang="en" class="js-langanchor" id="anchoren">\n' +
    '                                <li><img src="img/nav/f1ky10.jpg.gif" height="13" width="18"></li>\n' +
    '                            </a>\n' +
    '                            <a href="javascript:void(0)" data-lang="gr" class="js-langanchor" id="anchorgr">\n' +
    '                                <li><img src="img/nav/2r7t05j.jpg" height="13" width="18"></li>\n' +
    '                            </a>';
/**
 * Language menu
 *
 * @type {string}
 */
let langMenuGr = ' <a href="javascript:void(0)" data-lang="gr" class="js-langanchor" id="anchorgr">\n' +
    '                                <li><img src="img/nav/2r7t05j.jpg" height="13" width="18"></li>\n' +
    '                            </a>\n' +
    '                            <a href="javascript:void(0)" data-lang="en" class="js-langanchor" id="anchoren">\n' +
    '                                <li><img src="img/nav/f1ky10.jpg.gif" height="13" width="18"></li>\n' +
    '                            </a>';

/**
 * On page load
 *
 */
$(function ($) {
    //getCurrentWeather();
    handleScrollToTop();
    // get lang if exists
    lang = localStorage.getItem('lang') || 'en';
    // get current page
    page = $('#whichPage').val();
    // configure language menu
    configureLangMenu(lang);
    // translate current page
    translate(page);
    //if error everything from here breaks
    initializeMap();
    // initialize photo galley
    galleryInit();
});

/**
 * Language menu on click function
 *
 */
$("#js-langmenu").on('click', '.js-langanchor', function () {
    // noinspection JSUnresolvedFunction
    //get selected lang
    lang = $(this).data('lang');
    //store selected lang
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
 * Handles page translation
 *
 * @param page
 */
function translate(page) {
    //lang items
    $('.lang').each(function () {
        //navbar
        $(this).text(langData['languages'][lang]['pages'][page]['navbar'][$(this).data('key')]);
        //rest of the page
        $(this).text(langData['languages'][lang]['pages'][page][$(this).data('key')]);
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

//scroll to top
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

function getCurrentWeather() {
    var proxy = 'https://cors-anywhere.herokuapp.com/';
    var apiLInk = 'https://www.metaweather.com/api/location/946738/';
// send the ajax request
    $.ajax({
        type: "GET",
        url: proxy + apiLInk,
        success: function (data) {
            console.log(data)
        },
        error: function (data) {
            console.log(data)
        }
    })
}


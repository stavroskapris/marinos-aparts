/**
 * Holds selected language
 *
 */
let lang;

/**
 * Holds current page
 */
let page;

/**
 *Language menu
 *
 * @type {string}
 */
let langMenuEn = '<a href="javascript:void(0)" data-lang="en" class="js-langanchor" id="anchoren">\n' +
    '                                <li><img src="img/f1ky10.jpg.gif" height="13" width="18"></li>\n' +
    '                            </a>\n' +
    '                            <a href="javascript:void(0)" data-lang="gr" class="js-langanchor" id="anchorgr">\n' +
    '                                <li><img src="img/2r7t05j.jpg" height="13" width="18"></li>\n' +
    '                            </a>';
/**
 *Language menu
 *
 * @type {string}
 */
let langMenuGr = ' <a href="javascript:void(0)" data-lang="gr" class="js-langanchor" id="anchorgr">\n' +
    '                                <li><img src="img/2r7t05j.jpg" height="13" width="18"></li>\n' +
    '                            </a>\n' +
    '                            <a href="javascript:void(0)" data-lang="en" class="js-langanchor" id="anchoren">\n' +
    '                                <li><img src="img/f1ky10.jpg.gif" height="13" width="18"></li>\n' +
    '                            </a>';
/**
 * On page load
 */
$(function ($) {
    //get lang if exists
    lang = localStorage.getItem('lang') || 'en';
    //get current page
    page = $('#whichPage').val();
    //configure language menu
    configureLangMenu(lang);
    //translate current page
    translate(page);
    //initialize map if in contact page
    page === 'contact' ? initializeMap() : '';
    //$("#mdb-lightbox-ui").load("mdb-addons/mdb-lightbox-ui.html");
});

/**
 *Language menu on click function
 */
$("#js-langmenu").on('click', '.js-langanchor', function () {
    // noinspection JSUnresolvedFunction
    //get selected lang
    lang = $(this).data('lang');
    //store selected lang
    localStorage.setItem('lang', lang);
    //configure lang menu
    configureLangMenu(lang);
    // noinspection JSUnresolvedFunction
    //replace with appropriate lang items
    translate(page);
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
    let target1 = L.latLng('39.410562', '20.239852');
    let target2 = L.latLng('39.409889', '20.240984');
// Set map's center to target with zoom 14.
    map.setView(target1, 15);
    map.setView(target2, 15);

// Place a marker on the same location.
    L.marker(target1).addTo(map);
    L.marker(target2).addTo(map);
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
 *
 * @param page
 */
function translate(page) {
    $('.lang').each(function () {
        //navbar
        $(this).text(langData['languages'][lang]['pages'][page]['navbar'][$(this).data('key')]);
        //rest of the page
        $(this).text(langData['languages'][lang]['pages'][page][$(this).data('key')])
    });
}


/* global jQuery, PhotoSwipe, PhotoSwipeUI_Default, console */

function galleryInit() {

    // Init empty gallery array
    var container = [];

    // Loop over gallery items and push it to the array
    $('#gallery').find('figure').each(function () {
        var $link = $(this).find('a'),
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
        var $pswp = $('.pswp')[0],
            options = {
                index: $(this).parent('figure').index(),
                bgOpacity: 0.85,
                showHideOpacity: true
            };

        // Initialize PhotoSwipe
        var gallery = new PhotoSwipe($pswp, PhotoSwipeUI_Default, container, options);
        gallery.init();
    });

}
//var to hold selected language
let lang;
// noinspection JSUnresolvedFunction
$(function ($) {
    lang = localStorage.getItem('lang') || 'en';
    if (lang == null) {
        lang = $('#langSelect').val();
        console.log(lang + ' mesa');
    } else {
        $('#langSelect').val(lang);
    }

    $('.lang').each(function () {
        $(this).text(langData['languages'][lang]['keys'][$(this).data('key')])
    });
    //initialize map
    initializeMap();
});

/**
 *
 */
// noinspection JSUnresolvedFunction
$('a.js-langanchor').on('click', function () {
    // location.reload();
    // noinspection JSUnresolvedFunction
    lang = $(this).data('lang');
    localStorage.setItem('lang', lang);
    console.log(lang);
    // noinspection JSUnresolvedFunction
    $('.lang').each(function () {
        // noinspection JSUnresolvedFunction
        $(this).text(langData['languages'][lang]['keys'][$(this).data('key')])
    });

});

let langData = {
    'languages': {
        'en': {
            'keys': {
                'home': 'Home',
                'kimon': 'Kimon Resort',
                'irida': 'Irida Resort',
                'contact': 'Contact',
                'welcome': 'Welcome to Marinos-aparts Rooms in Sivota, where your satisfaction is our top priority.'
            }
        }
        , 'gr': {
            'keys': {
                'home': 'Αρχική',
                'kimon': 'Kimon Resort',
                'irida': 'Irida Resort',
                'contact': 'Επικοικωνία',
                'welcome': 'Καλωσορίσατε στα ενοικιαζόμενα δωμάτια Marinos apartments, στα Σύβοτα, όπου η απόλυτη ικανοποίηση σας είναι προτεραιότητα μας.'
            }
        }
    }
};

/**
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
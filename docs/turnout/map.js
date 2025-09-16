document.addEventListener('DOMContentLoaded', function () {
    // Initialize the Pym.js child
    var pymChild = new pym.Child();

    // Define access token
    mapboxgl.accessToken = "pk.eyJ1IjoibWxub3ciLCJhIjoiY21mZDE2anltMDRkbDJtcHM1Y2M0eTFjNCJ9.nmMGLA-zX7BqznSJ2po65g";

    // Define basemap parameters
    // const mapZoom = window.innerWidth < 400 ? 10.4 : 12.5;
    // const mapY = window.innerWidth < 400 ? 37.750 : 37.750;

    var map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mlnow/cm2tndow500co01pw3fho5d21',
        zoom: 12.5,
        center: [-122.496, 37.750], // Updated default center
    });


    let currentPopup; // Variable to hold the current popup reference

    map.on('load', () => {
        // Add GeoJSON data source
        map.addSource('precincts', {
            'type': 'geojson',
            'data': 'turnout.geojson' // Static data file
        });
        map.addLayer({
            'id': 'precincts-layer',
            'type': 'fill',
            'source': 'precincts',
            'paint': {
                'fill-color': [
                    'match',
                    ['get', 'yes_perc'],
                    // Low turnout
                    'Less than 25%', '#9DF4D9',
                    '25-30%', '#65EAD0',
                    '30-35%', '#0DD6C7',
                    '35-40%', '#0DC1D3',
                    '40-45%', '#00A4BF',
                    '45-50%', '#007DBC',
                    // Higher turnout
                    '50-55%', '#005A8C',
                    '55-60%', '#003F5C',
                    '60-65%', '#00233B',
                    '65-70%', '#001F2A',
                    '70-75%', '#001622',
                    '75% and more', '#000F19',
                    '#CECECE' // Default color for any values not covered
                ],
                'fill-opacity': 0.8
            }
        });
        
        // Add a base outline for the precincts
        map.addLayer({
            'id': 'precincts-outline',
            'type': 'line',
            'source': 'precincts',
            'paint': {
                'line-color': '#ffffff',
                'line-width': 0.5
            }
        });

        // Add hover outline layer for highlighted polygons
        map.addLayer({
            'id': 'precincts-hover-outline',
            'type': 'line',
            'source': 'precincts',
            'paint': {
                'line-color': '#ffffff',
                'line-width': 2.5,
            },
            'filter': ['==', ['get', 'precinct'], ''] // Initially hidden
        });

        // Add hover event listeners
        map.on('mousemove', 'precincts-layer', (e) => {
            if (e.features.length > 0) {
                map.getCanvas().style.cursor = 'pointer';
                const featurePrecinct = e.features[0].properties.precinct;
                map.setFilter('precincts-hover-outline', ['==', ['get', 'precinct'], featurePrecinct]);
            }
        });

        map.on('mouseleave', 'precincts-layer', () => {
            map.getCanvas().style.cursor = '';
            map.setFilter('precincts-hover-outline', ['==', ['get', 'precinct'], '']);
        });

        // Once the charts are drawn, call pymChild.sendHeight() to resize the iframe
        pymChild.sendHeight();
    });

    map.on('click', 'precincts-layer', function (e) {
        if (e.features.length > 0) {
            const properties = e.features[0].properties;
            const yesPerc = properties.yes_perc ? Number(properties.yes_perc) : 0;
            const noPerc = 100 - yesPerc;

            const content = `
                <div style="background-color: white; padding: 5px; border-radius: 2.5px; font-size: 12px; line-height: 1.2;">
                    <h3 class="popup-header" style="margin: 2px 0; font-size: 16px;">Precinct ${properties.precinct || 'N/A'}</h3>
        <hr>
                    <p class="popup-text" style="margin: 2px 0;">${properties.registered_voters} voters<br>${properties.turnout || 'N/A'}% turnout</p>
                </div>
            `;

            if (currentPopup) currentPopup.remove();

            currentPopup = new mapboxgl.Popup()
                .setLngLat(e.lngLat)
                .setHTML(content)
                .addTo(map);
        }
    });

    map.on('load', function () {
        map.moveLayer('road-label-navigation');
        map.moveLayer('settlement-subdivision-label');
    });
});


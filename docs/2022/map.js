document.addEventListener('DOMContentLoaded', function () {
    // Initialize the Pym.js child
    var pymChild = new pym.Child();
    mapboxgl.accessToken = "pk.eyJ1IjoibWxub3ciLCJhIjoiY21kODJzdWZnMHFqMzJtb2tqc20wOXY2NyJ9.oeZTOKB57oX-95RuV-bkaQ";

    // Initialize the map centered on District 4
    var map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mlnow/cm2tndow500co01pw3fho5d21',
        zoom: 12.5,
        center: [-122.496, 37.750], // Updated default center
        minZoom: 10.4
    });


    let currentPopup;

    map.on('load', () => {
        // Load District 4 precinct data
        map.addSource('precincts', {
            'type': 'geojson',
            'data': "d4.geojson"
        });

        // Fill layer by winner (Engardio = blue, Mar = green)
        map.addLayer({
            'id': 'precincts-layer',
            'type': 'fill',
            'source': 'precincts',
            'paint': {
                'fill-color': [
                    'match',
                    ['get', 'winner'],
                    'joel_engardio', '#57a4ea',
                    'gordon_mar', '#46c134',
                    '#CECECE' // default gray if no match
                ],
                'fill-opacity': 0.6
            }
        });

        // Precinct outlines
        map.addLayer({
            'id': 'precincts-outline',
            'type': 'line',
            'source': 'precincts',
            'paint': {
                'line-color': '#ffffff',
                'line-width': 0.5
            }
        });

        // Hover outline
        map.addLayer({
            'id': 'precincts-hover-outline',
            'type': 'line',
            'source': 'precincts',
            'paint': {
                'line-color': '#ffffff',
                'line-width': 2.5
            },
            'filter': ['==', ['get', 'precinct'], '']
        });

        // Hover effect
        map.on('mousemove', 'precincts-layer', (e) => {
            if (e.features.length > 0) {
                const featurePrecinct = e.features[0].properties.precinct;
                map.setFilter('precincts-hover-outline', ['==', ['get', 'precinct'], featurePrecinct]);
                map.getCanvas().style.cursor = 'pointer';
            }
        });

        map.on('mouseleave', 'precincts-layer', () => {
            map.setFilter('precincts-hover-outline', ['==', ['get', 'precinct'], '']);
            map.getCanvas().style.cursor = '';
        });

        // Popup click
        map.on('click', 'precincts-layer', function (e) {
            if (e.features.length > 0) {
                const properties = e.features[0].properties;

                const candidates = [
                    {
                        name: "Joel Engardio",
                        percent: properties['joel_engardio_p'],
                        votes: properties['joel_engardio'],
                        key: 'joel_engardio'
                    },
                    {
                        name: "Gordon Mar",
                        percent: properties['gordon_mar_p'],
                        votes: properties['gordon_mar'],
                        key: 'gordon_mar'
                    }
                ];

                // Determine winner
                const winner = candidates.reduce((max, c) => c.votes > max.votes ? c : max, candidates[0]);

                let content = `
                    <div style="background-color: white; padding: 5px; border-radius: 3px; font-size: 12px; line-height: 1.2;">
                        <h3 style="margin: 2px 0; font-size: 16px;">Precinct ${properties.precinct || 'N/A'}</h3>
                        <hr style="margin: 5px 0;">
                `;

                candidates.forEach(c => {
                    content += `
                        <p style="margin: 2px 0;">
                            ${winner.key === c.key ? `<strong>${c.name}</strong>` : c.name}:
                            ${winner.key === c.key ? `<strong>${c.percent}%</strong>` : c.percent + '%'}
                            (${winner.key === c.key ? `<strong>${c.votes}</strong>` : c.votes})
                        </p>
                    `;
                });

                content += `</div>`;

                if (currentPopup) currentPopup.remove();

                currentPopup = new mapboxgl.Popup()
                    .setLngLat(e.lngLat)
                    .setHTML(content)
                    .addTo(map);
            }
        });

        // Resize responsiveness
        window.addEventListener('resize', () => map.resize());
        pymChild.sendHeight();
    });
});

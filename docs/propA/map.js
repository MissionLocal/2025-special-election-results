document.addEventListener('DOMContentLoaded', function () {
  // Initialize the Pym.js child
  var pymChild = new pym.Child();
  // define access token
  mapboxgl.accessToken = "pk.eyJ1IjoibWxub3ciLCJhIjoiY21mZDE2anltMDRkbDJtcHM1Y2M0eTFjNCJ9.nmMGLA-zX7BqznSJ2po65g";

  // define basemap
  // if (window.innerWidth < 400) {
  //     var mapZoom = 10.4;
  //     var mapY = 37.750;
  // } else {
  //     var mapZoom = 12.5;
  //     var mapY = 37.750;
  // }

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
          'data': 'propA.geojson' // Replace with your data file or object
      });

      // Add a layer to style precinct polygons based on yes_perc_bin
      map.addLayer({
          'id': 'precincts-layer',
          'type': 'fill',
          'source': 'precincts',
          'paint': {
              'fill-color': [
                  'match',
                  ['get', 'yes_perc_bin'],
                  'Less than 25%', '#990000',
                  '25-30%', '#E02214',
                  '30-35%', '#E54C4C',
                  '35-40%', '#EE7651',
                  '40-45%', '#EF9F6A',
                  '45-50%', '#FFCB78',
                  '50-55%', '#9DF4D9',
                  '55-60%', '#65EAD0',
                  '60-65%', '#0DD6C7',
                  '65-70%', '#0DC1D3',
                  '70-75%', '#00A4BF',
                  '75% and more', '#007DBC',
                  /* default color if none of the above match */
                  '#CECECE'
              ],
              'fill-opacity': 0.6
          }
      });

      document.getElementById('propositionDropdown').addEventListener('change', (event) => {
          const selectedProp = event.target.value.charAt(0); // Get the first letter of the selected value
          const dataUrl = `data/${selectedProp}.geojson`; // Update with the correct path to your GeoJSON files
      
          // Close the current popup if it exists
          if (currentPopup) {
              currentPopup.remove();
              currentPopup = null; // Reset the popup reference
          }
      
          // Update the precincts source data to the new file based on the selected proposition
          map.getSource('precincts').setData(dataUrl);
      
          // // Hide all legends first
          // const legends = document.querySelectorAll('.legend');
          // legends.forEach(legend => {
          //     legend.style.display = 'none';
          // });
      
          // // Show the selected legend
          // const selectedLegend = document.getElementById(`legend-${selectedProp}`);
          // if (selectedLegend) {
          //     selectedLegend.style.display = 'block'; // Show the selected legend
          // }
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
              'line-color': '#ffffff', // Highlight color
              'line-width': 2.5, // Increased line width for hover
          },
          'filter': ['==', ['get', 'precinct'], ''] // Initially hidden
      });

      // Add hover event listeners
      map.on('mousemove', 'precincts-layer', (e) => {
          if (e.features.length > 0) {
              map.getCanvas().style.cursor = 'pointer';

              // Obtain the feature's precinct property
              const featurePrecinct = e.features[0].properties.precinct;

              // Update the filter in the hover-outline layer to highlight the precinct
              map.setFilter('precincts-hover-outline', ['==', ['get', 'precinct'], featurePrecinct]);
          }
      });

      map.on('mouseleave', 'precincts-layer', () => {
          map.getCanvas().style.cursor = '';
          // Reset the hover filter to hide the outline
          map.setFilter('precincts-hover-outline', ['==', ['get', 'precinct'], '']);
      });




      // Once the charts are drawn, call pymChild.sendHeight() to resize the iframe
      pymChild.sendHeight();
  });


  map.on('click', 'precincts-layer', function (e) {
      if (e.features.length > 0) {
          const properties = e.features[0].properties;
          const yesPerc = properties.yes_perc !== undefined && properties.yes_perc !== null ? Number(properties.yes_perc) : 0;
          const noPerc = 100 - yesPerc; // Calculate No percentage

          // Define styles for the bars
          const barWidth = 200; // Adjust as needed
          const yesWidth = (yesPerc / 100) * barWidth;
          const noWidth = (noPerc / 100) * barWidth;

          const content = `
              <div style="background-color: white; padding: 5px; border-radius: 2.5px; font-size: 12px; line-height: 1.2;">
                  <h3 class="popup-header" style="margin: 2px 0; font-size: 16px;">Precinct ${properties.precinct || 'N/A'}</h3>
                  <p class="popup-text" style="margin: 2px 0;">${properties.registered_voters} voters, ${properties.turnout || 'N/A'}% turnout</p>
                  <hr style="margin: 5px 0;">
                  <div style="display: flex; flex-direction: column; row-gap: 5px;">
                      <div>
                          <p class="popup-text" style="margin: 2px 0;"><strong>YES</strong></p>
                          <div style="position: relative; width: ${barWidth}px; height: 15px; background-color: #ffffff;">
                              <div style="position: absolute; left: 0; width: ${yesWidth}px; height: 100%; background-color: #8AD6CE; opacity: 0.6;"></div>
                              <p class="popup-text" style="position: absolute; left: 0; width: ${barWidth}px; text-align: left; margin: 0; line-height: 15px;">${yesPerc.toFixed(2)}% (${properties.yes || 'N/A'})</p>
                          </div>
                      </div>
                      <div>
                          <p class="popup-text" style="margin: 2px 0;"><strong>NO</strong></p>
                          <div style="position: relative; width: ${barWidth}px; height: 15px; background-color: #ffffff;">
                              <div style="position: absolute; left: 0; width: ${noWidth}px; height: 100%; background-color: #F36E57; opacity: 0.6;"></div>
                              <p class="popup-text" style="position: absolute; left: 0; width: ${barWidth}px; text-align: left; margin: 0; line-height: 15px;">${noPerc.toFixed(2)}% (${properties.no || 'N/A'})</p>
                          </div>
                      </div>
                  </div>
              </div>
          `;

          // Close the current popup if it exists
          if (currentPopup) {
              currentPopup.remove();
          }

          // Create and add the new popup
          currentPopup = new mapboxgl.Popup()
              .setLngLat(e.lngLat)
              .setHTML(content)
              .addTo(map);
      } else {
          console.warn("No features found at clicked location.");
      }
  });

  map.on('load', function () {
      // Move the 'settlement-subdivision-label' layer to the front
      map.moveLayer('road-label-navigation');
      map.moveLayer('settlement-subdivision-label');
  });
});
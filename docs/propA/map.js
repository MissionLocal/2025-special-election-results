document.addEventListener('DOMContentLoaded', async () => {
    const pymChild = new pym.Child();
    mapboxgl.accessToken = "pk.eyJ1IjoibWxub3ciLCJhIjoiY21mZDE2anltMDRkbDJtcHM1Y2M0eTFjNCJ9.nmMGLA-zX7BqznSJ2po65g";

    // DOM
    const infoBox = document.getElementById('info-box');
    const legendEl = document.getElementById('legend');

    // Map
    const map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mlnow/cm2tndow500co01pw3fho5d21',
        center: [-122.496, 37.750],
        zoom: 12.5
    });

    // Helpers
    const key = v => (v == null ? '' : String(v).trim());
    const getPrecinct = o => key(o?.precinct ?? o?.Precinct ?? o?.PCT ?? o?.pct);
    const fmtInt = x => Number.isFinite(Number(x)) ? Number(x).toLocaleString() : 'N/A';
    const fmtPct = x => {
        const n = Number(x);
        return Number.isFinite(n) ? n.toFixed(1) + '%' : 'N/A';
    };

    function tplInfoOneLine(p = {}) {
        const key = v => (v == null ? '' : String(v).trim());
        const fmtInt = x => Number.isFinite(Number(x)) ? Number(x).toLocaleString() : 'N/A';
        const fmtPct = x => {
            const n = Number(x);
            return Number.isFinite(n) ? n.toFixed(1) + '%' : 'N/A';
        };

        const yes = Number(p?.yes_perc);
        const yesTxt = fmtPct(yes);
        const noTxt = Number.isFinite(yes) ? fmtPct(100 - yes) : 'N/A';
        const turnoutTxt = (p?.turnout != null) ? fmtPct(p.turnout) : 'N/A';
        const votersTxt = p?.registered_voters ? `${fmtInt(p.registered_voters)} voters` : '';

        return `
    <div><strong>Precinct ${key(p?.precinct) || 'N/A'}</strong></div>
    <div>Yes: ${yesTxt} • No: ${noTxt} • Turnout: ${turnoutTxt}</div>
    ${votersTxt ? `<div style="color:#666;font-size:12px;margin-top:6px;">${votersTxt}</div>` : ''}
  `;
    }

    // Colors / paints
    const yesPercBinPaint = {
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
            '#CECECE'
        ],
        'fill-opacity': 0.6
    };

    // Legend: RGB + alpha squares (matches map look)
    const SWATCH_ALPHA = 0.6;
    const LEGEND_COLORS_RGB = [
        [153, 0, 0], [224, 34, 20], [229, 76, 76], [238, 118, 81], [239, 159, 106], [255, 203, 120],
        [157, 244, 217], [101, 234, 208], [13, 214, 199], [13, 193, 211], [0, 164, 191], [0, 125, 188]
    ];
    const legendSquaresHTML = (title, leftLabel, rightLabel) => `
      <div class="legend-title">${title}</div>
      <div class="legend-row">
        ${LEGEND_COLORS_RGB.map(([r, g, b]) =>
        `<span class="legend-swatch" style="background:rgba(${r},${g},${b},${SWATCH_ALPHA})"></span>`
    ).join('')}
      </div>
      <div class="legend-ends"><span>${leftLabel}</span><span>${rightLabel}</span></div>
    `;

    // Data index so we can fill the info box on click
    const byPrecinct = Object.create(null);
    function indexGeojson(gj) {
        for (const k in byPrecinct) delete byPrecinct[k];
        for (const f of (gj.features || [])) {
            const k = getPrecinct(f.properties || {});
            if (k) byPrecinct[k] = f.properties;
        }
    }

    // Load GeoJSON ourselves so we can index it and feed mapbox the object
    const dataUrl = 'propA.geojson';
    const gj = await fetch(dataUrl).then(r => r.json());
    indexGeojson(gj);

    map.on('load', () => {
        map.addSource('precincts', { type: 'geojson', data: gj });

        map.addLayer({ id: 'precincts-fill', type: 'fill', source: 'precincts', paint: yesPercBinPaint });
        map.addLayer({ id: 'precincts-outline', type: 'line', source: 'precincts', paint: { 'line-color': '#fff', 'line-width': 0.5 } });
        map.addLayer({ id: 'precincts-hover', type: 'line', source: 'precincts', paint: { 'line-color': '#fff', 'line-width': 2.5 }, filter: ['==', ['get', 'precinct'], ''] });

        // Hover
        map.on('mousemove', 'precincts-fill', (e) => {
            if (!e.features?.length) return;
            const k = getPrecinct(e.features[0].properties || {});
            map.setFilter('precincts-hover', ['==', ['get', 'precinct'], k]);
            map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'precincts-fill', () => {
            map.setFilter('precincts-hover', ['==', ['get', 'precinct'], '']);
            map.getCanvas().style.cursor = '';
        });

        // Click → update info-box (no Mapbox popup)
        map.on('click', 'precincts-fill', (e) => {
            if (!e.features?.length) return;
            const k = getPrecinct(e.features[0].properties || {});
            const props = byPrecinct[k] || e.features[0].properties || {};
            infoBox.innerHTML = tplInfoOneLine(props);
            // keep the thick outline on the selected precinct
            map.setFilter('precincts-hover', ['==', ['get', 'precinct'], k]);
            pymChild.sendHeight();
        });

        // Legend (overlay, left-aligned)
        legendEl.innerHTML = legendSquaresHTML('Yes vote %', 'No', 'Yes');

        // Optional: bring labels above fills if present in style
        try {
            if (map.getLayer('road-label-navigation')) map.moveLayer('road-label-navigation');
            if (map.getLayer('settlement-subdivision-label')) map.moveLayer('settlement-subdivision-label');
        } catch { }

        // Initial hint
        infoBox.innerHTML = '<div>Click a precinct.</div>';
        pymChild.sendHeight();
    });

    // If you later add a dropdown to switch datasets, do this:
    const selector = document.getElementById('propositionDropdown');
    if (selector) {
        selector.addEventListener('change', async (e) => {
            const v = e.target.value;            // e.g., "A", "K", ...
            const nextUrl = `data/${v}.geojson`; // adjust to your path
            const next = await fetch(nextUrl).then(r => r.json());
            indexGeojson(next);
            map.getSource('precincts').setData(next);
            infoBox.innerHTML = '<div>Click a precinct.</div>';
            map.setFilter('precincts-hover', ['==', ['get', 'precinct'], '']);
            legendEl.innerHTML = legendSquaresHTML('Yes vote %', 'No', 'Yes'); // same scale
            pymChild.sendHeight();
        });
    }

    // Resize
    window.addEventListener('resize', () => {
        map.resize();
        pymChild.sendHeight();
    });
});

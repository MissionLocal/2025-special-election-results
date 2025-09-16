// map.js (single-map version with show/hide info box + persistent selection)
document.addEventListener('DOMContentLoaded', async () => {
    const pymChild = new pym.Child();
    mapboxgl.accessToken = "pk.eyJ1IjoibWxub3ciLCJhIjoiY21mZDE2anltMDRkbDJtcHM1Y2M0eTFjNCJ9.nmMGLA-zX7BqznSJ2po65g";
  
    // DOM
    const infoBox  = document.getElementById('info-box');
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
    const fmtPct = x => { const n = Number(x); return Number.isFinite(n) ? n.toFixed(1) + '%' : 'N/A'; };
  
    function tplInfoOneLine(p = {}) {
      const yes = Number(p?.yes_perc);
      const yesTxt = fmtPct(yes);
      const noTxt  = Number.isFinite(yes) ? fmtPct(100 - yes) : 'N/A';
      const turnoutTxt = (p?.turnout != null) ? fmtPct(p.turnout) : 'N/A';
      return `
        <div><strong>Precinct ${key(p?.precinct) || 'N/A'}</strong></div>
        <div>Yes: ${yesTxt} • No: ${noTxt} • Turnout: ${turnoutTxt}</div>
      `;
    }
  
    // Colors / paints
    const yesPercBinPaint = {
      'fill-color': [
        'match', ['get','yes_perc_bin'],
        'Less than 25%','#990000','25-30%','#E02214','30-35%','#E54C4C','35-40%','#EE7651',
        '40-45%','#EF9F6A','45-50%','#FFCB78','50-55%','#9DF4D9','55-60%','#65EAD0',
        '60-65%','#0DD6C7','65-70%','#0DC1D3','70-75%','#00A4BF','75% and more','#007DBC',
        '#CECECE'
      ],
      'fill-opacity': 0.6
    };
  
    // Legend
    const SWATCH_ALPHA = 0.6;
    const LEGEND_COLORS_RGB = [
      [153,0,0],[224,34,20],[229,76,76],[238,118,81],[239,159,106],[255,203,120],
      [157,244,217],[101,234,208],[13,214,199],[13,193,211],[0,164,191],[0,125,188]
    ];
    const legendSquaresHTML = (title, l, r) => `
      <div class="legend-title">${title}</div>
      <div class="legend-row">
        ${LEGEND_COLORS_RGB.map(([r0,g0,b0]) =>
          `<span class="legend-swatch" style="background:rgba(${r0},${g0},${b0},${SWATCH_ALPHA})"></span>`
        ).join('')}
      </div>
      <div class="legend-ends"><span>${l}</span><span>${r}</span></div>
    `;
  
    // Data index for info box
    const byPrecinct = Object.create(null);
    function indexGeojson(gj) {
      for (const k in byPrecinct) delete byPrecinct[k];
      for (const f of (gj.features || [])) {
        const k = getPrecinct(f.properties || {});
        if (k) byPrecinct[k] = f.properties;
      }
    }
  
    // Load GeoJSON
    const dataUrl = 'propA.geojson';
    const gj = await fetch(dataUrl).then(r => r.json());
    indexGeojson(gj);
  
    // Selection state + show/hide helpers -------------- NEW
    let lastSelectedPrecinct = null;
    function showInfoBox() { infoBox.style.display = ''; }
    function hideInfoBox() { infoBox.style.display = 'none'; }
  
    map.on('load', () => {
      map.addSource('precincts', { type: 'geojson', data: gj });
  
      // layers
      map.addLayer({ id: 'precincts-fill',     type: 'fill', source: 'precincts', paint: yesPercBinPaint });
      map.addLayer({ id: 'precincts-outline',  type: 'line', source: 'precincts', paint: { 'line-color':'#fff','line-width':0.5 } });
      map.addLayer({ id: 'precincts-hover',    type: 'line', source: 'precincts', paint: { 'line-color':'#fff','line-width':2.5 }, filter: ['==',['get','precinct'], '' ] });
      map.addLayer({ id: 'precincts-selected', type: 'line', source: 'precincts', paint: { 'line-color':'#fff','line-width':3 },   filter: ['==',['get','precinct'], '' ] });
  
      // Hover (doesn't erase selection)
      map.on('mousemove', 'precincts-fill', (e) => {
        if (!e.features?.length) return;
        const k = getPrecinct(e.features[0].properties || {});
        map.setFilter('precincts-hover', ['==', ['get','precinct'], k]);
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'precincts-fill', () => {
        map.setFilter('precincts-hover', ['==', ['get','precinct'], '' ]);
        map.getCanvas().style.cursor = '';
      });
  
      // Click → select + info
      map.on('click', 'precincts-fill', (e) => {
        if (!e.features?.length) return;
        const k = getPrecinct(e.features[0].properties || {});
        lastSelectedPrecinct = k;
        const props = byPrecinct[k] || e.features[0].properties || {};
        infoBox.innerHTML = tplInfoOneLine(props);
        map.setFilter('precincts-selected', ['==', ['get','precinct'], k]); // persist highlight
        showInfoBox();
      });
  
      // Click gray background → clear + hide
      map.on('click', (e) => {
        const hit = map.queryRenderedFeatures(e.point, { layers: ['precincts-fill'] });
        if (!hit.length) {
          lastSelectedPrecinct = null;
          infoBox.innerHTML = '';
          hideInfoBox();
          map.setFilter('precincts-selected', ['==', ['get','precinct'], '' ]);
          map.setFilter('precincts-hover',    ['==', ['get','precinct'], '' ]);
        }
      });
  
      // ESC to clear/hide
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          lastSelectedPrecinct = null;
          infoBox.innerHTML = '';
          hideInfoBox();
          map.setFilter('precincts-selected', ['==', ['get','precinct'], '' ]);
          map.setFilter('precincts-hover',    ['==', ['get','precinct'], '' ]);
        }
      });
  
      // Legend
      legendEl.innerHTML = legendSquaresHTML('Yes vote %', 'No', 'Yes');
  
      // Optional: move labels up
      try {
        if (map.getLayer('road-label-navigation')) map.moveLayer('road-label-navigation');
        if (map.getLayer('settlement-subdivision-label')) map.moveLayer('settlement-subdivision-label');
      } catch {}
  
      // Start with box hidden (don’t write hint text)
      hideInfoBox();
  
      // Initial height sync (robust burst for WP)
      Promise.all([
        new Promise(r => map.once('idle', r)),
        (document.fonts?.ready ?? Promise.resolve())
      ]).then(() => {
        const send = () => pymChild.sendHeight();
        requestAnimationFrame(send);
        // short keep-alive to catch late reflows
        let n = 0; const t = setInterval(() => { send(); if (++n >= 10) clearInterval(t); }, 150);
      });
    });
  
    // If you switch datasets later, also clear selection & hide box
    const selector = document.getElementById('propositionDropdown');
    if (selector) {
      selector.addEventListener('change', async (e) => {
        const v = e.target.value;            // e.g., "A", "K"
        const nextUrl = `data/${v}.geojson`;
        const next = await fetch(nextUrl).then(r => r.json());
        indexGeojson(next);
        map.getSource('precincts').setData(next);
        lastSelectedPrecinct = null;
        infoBox.innerHTML = '';
        hideInfoBox();
        map.setFilter('precincts-selected', ['==', ['get','precinct'], '' ]);
        map.setFilter('precincts-hover',    ['==', ['get','precinct'], '' ]);
      });
    }
  
    // Resize (no sendHeight needed; the burst above + theme observers usually cover it)
    window.addEventListener('resize', () => { map.resize(); });
  });
  
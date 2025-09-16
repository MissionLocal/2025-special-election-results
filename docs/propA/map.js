// map.js — single map with two-map-style hover + show/hide info box
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
      zoom: 12.2
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
      const votersTxt = p?.registered_voters ? `${fmtInt(p.registered_voters)} voters` : '';
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
    const gj = await fetch(dataUrl).then(r => {
      if (!r.ok) throw new Error(`Failed to load ${dataUrl}`);
      return r.json();
    });
    indexGeojson(gj);
  
    // Selection state + show/hide helpers
    let lastSelectedPrecinct = null;
    const showInfoBox = () => { infoBox.style.display = ''; };
    const hideInfoBox = () => { infoBox.style.display = 'none'; };
    const clearSelection = () => {
      lastSelectedPrecinct = null;
      infoBox.innerHTML = '';
      hideInfoBox();
      map.setFilter('precincts-hover', ['==', ['get','precinct'], '' ]);
    };
  
    map.on('load', () => {
      map.addSource('precincts', { type: 'geojson', data: gj });
  
      // Layers (hover outline doubles as selection outline—just like the two-map file)
      map.addLayer({ id: 'precincts-fill',    type: 'fill', source: 'precincts', paint: yesPercBinPaint });
      map.addLayer({ id: 'precincts-outline', type: 'line', source: 'precincts',
        paint: { 'line-color':'#fff', 'line-width': 0.5 }
      });
      map.addLayer({ id: 'precincts-hover',   type: 'line', source: 'precincts',
        paint: { 'line-color':'#fff', 'line-width': 2.5 },
        filter: ['==', ['get','precinct'], '' ]
      });
  
      // Hover (same semantics as two-map)
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
  
      // Click polygon → set the SAME hover outline to that precinct + show box
      map.on('click', 'precincts-fill', (e) => {
        if (!e.features?.length) return;
        const k = getPrecinct(e.features[0].properties || {});
        lastSelectedPrecinct = k;
        const props = byPrecinct[k] || e.features[0].properties || {};
        infoBox.innerHTML = tplInfoOneLine(props);
        map.setFilter('precincts-hover', ['==', ['get','precinct'], k]); // stick the outline
        showInfoBox();
        map.getCanvas().style.cursor = 'pointer';
      });
  
      // Click gray background → clear + hide
      map.on('click', (e) => {
        const hit = map.queryRenderedFeatures(e.point, { layers: ['precincts-fill'] });
        if (!hit.length) clearSelection();
      });
  
      // ESC to clear/hide
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') clearSelection();
      });
  
      // Legend
      legendEl.innerHTML = legendSquaresHTML('Percentage', 'No', 'Yes');
  
      // Optional: bring label layers above fills if present
      try {
        if (map.getLayer('road-label-navigation')) map.moveLayer('road-label-navigation');
        if (map.getLayer('settlement-subdivision-label')) map.moveLayer('settlement-subdivision-label');
        // keep hover stroke above outlines
        map.moveLayer('precincts-hover');
      } catch {}
  
      // Start hidden (no hints rendered so it truly disappears)
      hideInfoBox();
  
      // --- Robust Pym height sync (good for WP reflows) ---
      (function robustPym() {
        // tiny sentinel so absolutely positioned overlays don't get clipped
        const sentinel = document.createElement('div');
        sentinel.style.cssText = 'height:1px;margin-top:32px;';
        document.body.appendChild(sentinel);
  
        const sendBurst = (ms = 1800, every = 150) => {
          const end = performance.now() + ms;
          const tick = () => {
            pymChild.sendHeight();
            if (performance.now() < end) setTimeout(tick, every);
          };
          requestAnimationFrame(tick);
        };
  
        let tId = null;
        const sendThrottled = () => {
          if (tId) return;
          tId = setTimeout(() => { tId = null; pymChild.sendHeight(); }, 100);
        };
  
        Promise.all([
          new Promise(r => map.once('idle', r)),
          (document.fonts?.ready ?? Promise.resolve())
        ]).then(() => {
          requestAnimationFrame(() => {
            pymChild.sendHeight();
            sendBurst();
          });
        });
  
        new ResizeObserver(sendThrottled).observe(document.body);
        const mo = new MutationObserver(sendThrottled);
        mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
  
        window.addEventListener('orientationchange', () => {
          setTimeout(() => { map.resize(); sendBurst(1000, 150); }, 200);
        });
      })();
    });
  
    // Optional dataset switcher: also clear & hide like the two-map code
    const selector = document.getElementById('propositionDropdown');
    if (selector) {
      selector.addEventListener('change', async (e) => {
        const v = e.target.value;                   // e.g., "A", "K"
        const nextUrl = `data/${v}.geojson`;        // adjust path as needed
        const next = await fetch(nextUrl).then(r => {
          if (!r.ok) throw new Error(`Failed to load ${nextUrl}`);
          return r.json();
        });
        indexGeojson(next);
        map.getSource('precincts').setData(next);
        clearSelection();                            // hide box + clear outline
        // If your legend scale changes by dataset, update here:
        legendEl.innerHTML = legendSquaresHTML('Percentage', 'No', 'Yes');
      });
    }
  
    // Resize (mapbox relayout; Pym handled via observers/burst)
    window.addEventListener('resize', () => { map.resize(); });
  });
  
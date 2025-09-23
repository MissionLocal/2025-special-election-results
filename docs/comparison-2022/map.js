// map.js
document.addEventListener('DOMContentLoaded', () => {
  const pymChild = new pym.Child();
  mapboxgl.accessToken = "pk.eyJ1IjoibWxub3ciLCJhIjoiY21mZDE2anltMDRkbDJtcHM1Y2M0eTFjNCJ9.nmMGLA-zX7BqznSJ2po65g";

  // DOM refs
  const infoBox1 = document.getElementById('info-map1');
  const infoBox2 = document.getElementById('info-map2');
  const modeSelect = document.getElementById('map2Mode');
  const map2Title = document.getElementById('map2title');

  // --- View presets for desktop vs mobile ---
  const VIEW = {
    desktop: { center: [-122.494, 37.753], zoom: 12 },  
    mobile: { center: [-122.508, 37.750], zoom: 11.7 } 
  };
  const MEDIA = window.matchMedia('(max-width: 640px)');   // mobile breakpoint
  let viewMode = MEDIA.matches ? 'mobile' : 'desktop';
  const initialView = VIEW[viewMode];

  // Maps
  const map1 = new mapboxgl.Map({
    container: 'map1',
    style: 'mapbox://styles/mlnow/cm2tndow500co01pw3fho5d21',
    center: initialView.center,
    zoom: initialView.zoom
  });
  const map2 = new mapboxgl.Map({
    container: 'map2',
    style: 'mapbox://styles/mlnow/cm2tndow500co01pw3fho5d21',
    center: initialView.center,
    zoom: initialView.zoom
  });

  // Helpers
  const key = v => (v == null ? '' : String(v).trim());
  const getPrecinct = o => key(o?.precinct ?? o?.Precinct ?? o?.PCT ?? o?.pct);
  const fmtInt = x => Number.isFinite(Number(x)) ? Number(x).toLocaleString() : 'N/A';
  const fmtPct = x => {
    const n = Number(x);
    return Number.isFinite(n) ? n.toFixed(1) + '%' : 'N/A';
  };
  const hasLayer = (m, id) => !!m.getLayer(id);

  // ------- helpers (added) -------
  const asNum = v => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const pickField = (obj, names) => names.map(n => obj?.[n]).find(v => v !== undefined);
  // Add/rename keys here if your files use different turnout names
  const getTurnout = p => asNum(pickField(p, ['turnout', 'turnout_pct', 'turnout_p', 'Turnout']));

  // COMPACT info templates
  function tplYesNoCompact(p) {
    const yes = asNum(p?.yes_perc);
    const no  = (yes != null) ? (100 - yes) : null;
    const t   = getTurnout(p);

    return `
        <div><strong>Precinct ${key(p?.precinct) || 'N/A'}</strong></div>
        <div>
          Yes: ${yes != null ? fmtPct(yes) : 'N/A'} •
          No: ${no != null ? fmtPct(no) : 'N/A'} •
          Turnout: ${t != null ? fmtPct(t) : 'N/A'}
        </div>
      `;
  }
  function tplD4Compact(p) {
    const eng = asNum(p?.['joel_engardio_p']);
    const mar = asNum(p?.['gordon_mar_p']);
    const t   = getTurnout(p);

    return `
        <div><strong>Precinct ${key(p?.precinct) || 'N/A'}</strong></div>
        <div>
          Engardio: ${eng != null ? fmtPct(eng) : 'N/A'} •
          Mar: ${mar != null ? fmtPct(mar) : 'N/A'} •
          Turnout: ${t != null ? fmtPct(t) : 'N/A'}
        </div>
      `;
  }

  // Data + indexes
  const propAByPrecinct = Object.create(null);  // Left fixed
  const propKByPrecinct = Object.create(null);  // Right option 1
  const d4ByPrecinct = Object.create(null);  // Right option 2

  function indexGeojson(gj, dict, label) {
    for (const k in dict) delete dict[k];
    if (!gj?.features) {
      console.error(`[${label}] Missing features`);
      return;
    }
    for (const f of gj.features) {
      const k = getPrecinct(f.properties || {});
      if (k) dict[k] = f.properties;
    }
  }

  // --- Paints ---
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

  function percentPaint(propName) {
    return {
      'fill-color': [
        'step',
        ['to-number', ['get', propName]],
          /* <25% */ '#990000',
        25, '#E02214',
        30, '#E54C4C',
        35, '#EE7651',
        40, '#EF9F6A',
        45, '#FFCB78',
        50, '#9DF4D9',
        55, '#65EAD0',
        60, '#0DD6C7',
        65, '#0DC1D3',
        70, '#00A4BF',
        75, '#007DBC'
      ],
      'fill-opacity': 0.6
    };
  }

  // Legends (discrete squares)
  // Legend squares using RGB + alpha (only squares are translucent)
  const SWATCH_ALPHA = 0.6; // match your map fill-opacity
  const LEGEND_COLORS_RGB = [
    [153, 0, 0],  // #990000
    [224, 34, 20],  // #E02214
    [229, 76, 76],  // #E54C4C
    [238, 118, 81],  // #EE7651
    [239, 159, 106],  // #EF9F6A
    [255, 203, 120],  // #FFCB78
    [157, 244, 217],  // #9DF4D9
    [101, 234, 208],  // #65EAD0
    [13, 214, 199],  // #0DD6C7
    [13, 193, 211],  // #0DC1D3
    [0, 164, 191],  // #00A4BF
    [0, 125, 188]   // #007DBC
  ];

  const legendSquaresHTML = (title, leftLabel, rightLabel) => `
      <div class="legend-title">${title}</div>
      <div class="legend-row">
        ${LEGEND_COLORS_RGB.map(([r, g, b]) =>
    `<span class="legend-swatch"
                 style="display:inline-block;background: rgba(${r}, ${g}, ${b}, ${SWATCH_ALPHA});"></span>`
  ).join('')}
      </div>
      <div class="legend-ends" style="display:flex;justify-content:space-between;margin-top:4px;width:100%;">
        <span>${leftLabel}</span><span>${rightLabel}</span>
      </div>
    `;

  let legend1El, legend2El;
  function injectLegends() {
    const map1Container = document.getElementById('map1').parentElement;
    const map2Container = document.getElementById('map2').parentElement;

    legend1El = document.getElementById('legend1');
    if (!legend1El) {
      legend1El = document.createElement('div');
      legend1El.className = 'legend';
      legend1El.id = 'legend1';
      map1Container.appendChild(legend1El);
    }
    legend1El.innerHTML = legendSquaresHTML('Percentage', 'No', 'Yes');

    legend2El = document.getElementById('legend2');
    if (!legend2El) {
      legend2El = document.createElement('div');
      legend2El.className = 'legend';
      legend2El.id = 'legend2';
      map2Container.appendChild(legend2El);
    }
    legend2El.innerHTML = legendSquaresHTML('Percentage', 'No', 'Yes');
  }
  function updateMap2Legend(mode) {
    if (!legend2El) return;
    legend2El.innerHTML = (mode === 'propK')
      ? legendSquaresHTML('Percentage', 'No', 'Yes')
      : legendSquaresHTML('Engardio % of first votes', '0%', '100%');
  }

  // Sync camera
  function sync(a, b) {
    let sa = false, sb = false;
    a.on('move', () => {
      if (sa) return;
      sb = true;
      b.jumpTo({ center: a.getCenter(), zoom: a.getZoom(), bearing: a.getBearing(), pitch: a.getPitch() });
      sb = false;
    });
    b.on('move', () => {
      if (sb) return;
      sa = true;
      a.jumpTo({ center: b.getCenter(), zoom: b.getZoom(), bearing: b.getBearing(), pitch: b.getPitch() });
      sa = false;
    });
  }

  // Title helper
  function updateMap2Title(mode) {
    if (!map2Title) return;
    map2Title.textContent = (mode === 'propK')
      ? 'Nov. 2024 Proposition K'
      : 'Nov. 2022 supervisor election';
  }

  // --- Hover sync + selection memory ---
  let lastSelectedPrecinct = null;

  function setHoverPrecinct(k) {
    if (hasLayer(map1, 'propA-hover')) map1.setFilter('propA-hover', ['==', ['get', 'precinct'], k || '']);
    if (hasLayer(map2, 'map2-hover')) map2.setFilter('map2-hover', ['==', ['get', 'precinct'], k || '']);
  }

  function updateBoxesFromPrecinct(k) {
    const leftProps = propAByPrecinct[k] || {};
    const rightMode = modeSelect?.value || 'propK';
    const rightProps = (rightMode === 'propK') ? (propKByPrecinct[k] || {}) : (d4ByPrecinct[k] || {});
    infoBox1.innerHTML = tplYesNoCompact(leftProps);
    infoBox2.innerHTML = (rightMode === 'propK') ? tplYesNoCompact(rightProps) : tplD4Compact(rightProps);
  }

  // Build Map 2 layers for a given mode
  function buildMap2Layers(mode) {
    ['map2-fill', 'map2-outline', 'map2-hover'].forEach(id => {
      if (map2.getLayer(id)) map2.removeLayer(id);
    });

    const paint = (mode === 'propK') ? yesPercBinPaint : percentPaint('joel_engardio_p');

    map2.addLayer({ id: 'map2-fill', type: 'fill', source: 'map2src', paint });
    map2.addLayer({ id: 'map2-outline', type: 'line', source: 'map2src', paint: { 'line-color': '#fff', 'line-width': 0.5 } });
    map2.addLayer({ id: 'map2-hover', type: 'line', source: 'map2src', paint: { 'line-color': '#fff', 'line-width': 2.5 }, filter: ['==', ['get', 'precinct'], ''] });

    // Bind hover (de-duped) on Map 2, syncing both maps
    map2.off('mousemove', 'map2-fill', onMap2Move);
    map2.off('mouseleave', 'map2-fill', onMap2Leave);
    map2.on('mousemove', 'map2-fill', onMap2Move);
    map2.on('mouseleave', 'map2-fill', onMap2Leave);
  }

  // Unified hover handlers
  function onMap1Move(e) {
    if (!e.features?.length) return;
    const pct = getPrecinct(e.features[0].properties || {});
    setHoverPrecinct(pct);
    map1.getCanvas().style.cursor = 'pointer';
    map2.getCanvas().style.cursor = 'pointer';
  }
  function onMap1Leave() {
    setHoverPrecinct('');
    map1.getCanvas().style.cursor = '';
    map2.getCanvas().style.cursor = '';
  }
  function onMap2Move(e) {
    if (!e.features?.length) return;
    const pct = getPrecinct(e.features[0].properties || {});
    setHoverPrecinct(pct);
    map2.getCanvas().style.cursor = 'pointer';
    map1.getCanvas().style.cursor = 'pointer';
  }
  function onMap2Leave() {
    setHoverPrecinct('');
    map2.getCanvas().style.cursor = '';
    map1.getCanvas().style.cursor = '';
  }

  // Load everything
  Promise.all([
    new Promise(res => map1.on('load', res)),
    new Promise(res => map2.on('load', res)),
    fetch('propA.geojson').then(r => { if (!r.ok) throw new Error('propA.geojson not found'); return r.json(); }),
    fetch('propK.geojson').then(r => { if (!r.ok) throw new Error('propK.geojson not found'); return r.json(); }),
    fetch('d4.geojson').then(r => { if (!r.ok) throw new Error('d4.geojson not found'); return r.json(); })
  ])
    .then(([_, __, propA, propK, d4]) => {
      indexGeojson(propA, propAByPrecinct, 'Prop A');
      indexGeojson(propK, propKByPrecinct, 'Prop K');
      indexGeojson(d4, d4ByPrecinct, '2022');

      // Map 1 (Prop A fixed)
      map1.addSource('propA', { type: 'geojson', data: propA });
      map1.addLayer({ id: 'propA-fill', type: 'fill', source: 'propA', paint: yesPercBinPaint });
      map1.addLayer({ id: 'propA-outline', type: 'line', source: 'propA', paint: { 'line-color': '#fff', 'line-width': 0.5 } });
      map1.addLayer({ id: 'propA-hover', type: 'line', source: 'propA', paint: { 'line-color': '#fff', 'line-width': 2.5 }, filter: ['==', ['get', 'precinct'], ''] });

      // Hover on Map 1 (sync to Map 2)
      map1.on('mousemove', 'propA-fill', onMap1Move);
      map1.on('mouseleave', 'propA-fill', onMap1Leave);

      // Map 2 (start in Prop K mode)
      map2.addSource('map2src', { type: 'geojson', data: d4 });
      buildMap2Layers('d4_2022');

      // Dropdown: swap Map 2 between Prop K and 2022 supervisor
      if (modeSelect) {
        modeSelect.addEventListener('change', (e) => {
          // treat anything not 'propK' as the supervisor map
          const mode = (e.target.value === 'd4_2022') ? 'd4_2022' : 'propK';
          const data = (mode === 'd4_2022') ? d4 : propK;
          map2.getSource('map2src').setData(data);
          buildMap2Layers(mode);
          

          // update title + legend
          updateMap2Title(mode);
          updateMap2Legend(mode);

          // restore selection (if any), otherwise hide info boxes
          if (lastSelectedPrecinct) {
            updateBoxesFromPrecinct(lastSelectedPrecinct);
            setHoverPrecinct(lastSelectedPrecinct);
            showInfoBoxes();
          } else {
            hideInfoBoxes();
          }
        });
      }


      // Click handlers (both maps) — remember selection, update boxes, keep highlight
      map1.on('click', 'propA-fill', e => {
        if (!e.features.length) return;
        lastSelectedPrecinct = getPrecinct(e.features[0].properties || '');
        updateBoxesFromPrecinct(lastSelectedPrecinct);
        setHoverPrecinct(lastSelectedPrecinct);
        showInfoBoxes();
      });
      map2.on('click', 'map2-fill', e => {
        if (!e.features.length) return;
        lastSelectedPrecinct = getPrecinct(e.features[0].properties || '');
        updateBoxesFromPrecinct(lastSelectedPrecinct);
        setHoverPrecinct(lastSelectedPrecinct);
        showInfoBoxes();
      });


      // Helper to clear selection + info boxes
      function clearSelection() {
        lastSelectedPrecinct = null;
        setHoverPrecinct('');
        // If you want them totally empty (disappear):
        infoBox1.innerHTML = '';
        infoBox2.innerHTML = '';
        hideInfoBoxes();
        // If you prefer the original hints instead, swap the two lines above for:
        // infoBox1.innerHTML = '<div>Click a precinct.</div>';
        // const mode = modeSelect?.value || 'propK';
        // infoBox2.innerHTML = mode === 'propK'
        //   ? '<div>Right map: <strong>Prop K</strong>. Click a precinct.</div>'
        //   : '<div>Right map: <strong>2022 Results</strong>. Click a precinct.</div>';
      }

      // Background clicks (outside precinct polygons) clear selection
      map1.on('click', (e) => {
        const hit = map1.queryRenderedFeatures(e.point, { layers: ['propA-fill'] });
        if (!hit.length) clearSelection();
      });
      map2.on('click', (e) => {
        const hit = map2.queryRenderedFeatures(e.point, { layers: ['map2-fill'] });
        if (!hit.length) clearSelection();
      });

      // Optional: ESC key also clears
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') clearSelection();
      });
      // Sync + initial overlays
      sync(map1, map2);
      const initialMode = modeSelect?.value || 'propK';
      updateMap2Title(initialMode);

      // When viewport crosses the breakpoint (e.g., rotate phone), update both maps.
      // We jump only map1; the sync() you already have will move map2.
      MEDIA.addEventListener('change', () => {
        const newMode = MEDIA.matches ? 'mobile' : 'desktop';
        if (newMode !== viewMode) {
          viewMode = newMode;
          const v = VIEW[viewMode];
          map1.jumpTo({
            center: v.center,
            zoom: v.zoom,
            bearing: map1.getBearing(), // keep current bearing/pitch
            pitch: map1.getPitch()
          });
        }
      });

      // Legends
      injectLegends();
      updateMap2Legend(initialMode);

      // === Info box show/hide (overlay) ===
      function showInfoBoxes() {
        infoBox1.style.display = '';
        infoBox2.style.display = '';
      }
      function hideInfoBoxes() {
        infoBox1.style.display = 'none';
        infoBox2.style.display = 'none';
      }

      // Start hidden (no selection yet)
      hideInfoBoxes();

      // --- Robust Pym height sync ---
      (function robustPym() {
        // 1) Tiny bottom sentinel to prevent clipping of absolutely-positioned UI
        const sentinel = document.createElement('div');
        sentinel.style.cssText = 'height:1px;margin-top:32px;';
        document.body.appendChild(sentinel);

        // Helper: short burst of sendHeight calls to catch late reflows
        const sendBurst = (ms = 1800, every = 150) => {
          const end = performance.now() + ms;
          const tick = () => {
            pymChild.sendHeight();
            if (performance.now() < end) setTimeout(tick, every);
          };
          requestAnimationFrame(tick);
        };

        // Helper: throttled sender for observers/events
        let tId = null;
        const sendThrottled = () => {
          if (tId) return;
          tId = setTimeout(() => { tId = null; pymChild.sendHeight(); }, 100);
        };

        // Wait for both maps to be idle AND webfonts
        Promise.all([
          new Promise(r => map1.once('idle', r)),
          new Promise(r => map2.once('idle', r)),
          (document.fonts?.ready ?? Promise.resolve())
        ]).then(() => {
          requestAnimationFrame(() => {
            pymChild.sendHeight();  // precise first measure
            sendBurst();            // belt-and-suspenders
          });
        });

        // Re-measure on any size/layout change
        new ResizeObserver(sendThrottled).observe(document.body);

        // Re-measure on DOM mutations (legend text wraps, etc.)
        const mo = new MutationObserver(sendThrottled);
        mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });

        // Mobile orientation changes
        window.addEventListener('orientationchange', () => {
          setTimeout(() => { map1.resize(); map2.resize(); sendBurst(1000, 150); }, 200);
        });
      })();

      // --- Single-shot Pym height AFTER both maps are idle + fonts are ready ---
      Promise.all([
        new Promise(r => map1.once('idle', r)),
        new Promise(r => map2.once('idle', r)),
        (document.fonts?.ready ?? Promise.resolve())
      ]).then(() => {
        // allow one paint/layout tick
        requestAnimationFrame(() => pymChild.sendHeight());
      });
    })
    .catch(err => {
      console.error('INIT ERROR:', err);
      infoBox2.innerHTML = `<div style="color:#b00">Error loading maps: ${err?.message || err}</div>`;
    });

  // Resize (no Pym here — single-shot strategy)
  window.addEventListener('resize', () => {
    map1.resize();
    map2.resize();
  });
});

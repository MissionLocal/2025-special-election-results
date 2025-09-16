// map.js — treat 0.0 as N/A (gray)
document.addEventListener('DOMContentLoaded', async () => {
  const pymChild = new pym.Child();
  mapboxgl.accessToken = "pk.eyJ1IjoibWxub3ciLCJhIjoiY21mZDE2anltMDRkbDJtcHM1Y2M0eTFjNCJ9.nmMGLA-zX7BqznSJ2po65g";

  // DOM
  const infoBox  = document.getElementById('info-box');
  const legendEl = document.getElementById('legend');

  // Hide info box on load ✅
  if (infoBox) infoBox.style.display = 'none';

  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mlnow/cm2tndow500co01pw3fho5d21',
    center: [-122.496, 37.750],
    zoom: 12.2
  });

  const key = v => (v == null ? '' : String(v).trim());
  const getPrecinct = o => key(o?.precinct ?? o?.Precinct ?? o?.PCT ?? o?.pct);
  const fmtInt = x => Number.isFinite(Number(x)) ? Number(x).toLocaleString() : 'N/A';
  const fmtPct = x => {
    const n = Number(x);
    return (!Number.isFinite(n) || n === 0) ? 'N/A' : n.toFixed(1) + '%';
  };

  function tplInfoOneLine(p = {}) {
    const turnoutTxt = (p?.turnout != null) ? fmtPct(p.turnout) : 'N/A';
    const votersTxt  = p?.registered_voters ? `${fmtInt(p.registered_voters)} registered voters` : '';
    const castTxt    = p?.votes_cast ? ` • Votes cast: ${fmtInt(p.votes_cast)}` : '';
    return `
      <div><strong>Precinct ${key(p?.precinct) || 'N/A'}</strong></div>
      <div class="info-stats">Turnout: ${turnoutTxt}${votersTxt ? ` • ${votersTxt}` : ''}</div>
    `;
  }

  // >>> Only change: if value is 0.0 → N/A gray. Otherwise keep your category palette.
  // Checks numeric value from either `turnout` or `yes_perc` (whichever you use).
  const ZERO_IS_NA = ['==',
    ['coalesce',
      ['to-number', ['get', 'turnout']],
      ['to-number', ['get', 'yes_perc']],
      0
    ],
    0
  ];

  const turnoutPaint = {
    'fill-color': [
      'case',
      ZERO_IS_NA, '#CECECE', // N/A gray when value is 0.0
      // Otherwise, use your existing categorical palette on yes_perc
      ['match', ['get','yes_perc'],
        'Less than 25%','#9DF4D9','25-30%','#65EAD0','30-35%','#0DD6C7','35-40%','#0DC1D3',
        '40-45%','#00A4BF','45-50%','#007DBC','50-55%','#005A8C','55-60%','#003F5C',
        '60-65%','#00233B','65-70%','#001F2A','70-75%','#001622','75% and more','#000F19',
        '#CECECE' // fallback
      ]
    ],
    'fill-opacity': 0.6
  };

  const SWATCH_ALPHA = 0.6;
  const LEGEND_COLORS_RGB = [
    [157,244,217],[101,234,208],[13,214,199],[13,193,211],[0,164,191],[0,125,188],
    [0,90,140],[0,63,92],[0,35,59],[0,31,42],[0,22,34],[0,15,25]
  ];
  const legendSquaresHTML = (title, leftLabel, rightLabel) => `
    <div class="legend-title">${title}</div>
    <div class="legend-row">
      ${LEGEND_COLORS_RGB.map(([r,g,b]) => `<span class="legend-swatch" style="background:rgba(${r},${g},${b},${SWATCH_ALPHA})"></span>`).join('')}
    </div>
    <div class="legend-ends"><span>${leftLabel}</span><span>${rightLabel}</span></div>
  `;

  const byPrecinct = Object.create(null);
  function indexGeojson(gj) {
    for (const k in byPrecinct) delete byPrecinct[k];
    for (const f of (gj.features || [])) {
      const k = getPrecinct(f.properties || {});
      if (k) byPrecinct[k] = f.properties;
    }
  }

  const dataUrl = 'turnout.geojson';
  const gj = await fetch(dataUrl).then(r => r.json());
  indexGeojson(gj);

  map.on('load', () => {
    map.addSource('precincts', { type:'geojson', data: gj });
    map.addLayer({ id:'turnout-fill',   type:'fill', source:'precincts', paint: turnoutPaint });
    map.addLayer({ id:'turnout-outline',type:'line', source:'precincts', paint:{ 'line-color':'#fff','line-width':0.5 }});
    map.addLayer({ id:'turnout-hover',  type:'line', source:'precincts', paint:{ 'line-color':'#fff','line-width':2.5 }, filter:['==',['get','precinct'],''] });

    // Hover
    map.on('mousemove','turnout-fill', e => {
      if (!e.features?.length) return;
      const k = getPrecinct(e.features[0].properties || {});
      map.setFilter('turnout-hover',['==',['get','precinct'],k]);
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave','turnout-fill', () => {
      map.setFilter('turnout-hover',['==',['get','precinct'],'']);
      map.getCanvas().style.cursor = '';
    });

    // Click on precinct → show card ✅
    map.on('click','turnout-fill', e => {
      if (!e.features?.length) return;
      const k = getPrecinct(e.features[0].properties || {});
      const props = byPrecinct[k] || e.features[0].properties || {};
      infoBox.style.display = 'block';                    // show
      infoBox.innerHTML = tplInfoOneLine(props);
      map.setFilter('turnout-hover',['==',['get','precinct'],k]);
      pymChild.sendHeight();
    });

    // Click anywhere else on the map → hide card ✅
    map.on('click', e => {
      const feats = map.queryRenderedFeatures(e.point, { layers:['turnout-fill'] });
      if (feats.length) return;                           // (click was on a precinct)
      infoBox.style.display = 'none';                     // hide
      map.setFilter('turnout-hover',['==',['get','precinct'],'']);
      pymChild.sendHeight();
    });

    legendEl.innerHTML = legendSquaresHTML('Turnout','0%','100%');

    try {
      if (map.getLayer('road-label-navigation')) map.moveLayer('road-label-navigation');
      if (map.getLayer('settlement-subdivision-label')) map.moveLayer('settlement-subdivision-label');
    } catch {}
  });

  window.addEventListener('resize', () => {
    map.resize();
    pymChild.sendHeight();
  });
});

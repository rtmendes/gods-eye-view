/**
 * The Deck's mission catalog: every use case the globe supports, grouped the
 * way the app groups its layers, each with a view the globe can open, the
 * feeds it reads, the keys it needs and a question for the analyst.
 * Views use the share-link format (gods-eye-view/view); the server turns
 * them into links.
 */

export const GROUPS = [
  {
    id: 'movement',
    title: 'Movement',
    blurb: 'Aircraft, ships and vehicles on live telemetry.',
  },
  {
    id: 'cameras',
    title: 'Cameras',
    blurb: 'Public cameras and street-level imagery, placed in 3D.',
  },
  {
    id: 'events',
    title: 'Events',
    blurb: 'Earthquakes, fires, storms and documented disasters.',
  },
  {
    id: 'space',
    title: 'Space',
    blurb: 'Satellites, passes and launch replays.',
  },
  {
    id: 'weather',
    title: 'Weather',
    blurb: 'Forecast wind and observed radar, clouds and lightning.',
  },
  {
    id: 'infrastructure',
    title: 'Infrastructure',
    blurb: 'The fixed world: cables, datacenters, dams, installations.',
  },
  {
    id: 'analysis',
    title: 'Analysis',
    blurb: 'Briefs that combine several feeds into one answer.',
  },
  {
    id: 'cinema',
    title: 'Cinema and publishing',
    blurb: 'Sensor looks, cockpit rides and shareable scenes.',
  },
];

const GLOBE = { lat: 20, lon: 0, altitude_m: 15_000_000, pitch_deg: -90 };

export const USE_CASES = [
  {
    id: 'flights',
    group: 'movement',
    title: 'Live flights',
    blurb:
      'Thousands of aircraft on real transponder data. Click one to track it, read its card and ride along.',
    sources: 'OpenSky, adsb.lol',
    needs: [],
    view: {
      camera: { lat: 33.94, lon: -118.41, altitude_m: 60_000, pitch_deg: -60 },
      layers: ['flights'],
    },
    prompt:
      'What is airborne within 50 km of LAX right now, and which contact is worth tracking?',
  },
  {
    id: 'military',
    group: 'movement',
    title: 'Military traffic',
    blurb:
      'ADS-B military aircraft in amber, with about 24 hours of trace history resolved as 3D loops.',
    sources: 'adsb.lol',
    needs: [],
    view: {
      camera: { lat: 36.6, lon: -115.7, altitude_m: 250_000, pitch_deg: -75 },
      layers: ['military'],
    },
    prompt:
      'Which military aircraft are over Nevada now, and what pattern are they flying?',
  },
  {
    id: 'vessels',
    group: 'movement',
    title: 'Live vessels',
    blurb:
      'Ships worldwide from AIS, with tactical cards and wake trails. Needs a free AISStream key.',
    sources: 'AISStream',
    needs: ['AISSTREAM_API_KEY'],
    view: {
      camera: { lat: 33.74, lon: -118.22, altitude_m: 25_000, pitch_deg: -55 },
      layers: ['ais-live-vessels'],
    },
    prompt:
      'List the tankers and container ships near the Port of Long Beach and what is at anchor.',
  },
  {
    id: 'transit',
    group: 'movement',
    title: 'Transit',
    blurb:
      'Buses, trams, metros and ferries from operator GTFS-Realtime feeds, with trails between reports.',
    sources: 'Operator GTFS-RT feeds',
    needs: [],
    view: {
      camera: { lat: 42.36, lon: -71.06, altitude_m: 12_000, pitch_deg: -60 },
      layers: ['transit'],
    },
    prompt: 'How many transit vehicles are moving in Boston now, by mode?',
  },
  {
    id: 'traffic',
    group: 'movement',
    title: 'Traffic',
    blurb:
      'Vehicles simulated along real roads; with TomTom, live flow speeds and congestion colour.',
    sources: 'OpenStreetMap, TomTom',
    needs: ['TOMTOM_API_KEY'],
    view: {
      camera: { lat: 34.05, lon: -118.25, altitude_m: 6_000, pitch_deg: -55 },
      layers: ['traffic'],
    },
    prompt:
      'Where is traffic slowest in downtown Los Angeles right now compared with free flow?',
  },
  {
    id: 'bikeshare',
    group: 'movement',
    title: 'Bike share',
    blurb: 'Live station availability from GBFS systems in supported cities.',
    sources: 'GBFS',
    needs: [],
    view: {
      camera: { lat: 40.74, lon: -73.99, altitude_m: 8_000, pitch_deg: -60 },
      layers: ['bikeshare'],
    },
    prompt:
      'Which bike-share stations in Manhattan are empty or full right now?',
  },
  {
    id: 'cctv',
    group: 'cameras',
    title: 'CCTV mesh',
    blurb:
      'Public cameras projected into the 3D city, with estimated viewsheds and NEAREST hand-off from any tracked target.',
    sources: 'City and state transport APIs',
    needs: [],
    view: {
      camera: { lat: 30.27, lon: -97.74, altitude_m: 3_000, pitch_deg: -50 },
      layers: ['cctv'],
    },
    prompt:
      'Find the public cameras closest to the Texas Capitol in Austin and show me the current image from the nearest one.',
  },
  {
    id: 'alpr',
    group: 'cameras',
    title: 'Mapped ALPR cameras',
    blurb:
      'License-plate-reader locations tagged in OpenStreetMap, one city at a time. Locations and tags only.',
    sources: 'OpenStreetMap',
    needs: [],
    view: {
      camera: { lat: 37.77, lon: -122.42, altitude_m: 15_000, pitch_deg: -75 },
      layers: ['alpr-cameras'],
    },
    prompt:
      'How many mapped license plate readers are in San Francisco, and which operators are tagged?',
  },
  {
    id: 'street',
    group: 'cameras',
    title: 'Street level',
    blurb:
      'Street-level photos and 360° panoramas behind one panel, with the camera following the photo view.',
    sources: 'Mapillary',
    needs: ['MAPILLARY_CLIENT_TOKEN'],
    view: {
      camera: { lat: 48.8584, lon: 2.2945, altitude_m: 1_500, pitch_deg: -45 },
      layers: ['street-level'],
    },
    prompt:
      'Describe what is around the Eiffel Tower at street level and which views are worth capturing.',
  },
  {
    id: 'earthquakes',
    group: 'events',
    title: 'Earthquakes',
    blurb:
      'Global seismic activity from USGS over the last 24 hours, strongest first.',
    sources: 'USGS',
    needs: [],
    view: { camera: GLOBE, layers: ['earthquakes'] },
    prompt:
      'What were the strongest earthquakes in the last 24 hours, and did any hit a populated area?',
  },
  {
    id: 'fires',
    group: 'events',
    title: 'Active fires',
    blurb:
      'NASA FIRMS satellite fire detections, trailing 24 hours, with mapped perimeters where WFIGS has them.',
    sources: 'NASA FIRMS, WFIGS',
    needs: ['FIRMS_MAP_KEY'],
    view: {
      camera: { lat: 37.5, lon: -120, altitude_m: 900_000, pitch_deg: -90 },
      layers: ['local-firms', 'fire-perimeters'],
    },
    prompt:
      'Where are the most intense fire detections in California today, and which have mapped perimeters?',
  },
  {
    id: 'cyclones',
    group: 'events',
    title: 'Cyclones',
    blurb:
      'Advisory positions, forecast tracks and cones for the Atlantic and eastern and central Pacific.',
    sources: 'NOAA NHC and CPHC',
    needs: [],
    view: {
      camera: { lat: 22, lon: -70, altitude_m: 6_000_000, pitch_deg: -90 },
      layers: ['weather-cyclones'],
    },
    prompt:
      'Are there active tropical cyclones now? Give positions, intensity and where the forecast tracks go.',
  },
  {
    id: 'bhote-koshi',
    group: 'events',
    title: 'Bhote Koshi flood',
    blurb:
      'A documented event: the flood path, witness sources and before-and-after imagery, in story order.',
    sources: 'Bundled event pack (CC BY-NC 4.0)',
    needs: [],
    view: {
      camera: { lat: 27.97, lon: 85.95, altitude_m: 40_000, pitch_deg: -55 },
      layers: ['bhote-koshi-2026', 'bhote-koshi-locator'],
    },
    prompt:
      'Walk me through the Bhote Koshi flood evidence trail and suggest the three strongest visuals for a feature.',
  },
  {
    id: 'satellites',
    group: 'space',
    title: 'Satellites',
    blurb:
      'An 838-object catalog propagated with SGP4, colour-coded by class, with the whole Starlink shell on demand.',
    sources: 'CelesTrak',
    needs: [],
    view: {
      camera: { lat: 10, lon: 20, altitude_m: 25_000_000, pitch_deg: -90 },
      layers: ['satellites'],
    },
    prompt:
      'What is overhead London right now, highest first, and when does the ISS next rise there?',
  },
  {
    id: 'iss',
    group: 'space',
    title: 'Track the ISS',
    blurb:
      'Ride along at orbital distance, orbit ring and all, and ask when it next passes over you.',
    sources: 'CelesTrak',
    needs: [],
    view: {
      camera: { lat: 0, lon: 0, altitude_m: 3_000_000, pitch_deg: -90 },
      layers: ['satellites'],
      follow: { kind: 'satellite', id: '25544' },
    },
    prompt:
      'When is the next visible ISS pass over Los Angeles, and will it be naked-eye visible?',
  },
  {
    id: 'launches',
    group: 'space',
    title: 'Space missions',
    blurb:
      'Rolling 30-day launches with payload, stage and recovery detail, and a scrubbable ascent replay.',
    sources: 'Launch Library 2',
    needs: [],
    view: {
      camera: { lat: 28.57, lon: -80.65, altitude_m: 120_000, pitch_deg: -60 },
      layers: ['rocket-launches'],
    },
    prompt:
      'What launched in the last 30 days, and what is next from Cape Canaveral?',
  },
  {
    id: 'wind',
    group: 'weather',
    title: 'Wind',
    blurb:
      'Animated 10 m forecast wind from GFS or ECMWF, with speed, temperature or pressure colour fields.',
    sources: 'NOAA GFS, ECMWF IFS',
    needs: [],
    view: {
      camera: { lat: 45, lon: -30, altitude_m: 8_000_000, pitch_deg: -90 },
      layers: ['wind'],
    },
    prompt:
      'Describe the wind field over the North Atlantic now and where the strongest gradients are.',
  },
  {
    id: 'observed',
    group: 'weather',
    title: 'Radar, clouds, lightning',
    blurb:
      'Observed rain radar, satellite clouds and lightning density on one history timeline.',
    sources: 'NOAA nowCOAST',
    needs: [],
    view: {
      camera: { lat: 38, lon: -95, altitude_m: 5_000_000, pitch_deg: -90 },
      layers: ['weather-radar', 'weather-satellite', 'weather-lightning'],
    },
    prompt:
      'Get the latest radar and lightning maps over the central United States and tell me where the active storms are.',
  },
  {
    id: 'cables',
    group: 'infrastructure',
    title: 'Submarine cables',
    blurb: '712 cables and their landing points, drawn beneath the globe.',
    sources: 'TeleGeography (CC BY-NC-SA 3.0)',
    needs: [],
    view: {
      camera: { lat: 25.5, lon: -77.5, altitude_m: 900_000, pitch_deg: -75 },
      layers: ['telegeography-submarine-cables'],
    },
    prompt: 'Which submarine cables land in the Bahamas and where do they go?',
  },
  {
    id: 'datacenters',
    group: 'infrastructure',
    title: 'Datacenters and dams',
    blurb:
      '4,351 datacenters and 704 dams from OpenStreetMap, bundled and queryable by area.',
    sources: 'OpenStreetMap (ODbL)',
    needs: [],
    view: {
      camera: { lat: 39.0, lon: -77.5, altitude_m: 80_000, pitch_deg: -70 },
      layers: ['local-datacenters', 'local-dams'],
    },
    prompt:
      'How many datacenters are within 30 km of Ashburn, Virginia, and who operates the largest clusters?',
  },
  {
    id: 'three-gorges',
    group: 'infrastructure',
    title: 'Orbit Three Gorges',
    blurb: 'Sweep the dam and its terrain, then turn on Dams to find 703 more.',
    sources: 'OpenStreetMap (ODbL)',
    needs: [],
    view: {
      camera: {
        lat: 30.82,
        lon: 111.0,
        altitude_m: 12_000,
        pitch_deg: -40,
        heading_deg: 320,
      },
      layers: ['local-dams'],
    },
    prompt:
      'Tell me about the dams within 200 km of Three Gorges and the terrain height at the dam.',
  },
  {
    id: 'installations',
    group: 'infrastructure',
    title: 'Mapped installations',
    blurb:
      'Military sites from community mapping, viewport-bounded and labelled as incomplete by nature.',
    sources: 'OpenStreetMap',
    needs: [],
    view: {
      camera: { lat: 32.2, lon: -110.9, altitude_m: 40_000, pitch_deg: -65 },
      layers: ['military-installations'],
    },
    prompt:
      'What military installations are mapped around Tucson, and what sits at the boneyard?',
  },
  {
    id: 'situation',
    group: 'analysis',
    title: 'Situation brief',
    blurb:
      'Weather, earthquakes, fires, aircraft, ships and cyclones for an area, section by section.',
    sources: 'Several feeds',
    needs: [],
    view: {
      camera: { lat: 25.03, lon: 121.56, altitude_m: 900_000, pitch_deg: -85 },
      layers: ['flights', 'ais-live-vessels', 'earthquakes'],
    },
    prompt: 'Give me a situation brief for Taiwan.',
  },
  {
    id: 'awareness',
    group: 'analysis',
    title: 'Military awareness',
    blurb:
      'Military and other aircraft, ships and installations within 250 km of a point.',
    sources: 'adsb.lol, AISStream, OpenStreetMap',
    needs: [],
    view: {
      camera: { lat: 32.72, lon: -117.17, altitude_m: 400_000, pitch_deg: -80 },
      layers: ['military', 'military-awareness', 'military-installations'],
    },
    prompt: 'Run military awareness around San Diego.',
  },
  {
    id: 'regional',
    group: 'analysis',
    title: 'Regional brief',
    blurb:
      'What and where a place is, its weather and recent headlines, with the HUD caption the globe writes.',
    sources: 'Nominatim, weather, news',
    needs: [],
    view: {
      camera: { lat: 59.44, lon: 24.75, altitude_m: 20_000, pitch_deg: -60 },
      layers: ['cctv'],
    },
    prompt:
      'Brief me on Tallinn: what is happening there today, with the weather and headlines.',
  },
  {
    id: 'imagery',
    group: 'analysis',
    title: 'Recent satellite imagery',
    blurb:
      'The most recent clear Landsat or Sentinel-2 image of an area, with a VIIRS fallback.',
    sources: 'NASA Worldview',
    needs: [],
    view: {
      camera: { lat: -3.1, lon: -60.0, altitude_m: 300_000, pitch_deg: -90 },
      layers: ['recent-imagery'],
    },
    prompt:
      'Get the most recent clear satellite image around Manaus and describe what it shows.',
  },
  {
    id: 'cockpit',
    group: 'cinema',
    title: 'Cockpit ride',
    blurb:
      'Track an airliner on final approach, hit COCKPIT and ride it down with the sensor look of your choice.',
    sources: 'OpenSky, adsb.lol',
    needs: [],
    view: {
      camera: {
        lat: 51.47,
        lon: -0.46,
        altitude_m: 15_000,
        pitch_deg: -45,
        heading_deg: 90,
      },
      layers: ['flights'],
      style: 'surveillance',
    },
    prompt:
      'Which aircraft is lining up for Heathrow right now? Give me the view that follows it.',
  },
  {
    id: 'styles',
    group: 'cinema',
    title: 'Sensor styles',
    blurb:
      'CRT, night vision, FLIR, anime, noir and snow over the live globe. Keys 1 to 7 in the app.',
    sources: 'GLSL post-processing',
    needs: [],
    view: {
      camera: { lat: 35.66, lon: 139.7, altitude_m: 4_000, pitch_deg: -45 },
      layers: ['flights', 'radio'],
      style: 'thermal',
    },
    prompt:
      'Suggest three sensor looks and camera angles over Shibuya for a night-watch story, with the views.',
  },
  {
    id: 'radio',
    group: 'cinema',
    title: 'World radio',
    blurb:
      'Geolocated stations with an analog tuner: every needle position flies the globe to a broadcaster.',
    sources: 'Radio Browser',
    needs: [],
    view: {
      camera: { lat: 35.66, lon: 139.7, altitude_m: 30_000, pitch_deg: -60 },
      layers: ['radio'],
    },
    prompt: 'Find jazz stations broadcasting from Tokyo with working streams.',
  },
  {
    id: 'share',
    group: 'cinema',
    title: 'Share links and scenes',
    blurb:
      'Camera, style, layers and a tracked target serialize into a URL; the Director records camera tours.',
    sources: 'The app',
    needs: [],
    view: {
      camera: {
        lat: 40.71,
        lon: -74.01,
        altitude_m: 5_000,
        pitch_deg: -40,
        heading_deg: 30,
      },
      layers: ['flights', 'ais-live-vessels'],
      style: 'noir',
      map: 'photoreal',
    },
    prompt:
      'Build me a publishing pack about New York Harbor tonight: an angle, the data and three views to capture.',
  },
];

/** The voice actions the globe answers to, for the capabilities list. */
export const VOICE_ACTIONS = [
  'fly_to_location',
  'select_nearest_aircraft',
  'track_entity',
  'stop_tracking',
  'control_cockpit',
  'adjust_camera_zoom',
  'zoom_to_globe',
  'move_camera',
  'frame_overhead',
  'fly_route',
  'set_layer_visibility',
  'show_data_layers_menu',
  'set_panel_open',
  'set_context_mode',
  'set_visual_style',
  'set_hud',
  'set_cyber_sonar',
  'set_detection',
  'set_map_stack',
  'set_post_processing',
  'control_scene',
  'control_cctv',
  'control_radio',
  'annotate_map',
  'clear_annotations',
  'get_entity_context',
  'get_current_view_state',
  'analyst_query',
  'next_iss_pass',
  'next_satellite_pass',
];

export const SHORTCUTS = [
  ['1 – 7', 'Visual styles'],
  ['H', 'Heads-up display'],
  ['D', 'Detection overlay'],
  ['C', 'Cockpit'],
  ['`', 'Frame rate'],
  ['Esc', 'Back out'],
];

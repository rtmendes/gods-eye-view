# Harlem–Tyrone equipment curation, 6 November 2026

This is an initial evidence-backed inventory of agency-published camera-site
points. It is **not an exact, surveyed or complete equipment inventory**.

| Disposition                               | Count | Meaning                                                                                                                                    |
| ----------------------------------------- | ----: | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Screened agency site points               |    49 | 7 NYC DOT + 42 511PA points with descriptions matching the sample route's roads; physical mount and measurement accuracy remain unverified |
| Needs review                              |    17 | Adjacent roads, portable devices, unspecified CAM names, weather-device ambiguity or unresolved route association                          |
| Quarantined                               |     1 | 511PA site 3889 describes Tacony/Levick in Philadelphia but publishes a coordinate near Tyrone                                             |
| Independently verified physical positions |     0 | No field/survey verification was performed                                                                                                 |
| Verified enforcement-device positions     |     0 | Monitoring cameras are not treated as citation cameras                                                                                     |

The previously curated 11 PennDOT WZSSC records / 9 project areas remain a
separate zone dataset. A traffic camera inside a work zone is not thereby a
speed-enforcement device.

## Acquisition and screening

The route is the central-Harlem to central-Tyrone OSRM route previously used in
the app, approximately 266 miles. Both carriageways and nearby streets can be
within the search corridor; proximity does not establish the monitored road.

1. Retrieved NYC DOT's public catalog at
   `https://webcams.nyctmc.org/api/cameras/` (975 rows). Its direct endpoint
   initially returned 503; Firecrawl retrieved the public catalog successfully.
2. Retrieved 511PA's public camera-map layer at
   `https://www.511pa.com/map/mapIcons/Cameras` (1,564 site markers).
3. Selected source points within 250 m of the route's centerline: 16 NYC and
   51 PA candidates. Distance and approximate trip mileage are computed from the
   sampled route, not supplied by the camera agency and not evidence of GPS accuracy.
4. Retrieved and reviewed all 51 511PA public tooltip descriptions at
   `/tooltip/Cameras/{siteId}?lang=en`. Grouped view IDs remain views, not a
   count of physical devices. Equipment-facing direction is not inferred from
   a monitoring-camera view description.
5. Retained 7 named-road NYC matches and 42 named I-80/I-99 PA non-portable site
   records as agency-site candidates. Isolated ambiguity and mismatches rather
   than geocoding a replacement position.

Every retained latitude/longitude is copied from its agency record. Unknown
accuracy remains null. Decimal precision must not be interpreted as measured
accuracy. Retrieval time is not a physical observation time. An agency camera
image link shows its output, not a photo proving its exact mount position.

## Rejected/unavailable sources

- NYC Open Data `hk4g-zwnh`, titled “speed cameras,” is a community-derived view
  of FY2015 Department of Finance ticket records. It was rejected as a current
  equipment inventory. No plate/vehicle records are included here.
- The public 511NJ camera page redirected to account login in the review
  environment. No login was attempted and no NJ points were accepted.
- The public OSM Overpass query returned HTTP 406; the retrieval tool also
  failed. No OSM coordinates were imported.

These gaps do not establish absence of equipment. Neither camera availability
nor live violation enforcement was independently verified. Site images are
linked rather than copied; image reuse rights were not established.

## Files and app import

`equipment-inventory.json` contains all 67 candidates, their disposition,
evidence URLs, source site/view identifiers and uncertainty. The two
`app-import-*.json` files contain only the 49 screened monitoring-site points.
They use `Harlem–Tyrone corridor` rather than assigning an unverified highway
number to a nearby point. They cannot generate speed-enforcement alerts.

```sh
npm run enforcement:manage -- import curation/harlem-tyrone/app-import-nyc.json
npm run enforcement:manage -- import curation/harlem-tyrone/app-import-pa.json
```

New installations also seed these records from the bundled snapshot. This is a
dated curation; the existing hourly NYSDOT/PennDOT **work-zone** importer does
not refresh these monitoring-camera catalogs. Re-curate from their sources to
update this point inventory. The app's one-minute refresh reads the database.

## Remaining verification

- Obtain agency confirmation that points represent physical equipment mounts,
  including asset IDs, accuracy, current status, equipment purpose and dates.
- Verify point positions using permitted dated street-level imagery or field
  observations; do not use the observer's vehicle GPS as the camera's GPS.
- Obtain a current enforcement-device asset/deployment feed. It is still absent.
- Resolve New Jersey coverage, all 17 review candidates and the quarantined PA
  coordinate/name conflict.

`agency-camera-site-marker` is a distinct position meaning in the app.
`equipmentPositionVerified` remains false for all these records. A future
physical-device verification requires stated accuracy and a verification date.
See `agency-request-drafts.md` for requests prepared but not sent.

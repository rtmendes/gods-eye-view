/** Deliberately synthetic, local-only replay; never imported into the enforcement database. */
export function demoTrip() {
  const geometry = [
    [-74.11, 40.892],
    [-74.103, 40.891],
    [-74.096, 40.889],
    [-74.089, 40.886],
    [-74.082, 40.884],
    [-74.075, 40.882],
  ];
  return {
    ok: true,
    geometry,
    distanceM: 3200,
    durationS: 160,
    demo: true,
    steps: [
      {
        instruction: 'Continue east on I-80 (demo)',
        ref: 'I 80',
        distanceM: 2600,
        lon: geometry[0][0],
        lat: geometry[0][1],
      },
      {
        instruction: 'Take the demonstration exit',
        ref: 'I 80',
        distanceM: 600,
        lon: geometry[4][0],
        lat: geometry[4][1],
      },
      {
        instruction: 'Arrive at the demonstration destination',
        ref: 'I 80',
        distanceM: 0,
        lon: geometry[5][0],
        lat: geometry[5][1],
      },
    ],
  };
}

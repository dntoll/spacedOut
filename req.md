# Game Requirements

## Technical Requirements

- **REQ-01:** Build a small Canvas game using Vite and TypeScript.
- **REQ-19:** Maintain automated test coverage for every documented requirement.

## Domain Rules

- **REQ-02:** Simulate spaceship and asteroid physics.
- **REQ-06:** Turn the ship directly toward the current mouse or touch position.
- **REQ-07:** While a touch pointer is pressed, accelerate the ship toward that position. The forward component of its existing velocity is preserved; the perpendicular and reverse components are dampened per REQ-26. (On PC the mouse only aims; thrust is via WASD per REQ-37.)
- **REQ-08:** Scale touch thrust with the distance between the ship and the pointer: nearby input produces little thrust, while distant input produces strong thrust.
- **REQ-11:** Populate the world with randomized asteroids.
- **REQ-12:** Give the ship and asteroids area-scaled mass based on their radius, and use their relative masses during physical collisions to determine their resulting directions and speeds while transferring momentum and asteroid spin.
- **REQ-14:** Randomly and stably spread collectible air and fuel containers throughout reached world regions rather than only around the starting center.
- **REQ-16:** Reduce the ship's fuel while it is thrusting.
- **REQ-17:** Reduce the ship's air over time.
- **REQ-18:** Allow air and fuel containers to collide physically with asteroids.
- **REQ-20:** Include immovable massive asteroids that are 30–100 times the ship radius, have irregular concave silhouettes, and physically collide with the ship, regular asteroids, and supply containers. Their impact craters must not overlap the outline, must span varied sizes with more small craters than large ones, and must not be limited to the asteroid center.
- **REQ-21:** Match massive-asteroid collisions to their irregular visible outline so concave areas do not create invisible collisions outside the rock.
- **REQ-22:** Treat the ship as a swept sphere: expand polygon edges by the ship radius, cap original edge corners with ship-radius circles, find the earliest collision along the previous-to-current center path, keep the ship outside the obstacle, and handle simultaneous contacts without penetration.
- **REQ-24:** Stably spread massive asteroids through distant world regions rather than only around the starting center.
- **REQ-25:** Spawn newly recycled or region-generated world objects beyond the visible boundary, with additional clearance as ship speed increases.
- **REQ-26:** While the ship is thrusting, dampen the perpendicular and reverse components of its velocity at a tunable per-second rate, so motion across or against the thrust direction bleeds off while forward motion is retained.
- **REQ-33:** Give the ship a hit-points meter alongside air and fuel, and display it with them. Violent collisions—those whose impact speed exceeds 500—damage the ship. Collisions with massive asteroids inflict more damage than collisions with regular asteroids. The maximum damage a single collision can inflict is tuned so the ship just barely survives two full-speed impacts.
- **REQ-34:** Randomly and stably spread collectible repair containers throughout reached world regions—like the air and fuel containers—that restore the ship's hit-points when collected.
- **REQ-35:** After the ship takes damage, grant it 0.5 seconds of invulnerability so repeated contacts cannot drain hit-points instantly, and emit a large burst of particles at the impact point.
- **REQ-36:** When the ship's hit-points reach zero, destroy it with an explosion, show a Game Over screen, and start a new game when the player clicks.
- **REQ-37:** On PC, give the player directional thrust via the WASD keys: W thrusts forward along the ship's nose, S backward, A left, and D right. The keys combine into a single ship-axis thrust vector whose magnitude ramps up while held and decays when released, so thrust tapers smoothly on key release. The perpendicular and reverse velocity components are dampened relative to the active thrust direction per REQ-26, and fuel is consumed proportionally to the thrust level.
- **REQ-38:** Show visible thruster nozzles — tail, nose, port, and starboard — that emit fuel-amber exhaust particles (cooling to atmospheric dust per REQ-10/31) when their corresponding thrust direction is active.

## View Requirements

- **REQ-03:** Keep the player ship visually centered on the screen.
- **REQ-04:** Render the ship as a simple triangle.
- **REQ-05:** Support mouse, touch, and keyboard controls.
- **REQ-09:** Zoom the camera farther out as the ship moves faster.
- **REQ-10:** Emit world-space exhaust particles behind the ship, opposite its thrust direction. They carry a world-space velocity so they drift through the world rather than sitting still, despawn when they leave the visible range, and after their brief bright burn convert into ambient atmospheric dust (per REQ-31) rather than vanishing.
- **REQ-13:** Display visual particles when collisions occur.
- **REQ-15:** Display UI indicators showing the ship's collected air and fuel levels.
- **REQ-23:** Display a ship-centered scrolling minimap of camera-explored space, discovered air and fuel containers, and discovered massive asteroids represented by their irregular outlines.
- **REQ-27:** Provide a settings menu with sliders to tune the ship's lateral dampening rate, thrust power, and maximum speed at runtime.
- **REQ-28:** Persist the chosen control-tuning settings across page reloads through a storage adapter that abstracts where and how they are stored, and restore them when the settings menu initializes.
- **REQ-29:** Adapt the music to how violently the player drives: play calm tracks when the ship is idle, stationary, or making only small adjustments, medium tracks under more thrust and frequent thrust engagement, and action tracks under full speed combined with hard turning. A ship with no speed stays calm regardless of thrust or turning input, and turning without thrust does not affect the category. Derive a flight-intensity score from thrust, turning rate (counted only while thrusting), speed, acceleration, and thrust-engagement frequency with hysteresis so hovering near a threshold does not flicker, and enforce a minimum dwell window per category so switches cannot happen in rapid succession. The medium and action category thresholds are user-tunable at runtime. Crossfade tracks when the category changes, advance to the next track in a category when the current one ends, and resume a previously paused track from its remembered playback position when its category becomes active again.
- **REQ-30:** Provide persistent music settings in the settings menu — the music level and the medium/action category thresholds — restored on load and saved on change through the storage adapter.
- **REQ-31:** Maintain ambient atmospheric particles drifting through model space at random. They are spawned at random outside the visible range with a random speed directed inward into view, bounce visually off the ship, regular asteroids, and massive asteroids (bounding-circle broad phase, then outline-accurate against the irregular silhouette), are removed when they leave the visible range, and are replenished at random. Exhaust particles convert into them.
- **REQ-32:** Provide a persistent particle-visibility setting in the settings menu (a slider controlling the opacity of exhaust, collision, and atmospheric-dust particles), restored on load and saved on change through the storage adapter.

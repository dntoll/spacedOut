# Game Requirements

## Technical Requirements

- **REQ-01:** Build a small Canvas game using Vite and TypeScript.
- **REQ-19:** Maintain automated test coverage for every documented requirement.

## Domain Rules

- **REQ-02:** Simulate spaceship and asteroid physics.
- **REQ-06:** Turn the ship directly toward the current mouse or touch position.
- **REQ-07:** While the mouse or touch is pressed, accelerate the ship toward that position. The forward component of its existing velocity is preserved; the perpendicular and reverse components are dampened per REQ-26.
- **REQ-08:** Scale thrust with the distance between the ship and the pointer: nearby input produces little thrust, while distant input produces strong thrust.
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

## View Requirements

- **REQ-03:** Keep the player ship visually centered on the screen.
- **REQ-04:** Render the ship as a simple triangle.
- **REQ-05:** Support mouse and touch controls.
- **REQ-09:** Zoom the camera farther out as the ship moves faster.
- **REQ-10:** Emit world-space exhaust particles behind the ship, opposite its thrust direction.
- **REQ-13:** Display visual particles when collisions occur.
- **REQ-15:** Display UI indicators showing the ship's collected air and fuel levels.
- **REQ-23:** Display a ship-centered scrolling minimap of camera-explored space, discovered air and fuel containers, and discovered massive asteroids represented by their irregular outlines.
- **REQ-27:** Provide a settings menu with sliders to tune the ship's lateral dampening rate, thrust power, and maximum speed at runtime.

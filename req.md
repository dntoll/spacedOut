# Game Requirements

## Technical Requirements

- **REQ-01:** Build a small Canvas game using Vite and TypeScript.
- **REQ-19:** Maintain automated test coverage for every documented requirement.

## Domain Rules

- **REQ-02:** Simulate spaceship and asteroid physics.
- **REQ-06:** Turn the ship directly toward the current mouse or touch position.
- **REQ-07:** While the mouse or touch is pressed, accelerate the ship toward that position without discarding its existing velocity or direction of travel.
- **REQ-08:** Scale thrust with the distance between the ship and the pointer: nearby input produces little thrust, while distant input produces strong thrust.
- **REQ-11:** Populate the world with randomized asteroids.
- **REQ-12:** Allow the ship and asteroids to collide physically, transferring momentum in both directions and applying spin to asteroids.
- **REQ-14:** Randomly spread collectible air and fuel containers through the world.
- **REQ-16:** Reduce the ship's fuel while it is thrusting.
- **REQ-17:** Reduce the ship's air over time.
- **REQ-18:** Allow air and fuel containers to collide physically with asteroids.

## View Requirements

- **REQ-03:** Keep the player ship visually centered on the screen.
- **REQ-04:** Render the ship as a simple triangle.
- **REQ-05:** Support mouse and touch controls.
- **REQ-09:** Zoom the camera farther out as the ship moves faster.
- **REQ-10:** Emit world-space exhaust particles behind the ship, opposite its thrust direction.
- **REQ-13:** Display visual particles when collisions occur.
- **REQ-15:** Display UI indicators showing the ship's collected air and fuel levels.

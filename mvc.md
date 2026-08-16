# MVC Architecture Rules

- Divide code into `model`, `view`, and `controller` folders.
- Put each class in its own file.
- Use module namespaces such as `Model.Ship`, `View.Game`, and `Controller.Game`; do not repeat the namespace in class names with suffixes such as `ShipModel`.
- Use named classes to encapsulate state and behavior instead of plain object structures.
- Do not communicate actions or events with strings. Use explicit methods, typed objects, interfaces, or enums when appropriate.

## Model

- Keep the model limited to gameplay state and behavior that affects the simulation.
- Expose explicit action methods such as `startThrust()`, `stopThrust()`, and `setThrustTarget()`.
- Give collections dedicated owner classes. For example, `Model.AsteroidBelt` owns and manages its private asteroid array, including creation, updates, collisions, recycling, and iteration.
- Do not place purely visual state, such as exhaust or effect particles, in the model.
- Publish simulation events through typed observers. The model must not depend on the view.

## View

- Camera and input belong to the view.
- Abstract device and screen details from the controller. The view exposes model-space input through APIs such as `isPlayerThrusting` and `getThrustTarget()`.
- The view may maintain its own visual models and collections for stars, exhaust, collision particles, and other effects.
- Split rendering responsibilities into focused view classes instead of growing `View.Game`.
- Hide native Canvas and event-listener details behind a drawing/input API. View components should use drawing primitives rather than `CanvasRenderingContext2D` directly.
- The view may observe typed model events, such as collisions, to produce visual effects.

## Controller

- Keep the controller small. It coordinates model actions, model updates, and view rendering.
- The controller must not access Canvas, DOM events, pointer IDs, camera calculations, or model internals directly.

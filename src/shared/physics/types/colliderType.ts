export type ColliderType =
    "rigidbody" | // Bound to real-time physical interaction.
    "standalone" | // No physical constraints.
    "wallAttachment"; // No physical constraints, except that it is required to stay attached to a wall.
# ThingsPool

A web-based 3D sandbox multiplayer game powered by Node.js. No downloads, no installs — just open your browser and jump in.

**[Play Now](https://app.thingspool.net)**

## What is ThingsPool?

ThingsPool is a shared virtual space made up of interconnected **Rooms**. Each Room is a fully interactive 3D environment where you can:

- **Explore** — Travel across rooms and discover what others have built
- **Chat** — Meet and talk with other people in real time
- **Build** — Make your own room and turn it into anything you imagine
- **Customize** — Style your character from head to toe; give it a look of its own

## For Artists and Creators

ThingsPool doubles as a creative platform. Build your own virtual gallery, design an interactive installation, or craft an entire world that tells a story. Your room can either be a blank canvas waiting to be shaped into something unique, or a hidden place of adventure inviting to be explored.

## For Developers

ThingsPool is open source and built with a modern real-time web stack — Three.js for 3D rendering, Socket.IO for multiplayer networking, and a custom physics and voxel engine for world building. If you are building your own multiplayer game, metaverse, or interactive web app, feel free to explore the codebase.

## Documentation

- **Summary**
    - [Project Overview](CLAUDE.md)

- **DevOps**
    - [Local Development Guide](docs/devOps/local_dev.md)
    - VPS Hosting Guide
        - [Basic Setup](docs/devOps/vps/basic-setup.md)
        - [Networking & Security](docs/devOps/vps/networking-and-security.md)
        - [Deployment](docs/devOps/vps/deployment.md)
        - [Maintenance](docs/devOps/vps/maintenance.md)

- **Networking**
    - [Authentication Flows](docs/networking/authentication.md)
    - [User State Management Flows](docs/networking/user_state_management.md)
    - [Single-Player Mode](docs/networking/single_player_mode.md)
    - ["My Room" Flows](docs/networking/my_room.md)
    - [Voxel Grid Update Flows](docs/networking/voxel_grid_update.md)
    - [Object Update Flows](docs/networking/object_update.md)

- **Geometry**
    - [Texture](docs/geometry/texture.md)
    - [Wall-Attached Object](docs/geometry/wall_attached_object.md)
    - [Voxel Grid Structure](docs/geometry/voxel_grid.md)
    - [Physics System](docs/geometry/physics.md)
    - [Room Entrance Structure](docs/geometry/room_entrance.md)
    - [Room Generation System](docs/geometry/room_generation.md)
    - [Player Customization System](docs/geometry/player_customization.md)

- **Graphics**
    - [Camera Control](docs/graphics/camera_control.md)
    - [Instanced Mesh Composition System](docs/graphics/instanced_mesh_composition.md)

- **Testing**
    - E2E Tests
        - [Workflow](docs/testing/e2e/workflow.md)
    - Integration Tests
        - [Workflow](docs/testing/integration/workflow.md)
        - [Framework](docs/testing/integration/framework.md)
        - [Scenarios](docs/testing/integration/scenarios.md)
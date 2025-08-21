# Indianode Storage Starter

This pack contains:
- `docs/storage.md`: Website content describing Scratch NVMe, Dataset Cache add-ons, and the self-serve preload.
- `sdl/*.yaml`: Ready SDL templates for customers (200Gi, 500Gi, 1Ti GPU plans, and a storage-only 1Ti plan).
- `scripts/preload.sh`: A self-serve preload script to run *inside the container* that fills `/data` with common models/datasets.

## How to use
1. Publish `docs/storage.md` as a new page on your site (e.g., `/storage`).
2. Add links to the SDL files on that page or copy their contents inline.
3. Share `scripts/preload.sh` with renters so they can run it inside their containers.

No server changes are required on your 3090 host for any of the above.

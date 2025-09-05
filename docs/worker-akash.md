# Worker: Akash SDL Deployer (Example)

Your compute worker can poll for jobs and, when it sees `payload.kind === 'akash-sdl'`, it can:
1) Write `payload.sdl` to a temporary `deploy.yaml`
2) Use `akash` CLI to create a deployment (keys, certs, provider selection are up to you)
3) Update status via `/api/compute/progress` and `/api/compute/done` as you do for other compute jobs

Pseudo-steps:
```
POST /api/compute/pick  (with Authorization: Bearer <COMPUTE_PROVIDER_KEY>)
-> { ok: true, job: { id, sku, minutes, email, payload: { kind: 'akash-sdl', sdl, sdlName, sdlNotes } } }

# if payload.kind === 'akash-sdl':
write payload.sdl -> /tmp/deploy.yaml
akash tx deployment create /tmp/deploy.yaml --from <key> --node <rpc> --chain-id <id> ...
akash provider lease-status <lease-id> ...
POST /api/compute/progress { id, message: 'deployed', metadata: { leaseId, uri } }
POST /api/compute/done     { id, success: true }
```

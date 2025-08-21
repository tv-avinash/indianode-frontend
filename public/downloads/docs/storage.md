# Local NVMe Storage for Your Akash Lease

Speed up your jobs with **local NVMe** on the same host as your GPU. Perfect for model checkpoints, HuggingFace snapshots, and preprocessed data.

## Included Scratch (free)
- **Basic**: 50 Gi scratch included
- **Pro**: 200 Gi scratch included
- **Max**: 500 Gi scratch included

## Dataset Cache Add-on (persistent)
Choose how much persistent storage you want to attach to your lease:
- **200 Gi**
- **500 Gi**
- **1 TiB**

> Your dataset volume is mounted inside the container (path `/data`). Data is removed when the lease ends. Keep ~10–15% free space for safety.

## Self-serve Data Preload (one-time)
Pull popular models/datasets yourself into `/data` using a one-liner after your lease starts. Examples include Llama-2 7B, Mistral-7B, and more.

---

## How to Request Storage (Akash)
1. Pick your GPU plan and choose a dataset cache size (200 Gi / 500 Gi / 1 TiB).
2. Use one of our **SDL templates** below (or copy/paste from this page).
3. Deploy your app as usual.
4. After the lease starts, open a shell in your container and run our **Self-serve Preload** script to populate `/data`.

### SDL Templates
- GPU + **200 Gi** dataset cache → `sdl/app-200Gi.yaml`
- GPU + **500 Gi** dataset cache → `sdl/app-500Gi.yaml`
- GPU + **1 TiB** dataset cache → `sdl/app-1Ti.yaml`
- Storage-only (no GPU) **1 TiB** → `sdl/storage-only-1Ti.yaml`

---

## FAQ
**Will this slow down my GPU job?** No—storage is local NVMe.  
**Can I expand later?** Redeploy with a bigger storage request.  
**Where is my data?** On a persistent volume mounted at `/data` inside your deployment. Removed when the lease ends.

*Questions?* Reach out on your order email or the contact form.

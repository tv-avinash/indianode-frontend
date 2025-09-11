// pages/gpu-render-service.js
import Link from "next/link";
import SEO from "@/components/SEO";

export default function GpuRenderService() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "GPU for Rendering",
    provider: { "@type": "Organization", name: "Indianode", url: "https://www.indianode.com" },
    areaServed: "IN",
    serviceType: "GPU-accelerated rendering (video/image/3D)",
    offers: { "@type": "Offer", priceCurrency: "INR", price: "Varies" },
    url: "https://www.indianode.com/gpu-render-service"
  };

  return (
    <>
      <SEO
        title="GPU for Rendering – Fast Video/Image/3D Renders on RTX | Indianode"
        description="Accelerate video editing, image processing, and 3D rendering on RTX GPUs in India. Pay by the minute, scale on demand, and automate via SDL deployment."
        canonical="https://www.indianode.com/gpu-render-service"
        keywords="gpu for rendering, video rendering gpu india, blender gpu render, cloud gpu render"
        breadcrumbs={[{ name: "Home", url: "/" }, { name: "GPU for rendering", url: "/gpu-render-service" }]}
        schema={schema}
      />

      <main style={{ maxWidth: 880, margin: "0 auto", padding: "2rem 1rem" }}>
        <h1>GPU for Rendering</h1>
        <p>
          Accelerate your <strong>video encoding, image pipelines, and 3D scenes</strong> using dedicated RTX GPUs.
          For short tasks and automation, try{" "}
          <Link href="/compute-sdl" className="text-blue-600 underline">SDL deployment</Link>. If you also run AI/ML,
          see <Link href="/gpu-rental-india" className="text-blue-600 underline">GPU rental in India</Link> for training
          and inference workloads.
        </p>

        <h2>Common tools</h2>
        <ul>
          <li>FFmpeg (NVENC), HandBrake, custom CUDA pipelines</li>
          <li>Blender, Unreal, Unity (headless) for 3D renders</li>
          <li>Stable Diffusion and image upscalers for creative pipelines</li>
        </ul>

        <h2>Why Indianode</h2>
        <ul>
          <li>On-demand GPUs with <strong>pay-per-minute</strong> billing</li>
          <li>Fast local NVMe, good for frame caches and intermediates</li>
          <li>Automate jobs via{" "}
            <Link href="/compute-sdl" className="text-blue-600 underline">SDL deployment</Link> or simple tokens</li>
        </ul>

        <h2>Example SDL (batch render)</h2>
        <pre className="bg-gray-900 text-gray-100 rounded-xl p-3 text-xs overflow-x-auto">
{`version: "2.0"
services:
  render:
    image: linuxserver/ffmpeg
    command:
      - /bin/sh
      - -lc
      - |
        ffmpeg -hwaccel cuda -i input.mp4 -c:v h264_nvenc -preset p5 -b:v 6M output.mp4
    expose:
      - port: 8080
        as: 8080
        to:
          - global: true
profiles:
  compute:
    render:
      resources:
        cpu:
          units: 4
        memory:
          size: 8Gi
        gpu:
          units: 1
          attributes:
            vendor:
              nvidia:
                - "3090"
deployment:
  render:
    dcloud:
      profile: render
      count: 1`}
        </pre>

        <p className="mt-3">
          You can paste a variant of this into our{" "}
          <Link href="/compute-sdl" className="text-blue-600 underline">SDL deployment</Link> page and run it with a
          one-time token. For long jobs, compare costs on{" "}
          <Link href="/pricing" className="text-blue-600 underline">Pricing</Link>.
        </p>

        <h2>Tips</h2>
        <ul>
          <li>Prefer NVENC/AV1 for faster encodes with good quality.</li>
          <li>Batch scenes and reuse cached assets on NVMe.</li>
          <li>For concurrent renders, scale out replicas instead of one giant node.</li>
        </ul>

        <p className="mt-4">
          Questions?{" "}
          <Link href="/contact" className="text-blue-600 underline">Contact us</Link>.  
          Also explore{" "}
          <Link href="/llm-hosting" className="text-blue-600 underline">LLM hosting</Link> or{" "}
          <Link href="/whisper-gpu" className="text-blue-600 underline">Whisper on GPU</Link> for AI-enhanced media workflows.
        </p>
      </main>
    </>
  );
}

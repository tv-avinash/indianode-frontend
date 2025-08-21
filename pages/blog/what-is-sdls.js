import Head from "next/head";
import Link from "next/link";

export default function WhatIsSDLS() {
  return (
    <>
      <Head>
        <title>What is SDLS? When to use it on GPU providers | Indianode</title>
        <meta name="description" content="Plain-English intro to SDLS (Standard Development Lease Scripts), how they map to GPU workloads, and when to use them." />
        <link rel="canonical" href="https://www.indianode.com/blog/what-is-sdls" />
      </Head>
      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold mb-4">What is SDLS? When to use it on GPU providers</h1>
        <p className="mb-4">
          SDLS describes how to bring up a workload (image, ports, env) on rented compute like GPUs. It’s perfect for short, repeatable jobs like transcription, batch renders, or LLM endpoints.
        </p>
        <h2 className="text-xl font-semibold mt-6 mb-2">Why it helps</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>Repeatable deployments across providers</li>
          <li>Clear resource requests (vCPU, RAM, GPU)</li>
          <li>Faster spin-up for small tasks</li>
        </ul>
        <h2 className="text-xl font-semibold mt-6 mb-2">Typical SDLS for AI</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>Whisper ASR microservice</li>
          <li>Stable Diffusion batch renders</li>
          <li>LLM inference endpoints</li>
        </ul>
        <p className="mt-4">
          Ready to try SDLS on a 3090? See{" "}
          <Link className="text-blue-600 underline" href="/sdls">SDLS hosting</Link> or deploy{" "}
          <Link className="text-blue-600 underline" href="/whisper-gpu">Whisper on GPU</Link>.
        </p>
      </main>
    </>
  );
}

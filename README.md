<img src="public/favicon.svg" width="64" height="64" alt="">

# Frame Generation FPS calculator

A one-page calculator for how frame generation (DLSS, FSR, XeSS, Lossless Scaling and others) raises the
FPS you see and lowers the FPS your game renders. It runs entirely in the browser.

## Publish on GitHub Pages

1. Create an empty repository on GitHub.
2. In it, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push this repository to its `main` branch. The site appears at `https://<user>.github.io/<repo>/`
   once the "Deploy" workflow finishes.

Every push to `main` runs the tests, builds the site and publishes it
(`.github/workflows/deploy.yml`). The build uses relative paths, so it works at any address.

## Model

For multiplier M, with M = 1 meaning frame generation off and no overhead:

```
frame time      = 1000 / base FPS
overhead(M)     = shared + (M − 1) × per generated frame, or the value entered for M
real FPS        = 1000 / (frame time + overhead(M))
displayed FPS   = real FPS × M
```

The overhead is GPU time added to every rendered frame. The results are estimates: real implementations
can overlap that work with rendering or compete with it for the GPU. Displayed FPS is not capped to a
refresh rate.

The page takes the cost from one of three sources:

- **Measured data** loads a published measurement, chosen by technology, hardware and scenario.
- **Model** uses a shared cost per rendered frame plus a cost per generated frame.
- **Your numbers** takes a value for each of ×2 to ×5, in ms or as measured displayed FPS, converted with
  `overhead = M × 1000 / displayed FPS − 1000 / base FPS`.

With Measured data or Your numbers, "Use in model" fits the shared and per-frame costs to the values. With
only one value, it assumes the worst case, no shared work.

## Measured data

The 197 presets and their sources are in `src/presets.ts`. Official data comes first; an unofficial preset
is dropped when an official one covers the same case. Presets hold measured values only, and multipliers a
source doesn't report show "no data".

| Technology | Official sources | Unofficial sources |
|---|---|---|
| NVIDIA DLSS Frame Generation | [Streamline DLSS-G guide 2.14.16](https://github.com/NVIDIA-RTX/Streamline/blob/main/docs/ProgrammingGuideDLSS_G.md) (RTX 4090/5080/5090) | DLSSG for SM86 (RTX 3070/3080 Ti), ComputerBase, TechPowerUp, KitGuru, PurePC (RTX 4060 to 5080) |
| AMD FSR 3 Frame Generation | [FSR 3.1 overhead table](https://gpuopen.com/fidelityfx-super-resolution-3/) (RX 7900 XTX/6800 XT/5700 XT), [FSR 3 launch data](https://gpuopen.com/fsr3-in-games-technical-details/) | Tom's Hardware, ComputerBase, PCGH, TechPowerUp, Wccftech (RTX 2070 to 4090, RX 5700 XT to 9070 XT, Arc A770, Radeon 890M) |
| AMD FSR 4 Frame Generation | [FSR FG 4.0.2 manual](https://gpuopen.com/manuals/fsr_sdk/techniques/frame-interpolation-ml/) | PCGH (RX 9070 XT at 1440p) |
| Intel XeSS Frame Generation | none published | PCGH (Arc A770, ×2 to ×4), PurePC and ComputerBase (Arc B580), Notebookcheck (Arc 140T) |
| Apex Compute ANR | [Apex neural rendering page](https://apexcompute.com/neural-rendering) (RTX 5090, Apple M2 Max) | ANR test-kit results in the [apex-compute/ANR issues](https://github.com/apex-compute/ANR/issues) (Arc A770/B390, Radeon 780M/890M, RX 9070 XT, GTX 1650 mobile, Vega) |
| Lossless Scaling | [lsfg-vk 2.0.0 benchmark](https://lsfg-vk.dev/blog/release-v2.0.0/) (Radeon 680M, RTX 5080) | Decky-FrameGen-Hub (Radeon 890M), lsfg-vk discussions (RTX 3050 Laptop) |
| MAKO FG | [MAKO FG V1.24 model card](https://huggingface.co/eugeniosegala/MAKO-FG) (Steam Machine) | none |

"Effective" presets are worked out from FPS measured with frame generation off and on in the same scene, so
they include contention with the game, and choosing one sets base FPS to the measured value. No verified
measurement exists for the Steam Deck.

## Development

Requires Node.js 22.12 or later.

```sh
npm install
npm run dev      # local server
npm test         # unit tests
npm run build    # type check and build into dist/
```

The calculation is in `src/model.ts`, the fit in `src/fit.ts`, link parameters in `src/url.ts`, and the
page in `index.html`, `src/main.ts`, `src/chart.ts` and `src/style.css`.

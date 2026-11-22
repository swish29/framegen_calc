/**
 * Published Frame Generation measurements, converted to this calculator's overhead:
 * GPU time added per rendered frame for all frames generated from it.
 *
 * Presets hold measured values only. Multipliers a source does not report are null
 * ("no data"); nothing is interpolated or extrapolated here. Where a source reports time
 * per generated frame, the value is multiplied by the number of generated frames (M − 1),
 * and the conversion is written out below.
 *
 * Sources are either direct GPU timings of the FG passes ('gpu-time'), or effective overhead
 * worked out from FPS measured with FG off and on in the same scene ('effective'), using
 * overhead = M × 1000 / displayed FPS − 1000 / base FPS. Official data takes precedence:
 * an unofficial preset is dropped when an official one covers the same technology,
 * hardware, game, resolution and settings.
 */
import type { FgMultiplier, ManualOverhead } from './model';

/** Frame generation technologies, in menu order. */
export const TECHS = [
  { id: 'dlss', name: 'NVIDIA DLSS Frame Generation' },
  { id: 'fsr3', name: 'AMD FSR 3 Frame Generation' },
  { id: 'fsr4', name: 'AMD FSR 4 Frame Generation' },
  { id: 'xess', name: 'Intel XeSS Frame Generation' },
  { id: 'anr', name: 'Apex Compute ANR Frame Generation' },
  { id: 'lsfg', name: 'Lossless Scaling Frame Generation' },
  { id: 'mako', name: 'MAKO Frame Generation' },
] as const;
export type TechId = (typeof TECHS)[number]['id'];

export interface PresetSource {
  id: string;
  /** Short name shown in the scenario list when a preset has no game. */
  short: string;
  /** Full name shown in the note. */
  name: string;
  url: string;
  /** What the numbers measure and how they were converted. Shown under the selector. */
  note: string;
  /** Published by the developer of the FG technology. */
  official: boolean;
  kind: 'gpu-time' | 'effective';
}

/** Sentence appended to every preset note, by kind of measurement. */
export const KIND_NOTE: Record<PresetSource['kind'], string> = {
  'gpu-time': 'These are GPU execution times, not FPS costs measured in a game.',
  effective:
    'The calculator works these values out from FPS measured with frame generation off and on, as M × 1000 / displayed FPS − 1000 / FPS off. ' +
    'They include contention with the game.',
};

export interface Preset {
  id: string;
  sourceId: string;
  tech: TechId;
  /** GPU or device, e.g. "RTX 5080" or "Steam Deck OLED". */
  hardware: string;
  /** Game or test scene; omitted for vendor reference numbers. */
  game?: string;
  /** Output resolution, e.g. "1440p" or "1280×800". */
  resolution: string;
  /** Anything else that changes the cost: version, upscaler mode, power limit, mod settings. */
  settings?: string;
  /** Measured overhead per multiplier in ms per rendered frame; null where not measured. */
  overheadMs: ManualOverhead;
  /** FPS with FG off in the source's measurement. Choosing the preset sets base FPS to it. */
  baseFPS?: number;
  /** Link to this preset's data when it differs from the source's page (e.g. one GitHub issue). */
  url?: string;
}

export const SOURCES: PresetSource[] = [
  {
    id: 'nvidia',
    short: 'NVIDIA reference',
    name: 'NVIDIA Streamline DLSS-G programming guide 2.14.16',
    official: true,
    kind: 'gpu-time',
    url: 'https://github.com/NVIDIA-RTX/Streamline/blob/main/docs/ProgrammingGuideDLSS_G.md',
    note:
      'Execution cost from section 1.1. NVIDIA measured it in games and calls it a rough estimate. ' +
      'The guide does not say whether the 4x cost covers all three generated frames. The calculator assumes it does. ' +
      'The guide lists no ×3 or ×5 values.',
  },
  {
    id: 'amd-fsr4',
    short: 'AMD reference',
    name: 'AMD FSR Frame Generation 4.0.2 manual',
    official: true,
    kind: 'gpu-time',
    url: 'https://gpuopen.com/manuals/fsr_sdk/techniques/frame-interpolation-ml/',
    note:
      'Reference time, one value per GPU at its recommended resolution. AMD gives no test conditions. ' +
      'FSR Frame Generation generates one frame per rendered frame, so only ×2 has a value.',
  },
  {
    id: 'amd-fsr31',
    short: 'AMD reference',
    name: 'AMD FSR 3 page, "AMD FSR 3 performance overhead", FSR 3.1',
    official: true,
    kind: 'gpu-time',
    url: 'https://gpuopen.com/fidelityfx-super-resolution-3/',
    note:
      'AMD measured it in the FidelityFX SDK sample with PIX, async compute off, and calls it an estimate, rounded up. ' +
      'The value rises with the upscaling quality mode, and AMD does not say whether it includes the upscaling time listed next to it. ' +
      'FSR 3 generates one frame per rendered frame, so only ×2 has a value.',
  },
  {
    id: 'lsfg-vk-blog',
    short: 'lsfg-vk benchmark',
    name: 'lsfg-vk 2.0.0 release notes',
    official: true,
    kind: 'gpu-time',
    url: 'https://lsfg-vk.dev/blog/release-v2.0.0/',
    note:
      "From the lsfg-vk project's own CLI benchmark with no game running, so a game adds contention on top. " +
      'Time per real frame, flow 100 %, performance mode off. The Radeon 680M has the same RDNA 2 architecture as the Steam Deck ' +
      'with more compute units, so a Steam Deck is likely slower.',
  },
  {
    id: 'sm86-synthetic',
    short: 'Synthetic scene',
    name: 'DLSSG for SM86 README, synthetic scene',
    official: false,
    kind: 'gpu-time',
    url: 'https://github.com/sdli1995/dlssg_for_sm86/blob/main/README.en.md#performance',
    note:
      'DLSS Frame Generation on RTX 30 through the DLSSG for SM86 proxy. GPU time of the whole generation group per real frame, ' +
      'driver 610.88, GPU at 1950 MHz. This is the same quantity the calculator uses as overhead. ' +
      'Tier 1 is the bit-identical kernel optimization and the current factory default. Tier 0 is the stock kernels.',
  },
  {
    id: 'sm86-games',
    short: 'Game replay',
    name: 'DLSSG for SM86 README, game replays',
    official: false,
    kind: 'gpu-time',
    url: 'https://github.com/sdli1995/dlssg_for_sm86/blob/main/README.en.md#performance',
    note:
      'DLSS Frame Generation on RTX 30 through the DLSSG for SM86 proxy. Offline replays of recorded game input with the 0.4.0 factory settings. ' +
      'The README gives GPU time per generated frame. The calculator multiplies the ×4 value by 3 to get the time per rendered frame. ' +
      'The RTX 3080 Ti ran at 1665 MHz in these tests.',
  },
  {
    id: 'pcgh-a770',
    short: 'PCGH',
    name: 'PC Games Hardware, Multi Frame Generation test, February 2026',
    official: false,
    kind: 'effective',
    url: 'https://www.pcgameshardware.de/Arc-B580-Grafikkarte-280998/Specials/Multi-Frame-Generation-Test-MFG-Intel-Arc-XeSS-Latenz-1503950/',
    note:
      'Arc A770 16 GB, driver 8509, XeSS Quality, Ryzen 7 9800X3D, average FPS from CapFrameX. ×3 and ×4 use the driver override. ' +
      'PCGH does not say whether XeLL was on in the FG-off runs.',
  },
  {
    id: 'toms-avatar',
    short: "Tom's Hardware",
    name: "Tom's Hardware, FSR 3 in Avatar: Frontiers of Pandora, December 2023",
    official: false,
    kind: 'effective',
    url: 'https://www.tomshardware.com/pc-components/gpus/testing-gpus-with-amd-fsr3-and-avatar-frontiers-of-pandora-16-graphics-cards-and-hundreds-of-benchmarks',
    note:
      'FSR 3.0. Built-in benchmark, Ultra, FSR 3 Quality, FrameView, Core i9-13900K. ' +
      'The Arc A770 at 4K likely runs short of memory or bandwidth, so that value is more than the FG cost alone.',
  },
  {
    id: 'wccftech-890m',
    short: 'Wccftech',
    name: 'Wccftech, OneXPlayer X1 Pro review, February 2025',
    official: false,
    kind: 'effective',
    url: 'https://wccftech.com/review/onexplayer-x1-pro-3-in-1-amd-ryzen-ai-9-hx-370-gaming-handheld/',
    note:
      'Ryzen AI 9 HX 370 at 30 W, Medium, FSR Balanced.',
  },
  {
    id: 'amd-fsr3-launch',
    short: 'AMD launch data',
    name: 'AMD GPUOpen, "AMD FSR 3 game integrations out now", September 2023',
    official: true,
    kind: 'effective',
    url: 'https://gpuopen.com/fsr3-in-games-technical-details/',
    note:
      'FSR 3.0 at launch. Ryzen 9 7950X3D, ray tracing on, FSR 3 Performance. AMD lists FPS without and with frame generation.',
  },
  {
    id: 'pcgh-redstone',
    short: 'PCGH',
    name: 'PC Games Hardware, FSR Redstone test, December 2025',
    official: false,
    kind: 'effective',
    url: 'https://www.pcgameshardware.de/AMD-Radeon-Grafikkarte-255597/Specials/FSR-Redstone-Release-Test-AMD-RDNA-2-3-vs-DLSS-4-1488644/2/',
    note:
      'RX 9070 XT, driver 25.12.1, Ryzen 7 9800X3D, FPS from PCGH benchmark data. The same runs compare FSR 4 ML frame generation and FSR 3.1 frame generation. ' +
      'PCGH warns that Cyberpunk 2077 2.3 has poor frame pacing on Radeon.',
  },
  {
    id: 'cb-redstone',
    short: 'ComputerBase',
    name: 'ComputerBase, AMD FSR Redstone Frame Generation test, December 2025',
    official: false,
    kind: 'effective',
    url: 'https://www.computerbase.de/artikel/grafikkarten/amd-fsr-redstone-frame-generation.95385/seite-3',
    note:
      'RX 9070 XT at 4K with FSR 3.1 frame generation. The CPU is not stated.',
  },
  {
    id: 'cb-fg-2024',
    short: 'ComputerBase',
    name: 'ComputerBase, frame generation from AMD and NVIDIA compared, March 2024',
    official: false,
    kind: 'effective',
    url: 'https://www.computerbase.de/artikel/grafikkarten/amd-fsr-nvidia-dlss-frame-generation-vergleich.86978/',
    note:
      'FSR 3 frame generation in game builds of early 2024, 4K, FSR upscaling in both runs. The CPU is not stated.',
  },
  {
    id: 'pcgh-fsr3-2023',
    short: 'PCGH',
    name: 'PC Games Hardware, FSR 3 in practice, October 2023',
    official: false,
    kind: 'effective',
    url: 'https://www.pcgameshardware.de/FidelityFX-Super-Resolution-Software-277617/Specials/AMD-Fluid-Motion-Frames-Frame-Generation-Radeon-Hands-on-Preview-1431894/2/',
    note:
      'FSR 3.0 in Forspoken 1.22, Core i9-12900K, FPS from PCGH benchmark data. PCGH notes its tools record frame times before FSR 3 frame pacing.',
  },
  {
    id: 'toms-stalker2',
    short: "Tom's Hardware",
    name: "Tom's Hardware, Stalker 2 PC performance testing, November 2024",
    official: false,
    kind: 'effective',
    url: 'https://www.tomshardware.com/video-games/pc-gaming/stalker-2-pc-performance-testing-and-settings-analysis',
    note:
      'FSR 3.1 frame generation, 1440p Epic, Quality upscaling in both runs, Core i9-13900K. NVIDIA cards use DLSS upscaling and Arc uses XeSS upscaling with FSR frame generation. ' +
      'Most values are read from chart images. The game is CPU-limited near 85 FPS without frame generation; these GPUs are below that.',
  },
  {
    id: 'anr-kit',
    short: 'ANR test kit',
    name: 'ANR frame generation test kit results posted in the apex-compute/ANR GitHub issues',
    official: false,
    kind: 'gpu-time',
    url: 'https://github.com/apex-compute/ANR/issues',
    note:
      'Offline kit: the ANR model runs on 64 recorded frames after 8 warm-ups, with no game running. ' +
      'Values are the kit\'s frame_ms median. The kit does not define it; it grows with the multiplier, so the calculator reads it as ' +
      'the total per rendered frame. The settings name the kit path when the poster chose a non-default one.',
  },
  {
    id: 'lsfg-vk-community',
    short: 'lsfg-vk benchmark',
    name: 'lsfg-vk CLI benchmark posted in the lsfg-vk GitHub discussions',
    official: false,
    kind: 'gpu-time',
    url: 'https://github.com/PancakeTAS/lsfg-vk/discussions/558',
    note:
      'lsfg-vk 2.0 CLI benchmark with default settings, no game running. Time per real frame. ' +
      'The default flow scale is not printed in the output.',
  },
  {
    id: 'mako-card',
    short: 'MAKO model card',
    name: 'MAKO FG V1.24 model card',
    official: true,
    kind: 'gpu-time',
    url: 'https://huggingface.co/eugeniosegala/MAKO-FG',
    note:
      'MAKO is an open-source Linux frame generation layer derived from lsfg-vk; MAKO FG is its own model. ' +
      'Complete GPU time per real frame including all generated frames, measured offline on the Steam Machine GPU ' +
      'in 3 runs of 500 pairs after 1,000 warm-ups. The card says it is not a live-game benchmark. ' +
      'The modes differ in how often motion is solved, so their means hide spikes.',
  },
  {
    id: 'tpu-forspoken',
    short: 'TechPowerUp',
    name: 'TechPowerUp, Forspoken FSR 3 review, October 2023',
    official: false,
    kind: 'effective',
    url: 'https://www.techpowerup.com/review/forspoken-fsr-3/',
    note:
      'FSR 3.0 at launch, RTX 3080, Ultra High, ray tracing off, FSR 3 Quality in both runs. One static scene; the capture tool and CPU are not stated. ' +
      'The 1080p result is left out because it is near the CPU limit.',
  },
  {
    id: 'cb-rtx50',
    short: 'ComputerBase',
    name: 'ComputerBase, GeForce RTX 50 reviews and MFG tests, 2025 and 2026',
    official: false,
    kind: 'effective',
    url: 'https://www.computerbase.de/artikel/grafikkarten/nvidia-geforce-rtx-5060-ti-16-gb-test.92119/seite-6',
    note:
      'Ryzen 7 9800X3D, average FPS from HTML charts, DLSS upscaling in all runs.',
  },
  {
    id: 'tpu-rtx50',
    short: 'TechPowerUp',
    name: 'TechPowerUp, GeForce RTX 4060 / 5060 Ti / 5070 reviews, DLSS frame generation pages',
    official: false,
    kind: 'effective',
    url: 'https://www.techpowerup.com/review/palit-geforce-rtx-5060-ti-infinity-3-16-gb/38.html',
    note:
      'Native rendering without upscaling in both runs, maximum settings. Ryzen 7 9800X3D (RTX 50 reviews) or Core i9-13900K (RTX 4060 review). ' +
      'FPS are whole numbers, some read from chart images.',
  },
  {
    id: 'kitguru-5060ti',
    short: 'KitGuru',
    name: 'KitGuru, GeForce RTX 5060 Ti 16 GB review, DLSS testing, April 2025',
    official: false,
    kind: 'effective',
    url: 'https://www.kitguru.net/components/graphic-cards/dominic-moass/nvidia-rtx-5060-ti-16gb-review-ft-gigabyte-palit/28/',
    note:
      'Ryzen 7 9800X3D, DLSS Quality upscaling in all runs, values read from chart images.',
  },
  {
    id: 'purepc-dmfg',
    short: 'PurePC',
    name: 'PurePC, NVIDIA Dynamic Multi Frame Generation test, March 2026',
    official: false,
    kind: 'effective',
    url: 'https://www.purepc.pl/nvidia-dynamic-multi-frame-generation-test-opinia-recenzja',
    note:
      'Fixed DLSS 4.5 multi frame generation without upscaling, Cyberpunk 2077 Ultra with RT Ultra, uncapped. The CPU is not stated. ' +
      'The source also has ×6, which the calculator does not model.',
  },
  {
    id: 'cb-b580',
    short: 'ComputerBase',
    name: 'ComputerBase, Arc B580 Limited Edition test, December 2024',
    official: false,
    kind: 'effective',
    url: 'https://www.computerbase.de/artikel/grafikkarten/intel-arc-b580-limited-edition-test.90585/seite-9',
    note:
      'XeSS 2 frame generation in F1 24 with ray tracing, native resolution in both runs, Ryzen 7 9800X3D.',
  },
  {
    id: 'purepc-b580',
    short: 'PurePC',
    name: 'PurePC, Intel XeSS Multi Frame Generation on Arc B580, May 2026',
    official: false,
    kind: 'effective',
    url: 'https://www.purepc.pl/test-intel-xess-multi-frame-generation-arc-b580-recenzja-opinia',
    note:
      'XeSS 3 frame generation, Core i9-12900K, XeSS upscaling in all runs, FPS truncated to whole numbers. ' +
      'Latency falls with FG on, so XeLL may only be active with FG, which would make the cost look smaller.',
  },
  {
    id: 'nbc-140t',
    short: 'Notebookcheck',
    name: 'Notebookcheck, Intel Arc Graphics 140T analysis, February 2025',
    official: false,
    kind: 'effective',
    url: 'https://www.notebookcheck.net/Intel-Arc-Graphics-140T-analysis-Arrow-Lake-H-iGPU-gains-frame-generation-support.960242.0.html',
    note:
      "XeSS 2 frame generation in F1 24 at native resolution, Core Ultra 9 285H. The article doesn't say which of its test laptops ran it, so the power limit is 24 W or 45 W.",
  },
  {
    id: 'decky-fg-hub',
    short: 'Decky-FrameGen-Hub',
    name: 'Decky-FrameGen-Hub README',
    official: false,
    kind: 'gpu-time',
    url: 'https://github.com/davnozdu/Decky-FrameGen-Hub',
    note:
      'Timing reported by the plugin developer on a ROG Xbox Ally X, whose GPU the page lists as a Radeon 890M. ' +
      'Milliseconds per real frame at ×2. The method, power limit and lsfg-vk version are not stated.',
  },
  {
    id: 'apex',
    short: 'Apex Compute',
    name: 'Apex Compute neural rendering page',
    official: true,
    kind: 'gpu-time',
    url: 'https://apexcompute.com/neural-rendering',
    note:
      'Values published by Apex Compute without test conditions. The page gives time per generated frame, and a mean for 4X. ' +
      'The calculator multiplies the ×4 mean by 3. The Apple M2 Max values come from the native Metal beta.',
  },
];

/**
 * Effective overhead from a measured FPS pair at multiplier M:
 * M × 1000 / displayed FPS − 1000 / FPS with FG off.
 */
const eff = (m: number, displayedFPS: number, baseFPS: number): number => (m * 1000) / displayedFPS - 1000 / baseFPS;

const v = (x2: number | null, x3: number | null = null, x4: number | null = null, x5: number | null = null): ManualOverhead => ({
  2: x2,
  3: x3,
  4: x4,
  5: x5,
});

/** Stable id from the fields that identify a preset, used in shared links. */
const slug = (...parts: string[]) =>
  parts
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Preset from one FPS pair at ×2 (FG off → displayed with FG). Base FPS is set to the FG-off value. */
const pair = (
  sourceId: string,
  tech: TechId,
  hardware: string,
  game: string,
  resolution: string,
  settings: string,
  off: number,
  on: number,
): Preset => ({
  id: slug(sourceId, tech, hardware, game, resolution, settings),
  sourceId,
  tech,
  hardware,
  game,
  resolution,
  settings,
  baseFPS: off,
  overheadMs: v(eff(2, on, off)),
});

/**
 * Preset from an FPS ladder: FG off, then displayed FPS at ×2, ×3, ×4, ×5 (as many as measured).
 * Base FPS is set to the FG-off value.
 */
const ladder = (
  sourceId: string,
  tech: TechId,
  hardware: string,
  game: string,
  resolution: string,
  settings: string,
  off: number,
  displayed: number[],
  url?: string,
): Preset => {
  const at = (m: number) => (displayed[m - 2] === undefined ? null : eff(m, displayed[m - 2]!, off));
  return {
    id: slug(sourceId, tech, hardware, game, resolution, settings),
    sourceId,
    tech,
    hardware,
    game,
    resolution,
    settings,
    baseFPS: off,
    overheadMs: v(at(2), at(3), at(4), at(5)),
    ...(url ? { url } : {}),
  };
};

const fsr31 = (gpu: string, id: string, rows: Record<'4K' | '1440p' | '1080p', [number, number, number]>): Preset[] =>
  (Object.entries(rows) as ['4K' | '1440p' | '1080p', [number, number, number]][]).flatMap(([res, vals]) =>
    (['Native AA', 'Quality', 'Performance'] as const).map((mode, i) => ({
      id: `fsr31-${id}-${res.toLowerCase()}-${mode.toLowerCase().replace(' ', '')}`,
      sourceId: 'amd-fsr31',
      tech: 'fsr3' as const,
      hardware: gpu,
      resolution: res,
      settings: `FSR 3.1, ${mode}`,
      overheadMs: v(vals[i]!),
    })),
  );

const pcgh = (id: string, game: string, off: number, x2: number, x3: number, x4: number): Preset => ({
  id: `pcgh-a770-${id}`,
  sourceId: 'pcgh-a770',
  tech: 'xess',
  hardware: 'Arc A770',
  game,
  resolution: '1440p',
  settings: 'XeSS 3, XeSS Quality',
  baseFPS: off,
  overheadMs: v(eff(2, x2, off), eff(3, x3, off), eff(4, x4, off)),
});

export const PRESETS: Preset[] = [
  // NVIDIA Streamline, "Execution Cost" table: 2x and 4x cost (ms).
  { id: 'nv-4090-1080p', sourceId: 'nvidia', tech: 'dlss', hardware: 'RTX 4090', resolution: '1080p', overheadMs: v(1.35) },
  { id: 'nv-4090-1440p', sourceId: 'nvidia', tech: 'dlss', hardware: 'RTX 4090', resolution: '1440p', overheadMs: v(1.78) },
  { id: 'nv-4090-4k', sourceId: 'nvidia', tech: 'dlss', hardware: 'RTX 4090', resolution: '4K', overheadMs: v(2.77) },
  { id: 'nv-5080-1080p', sourceId: 'nvidia', tech: 'dlss', hardware: 'RTX 5080', resolution: '1080p', overheadMs: v(1.45, null, 2.43) },
  { id: 'nv-5080-1440p', sourceId: 'nvidia', tech: 'dlss', hardware: 'RTX 5080', resolution: '1440p', overheadMs: v(2.04, null, 3.61) },
  { id: 'nv-5080-4k', sourceId: 'nvidia', tech: 'dlss', hardware: 'RTX 5080', resolution: '4K', overheadMs: v(2.84, null, 5.25) },
  { id: 'nv-5090-1080p', sourceId: 'nvidia', tech: 'dlss', hardware: 'RTX 5090', resolution: '1080p', overheadMs: v(1.07, null, 1.78) },
  { id: 'nv-5090-1440p', sourceId: 'nvidia', tech: 'dlss', hardware: 'RTX 5090', resolution: '1440p', overheadMs: v(1.46, null, 2.48) },
  { id: 'nv-5090-4k', sourceId: 'nvidia', tech: 'dlss', hardware: 'RTX 5090', resolution: '4K', overheadMs: v(1.72, null, 3.32) },

  // DLSSG for SM86: whole generation group per real frame, synthetic scene, RTX 3080 Ti.
  ...(
    [
      ['1080p', 'tier 1', 't1', [0.926, 1.423, 1.914, 2.411]],
      ['1440p', 'tier 1', 't1', [1.459, 2.238, 3.008, 3.786]],
      ['4K', 'tier 1', 't1', [1.901, 3.002, 4.106, 5.212]],
      ['1080p', 'tier 0, stock kernels', 't0', [1.364, 1.942, 2.52, 3.089]],
      ['1440p', 'tier 0, stock kernels', 't0', [2.094, 3.03, 3.963, 4.9]],
      ['4K', 'tier 0, stock kernels', 't0', [2.472, 3.792, 5.112, 6.437]],
    ] as const
  ).map(
    ([res, tier, tid, [a, b, c, d]]): Preset => ({
      id: `sm86-${tid}-${res.toLowerCase()}`,
      sourceId: 'sm86-synthetic',
      tech: 'dlss',
      hardware: 'RTX 3080 Ti',
      resolution: res,
      settings: `DLSSG for SM86, ${tier}`,
      overheadMs: v(a, b, c, d),
    }),
  ),

  // DLSSG for SM86, offline game replays, "DLSS default". 2X: ms per generated frame (= per rendered frame).
  // 4X: ms per generated frame × 3 generated frames.
  { id: 'sm86-3080ti-cp-4k', sourceId: 'sm86-games', tech: 'dlss', hardware: 'RTX 3080 Ti', game: 'Cyberpunk 2077', resolution: '4K', settings: 'DLSSG for SM86', overheadMs: v(2.171, null, 3 * 1.567) },
  { id: 'sm86-3080ti-wk-4k', sourceId: 'sm86-games', tech: 'dlss', hardware: 'RTX 3080 Ti', game: 'Black Myth: Wukong', resolution: '4K', settings: 'DLSSG for SM86', overheadMs: v(2.275, null, 3 * 1.666) },
  { id: 'sm86-3080ti-cp-1440p', sourceId: 'sm86-games', tech: 'dlss', hardware: 'RTX 3080 Ti', game: 'Cyberpunk 2077', resolution: '1440p', settings: 'DLSSG for SM86', overheadMs: v(1.651) },
  { id: 'sm86-3070-cp-4k', sourceId: 'sm86-games', tech: 'dlss', hardware: 'RTX 3070', game: 'Cyberpunk 2077', resolution: '4K', settings: 'DLSSG for SM86', overheadMs: v(3.557, null, 3 * 2.532) },
  { id: 'sm86-3070-wk-4k', sourceId: 'sm86-games', tech: 'dlss', hardware: 'RTX 3070', game: 'Black Myth: Wukong', resolution: '4K', settings: 'DLSSG for SM86', overheadMs: v(3.756, null, 3 * 2.733) },
  { id: 'sm86-3070-cp-1440p', sourceId: 'sm86-games', tech: 'dlss', hardware: 'RTX 3070', game: 'Cyberpunk 2077', resolution: '1440p', settings: 'DLSSG for SM86', overheadMs: v(2.554) },

  // AMD FSR 3.1 "Frame Generation (ms, up to)" by output resolution and upscaling mode.
  ...fsr31('RX 7900 XTX', '7900xtx', { '4K': [2.4, 1.7, 1.5], '1440p': [1.0, 0.9, 0.7], '1080p': [0.7, 0.6, 0.5] }),
  ...fsr31('RX 6800 XT', '6800xt', { '4K': [3.8, 2.4, 2.1], '1440p': [1.6, 1.3, 1.0], '1080p': [1.0, 0.9, 0.7] }),
  ...fsr31('RX 5700 XT', '5700xt', { '4K': [7.3, 5.0, 4.5], '1440p': [3.3, 2.4, 2.1], '1080p': [2.1, 1.6, 1.4] }),

  // Tom's Hardware, Avatar, FSR 3.0 FG ×2: FPS with FG off, displayed FPS.
  { id: 'toms-avatar-3080-1440p', sourceId: 'toms-avatar', tech: 'fsr3', hardware: 'RTX 3080', game: 'Avatar: Frontiers of Pandora', resolution: '1440p', settings: 'FSR 3.0, Quality', baseFPS: 76.9, overheadMs: v(eff(2, 122.6, 76.9)) },
  { id: 'toms-avatar-3080-4k', sourceId: 'toms-avatar', tech: 'fsr3', hardware: 'RTX 3080', game: 'Avatar: Frontiers of Pandora', resolution: '4K', settings: 'FSR 3.0, Quality', baseFPS: 47.1, overheadMs: v(eff(2, 79.2, 47.1)) },
  { id: 'toms-avatar-a770-1440p', sourceId: 'toms-avatar', tech: 'fsr3', hardware: 'Arc A770', game: 'Avatar: Frontiers of Pandora', resolution: '1440p', settings: 'FSR 3.0, Quality', baseFPS: 37.2, overheadMs: v(eff(2, 65.8, 37.2)) },
  { id: 'toms-avatar-a770-4k', sourceId: 'toms-avatar', tech: 'fsr3', hardware: 'Arc A770', game: 'Avatar: Frontiers of Pandora', resolution: '4K', settings: 'FSR 3.0, Quality', baseFPS: 23.9, overheadMs: v(eff(2, 39.3, 23.9)) },

  // Wccftech, Radeon 890M at 30 W, Cyberpunk 2077: 46.75 FPS off, 76.30 FPS with FG.
  { id: 'wccftech-890m-cp', sourceId: 'wccftech-890m', tech: 'fsr3', hardware: 'Radeon 890M', game: 'Cyberpunk 2077', resolution: '1200p', settings: 'FSR Balanced, 30 W', baseFPS: 46.75, overheadMs: v(eff(2, 76.3, 46.75)) },

  // DLSS frame generation, reviewer FPS ladders: FG off, then ×2, ×3, ×4 (and ×5).
  ladder('cb-rtx50', 'dlss', 'RTX 5060', 'Doom: The Dark Ages', '1080p', 'DLSS Quality', 78.0, [123.3, 172.9, 213.0], 'https://www.computerbase.de/artikel/grafikkarten/nvidia-geforce-rtx-5060-test.92811/seite-6'),
  ladder('cb-rtx50', 'dlss', 'RTX 5060 Ti 16 GB', 'Alan Wake 2', '1440p', 'DLSS Performance, path tracing', 32.8, [58.8, 84.1, 106.8]),
  ladder('cb-rtx50', 'dlss', 'RTX 5060 Ti 16 GB', 'Indiana Jones and the Great Circle', '1440p', 'DLSS Performance, RT', 35.4, [61.6, 85.3, 104.5]),
  ladder('cb-rtx50', 'dlss', 'RTX 5060 Ti 16 GB', 'Star Wars Outlaws', '1440p', 'DLSS Performance', 55.1, [89.9, 126.7, 157.7]),
  ladder('cb-rtx50', 'dlss', 'RTX 4060 Ti 8 GB', 'Alan Wake 2', '1440p', 'DLSS Performance, path tracing', 28.5, [51.6]),
  ladder('cb-rtx50', 'dlss', 'RTX 4060 Ti 8 GB', 'Star Wars Outlaws', '1440p', 'DLSS Performance', 50.7, [83.3]),
  ladder('cb-rtx50', 'dlss', 'RTX 5070 Ti', 'Cyberpunk 2077', '3440×1440', 'DLSS, path tracing', 65.2, [109.2, 154.9, 194.1], 'https://www.computerbase.de/artikel/grafikkarten/nvidia-geforce-rtx-5070-ti-test.91379/seite-7'),
  ladder('cb-rtx50', 'dlss', 'RTX 5070 Ti', 'Alan Wake 2', '3440×1440', 'DLSS, path tracing', 48.0, [85.2, 121.2, 155.4], 'https://www.computerbase.de/artikel/grafikkarten/nvidia-geforce-rtx-5070-ti-test.91379/seite-7'),
  ladder('cb-rtx50', 'dlss', 'RTX 4070 Ti Super', 'Cyberpunk 2077', '3440×1440', 'DLSS, path tracing', 61.2, [101.7], 'https://www.computerbase.de/artikel/grafikkarten/nvidia-geforce-rtx-5070-ti-test.91379/seite-7'),
  ladder('cb-rtx50', 'dlss', 'RTX 4070 Ti Super', 'Alan Wake 2', '3440×1440', 'DLSS, path tracing', 44.0, [77.4], 'https://www.computerbase.de/artikel/grafikkarten/nvidia-geforce-rtx-5070-ti-test.91379/seite-7'),
  ladder('cb-rtx50', 'dlss', 'RTX 5080', 'Cyberpunk 2077', '4K', 'DLSS 4.5, Performance, path tracing', 57.0, [97.7, 138.8, 175.6, 211.6], 'https://www.computerbase.de/artikel/grafikkarten/dlss-multi-frame-generation-6x-dynamic-dlss-test.96721/seite-2'),
  ladder('cb-rtx50', 'dlss', 'RTX 5080', 'Hogwarts Legacy', '4K', 'DLSS 4.5, Balanced, RT', 58.9, [99.1, 142.8, 179.2, 210.6], 'https://www.computerbase.de/artikel/grafikkarten/dlss-multi-frame-generation-6x-dynamic-dlss-test.96721/seite-2'),

  ladder('tpu-rtx50', 'dlss', 'RTX 5060 Ti 16 GB', 'Cyberpunk 2077', '1440p', 'Native, RT', 34, [57, 82, 103]),
  ladder('tpu-rtx50', 'dlss', 'RTX 4070', 'Cyberpunk 2077', '1440p', 'Native, RT', 41, [73]),
  ladder('tpu-rtx50', 'dlss', 'RTX 5070', 'Alan Wake 2', '1440p', 'Native, path tracing', 33, [61, 88, 114], 'https://www.techpowerup.com/review/nvidia-geforce-rtx-5070-founders-edition/39.html'),
  ladder('tpu-rtx50', 'dlss', 'RTX 5070', 'Hogwarts Legacy', '1440p', 'Native, RT', 56, [98, 136, 174], 'https://www.techpowerup.com/review/nvidia-geforce-rtx-5070-founders-edition/39.html'),
  ladder('tpu-rtx50', 'dlss', 'RTX 5070', 'Star Wars Outlaws', '1440p', 'Native, RT', 46, [75, 106, 130], 'https://www.techpowerup.com/review/nvidia-geforce-rtx-5070-founders-edition/39.html'),
  ladder('tpu-rtx50', 'dlss', 'RTX 4070 Ti', 'Alan Wake 2', '1440p', 'Native, path tracing', 39, [71], 'https://www.techpowerup.com/review/nvidia-geforce-rtx-5070-founders-edition/39.html'),
  ladder('tpu-rtx50', 'dlss', 'RTX 4070 Ti', 'Hogwarts Legacy', '1440p', 'Native, RT', 61, [104], 'https://www.techpowerup.com/review/nvidia-geforce-rtx-5070-founders-edition/39.html'),
  ladder('tpu-rtx50', 'dlss', 'RTX 4070 Ti', 'Star Wars Outlaws', '1440p', 'Native, RT', 51, [85], 'https://www.techpowerup.com/review/nvidia-geforce-rtx-5070-founders-edition/39.html'),
  ladder('tpu-rtx50', 'dlss', 'RTX 4060', 'Cyberpunk 2077', '1080p', 'DLSS 3, Native', 64, [104], 'https://www.techpowerup.com/review/msi-geforce-rtx-4060-gaming-x/35.html'),
  ladder('tpu-rtx50', 'dlss', 'RTX 4060', 'A Plague Tale: Requiem', '1080p', 'DLSS 3, Native', 54, [89], 'https://www.techpowerup.com/review/msi-geforce-rtx-4060-gaming-x/35.html'),
  ladder('tpu-rtx50', 'dlss', 'RTX 4060', 'Hogwarts Legacy', '1080p', 'DLSS 3, Native', 49, [83], 'https://www.techpowerup.com/review/msi-geforce-rtx-4060-gaming-x/35.html'),

  ladder('kitguru-5060ti', 'dlss', 'RTX 5060 Ti 16 GB', 'Cyberpunk 2077', '1080p', 'DLSS Quality, path tracing', 50.3, [90.4, 130.4, 165.8]),
  ladder('kitguru-5060ti', 'dlss', 'RTX 5060 Ti 16 GB', 'Cyberpunk 2077', '1440p', 'DLSS Quality, path tracing', 31.8, [56.1, 79.9, 101.9]),
  ladder('kitguru-5060ti', 'dlss', 'RTX 5060 Ti 16 GB', 'Alan Wake 2', '1080p', 'DLSS Quality, RT High', 39.8, [73.6, 107.2, 137.7]),

  ladder('purepc-dmfg', 'dlss', 'RTX 5070 Ti', 'Cyberpunk 2077', '1080p', 'DLSS 4.5, Native, RT Ultra', 83, [141, 205, 258, 319]),
  ladder('purepc-dmfg', 'dlss', 'RTX 5070 Ti', 'Cyberpunk 2077', '1440p', 'DLSS 4.5, Native, RT Ultra', 50, [86, 126, 161, 199]),
  ladder('purepc-dmfg', 'dlss', 'RTX 5070 Ti', 'Cyberpunk 2077', '4K', 'DLSS 4.5, Native, RT Ultra', 24, [43, 64, 84, 104]),

  // XeSS frame generation.
  ladder('cb-b580', 'xess', 'Arc B580', 'F1 24', '1080p', 'XeSS 2, Native, RT', 65.9, [115.5]),
  ladder('purepc-b580', 'xess', 'Arc B580', 'Cyberpunk 2077', '1080p', 'XeSS 3, Ultra Quality', 90, [156, 208, 241], 'https://www.purepc.pl/test-intel-xess-multi-frame-generation-arc-b580-recenzja-opinia?page=0,7'),
  ladder('purepc-b580', 'xess', 'Arc B580', 'Cyberpunk 2077', '1440p', 'XeSS 3, Ultra Quality', 65, [113, 152, 193], 'https://www.purepc.pl/test-intel-xess-multi-frame-generation-arc-b580-recenzja-opinia?page=0,7'),
  ladder('purepc-b580', 'xess', 'Arc B580', "Assassin's Creed Shadows", '1080p', 'XeSS 3, Quality', 56, [92, 118, 142], 'https://www.purepc.pl/test-intel-xess-multi-frame-generation-arc-b580-recenzja-opinia?page=0,4'),
  ladder('purepc-b580', 'xess', 'Arc B580', "Assassin's Creed Shadows", '1440p', 'XeSS 3, Quality', 50, [84, 107, 131], 'https://www.purepc.pl/test-intel-xess-multi-frame-generation-arc-b580-recenzja-opinia?page=0,4'),
  ladder('purepc-b580', 'xess', 'Arc B580', 'Black Myth: Wukong', '1080p', 'XeSS 3, Ultra Quality', 54, [101, 142, 178], 'https://www.purepc.pl/test-intel-xess-multi-frame-generation-arc-b580-recenzja-opinia?page=0,5'),
  ladder('purepc-b580', 'xess', 'Arc B580', 'Black Myth: Wukong', '1440p', 'XeSS 3, Ultra Quality', 37, [66, 92, 121], 'https://www.purepc.pl/test-intel-xess-multi-frame-generation-arc-b580-recenzja-opinia?page=0,5'),
  ladder('purepc-b580', 'xess', 'Arc B580', 'Crimson Desert', '1080p', 'XeSS 3, Ultra Quality', 61, [115, 160, 204], 'https://www.purepc.pl/test-intel-xess-multi-frame-generation-arc-b580-recenzja-opinia?page=0,6'),
  ladder('purepc-b580', 'xess', 'Arc B580', 'Crimson Desert', '1440p', 'XeSS 3, Ultra Quality', 51, [93, 128, 163], 'https://www.purepc.pl/test-intel-xess-multi-frame-generation-arc-b580-recenzja-opinia?page=0,6'),
  ladder('purepc-b580', 'xess', 'Arc B580', 'Dying Light: The Beast', '1080p', 'XeSS 3, Ultra Quality', 77, [139, 175, 215], 'https://www.purepc.pl/test-intel-xess-multi-frame-generation-arc-b580-recenzja-opinia?page=0,9'),
  ladder('purepc-b580', 'xess', 'Arc B580', 'Dying Light: The Beast', '1440p', 'XeSS 3, Ultra Quality', 52, [93, 130, 160], 'https://www.purepc.pl/test-intel-xess-multi-frame-generation-arc-b580-recenzja-opinia?page=0,9'),
  ladder('purepc-b580', 'xess', 'Arc B580', 'Hogwarts Legacy', '1440p', 'XeSS 3, Ultra Quality', 75, [132, 172, 212], 'https://www.purepc.pl/test-intel-xess-multi-frame-generation-arc-b580-recenzja-opinia?page=0,10'),
  ladder('purepc-b580', 'xess', 'Arc B580', 'Star Wars Outlaws', '1080p', 'XeSS 3, Ultra Quality', 60, [106, 145, 189], 'https://www.purepc.pl/test-intel-xess-multi-frame-generation-arc-b580-recenzja-opinia?page=0,11'),
  ladder('purepc-b580', 'xess', 'Arc B580', 'Star Wars Outlaws', '1440p', 'XeSS 3, Ultra Quality', 44, [75, 105, 132], 'https://www.purepc.pl/test-intel-xess-multi-frame-generation-arc-b580-recenzja-opinia?page=0,11'),
  ladder('nbc-140t', 'xess', 'Arc 140T', 'F1 24', '1080p', 'XeSS 2, Native, High', 59, [87]),
  ladder('nbc-140t', 'xess', 'Arc 140T', 'F1 24', '1080p', 'XeSS 2, Native, Ultra with RT', 20, [36]),

  // AMD FSR 3 launch post: FPS off → FPS with FG, FSR 3 Performance, RT on.
  pair('amd-fsr3-launch', 'fsr3', 'RX 7900 XTX', 'Forspoken', '4K', 'FSR 3.0, Performance, RT', 90, 164),
  pair('amd-fsr3-launch', 'fsr3', 'RX 7900 XTX', 'Immortals of Aveum', '4K', 'FSR 3.0, Performance, RT', 107, 167),
  pair('amd-fsr3-launch', 'fsr3', 'RX 6800 XT', 'Forspoken', '1440p', 'FSR 3.0, Performance, RT', 83, 160),

  // PCGH Redstone test, RX 9070 XT 1440p: same runs with FSR 4 ML FG and FSR 3.1 FG.
  pair('pcgh-redstone', 'fsr4', 'RX 9070 XT', 'Black Myth: Wukong', '1440p', 'FSR 4 Performance, path tracing', 32.0, 58.8),
  pair('pcgh-redstone', 'fsr4', 'RX 9070 XT', 'Cyberpunk 2077', '1440p', 'FSR 4 Quality, RT Ultra', 66.5, 127.4),
  pair('pcgh-redstone', 'fsr3', 'RX 9070 XT', 'Black Myth: Wukong', '1440p', 'FSR 3.1, FSR 4 Performance, path tracing', 32.0, 59.6),
  pair('pcgh-redstone', 'fsr3', 'RX 9070 XT', 'Cyberpunk 2077', '1440p', 'FSR 3.1, FSR 4 Quality, RT Ultra', 66.5, 129.1),

  // ComputerBase Redstone test, RX 9070 XT 4K, FSR 3.1 FG.
  pair('cb-redstone', 'fsr3', 'RX 9070 XT', 'Black Myth: Wukong', '4K', 'FSR 3.1, Performance', 58.7, 102.7),
  pair('cb-redstone', 'fsr3', 'RX 9070 XT', 'Call of Duty: Black Ops 7', '4K', 'FSR 3.1, Native AA', 67.4, 113.9),

  // ComputerBase March 2024, 4K, FSR upscaling Quality / Performance.
  pair('cb-fg-2024', 'fsr3', 'RX 7800 XT', 'Starfield', '4K', 'FSR 3, Quality', 53.8, 96.2),
  pair('cb-fg-2024', 'fsr3', 'RX 7800 XT', 'Starfield', '4K', 'FSR 3, Performance', 66.1, 117.0),
  pair('cb-fg-2024', 'fsr3', 'RX 7800 XT', 'The Talos Principle 2', '4K', 'FSR 3, Quality', 46.7, 81.7),
  pair('cb-fg-2024', 'fsr3', 'RX 7800 XT', 'The Talos Principle 2', '4K', 'FSR 3, Performance', 62.5, 108.1),
  pair('cb-fg-2024', 'fsr3', 'RX 7800 XT', 'Like a Dragon: Infinite Wealth', '4K', 'FSR 3, Quality', 92.5, 140.8),
  pair('cb-fg-2024', 'fsr3', 'RTX 4070', 'Starfield', '4K', 'FSR 3, Quality', 48.0, 78.5),
  pair('cb-fg-2024', 'fsr3', 'RTX 4070', 'Starfield', '4K', 'FSR 3, Performance', 57.7, 93.6),
  pair('cb-fg-2024', 'fsr3', 'RTX 4070', 'The Talos Principle 2', '4K', 'FSR 3, Quality', 44.4, 69.3),
  pair('cb-fg-2024', 'fsr3', 'RTX 4070', 'The Talos Principle 2', '4K', 'FSR 3, Performance', 58.7, 89.4),
  pair('cb-fg-2024', 'fsr3', 'RTX 4070', 'Like a Dragon: Infinite Wealth', '4K', 'FSR 3, Quality', 81.0, 108.6),

  // TechPowerUp Forspoken FSR 3 review, RTX 3080.
  pair('tpu-forspoken', 'fsr3', 'RTX 3080', 'Forspoken', '1440p', 'FSR 3.0, Quality', 64, 113),
  pair('tpu-forspoken', 'fsr3', 'RTX 3080', 'Forspoken', '4K', 'FSR 3.0, Quality', 49, 81),

  // PCGH October 2023, Forspoken 1.22, FSR 3.0.
  pair('pcgh-fsr3-2023', 'fsr3', 'RX 6700 XT', 'Forspoken', '1440p', 'FSR 3.0, Balanced', 51.9, 103.1),
  pair('pcgh-fsr3-2023', 'fsr3', 'RTX 3070', 'Forspoken', '1440p', 'FSR 3.0, Balanced', 54.0, 95.5),
  pair('pcgh-fsr3-2023', 'fsr3', 'RX 5700 XT', 'Forspoken', '1080p', 'FSR 3.0, Quality', 62.8, 120.9),
  pair('pcgh-fsr3-2023', 'fsr3', 'RTX 2070', 'Forspoken', '1080p', 'FSR 3.0, Quality', 62.4, 113.6),
  pair('pcgh-fsr3-2023', 'fsr3', 'RTX 4090', 'Forspoken', '4K', 'FSR 3.0, Quality, RT', 72.7, 132.4),

  // Tom's Hardware Avatar, more GPUs (chart images). 8 GB cards at 4K are left out.
  pair('toms-avatar', 'fsr3', 'RX 7600', 'Avatar: Frontiers of Pandora', '1440p', 'FSR 3.0, Quality', 39.3, 70.1),
  pair('toms-avatar', 'fsr3', 'RX 7700 XT', 'Avatar: Frontiers of Pandora', '1440p', 'FSR 3.0, Quality', 61.5, 113.9),
  pair('toms-avatar', 'fsr3', 'RX 7700 XT', 'Avatar: Frontiers of Pandora', '4K', 'FSR 3.0, Quality', 36.7, 65.3),
  pair('toms-avatar', 'fsr3', 'RX 7800 XT', 'Avatar: Frontiers of Pandora', '1440p', 'FSR 3.0, Quality', 68.6, 128.9),
  pair('toms-avatar', 'fsr3', 'RX 7800 XT', 'Avatar: Frontiers of Pandora', '4K', 'FSR 3.0, Quality', 41.6, 75.3),
  pair('toms-avatar', 'fsr3', 'RX 7900 XT', 'Avatar: Frontiers of Pandora', '1440p', 'FSR 3.0, Quality', 92.2, 172.7),
  pair('toms-avatar', 'fsr3', 'RX 7900 XT', 'Avatar: Frontiers of Pandora', '4K', 'FSR 3.0, Quality', 57.2, 103.5),
  pair('toms-avatar', 'fsr3', 'RTX 4060', 'Avatar: Frontiers of Pandora', '1440p', 'FSR 3.0, Quality', 47.8, 81.3),
  pair('toms-avatar', 'fsr3', 'RTX 4060 Ti 16 GB', 'Avatar: Frontiers of Pandora', '1440p', 'FSR 3.0, Quality', 61.9, 105.9),
  pair('toms-avatar', 'fsr3', 'RTX 4060 Ti 16 GB', 'Avatar: Frontiers of Pandora', '4K', 'FSR 3.0, Quality', 34.7, 60.1),
  pair('toms-avatar', 'fsr3', 'RTX 4070', 'Avatar: Frontiers of Pandora', '1440p', 'FSR 3.0, Quality', 79.8, 129.4),
  pair('toms-avatar', 'fsr3', 'RTX 4070', 'Avatar: Frontiers of Pandora', '4K', 'FSR 3.0, Quality', 46.0, 78.6),
  pair('toms-avatar', 'fsr3', 'RTX 4070 Ti', 'Avatar: Frontiers of Pandora', '1440p', 'FSR 3.0, Quality', 102.6, 158.8),
  pair('toms-avatar', 'fsr3', 'RTX 4070 Ti', 'Avatar: Frontiers of Pandora', '4K', 'FSR 3.0, Quality', 60.2, 100.0),
  pair('toms-avatar', 'fsr3', 'RTX 4080', 'Avatar: Frontiers of Pandora', '1440p', 'FSR 3.0, Quality', 112.4, 177.6),
  pair('toms-avatar', 'fsr3', 'RTX 4080', 'Avatar: Frontiers of Pandora', '4K', 'FSR 3.0, Quality', 71.0, 115.7),

  // Tom's Hardware Stalker 2, 1440p Epic, FSR 3.1 FG. RX 7800 XT and 7900 GRE are left out:
  // their FG output is near the game's CPU limit.
  pair('toms-stalker2', 'fsr3', 'RTX 3060', 'Stalker 2', '1440p', 'FSR 3.1, DLSS Quality upscaling', 38.2, 64.0),
  pair('toms-stalker2', 'fsr3', 'RTX 2080 Ti', 'Stalker 2', '1440p', 'FSR 3.1, DLSS Quality upscaling', 46.5, 78.1),
  pair('toms-stalker2', 'fsr3', 'RTX 3080', 'Stalker 2', '1440p', 'FSR 3.1, DLSS Quality upscaling', 64.4, 104.5),
  pair('toms-stalker2', 'fsr3', 'RX 7600 XT', 'Stalker 2', '1440p', 'FSR 3.1, Quality', 43.3, 77.7),
  pair('toms-stalker2', 'fsr3', 'RX 6700 XT', 'Stalker 2', '1440p', 'FSR 3.1, Quality', 46.2, 84.0),
  pair('toms-stalker2', 'fsr3', 'RX 7700 XT', 'Stalker 2', '1440p', 'FSR 3.1, Quality', 54.3, 101.4),
  pair('toms-stalker2', 'fsr3', 'Arc A770', 'Stalker 2', '1440p', 'FSR 3.1, XeSS Quality upscaling', 32.1, 56.9),

  // AMD FSR Frame Generation 4.0.2 reference performance.
  { id: 'amd-9070xt-4k', sourceId: 'amd-fsr4', tech: 'fsr4', hardware: 'RX 9070 XT', resolution: '4K', overheadMs: v(2.2) },
  { id: 'amd-9060xt-1440p', sourceId: 'amd-fsr4', tech: 'fsr4', hardware: 'RX 9060 XT', resolution: '1440p', overheadMs: v(2.1) },

  // PCGH, Arc A770, XeSS-FG: FPS with FG off, then displayed FPS at ×2, ×3, ×4.
  pcgh('cp', 'Cyberpunk 2077', 56.4, 96.2, 122.0, 163.6),
  pcgh('f1', 'F1 25', 50.3, 86.4, 120.5, 151.5),
  pcgh('hl', 'Hogwarts Legacy', 40.8, 71.2, 99.4, 124.2),
  pcgh('bf6', 'Battlefield 6', 56.6, 96.3, 129.5, 160.2),
  pcgh('dl', 'Dying Light: The Beast', 49.2, 87.5, 119.4, 147.9),
  pcgh('e33', 'Clair Obscur: Expedition 33', 32.6, 59.0, 83.1, 103.7),
  pcgh('acs', "Assassin's Creed Shadows", 30.9, 55.9, 79.0, 98.7),

  // Apex Compute: 2X per generated frame; 4X mean per generated frame × 3.
  // Its DLSS FG numbers for the same GPU are left out: NVIDIA's own table covers RTX 5090 at 4K.
  { id: 'apex-anr-5090-4k', sourceId: 'apex', tech: 'anr', hardware: 'RTX 5090', resolution: '4K', overheadMs: v(1.01, null, 3 * 0.61) },

  // Apex Compute, Apple M2 Max (native Metal beta): per generated frame; ×4 mean × 3.
  { id: 'apex-anr-m2max-1080p', sourceId: 'apex', tech: 'anr', hardware: 'Apple M2 Max', resolution: '1080p', overheadMs: v(4.26, null, 3 * 2.52) },
  { id: 'apex-anr-m2max-4k', sourceId: 'apex', tech: 'anr', hardware: 'Apple M2 Max', resolution: '4K', overheadMs: v(15.66, null, 3 * 9.25) },

  // ANR test kit results from GitHub issues: frame_ms median, read as ms per rendered frame.
  { id: 'anr-kit-arc-a770-1080p-auto', sourceId: 'anr-kit', tech: 'anr', hardware: 'Arc A770', resolution: '1080p', url: 'https://github.com/apex-compute/ANR/issues/2', overheadMs: v(2.432, 3.397, 4.3902) },
  { id: 'anr-kit-arc-a770-1440p-auto', sourceId: 'anr-kit', tech: 'anr', hardware: 'Arc A770', resolution: '1440p', url: 'https://github.com/apex-compute/ANR/issues/2', overheadMs: v(3.7681, null, 6.9237) },
  { id: 'anr-kit-arc-a770-4k-auto', sourceId: 'anr-kit', tech: 'anr', hardware: 'Arc A770', resolution: '4K', url: 'https://github.com/apex-compute/ANR/issues/2', overheadMs: v(7.6499, null, 14.2883) },
  { id: 'anr-kit-radeon-780m-1080p-45-w', sourceId: 'anr-kit', tech: 'anr', hardware: 'Radeon 780M', resolution: '1080p', settings: '45 W', url: 'https://github.com/apex-compute/ANR/issues/74', overheadMs: v(7.0541, 10.532, 14.1375) },
  { id: 'anr-kit-radeon-780m-1440p-45-w', sourceId: 'anr-kit', tech: 'anr', hardware: 'Radeon 780M', resolution: '1440p', settings: '45 W', url: 'https://github.com/apex-compute/ANR/issues/74', overheadMs: v(12.0778, null, 24.6979) },
  { id: 'anr-kit-radeon-780m-4k-45-w', sourceId: 'anr-kit', tech: 'anr', hardware: 'Radeon 780M', resolution: '4K', settings: '45 W', url: 'https://github.com/apex-compute/ANR/issues/74', overheadMs: v(26.8664, null, 54.9785) },
  { id: 'anr-kit-radeon-890m-rog-xbox-ally-x-1080p-auto', sourceId: 'anr-kit', tech: 'anr', hardware: 'Radeon 890M (ROG Xbox Ally X)', resolution: '1080p', url: 'https://github.com/apex-compute/ANR/issues/29', overheadMs: v(5.2744, 7.9805, 10.6821) },
  { id: 'anr-kit-radeon-890m-rog-xbox-ally-x-1440p-auto', sourceId: 'anr-kit', tech: 'anr', hardware: 'Radeon 890M (ROG Xbox Ally X)', resolution: '1440p', url: 'https://github.com/apex-compute/ANR/issues/29', overheadMs: v(8.8916, null, 18.4029) },
  { id: 'anr-kit-radeon-890m-rog-xbox-ally-x-4k-auto', sourceId: 'anr-kit', tech: 'anr', hardware: 'Radeon 890M (ROG Xbox Ally X)', resolution: '4K', url: 'https://github.com/apex-compute/ANR/issues/29', overheadMs: v(20.181, null, 42.7131) },
  { id: 'anr-kit-radeon-890m-rog-xbox-ally-x-1080p-portable-linalg-path', sourceId: 'anr-kit', tech: 'anr', hardware: 'Radeon 890M (ROG Xbox Ally X)', resolution: '1080p', settings: 'portable-linalg path', url: 'https://github.com/apex-compute/ANR/issues/29', overheadMs: v(4.0075, 5.7963, 7.656, 9.5133) },
  { id: 'anr-kit-radeon-890m-rog-xbox-ally-x-1440p-portable-linalg-path', sourceId: 'anr-kit', tech: 'anr', hardware: 'Radeon 890M (ROG Xbox Ally X)', resolution: '1440p', settings: 'portable-linalg path', url: 'https://gist.github.com/davnozdu/932c0bd7c3ea7652449703aadf12a350', overheadMs: v(6.9, null, 13.3634) },
  { id: 'anr-kit-radeon-890m-rog-xbox-ally-x-4k-portable-linalg-path', sourceId: 'anr-kit', tech: 'anr', hardware: 'Radeon 890M (ROG Xbox Ally X)', resolution: '4K', settings: 'portable-linalg path', url: 'https://gist.github.com/davnozdu/932c0bd7c3ea7652449703aadf12a350', overheadMs: v(15.58, null, 30.2496) },
  { id: 'anr-kit-rx-9070-xt-1080p-windows', sourceId: 'anr-kit', tech: 'anr', hardware: 'RX 9070 XT', resolution: '1080p', settings: 'Windows', url: 'https://github.com/apex-compute/ANR/issues/5', overheadMs: v(1.0261, null, 1.321) },
  { id: 'anr-kit-rx-9070-xt-1440p-windows', sourceId: 'anr-kit', tech: 'anr', hardware: 'RX 9070 XT', resolution: '1440p', settings: 'Windows', url: 'https://github.com/apex-compute/ANR/issues/5', overheadMs: v(1.0795, null, 2.1639) },
  { id: 'anr-kit-rx-9070-xt-4k-windows', sourceId: 'anr-kit', tech: 'anr', hardware: 'RX 9070 XT', resolution: '4K', settings: 'Windows', url: 'https://github.com/apex-compute/ANR/issues/5', overheadMs: v(2.4572, null, 4.8893) },
  { id: 'anr-kit-rx-9070-xt-4k-linux-radv', sourceId: 'anr-kit', tech: 'anr', hardware: 'RX 9070 XT', resolution: '4K', settings: 'Linux, RADV', url: 'https://github.com/apex-compute/ANR/issues/21', overheadMs: v(2.51, null, 5.18) },
  { id: 'anr-kit-gtx-1650-mobile-1080p-30-w', sourceId: 'anr-kit', tech: 'anr', hardware: 'GTX 1650 Mobile', resolution: '1080p', settings: '30 W', url: 'https://github.com/apex-compute/ANR/issues/32', overheadMs: v(5.74, 8.46, 11.31) },
  { id: 'anr-kit-gtx-1650-mobile-1440p-30-w', sourceId: 'anr-kit', tech: 'anr', hardware: 'GTX 1650 Mobile', resolution: '1440p', settings: '30 W', url: 'https://github.com/apex-compute/ANR/issues/32', overheadMs: v(10.04, 15.1, 19.98) },
  { id: 'anr-kit-gtx-1650-mobile-4k-30-w', sourceId: 'anr-kit', tech: 'anr', hardware: 'GTX 1650 Mobile', resolution: '4K', settings: '30 W', url: 'https://github.com/apex-compute/ANR/issues/32', overheadMs: v(22.91, 33.94, 45.07) },
  { id: 'anr-kit-gtx-1650-ti-mobile-1080p-auto', sourceId: 'anr-kit', tech: 'anr', hardware: 'GTX 1650 Ti Mobile', resolution: '1080p', url: 'https://github.com/apex-compute/ANR/issues/39', overheadMs: v(4.16, 5.99, 7.8) },
  { id: 'anr-kit-gtx-1650-ti-mobile-4k-auto', sourceId: 'anr-kit', tech: 'anr', hardware: 'GTX 1650 Ti Mobile', resolution: '4K', url: 'https://github.com/apex-compute/ANR/issues/39', overheadMs: v(19.61, null, 37.6) },
  { id: 'anr-kit-radeon-vega-frontier-edition-1080p-auto', sourceId: 'anr-kit', tech: 'anr', hardware: 'Radeon Vega Frontier Edition', resolution: '1080p', url: 'https://github.com/apex-compute/ANR/issues/20', overheadMs: v(2.82, null, 5.66) },
  { id: 'anr-kit-radeon-vega-frontier-edition-4k-auto', sourceId: 'anr-kit', tech: 'anr', hardware: 'Radeon Vega Frontier Edition', resolution: '4K', url: 'https://github.com/apex-compute/ANR/issues/20', overheadMs: v(10.24, null, 20.48) },
  { id: 'anr-kit-arc-b390-1080p-auto', sourceId: 'anr-kit', tech: 'anr', hardware: 'Arc B390', resolution: '1080p', url: 'https://github.com/apex-compute/ANR/issues/22', overheadMs: v(3.47, 5.14) },
  { id: 'anr-kit-arc-b390-1440p-auto', sourceId: 'anr-kit', tech: 'anr', hardware: 'Arc B390', resolution: '1440p', url: 'https://github.com/apex-compute/ANR/issues/22', overheadMs: v(6.08, 8.88) },

  // lsfg-vk 2.0.0 blog: RTX 5080 at 1440p ×4, time per real frame.
  { id: 'lsfg-5080-1440p', sourceId: 'lsfg-vk-blog', tech: 'lsfg', hardware: 'RTX 5080', resolution: '1440p', settings: 'lsfg-vk 2.0, flow 100 %', overheadMs: v(null, null, 1.6) },
  // lsfg-vk CLI benchmark with defaults, RTX 3050 Laptop.
  { id: 'lsfg-3050m-1080p', sourceId: 'lsfg-vk-community', tech: 'lsfg', hardware: 'RTX 3050 Laptop', resolution: '1080p', settings: 'lsfg-vk 2.0, default settings', overheadMs: v(3.4) },

  // MAKO FG V1.24 model card, Steam Machine GPU, ms per real frame.
  { id: 'mako-sm-720p-q', sourceId: 'mako-card', tech: 'mako', hardware: 'Steam Machine', resolution: '720p', settings: 'Quality, flow 1.0', overheadMs: v(0.55, null, 0.95) },
  { id: 'mako-sm-800p-q', sourceId: 'mako-card', tech: 'mako', hardware: 'Steam Machine', resolution: '1280×800', settings: 'Quality, flow 1.0', overheadMs: v(0.58) },
  { id: 'mako-sm-1080p-q', sourceId: 'mako-card', tech: 'mako', hardware: 'Steam Machine', resolution: '1080p', settings: 'Quality, flow 1.0', overheadMs: v(0.97) },
  { id: 'mako-sm-1440p-q', sourceId: 'mako-card', tech: 'mako', hardware: 'Steam Machine', resolution: '1440p', settings: 'Quality, flow 1.0', overheadMs: v(1.61, null, 3.15) },
  { id: 'mako-sm-1440p-q08', sourceId: 'mako-card', tech: 'mako', hardware: 'Steam Machine', resolution: '1440p', settings: 'Quality, flow 0.8', overheadMs: v(1.35, 1.93) },
  { id: 'mako-sm-1440p-b08', sourceId: 'mako-card', tech: 'mako', hardware: 'Steam Machine', resolution: '1440p', settings: 'Balanced, flow 0.8', overheadMs: v(1.16, 1.73) },
  { id: 'mako-sm-1440p-p08', sourceId: 'mako-card', tech: 'mako', hardware: 'Steam Machine', resolution: '1440p', settings: 'Performance, flow 0.8', overheadMs: v(1.08, 1.65) },
  { id: 'mako-sm-1440p-xp08', sourceId: 'mako-card', tech: 'mako', hardware: 'Steam Machine', resolution: '1440p', settings: 'Extra Performance, flow 0.8', overheadMs: v(0.78, 1.35) },

  // lsfg-vk 2.0.0 CLI benchmark, Radeon 680M.
  { id: 'lsfg-680m-800p', sourceId: 'lsfg-vk-blog', tech: 'lsfg', hardware: 'Radeon 680M', resolution: '1280×800', settings: 'lsfg-vk 2.0, flow 100 %', overheadMs: v(3.3) },

  // Decky-FrameGen-Hub, lsfg-vk on the ROG Xbox Ally X, ms per real frame at 1080p ×2.
  { id: 'lsfg-890m-1080p', sourceId: 'decky-fg-hub', tech: 'lsfg', hardware: 'Radeon 890M (ROG Xbox Ally X)', resolution: '1080p', settings: 'lsfg-vk, default settings', overheadMs: v(3.4) },
  { id: 'lsfg-890m-1080p-perf', sourceId: 'decky-fg-hub', tech: 'lsfg', hardware: 'Radeon 890M (ROG Xbox Ally X)', resolution: '1080p', settings: 'lsfg-vk, flow 50 %, performance mode', overheadMs: v(1.9) },
];

export function sourceOf(preset: Preset): PresetSource {
  const s = SOURCES.find((x) => x.id === preset.sourceId);
  if (!s) throw new Error(`Unknown preset source: ${preset.sourceId}`);
  return s;
}


// ---------- Ordering and labels ----------

/** Natural, case-insensitive comparison ("RTX 3080" < "RTX 4090" < "RTX 5080"). */
const natural = new Intl.Collator('en', { numeric: true, sensitivity: 'base' }).compare;

/** Vertical pixel count of a resolution label, for sorting ("4K" → 2160, "1280×800" → 800). */
export function resolutionRank(res: string): number {
  if (/^4k$/i.test(res)) return 2160;
  const p = /^(\d+)p$/i.exec(res);
  if (p) return Number(p[1]);
  const wh = /^(\d+)\s*[×x]\s*(\d+)$/.exec(res);
  if (wh) return Number(wh[2]);
  return Number.MAX_SAFE_INTEGER;
}

/** Upscaling modes from highest to lowest render resolution; other settings sort after them. */
const UPSCALE_MODES = ['Native AA', 'Ultra Quality', 'Quality', 'Balanced', 'Performance', 'Extra Performance', 'Ultra Performance'];

function settingsRank(settings: string | undefined): number {
  if (!settings) return -1;
  // Longest names first, so "Ultra Performance" is not read as "Performance".
  const byLength = [...UPSCALE_MODES].sort((a, b) => b.length - a.length);
  const mode = byLength.find((m) => new RegExp(`\\b${m}\\b`).test(settings));
  return mode ? UPSCALE_MODES.indexOf(mode) : UPSCALE_MODES.length;
}

/** Order within a technology and hardware: game (reference data first), resolution, settings. */
function comparePresets(a: Preset, b: Preset): number {
  return (
    compareHardware(a.hardware, b.hardware) ||
    natural(a.game ?? '', b.game ?? '') ||
    resolutionRank(a.resolution) - resolutionRank(b.resolution) ||
    settingsRank(a.settings) - settingsRank(b.settings) ||
    natural(a.settings ?? '', b.settings ?? '') ||
    Number(sourceOf(b).official) - Number(sourceOf(a).official)
  );
}

/** Technologies that have presets, in TECHS order. */
export function techsWithPresets(): (typeof TECHS)[number][] {
  return TECHS.filter((t) => PRESETS.some((p) => p.tech === t.id));
}

/** Vendor order for the hardware list: NVIDIA, AMD (including AMD-based handhelds), Intel, others. */
export function vendorRank(hardware: string): number {
  if (/^(RTX|GTX)\b/.test(hardware)) return 0;
  if (/^(RX|Radeon|Steam Deck|Steam Machine|ROG)\b/.test(hardware)) return 1;
  if (/^Arc\b/.test(hardware)) return 2;
  return 3;
}

const compareHardware = (a: string, b: string) => vendorRank(a) - vendorRank(b) || natural(a, b);

export function hardwareFor(tech: TechId): string[] {
  return [...new Set(PRESETS.filter((p) => p.tech === tech).map((p) => p.hardware))].sort(compareHardware);
}

export function presetsFor(tech: TechId, hardware: string): Preset[] {
  return PRESETS.filter((p) => p.tech === tech && p.hardware === hardware).sort(comparePresets);
}

/** Label in the scenario list: game or source, resolution, settings, and "unofficial" when it is. */
export function scenarioLabel(p: Preset): string {
  const source = sourceOf(p);
  const parts = [p.game ?? source.short, p.resolution, p.settings];
  if (!source.official) parts.push('unofficial');
  return parts.filter(Boolean).join(', ');
}


/**
 * The preset whose values equal `overhead`, if any. Values are compared at the URL's
 * precision (3 decimals), so a preset survives a shared link round trip. Several presets
 * can share values; `preferredId` (the last chosen preset, or the one named in the URL)
 * wins when it matches, otherwise the first match in the list does.
 */
export function findPreset(overhead: ManualOverhead, preferredId?: string | null): Preset | undefined {
  const same = (a: number | null, b: number | null) =>
    a === null || b === null ? a === b : Math.round(a * 1000) === Math.round(b * 1000);
  const matches = (p: Preset) => ([2, 3, 4, 5] as FgMultiplier[]).every((m) => same(p.overheadMs[m], overhead[m]));
  const preferred = PRESETS.find((p) => p.id === preferredId);
  if (preferred && matches(preferred)) return preferred;
  return PRESETS.find(matches);
}

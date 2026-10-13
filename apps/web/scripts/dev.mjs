import { launchNext } from "./lib/launch-next.mjs";

await launchNext({ mode: "dev", extraArgs: ["--webpack"] });

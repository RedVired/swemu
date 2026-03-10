// run.js (ESM)
import * as swemu from "../src/index.js";

let config = {
  services: {
    a: { filePath: "./a.lua" },
    b: { filePath: "./b.lua" },
  },
  links: [
    { from: "a", to: "b" },
    { from: "b", to: "a" },
  ],
  log: {console: true, bus: true},
  simulation: {tickHz: 40}
};

const sim = new swemu.SWSimulator(config)

//console.log(sim);
//console.log(sim.buses);

sim.runInterval(100)

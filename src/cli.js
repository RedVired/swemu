#!/usr/bin/env node

import * as swemu from "./index.js";
import { Command } from "commander";
import fs from "node:fs";
import yaml from "js-yaml";

const program = new Command();
var configPath = "./config.yaml";

program
  .name("my-cli")
  .description("A CLI application built with Commander.js")
  .version("0.1.0");

program
  .command("run")
  .description("Run the SW simulator")
  .option("-t, --ticks <ticks>", "Number of ticks to run")
  .action((options) => {
    let configPaths = [
      "./config.yaml",
      "./config.yml",
      "./config.json",
      "./swemu.yaml",
      "./swemu.yml",
      "./swemu.json",
    ];

    name: for (let path of configPaths) {
      if (fs.existsSync(path)) {
        var configPath = path;
        break name;
      }
    }

    let configObject;

    try {
      let content = fs.readFileSync(configPath, "utf8");
      configObject = yaml.load(content);
    } catch (error) {
      console.error("Ошибка чтения YAML:", error.message);
    }

    const sim = new swemu.SWSimulator(configObject);
    if (options.ticks) {
      sim.runInterval(parseInt(options.ticks));
    } else {
      sim.run();
    }
  });

program.parse();

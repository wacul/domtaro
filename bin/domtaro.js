#!/usr/bin/env node

const argv = require("yargs")
  .alias("u", "url")
  .describe("u", "Set url you want to take dom snapshot")
  .alias("t", "type")
  .default("t", "snapshot")
  .describe("t", "Set type. snapshot or screenshot.")
  .help("help").argv;
const domtaro = require("../index");

(async () => {
  if (argv.url) {
    let buff;
    if (argv.type === "snapshot") {
      buff = await domtaro.snapshot(argv.url);
    } else {
      buff = await domtaro.screenshot(argv.url);
    }
    process.stdout.write(buff);
    process.exit();
  }
})();

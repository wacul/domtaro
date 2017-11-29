#!/usr/bin/env node

const argv = require("yargs")
  .alias("u", "url")
  .describe("u", "Set url you want to take dom snapshot")
  .help("help")
  .argv;
const domtaro = require("../index");

(async () => {
  if (argv.url) {
    const buff = await domtaro.snapshot(argv.url);
    process.stdout.write(buff);
    process.exit();
  }
})();


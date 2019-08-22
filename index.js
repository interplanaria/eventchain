#!/usr/bin/env node
const glob = require('glob')
const { planaria } = require("neonplanaria")
const fs = require('fs');
const path = require('path');
const stream = require('stream')

// Implement log stream - must define _read() callback or errs
const log = new stream.Readable()
log._read = function() {}

const validate = function(config, vmode) {
  let errors = [];
  if (!config.eventchain && vmode !== "build") {
    errors.push("requires an \"eventchain\": 1 key pair")
  }
  if (!config.name && vmode !== "build") {
    errors.push("requires a \"name\" attribute")
  }
  if (config.q) {
    let keys = Object.keys(config.q)
    if (keys.length > 0) {
      // keys must be either 'find' or 'project'
      keys.forEach(function(key) {
        if (!["find", "project"].includes(key)) {
          errors.push("\"q\" currently supports only \"find\" and \"project\"")
        }
      })
    } else {
      errors.push("\"q\" should have \"find\" attribute");
    }
  } else {
    errors.push("requires a 'q' attribute")
  }
  return errors;
}

const start = function(options) {
  glob(process.cwd() + "/*.json", async function(er, files) {
    let configs = files.map(function(f) {
      return require(f)
    }).filter(function(f) {
      return f.eventchain
    })
    if (configs.length === 0) {
      console.log("EVENTCHAIN", "Couldn't find a JSON file with an 'eventchain' attribute")
      process.exit();
      return;
    }
    if (configs.length > 1) {
      console.log("EVENTCHAIN", "Only one config JSON supported per Eventchain.")
      process.exit();
      return;
    }
    let config = configs[0];
    let v = validate(config)
    if (v.length > 0) {
      console.log(v.join("\n"))
      process.exit();
    }
    planaria.start({
      filter: config,
      onmempool: async function(e) {
        log.push("ONMEMPOOL " + Date.now() + " " + e.tx.tx.h + " " + JSON.stringify(e.tx) + "\n")
      },
      onblock: async function(e) {
        if (e.tx.length > 0) {
          log.push("ONBLOCK " + Date.now() + " " + e.tx[0].blk.h + " " + JSON.stringify(e.tx) + "\n")
        }
      },
      onstart: async function(e) {
        if (options.mode === 'pipe') {
          log.pipe(process.stdout)
        } else {
          const chaindir = process.cwd() + "/eventchain"
          if (!fs.existsSync(chaindir)) {
            fs.mkdirSync(chaindir)
          }
          const logfile = fs.createWriteStream(chaindir + "/chain.txt", { flags: 'a+' })
          log.pipe(logfile)
        }
      },
    })
  })
}

if (process.argv.length > 2) {
  let cmd = process.argv[2].toLowerCase();
  let opts = {}
  if (cmd === 'rewind') {
  } else if (cmd === 'start') {
    start(opts)
  } else if (cmd === 'pipe') {
    start({...opts, mode: 'pipe'})
  } else if (cmd === 'serve') {
  } else if (cmd === 'whoami') {
  } else if (cmd === 'ls') {
  }
}

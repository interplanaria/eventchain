#!/usr/bin/env node
const glob = require('glob')
const { planaria } = require("neonplanaria")
const fs = require('fs');
const path = require('path');
const stream = require('stream')
const minimist = require('minimist')
const requireStr = require('require-from-string');

// Implement log stream - must define _read() callback or errs
var chaindir;
const log = {
  push: (msg) => {
    fs.appendFile(chaindir + "/chain.txt", msg, (err) => {
      console.log("error", err);
    })
  }
}

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

const loadAndValidateConfig = async function(options) {
  const configs = await new Promise(function(resolve, reject) {
    if (options.strconfig) {
      let config;
      if (options.strconfig.startsWith("module.exports")) {
        console.log("EVENTCHAIN", "Using JavaScript config")
        config = requireStr(options.strconfig) 
      } else {
        console.log("EVENTCHAIN", "Using JSON config")
        config = JSON.parse(options.strconfig)
      }
      resolve([config])
    } else if (options.config) {
      console.log("EVENTCHAIN", "Loading config:", options.config)
      let config = require(path.resolve(options.config))
      resolve([config])
    } else {
      console.log("EVENTCHAIN", "Searching for config file")
      glob(process.cwd() +  "/*.@(js|json)", async function(err, files) {
        if (err) reject(err);
        let configs = files.map(function(f) {
          return require(f)
        }).filter(function(f) {
          return f.eventchain
        })
        resolve(configs)
      })
    }
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
  return config;
}

const start = async function(options) {
  const config = await loadAndValidateConfig(options)
  let gene = {
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
      if (options.pipe) {
        log.pipe(process.stdout)
      } else {
        if (!fs.existsSync(chaindir)) {
          fs.mkdirSync(chaindir, { recursive: true })
        }
      }
      log.push("ONSTART " + Date.now() + " " + JSON.stringify(e) + "\n")
    },
  };
  if (options && options.dest) gene.tape = options.dest;
  if (gene.tape) {
    chaindir = path.resolve(process.cwd(), gene.tape, "eventchain")
  } else {
    chaindir = path.resolve(process.cwd(), "eventchain")
  }
  planaria.start(gene)
}

if (require.main === module && process.argv.length > 2) {
  const cmd = process.argv[2].toLowerCase();
  const opts = minimist(process.argv.slice(3), {
    alias: {
      fileconfig: 'f',
      strconfig: 's',
      pipe: 'p',
      dest: 'd',
    },
    boolean: ['pipe']
  });
  if (cmd === 'rewind') {
  } else if (cmd === 'start') {
    start(opts)
  } else if (cmd === 'pipe') {
    start({...opts, pipe: true})
  } else if (cmd === 'serve') {
  } else if (cmd === 'whoami') {
  } else if (cmd === 'ls') {
  }
}

/*jslint node: true */
"use strict";

let ONE_SECOND = 1000 ;
// let ONE_MINUTE = ONE_SECOND*60 ;

const async = require("async");
const os = require("os");
const omit = require("object.omit");
const defaults = require("object.defaults/immutable");
const util = require("util");
const moment = require("moment");
const debug = require("debug")("la");

let hostname = os.hostname();
hostname = hostname.replace(/\.home/g, "");
hostname = hostname.replace(/\.local/g, "");
hostname = hostname.replace(/\.fios-router\.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");

const defaultDateTimeFormat = "YYYY-MM-DD HH:mm:ss ZZ";
const compactDateTimeFormat = "YYYYMMDD HHmmss";

const neataptic = require("neataptic");
let network;

const mongoose = require("mongoose");
const wordAssoDb = require("@threeceelabs/mongoose-twitter");
// const db = wordAssoDb();

const neutralNetworkModel = require("../mongooseTwitter/models/neuralNetwork.server.model");
const NeuralNetwork = mongoose.model("NeuralNetwork", neutralNetworkModel.NeuralNetworkSchema);
// const NeuralNetwork = require("mongoose").model("NeuralNetwork");
// const NeuralNetwork = mongoose.model("NeuralNetwork", neutralNetworkModel.NeuralNetworkSchema);


const EventEmitter2 = require("eventemitter2").EventEmitter2;
let configEvents = new EventEmitter2({
  wildcard: true,
  newListener: true,
  maxListeners: 20,
  verboseMemoryLeak: true
});

process.title = process.env.NNC_PROCESS_NAME;

let configuration = {};
configuration.processName = process.env.NNC_PROCESS_NAME;
configuration.crossEntropyWorkAroundEnabled = false;
configuration.verbose = false;
configuration.globalTestMode = false;
configuration.defaultPopulationSize = 100;
configuration.testMode = false; // 
configuration.keepaliveInterval = 30*ONE_SECOND;
configuration.rxQueueInterval = 1*ONE_SECOND;

require("isomorphic-fetch");
const Dropbox = require('dropbox').Dropbox;

const chalk = require("chalk");
const chalkAlert = chalk.red;
const chalkError = chalk.bold.red;
const chalkWarn = chalk.red;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;

function jsonPrint (obj){
  if (obj) {
    return JSON.stringify(obj, null, 2);
  }
  else {
    return "UNDEFINED";
  }
}



// debug("neataptic\n" + jsonPrint(neataptic));
debug("NNC | process.env\n" + jsonPrint(process.env));

console.log("\n\nNNC | =================================");
console.log("NNC | HOST:          " + hostname);
console.log("NNC | PROCESS ID:    " + process.pid);
console.log("NNC | PROCESS NAME:  " + process.env.NNC_PROCESS_NAME);
console.log("NNC | PROCESS ARGS:  " + util.inspect(process.argv, {showHidden: false, depth: 1}));
console.log("NNC | =================================");

process.on("message", function(msg) {
  if (msg === "shutdown") {
    console.log("\n\nNNC | !!!!! RECEIVED PM2 SHUTDOWN !!!!!\n\n***** Closing all connections *****\n\n");
    setTimeout(function() {
      console.log("NNC | **** Finished closing connections ****\n\n ***** RELOADING neuralNetwork.js NOW *****\n\n");
      process.exit(0);
    }, 1500);
  }
});

function msToTime(duration) {
  let seconds = parseInt((duration / 1000) % 60);
  let minutes = parseInt((duration / (1000 * 60)) % 60);
  let hours = parseInt((duration / (1000 * 60 * 60)) % 24);
  let days = parseInt(duration / (1000 * 60 * 60 * 24));

  days = (days < 10) ? "0" + days : days;
  hours = (hours < 10) ? "0" + hours : hours;
  minutes = (minutes < 10) ? "0" + minutes : minutes;
  seconds = (seconds < 10) ? "0" + seconds : seconds;

  return days + ":" + hours + ":" + minutes + ":" + seconds;
}

let statsObj = {};

statsObj.hostname = hostname;
statsObj.pid = process.pid;

statsObj.startTime = moment().valueOf();
statsObj.elapsed = 0;

statsObj.memory = {};
statsObj.memory.rss = process.memoryUsage().rss/(1024*1024);
statsObj.memory.maxRss = process.memoryUsage().rss/(1024*1024);
statsObj.memory.maxRssTime = moment().valueOf();

statsObj.evolve = {};
statsObj.evolve.startTime = moment().valueOf();
statsObj.evolve.endTime;
statsObj.evolve.elapsed = 0;
statsObj.evolve.options = {};
statsObj.evolve.results = {};

statsObj.train = {};
statsObj.train.options = {};
statsObj.train.results = {};

statsObj.training = {};
statsObj.training.startTime = 0;
statsObj.training.endTime = 0;

// ==================================================================
// DROPBOX
// ==================================================================
const DROPBOX_WORD_ASSO_ACCESS_TOKEN = process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN ;
const DROPBOX_WORD_ASSO_APP_KEY = process.env.DROPBOX_WORD_ASSO_APP_KEY ;
const DROPBOX_WORD_ASSO_APP_SECRET = process.env.DROPBOX_WORD_ASSO_APP_SECRET;
const DROPBOX_TNN_CONFIG_FILE = process.env.DROPBOX_TNN_CONFIG_FILE || "neuralNetworkConfig.json";
const DROPBOX_TNN_STATS_FILE = process.env.DROPBOX_NNC_STATS_FILE;

let dropboxConfigFolder = "/config/utility/" + hostname;
let dropboxConfigFile = hostname + "_" + DROPBOX_TNN_CONFIG_FILE;
let statsFolder = "/stats/" + hostname + "/neuralNetwork";
let statsFile = DROPBOX_TNN_STATS_FILE;

console.log("NNC | DROPBOX_TNN_CONFIG_FILE: " + DROPBOX_TNN_CONFIG_FILE);
console.log("NNC | DROPBOX_TNN_STATS_FILE : " + DROPBOX_TNN_STATS_FILE);

debug("dropboxConfigFolder : " + dropboxConfigFolder);
debug("dropboxConfigFile : " + dropboxConfigFile);

debug("statsFolder : " + statsFolder);
debug("statsFile : " + statsFile);

console.log("NNC | DROPBOX_WORD_ASSO_ACCESS_TOKEN :" + DROPBOX_WORD_ASSO_ACCESS_TOKEN);
console.log("NNC | DROPBOX_WORD_ASSO_APP_KEY :" + DROPBOX_WORD_ASSO_APP_KEY);
console.log("NNC | DROPBOX_WORD_ASSO_APP_SECRET :" + DROPBOX_WORD_ASSO_APP_SECRET);

const dropboxClient = new Dropbox({ accessToken: DROPBOX_WORD_ASSO_ACCESS_TOKEN });

function getTimeStamp(inputTime) {
  let currentTimeStamp ;

  if (inputTime  === undefined) {
    currentTimeStamp = moment().format(compactDateTimeFormat);
    return currentTimeStamp;
  }
  else if (moment.isMoment(inputTime)) {
    currentTimeStamp = moment(inputTime).format(compactDateTimeFormat);
    return currentTimeStamp;
  }
  else {
    currentTimeStamp = moment(parseInt(inputTime)).format(compactDateTimeFormat);
    return currentTimeStamp;
  }
}

function quit(message) {
  let msg = "";
  if (message) { msg = message; }
  console.log("NNC | " + process.argv[1]
    + " | NEURAL NET **** QUITTING"
    + " | CAUSE: " + msg
    + " | PID: " + process.pid
    
  );
  process.exit();
}


function saveFile (path, file, jsonObj, callback){

  const fullPath = path + "/" + file;

  debug(chalkInfo("LOAD FOLDER " + path));
  debug(chalkInfo("LOAD FILE " + file));
  debug(chalkInfo("NNC | SAVE FILE FULL PATH " + fullPath));

  let options = {};
  options.path = fullPath;
  options.mode = "overwrite";
  options.autorename = false;

  try {
    options.contents = JSON.stringify(jsonObj, null, 2);
  }
  catch (err){
    console.error(chalkError("NNC | *** SAVE FILE JSON STRINGIFY ERROR: " + err));
    process.send({op:"ERROR", processName: configuration.processName, error: err, statsObj: statsObj}, function(){
      quit();
    });
    // if (callback !== undefined) { return callback(err, null); }
  }

  dropboxClient.filesUpload(options)
    .then(function(response){
      debug(chalkLog("SAVED DROPBOX JSON | " + options.path));
      if (callback !== undefined) { callback(null, response); }
    })
    .catch(function(err){
      console.error(chalkError("NNC | " + moment().format(defaultDateTimeFormat) 
        + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
      ));
      if (err.status === 429) {
        console.error("TOO MANY DROPBOX WRITES");
        if (callback !== undefined) { callback(null, null); }
      }
      else {
        console.error("NNC | ERROR\nNNC | " + jsonPrint(err));
        console.error("NNC | ERROR.ERRORNNC | \n" + jsonPrint(err.error));
        process.send({op: "ERROR", processName: configuration.processName, error: err}, function(){
          quit(jsonPrint(err));
        });
      }
    });
}

function showStats(options){
  if ((statsObj.evolve.startTime > 0) && (statsObj.evolve.endTime > 0)){
    statsObj.evolve.elapsed = statsObj.evolve.endTime - statsObj.evolve.startTime;
  }
  else if (statsObj.evolve.startTime > 0){
    statsObj.evolve.elapsed = moment().valueOf() - statsObj.evolve.startTime;
  }

  statsObj.elapsed = moment().valueOf() - statsObj.startTime;
  statsObj.memory.rss = process.memoryUsage().rss/(1024*1024);

  if (statsObj.memory.rss > statsObj.memory.maxRss) {
    statsObj.memory.maxRss = statsObj.memory.rss;
    statsObj.memory.maxRssTime = moment().valueOf();
  }

  console.log(chalk.green("NNC | S"
    + " | START: " + moment(parseInt(statsObj.startTime)).format(compactDateTimeFormat)
    + " | ELAPSED: " + msToTime(statsObj.elapsed)
    + " | TRAINING START: " + moment(parseInt(statsObj.evolve.startTime)).format(compactDateTimeFormat)
    + " | TRAINING ELAPSED: " + msToTime(statsObj.evolve.elapsed)
  ));
}

process.on("SIGHUP", function() {
  console.log(chalkAlert("NNC | " + configuration.processName + " | *** SIGHUP ***"));
  quit("SIGHUP");
});

process.on("SIGINT", function() {
  console.log(chalkAlert("NNC | " + configuration.processName + " | *** SIGINT ***"));
  quit("SIGINT");
});

function activateNetwork(n, input, callback){
  let output;
  output = n.activate(input);
  callback(output);
}

function testEvolve(params, callback){
  let myNetwork = new neataptic.Network(2, 1);

  let myTrainingSet = [
    { input: [0,0], output: [0] },
    { input: [0,1], output: [1] },
    { input: [1,0], output: [1] },
    { input: [1,1], output: [0] }
  ];

  myNetwork.evolve(myTrainingSet, {
    mutation: neataptic.methods.mutation.FFW,
    equal: true,
    popsize: 100,
    growth: 0.0001,
    elitism: 10,
    // log: 100,
    error: 0.03,
    iterations: 10000,
    mutationRate: 0.7,
    schedule: {
      function: function(schedParams){ 
        debug("NNC SCHED"
          + " | " + configuration.processName
          + " | " + moment().format(compactDateTimeFormat)
          + " | I: " + schedParams.iteration
          + " | F: " + schedParams.fitness.toFixed(5)
          + " | E: " + schedParams.error.toFixed(5)
        );
      },
      iterations: 100
    }

  })
  .then(function(results){

    debug(chalkAlert("NNC"
      + " | " + configuration.processName
      + " | EVOLVE RESULTS"
      + " | " + "TIME: " + results.time
      + " | " + "ITERATIONS: " + results.iterations
      + " | " + "ERROR: " + results.error
      + "\n"
    ));

    let testPass = true;

    async.each(myTrainingSet, function(datum, cb){

      activateNetwork(myNetwork, datum.input, function(out){

        let dataOut = (out[0] >= 0.5) ? 1 : 0 ;

        let datumPass = false;
        if (datum.output[0] === dataOut){
          datumPass = true;
        }

        if (!datumPass) { testPass = false; }

        debug("NNC | TEST"
          + " | " + configuration.processName
          + " | IN: " + datum.input
          + " | EO: " + datum.output[0]
          + " | TO: " + dataOut
          + " | PASS: " + datumPass
        );

        cb();

      });

    }, function(){
      debug(chalkLog("NNC | " + configuration.processName + " | TEST RESULT: PASS: " + testPass));
      callback(testPass);
    });
  });
}

function evolve(params, callback){

  debug("evolve params.network\n" + jsonPrint(params.network));

  if (params.architecture === undefined) { params.architecture = "random"; }

  let options = {};

  if ((params.network !== undefined) && params.network) {
    options.network = params.network;
    params.architecture = "loadedNetwork";
    debug(chalkAlert("NNC | START NETWORK DEFINED: " + options.network.networkId));
  }

  options.threads = params.threads;
  options.elitism = params.elitism;
  options.equal = params.equal;
  options.error = params.error;
  options.iterations = params.iterations;
  options.mutation = neataptic.methods.mutation.FFW;
  options.mutationRate = params.mutationRate;
  options.popsize = params.popsize;
  options.growth = params.growth;

  let schedStartTime = moment().valueOf();

  statsObj.evolve.startTime = moment().valueOf();
  statsObj.evolve.elapsed = 0;

  options.schedule = {
    function: function(schedParams){

      let elapsedInt = moment().valueOf() - schedStartTime;
      let iterationRate = elapsedInt/schedParams.iteration;
      let iterationRateSec = iterationRate/1000.0;
      let timeToComplete = iterationRate*(params.iterations - schedParams.iteration);

      function schedMsToTime(duration) {
        let seconds = parseInt((duration / 1000) % 60);
        let minutes = parseInt((duration / (1000 * 60)) % 60);
        let hours = parseInt((duration / (1000 * 60 * 60)) % 24);
        let days = parseInt(duration / (1000 * 60 * 60 * 24));

        days = (days < 10) ? "0" + days : days;
        hours = (hours < 10) ? "0" + hours : hours;
        minutes = (minutes < 10) ? "0" + minutes : minutes;
        seconds = (seconds < 10) ? "0" + seconds : seconds;

        return days + ":" + hours + ":" + minutes + ":" + seconds;
      }

      console.log("NNC | EVOLVE"
        + " | " + configuration.processName
        // + " | " + params.runId
        + " | S: " + moment(schedStartTime).format(compactDateTimeFormat)
        + " | R: " + schedMsToTime(elapsedInt)
        + " | RATE: " + iterationRateSec.toFixed(1) + " s/I"
        + " | ETC: " + schedMsToTime(timeToComplete)
        + " | ETC: " + moment().add(timeToComplete).format(compactDateTimeFormat)
        + " | I: " + schedParams.iteration + " / " + params.iterations
        + " | F: " + schedParams.fitness.toFixed(5)
        + " | E: " + schedParams.error.toFixed(5)
      );
    },
    
    iterations: params.log
  };


  async.each(Object.keys(params), function(key, cb){

    debug(">>>> KEY: " + key);

    switch (key) {

      case "network":
      console.log("NNC"
        + " | " + configuration.processName
        + " | EVOLVE OPTION"
        + " | " + key + ": " + params[key].networkId 
        + " | " + params[key].successRate.toFixed(2) + "%"
      );
      break;

      case "mutation":
      console.log("NNC" + " | " + configuration.processName + " | EVOLVE OPTION | " + key + ": " + "FFW");
      // options.mutation = neataptic.methods.mutation[params[key]];
      break;
            
      case "cost":
      console.log("NNC" + " | " + configuration.processName + " | EVOLVE OPTION | " + key + ": " + params[key]);
      options.cost = neataptic.methods.cost[params[key]];

      // work-around for early complete bug
      if (configuration.crossEntropyWorkAroundEnabled && (params[key] === "CROSS_ENTROPY")) { 
        options.threads = 1; 
        console.log(chalkAlert("*** SETTING THREADS = 1 | BUG WORKAROUND ON CROSS_ENTROPY EARLY COMPLETE"));
      } 
      break;

      default:
        if ((key !== "log") && (key !== "trainingSet")){
          console.log("NNC" + " | " + configuration.processName + " | EVOLVE OPTION | " + key + ": " + params[key]);
          options[key] = params[key];
        }
    }

    cb();

  }, function(){

    switch (params.architecture) {

      case "loadedNetwork":
        network = neataptic.Network.fromJSON(options.network.network);
        console.log("NNC"
          + " | " + configuration.processName
          + " | EVOLVE ARCH | LOADED: " + options.network.networkId
          + " | IN: " + options.network.network.input
          + " | OUT: " + options.network.network.output
        );

      break;

      case "perceptron":
        console.log("NNC | EVOLVE ARCH"
          + " | " + configuration.processName
          + " | " + params.architecture
          + " | HIDDEN LAYER NODES: " + params.hiddenLayerSize
        );

        network = new neataptic.architect.Perceptron(
          params.trainingSet[0].input.length, 
          params.hiddenLayerSize,
          params.trainingSet[0].output.length
        );

      break;

      default:
        console.log("NNC | EVOLVE ARCH"
          + " | " + configuration.processName
          + " | " + params.architecture
        );
        network = new neataptic.Network(
          params.trainingSet[0].input.length, 
          params.trainingSet[0].output.length
        );
    }

    let trainingSet = [];

    async.each(params.trainingSet, function(datumObj, cb){

      debug("DATUM | " + datumObj.output + " | " + datumObj.user.screenName);

      trainingSet.push({ 
        input: datumObj.input, 
        output: datumObj.output
      });

      async.setImmediate(function() {
        cb();
      });

    }, function(){

      console.log(chalkAlert("NNC | START EVOLVE"
        + " | " + configuration.processName
        + " | IN: " + params.trainingSet[0].input.length
        + " | OUT: " + params.trainingSet[0].output.length
        + " | ITRTNS: " + options.iterations
        + " | TRAINING SET: " + trainingSet.length + " DATA PTS"
      ));

      async function networkEvolve() {

        let results = await network.evolve(trainingSet, options);

        statsObj.evolve.endTime = moment().valueOf();
        statsObj.evolve.elapsed = moment().valueOf() - statsObj.evolve.startTime;

        results.threads = options.threads;

        if (callback !== undefined) { callback(null, results); }

      }

      networkEvolve().catch(function(err){

        statsObj.evolve.endTime = moment().valueOf();
        statsObj.evolve.elapsed = moment().valueOf() - statsObj.evolve.startTime;

        console.error(chalkError("NNC | " + configuration.processName + " | NETWORK EVOLVE ERROR: " + err));

        process.send({op: "ERROR", processName: configuration.processName, error: err}, function(){

          quit(jsonPrint(err));

        });

      });
    });

  });
}

function train(params, callback){

  if (params.architecture === undefined) { params.architecture = "perceptron"; }

  let options = {};

  if ((params.network !== undefined) && params.network) {
    options.network = params.network;
    params.architecture = "loadedNetwork";
    console.log(chalkAlert("NNC | START NETWORK DEFINED: " + options.network.networkId));
  }

  options.error = params.error;
  options.rate = params.rate;
  options.dropout = params.dropout;
  options.shuffle = params.shuffle;
  options.iterations = params.iterations;
  options.clear = params.clear;
  options.momentum = params.momentum;
  options.batchSize = params.batchSize;
  options.hiddenLayerSize = params.hiddenLayerSize;

  const startTime = moment().valueOf();

  options.schedule = {

    function: function(schedParams){

      let elapsedInt = moment().valueOf() - startTime;

      function schedMsToTime(duration) {
        let seconds = parseInt((duration / 1000) % 60);
        let minutes = parseInt((duration / (1000 * 60)) % 60);
        let hours = parseInt((duration / (1000 * 60 * 60)) % 24);
        let days = parseInt(duration / (1000 * 60 * 60 * 24));

        days = (days < 10) ? "0" + days : days;
        hours = (hours < 10) ? "0" + hours : hours;
        minutes = (minutes < 10) ? "0" + minutes : minutes;
        seconds = (seconds < 10) ? "0" + seconds : seconds;

        return days + ":" + hours + ":" + minutes + ":" + seconds;
      }

      console.log("NNC | TRAIN "
        + " | " + params.runId
        + " | S: " + moment(startTime).format(compactDateTimeFormat)
        + " | R: " + schedMsToTime(elapsedInt)
        + " | I: " + schedParams.iteration + " / " + params.iterations
        // + " | F: " + schedParams.rate.toFixed(1)
        + " | E: " + schedParams.error.toFixed(5)
        // + " | schedParams\n" + jsonPrint(schedParams)
      );

    },
    iterations: 1
  };

  async.each(Object.keys(options), function(key, cb){

    if (key === "network") {
      console.log("NNC"
        + " | TRAIN OPTION | NETWORK: " + options[key].networkId 
        + " | IN: " + options[key].input
        + " | OUT: " + options[key].output
        + " | " + options[key].successRate.toFixed(2) + "%"
      );
    }
    else if (key === "cost") {
      console.log("NNC | TRAIN OPTION | " + key + ": " + options[key]);
      options.cost = neataptic.Methods.Cost[key];
    }
    else if (key === "ratePolicy") {
      console.log("NNC | TRAIN OPTION | " + key + ": " + options[key]);
      options.ratePolicy = neataptic.Methods.Rate[options[key]];
      // options.mutation = neataptic.methods.mutation.FFW;
    }
    cb();


  }, function(){

    // const hiddenLayerSize = parseInt(0.5*(params.trainingSet[0].input.length));

    switch (params.architecture) {

      case "loadedNetwork":
        console.log("NNC | TRAIN ARCH | LOADED: " + options.network.networkId);
        network = neataptic.Network.fromJSON(options.network.network);

      break;

      default:
        console.log("NNC | TRAIN ARCH"
          + "   | " + params.architecture
          + " | HIDDEN LAYER NODES: " + options.hiddenLayerSize
          + "\n"
        );

        network = new neataptic.architect.Perceptron(
          params.trainingSet[0].input.length, 
          options.hiddenLayerSize,
          params.trainingSet[0].output.length
        );
    }

    let trainingSet = [];

    async.each(params.trainingSet, function(datumObj, cb){

      debug("DATUM | " + datumObj.user.screenName);

      trainingSet.push({ 
        input: datumObj.input, 
        output: datumObj.output
      });

      cb();

    }, function(){

      console.log(chalkAlert("\nNNC | ========================\nNNC | START TRAIN"
        + "\nNNC | IN:       " + params.trainingSet[0].input.length
        + "\nNNC | HIDDEN:   " + options.hiddenLayerSize
        + "\nNNC | OUT:      " + params.trainingSet[0].output.length
        + "\nNNC | TRAINING: " + trainingSet.length
      ));

      async function networkTrain() {

        console.log(chalkAlert("\n\nNNC | START TRAIN\nNNC | OPTIONS\nNNC | " + jsonPrint(options)));

        const results = await network.train(trainingSet, options);

        if (callback !== undefined) { callback(null, results); }
      }

      networkTrain().catch(function(err){
        console.error(chalkError("NNC | NETWORK TRAIN ERROR: " + err));
        process.send({op: "ERROR", processName: configuration.processName, error: err}, function(){
          quit(jsonPrint(err));
        });
      });

    });

  });
}


function initStatsUpdate(cnf, callback){

  debug(chalkInfo("NNC | initStatsUpdate | INTERVAL: " + cnf.statsUpdateIntervalTime));

  setInterval(function () {

    statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);
    statsObj.timeStamp = moment().format(defaultDateTimeFormat);

    // saveFile(statsFolder, statsFile, statsObj, function(){
    //   // process.send({op:"STATS", statsObj: statsObj});
    // });

  }, cnf.statsUpdateIntervalTime);

  callback(null, cnf);
}


process.on("message", function(m) {

  debug(chalkAlert("NEURAL NET RX MESSAGE"
    + " | OP: " + m.op
    // + "\n" + jsonPrint(m)
  ));

  let evolveOptions = {};
  let trainParams = {};

  switch (m.op) {

    case "INIT":
      statsObj.testRunId = m.testRunId;
      // statsFile = "neuralNetworkChildStats_" + statsObj.pid + "_" + statsObj.testRunId + ".json";
      console.log(chalkInfo("NNC | STATS FILE: " + statsFolder + "/" + statsFile));
      console.log(chalkInfo("NNC | NEURAL NET INIT"
        + " | PROCESS NAME: " + configuration.processName
        + " | TEST RUN ID: " + statsObj.testRunId
      ));

      initStatsUpdate(configuration, function(){
        process.send({op: "INIT_COMPLETE", processName: configuration.processName});
      });

    break;

    case "TEST_EVOLVE":
      testEvolve({runId: statsObj.testRunId}, function(pass){
        process.send({op:"TEST_EVOLVE_COMPLETE", processName: configuration.processName, results: pass});
      });
    break;

    case "STATS":
      showStats();
      process.send({op:"STATS", processName: configuration.processName, statsObj: statsObj});
    break;

    case "TRAIN":

      statsObj.training.startTime = moment().valueOf();
      statsObj.training.testRunId = m.testRunId;
      statsObj.training.iterations = m.iterations;
      statsObj.training.trainingSet = {};
      statsObj.training.trainingSet.length = m.trainingSet.length;
      statsObj.training.trainingSet.numInputs = m.trainingSet[0].input.length;
      statsObj.training.trainingSet.numOutputs = m.trainingSet[0].output.length;

      statsObj.inputs = {};
      statsObj.inputs = m.inputs;
      statsObj.outputs = {};
      statsObj.outputs = m.outputs;

      trainParams = {
        runId: m.testRunId,
        architecture: m.architecture,
        inputs: m.inputs,
        hiddenLayerSize: m.hiddenLayerSize,
        outputs: m.outputs,
        trainingSet: m.trainingSet,
        log: m.log,
        error: m.error,
        cost: m.cost,
        rate: m.rate,
        dropout: m.dropout,
        shuffle: m.shuffle,
        iterations: m.iterations,
        clear: m.clear,
        momentum: m.momentum,
        ratePolicy: m.ratePolicy,
        batchSize: m.batchSize
      };

      statsObj.train.options = {        
        architecture: m.architecture,
        inputs: m.inputs,
        hiddenLayerSize: m.hiddenLayerSize,
        outputs: m.outputs,
        log: m.log,
        error: m.error,
        cost: m.cost,
        rate: m.rate,
        dropout: m.dropout,
        shuffle: m.shuffle,
        iterations: m.iterations,
        clear: m.clear,
        momentum: m.momentum,
        ratePolicy: m.ratePolicy,
        batchSize: m.batchSize
      };

      if (m.network && (m.network !== undefined)) {

        trainParams.network = m.network;
        statsObj.train.options = m.network;

        console.log(chalkAlert("\n\nNNC | NEURAL NET TRAIN | " + getTimeStamp()
          + "\nNNC | RUN ID:     " + m.testRunId
          + "\nNNC | NETWORK:    " + m.network.networkId + " | " + m.network.successRate.toFixed(2) + "%"
          // + "\nNETWORK:    " + jsonPrint(m.network)
          + "\nNNC | INPUTS:     " + statsObj.training.trainingSet.numInputs
          + "\nNNC | OUTPUTS:    " + statsObj.training.trainingSet.numOutputs
          + "\nNNC | DATA PTS:   " + m.trainingSet.length
          + "\nNNC | ITERATIONS: " + statsObj.training.iterations
          + "\n"
        ));
      }
      else {
        console.log(chalkAlert("\n\nNNC | NEURAL NET TRAIN | " + getTimeStamp()
          + "\nNNC | RUN ID:     " + m.testRunId
          + "\nNNC | INPUTS:     " + statsObj.training.trainingSet.numInputs
          + "\nNNC | OUTPUTS:    " + statsObj.training.trainingSet.numOutputs
          + "\nNNC | DATA PTS:   " + m.trainingSet.length
          + "\nNNC | ITERATIONS: " + statsObj.training.iterations
          + "\n"
        ));
      }

      train(trainParams, function(err, results){

        if (err) {
          console.error(chalkError("NNC | TRAIN ERROR: " + err));
          console.trace("NNC | TRAIN ERROR");
          process.send({op: "ERROR", processName: configuration.processName, error: err}, function(){
            quit(jsonPrint(err));
          });
        }
        else {

          console.log(chalkAlert("\nNNC | TRAIN COMPLETE | " + getTimeStamp()
            + " | RUN ID: " + m.testRunId
            + " | TIME: " + results.time
            + " | ITERATIONS: " + results.iterations
            + " | ERROR: " + results.error
            + "\n"
          ));

          statsObj.training.endTime = moment().valueOf();
          statsObj.training.elapsed = results.time;

          let exportedNetwork = network.toJSON();

          let networkObj = new NeuralNetwork();
          networkObj.networkCreateMode = "train";
          networkObj.testRunId = statsObj.training.testRunId;
          networkObj.networkId = statsObj.training.testRunId + "_" + configuration.processName;
          networkObj.network = exportedNetwork;
          networkObj.inputs = statsObj.inputs;
          networkObj.outputs = statsObj.outputs;
          networkObj.train = {};
          networkObj.train.results = {};
          networkObj.train.results = results;
          networkObj.train.options = {};
          networkObj.train.options = omit(trainParams, "network");
          networkObj.train.options = omit(networkObj.train.options, "input");
          networkObj.train.options = omit(networkObj.train.options, "output");
          if (trainParams.network){
            networkObj.train.options.network = {};
            networkObj.train.options.network.networkId = trainParams.network.networkId;
          }
          networkObj.elapsed = statsObj.training.elapsed;

          process.send({op:"TRAIN_COMPLETE", processName: configuration.processName, networkObj: networkObj, statsObj: statsObj});
          showStats();
        }
      });
    break;
    

    case "EVOLVE":

      statsObj.training.startTime = moment().valueOf();
      statsObj.training.testRunId = m.testRunId;
      statsObj.training.seedNetworkId = m.seedNetworkId;
      statsObj.training.seedNetworkRes = m.seedNetworkRes;
      statsObj.training.iterations = m.iterations;
      statsObj.training.trainingSet = {};
      statsObj.training.trainingSet.length = m.trainingSet.length;
      statsObj.training.trainingSet.numInputs = m.trainingSet[0].input.length;
      statsObj.training.trainingSet.numOutputs = m.trainingSet[0].output.length;

      statsObj.inputs = {};
      statsObj.inputs = m.inputs;
      statsObj.outputs = {};
      statsObj.outputs = m.outputs;

      evolveOptions = {};
      evolveOptions = {
        runId: m.testRunId,
        threads: m.threads,
        architecture: m.architecture,
        seedNetworkId: m.seedNetworkId,
        seedNetworkRes: m.seedNetworkRes,
        inputs: m.inputs,
        outputs: m.outputs,
        trainingSet: m.trainingSet,
        mutation: m.mutation,
        equal: m.equal,
        popsize: m.popsize,
        elitism: m.elitism,
        log: m.log,
        error: m.error,
        iterations: m.iterations,
        mutationRate: m.mutationRate,
        cost: m.cost,
        growth: m.growth,
        clear: m.clear
      };

      statsObj.evolve.options = {};

      statsObj.evolve.options = {
        threads: m.threads,
        seedNetworkId: m.seedNetworkId,
        seedNetworkRes: m.seedNetworkRes,
        architecture: m.architecture,
        mutation: m.mutation,
        mutationRate: m.mutationRate,
        equal: m.equal,
        cost: m.cost,
        clear: m.clear,
        error: m.error,
        popsize: m.popsize,
        growth: m.growth,
        elitism: m.elitism,
        iterations: m.iterations,
        log: m.log
      };

      if (m.network && (m.network !== undefined)) {

        evolveOptions.network = m.network;
        statsObj.evolve.options.network = m.network;

        console.log(chalkAlert("NNC | EVOLVE | " + getTimeStamp()
          + " | " + configuration.processName
          + " | " + m.testRunId
          + " | SEED: " + m.seedNetworkId
          + " | SEED RES %: " + m.seedNetworkRes.toFixed(2)
          + " | THRDs: " + m.threads
          + " | NN: " + m.network.networkId + " | " + m.network.successRate.toFixed(2) + "%"
          + " | IN: " + statsObj.training.trainingSet.numInputs
          + " | OUT: " + statsObj.training.trainingSet.numOutputs
          + " | TRSET: " + m.trainingSet.length
          + " | ITRS: " + statsObj.training.iterations
        ));
      }
      else {
        console.log(chalkAlert("NNC | EVOLVE | " + getTimeStamp()
          + " | " + configuration.processName
          + " | " + m.testRunId
          + " | SEED: " + "---"
          + " | SEED RES %: " + "---"
          + " | THRDs: " + m.threads
          + " | IN: " + statsObj.training.trainingSet.numInputs
          + " | OUT: " + statsObj.training.trainingSet.numOutputs
          + " | TRSET: " + m.trainingSet.length
          + " | ITRS: " + statsObj.training.iterations
        ));
      }

      // setTimeout(function(){

        evolve(evolveOptions, function(err, results){

          if (err) {
            console.error(chalkError("NNC | EVOLVE ERROR: " + err));
            console.trace("NNC | EVOLVE ERROR");
            process.send({op: "ERROR", processName: configuration.processName, error: err}, function(){
              quit(jsonPrint(err));
            });
          }
          else {

            debug(chalkAlert("evolve results\n" + jsonPrint(results)));

            statsObj.training.endTime = moment().valueOf();
            statsObj.training.elapsed = results.time;
            statsObj.evolve.results = results;

            let exportedNetwork = network.toJSON();

            let networkObj = {};

            const defaultResults = {
              error: 0,
              iterations: 0
            };

            networkObj.networkCreateMode = "evolve";
            networkObj.testRunId = statsObj.training.testRunId;
            networkObj.networkId = statsObj.training.testRunId;
            networkObj.seedNetworkId = statsObj.training.seedNetworkId;
            networkObj.seedNetworkRes = statsObj.training.seedNetworkRes;
            networkObj.network = {};
            networkObj.network = exportedNetwork;
            networkObj.numInputs = exportedNetwork.input;
            networkObj.numOutputs = exportedNetwork.output;
            networkObj.evolve = {};
            networkObj.evolve.results = {};
            networkObj.evolve.results = results;
            networkObj.evolve.results.error = ((results.error !== undefined) && results.error && (results.error < Infinity)) ? results.error : 0;
            networkObj.evolve.options = {};
            networkObj.evolve.options = evolveOptions;
            networkObj.startTime = statsObj.evolve.startTime;
            networkObj.endTime = statsObj.evolve.endTime;
            networkObj.evolve.elapsed = statsObj.training.elapsed;

           if (((results.error === 0) || (results.error > evolveOptions.error)) && (results.iterations < evolveOptions.iterations)) {

              statsObj.evolve.results.earlyComplete = true;
              networkObj.evolve.results.earlyComplete = true;

              console.log(chalkError("NNC | EVOLVE COMPLETE EARLY???"
                + " | " + configuration.processName
                + " | " + getTimeStamp()
                + " | " + "TIME: " + results.time
                + " | " + "THREADS: " + results.threads
                + " | " + "ITERATIONS: " + results.iterations
                + " | " + "ERROR: " + results.error
                + " | " + "ELAPSED: " + msToTime(statsObj.evolve.elapsed)
              ));

            }
            else {
              console.log(chalkAlert("NNC | EVOLVE COMPLETE"
                + " | " + configuration.processName
                + " | " + getTimeStamp()
                + " | " + "TIME: " + results.time
                + " | " + "THREADS: " + results.threads
                + " | " + "ITERATIONS: " + results.iterations
                + " | " + "ERROR: " + results.error
                + " | " + "ELAPSED: " + msToTime(statsObj.evolve.elapsed)
              ));
            }

            process.send({op:"EVOLVE_COMPLETE", processName: configuration.processName, networkObj: networkObj, statsObj: statsObj});
            showStats();
          }
        });

      // }, 5000);


    break;

    default:
      console.log(chalkError("NNC | NEURAL NETIZE UNKNOWN OP ERROR"
        + " | " + m.op
      ));
  }
});

function initialize(cnf, callback){

  cnf.processName = process.env.NNC_PROCESS_NAME || "neuralNetworkChild";

  cnf.verbose = process.env.TNN_VERBOSE_MODE || false ;
  cnf.globalTestMode = process.env.TNN_GLOBAL_TEST_MODE || false ;
  cnf.testMode = process.env.TNN_TEST_MODE || false ;
  cnf.quitOnError = process.env.TNN_QUIT_ON_ERROR || false ;

  if (process.env.TNN_CROSS_ENTROPY_WORKAROUND_ENABLED !== undefined){
    if (process.env.TNN_CROSS_ENTROPY_WORKAROUND_ENABLED === "false" || !process.env.TNN_CROSS_ENTROPY_WORKAROUND_ENABLED){
      cnf.crossEntropyWorkAroundEnabled = false;
    }
    else {
      cnf.crossEntropyWorkAroundEnabled = true;
    }
  }

  cnf.statsUpdateIntervalTime = process.env.TNN_STATS_UPDATE_INTERVAL || 60000;

  debug("NNC | CONFIG\n" + jsonPrint(cnf));

  debug(chalkWarn("dropboxConfigFolder: " + dropboxConfigFolder));
  debug(chalkWarn("dropboxConfigFile  : " + dropboxConfigFile));

  callback(null, cnf);
}

configEvents.on("newListener", function(data){
  console.log(chalkInfo("NNC | *** NEW CONFIG EVENT LISTENER: " + data));
});

configEvents.on("removeListener", function(data){
  console.log(chalkInfo("NNC | *** REMOVED CONFIG EVENT LISTENER: " + data));
});

setTimeout(function(){

  initialize(configuration, function(err, cnf){

    if (err && (err.status !== 404)) {
      console.error(chalkError("NNC | ***** INIT ERROR *****\n" + jsonPrint(err)));
      console.trace("NNC INIT ERROR");
      process.send({op:"ERROR", error: err, processName: configuration.processName, statsObj: statsObj}, function(){
        quit();
      });
    }
    else {
      console.log(chalkAlert("NNC | " + cnf.processName + " STARTED " + getTimeStamp()));
      process.send({op: "READY", processName: configuration.processName});
    }

  });
}, 1 * ONE_SECOND);



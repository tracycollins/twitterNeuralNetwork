/*jslint node: true */
"use strict";

let ONE_SECOND = 1000 ;
// let ONE_MINUTE = ONE_SECOND*60 ;

const async = require("async");
const os = require("os");
const omit = require("object.omit");
const deepcopy = require("deep-copy");

let hostname = os.hostname();
hostname = hostname.replace(/\.home/g, "");
hostname = hostname.replace(/\.local/g, "");
hostname = hostname.replace(/\.fios-router\.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");

const defaultDateTimeFormat = "YYYY-MM-DD HH:mm:ss ZZ";
const compactDateTimeFormat = "YYYYMMDD HHmmss";

const neataptic = require("neataptic");
let network;

const mongoose = require("./config/mongoose");

const db = mongoose();

const NeuralNetwork = require("mongoose").model("NeuralNetwork");


const EventEmitter2 = require("eventemitter2").EventEmitter2;
let configEvents = new EventEmitter2({
  wildcard: true,
  newListener: true,
  maxListeners: 20,
  verboseMemoryLeak: true
});

let configuration = {};
configuration.verbose = false;
configuration.globalTestMode = false;
configuration.defaultPopulationSize = 100;
configuration.testMode = false; // 
configuration.keepaliveInterval = 30*ONE_SECOND;
configuration.rxQueueInterval = 1*ONE_SECOND;

const util = require("util");
const moment = require("moment");
const Dropbox = require("dropbox");
const debug = require("debug")("la");

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

debug("neataptic\n" + jsonPrint(neataptic));

console.log("\n\nNNC | =================================");
console.log("NNC | HOST:          " + hostname);
console.log("NNC | PROCESS ID:    " + process.pid);
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

statsObj.memory = {};
statsObj.memory.rss = process.memoryUsage().rss/(1024*1024);
statsObj.memory.maxRss = process.memoryUsage().rss/(1024*1024);
statsObj.memory.maxRssTime = moment().valueOf();

statsObj.startTime = moment().valueOf();
statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);

statsObj.evolve = {};
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
const DROPBOX_TNN_STATS_FILE = process.env.DROPBOX_TNN_STATS_FILE || "neuralNetworkStats.json";

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
    currentTimeStamp = moment().format(defaultDateTimeFormat);
    return currentTimeStamp;
  }
  else if (moment.isMoment(inputTime)) {
    currentTimeStamp = moment(inputTime).format(defaultDateTimeFormat);
    return currentTimeStamp;
  }
  else {
    currentTimeStamp = moment(parseInt(inputTime)).format(defaultDateTimeFormat);
    return currentTimeStamp;
  }
}

function saveFile (path, file, jsonObj, callback){

  const fullPath = path + "/" + file;

  debug(chalkInfo("LOAD FOLDER " + path));
  debug(chalkInfo("LOAD FILE " + file));
  console.log(chalkInfo("SAVE FILE FULL PATH " + fullPath));

  let options = {};

  options.contents = JSON.stringify(jsonObj, null, 2);
  options.path = fullPath;
  options.mode = "overwrite";
  options.autorename = false;

  dropboxClient.filesUpload(options)
    .then(function(response){
      debug(chalkLog("SAVED DROPBOX JSON | " + options.path));
      if (callback !== undefined) { callback(null, response); }
    })
    .catch(function(err){
      console.error(chalkError(moment().format(defaultDateTimeFormat) 
        + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
      ));
      if (err.status === 429) {
        console.error("TOO MANY DROPBOX WRITES");
        if (callback !== undefined) { callback(null, null); }
      }
      else {
        console.error("ERROR\n" + jsonPrint(err));
        console.error("ERROR.ERROR\n" + jsonPrint(err.error));
        if (callback !== undefined) { callback(err, null); }
      }
    });
}

function showStats(options){
  if ((statsObj.training.startTime > 0) && (statsObj.training.endTime > 0)){
    statsObj.training.elapsed = msToTime(statsObj.training.endTime - statsObj.training.startTime);
  }
  else if (statsObj.training.startTime > 0){
    statsObj.training.elapsed = msToTime(moment().valueOf() - statsObj.training.startTime);
  }

  statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);
  statsObj.memory.rss = process.memoryUsage().rss/(1024*1024);

  if (statsObj.memory.rss > statsObj.memory.maxRss) {
    statsObj.memory.maxRss = statsObj.memory.rss;
    statsObj.memory.maxRssTime = moment().valueOf();
  }

  if (options) {
    console.log("NNC | STATS | " + Object.keys(statsObj));
  }
  else {
    console.log(chalk.green("NNC | S"
      + " | START: " + moment(parseInt(statsObj.startTime)).format(compactDateTimeFormat)
      + " | ELAPSED: " + statsObj.elapsed
      + " | TRAINING START: " + moment(parseInt(statsObj.training.startTime)).format(compactDateTimeFormat)
      + " | TRAINING ELAPSED: " + statsObj.elapsed
    ));
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

process.on("SIGHUP", function() {
  quit("SIGHUP");
});

process.on("SIGINT", function() {
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
    // equal: true,
    popsize: 100,
    elitism: 10,
    // log: 100,
    error: 0.03,
    iterations: 10000,
    mutationRate: 0.7,
    schedule: {
      function: function(schedParams){ 
        console.log("NNC SCHED"
          + " | " + params.runId
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

    // console.log(chalkAlert("NNC | TEST EVOLVE RESULTS\n" + jsonPrint(results)));
    console.log(chalkAlert("\nNNC | EVOLVE RESULTS"
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

        console.log("NNC | TEST"
          + " | IN: " + datum.input
          + " | EO: " + datum.output[0]
          + " | TO: " + dataOut
          + " | PASS: " + datumPass
        );

        cb();

      });

    }, function(){
      console.log(chalkAlert("TEST RESULT: PASS: " + testPass));
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
    console.log(chalkAlert("START NETWORK DEFINED: " + options.network.networkId));
  }

  options.elitism = params.elitism;
  options.equal = params.equal;
  options.error = params.error;
  options.iterations = params.iterations;
  // options.log = params.log;
  options.mutation = params.mutation;
  options.mutationRate = params.mutationRate;
  options.popsize = params.popsize;

  const startTime = moment().valueOf();

  options.schedule = {

    function: function(schedParams){

      var elapsedInt = moment().valueOf() - startTime;

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

      console.log("NNC"
        + " | " + params.runId
        + " | S: " + moment(startTime).format(compactDateTimeFormat)
        + " | R: " + schedMsToTime(elapsedInt)
        + " | I: " + schedParams.iteration + " / " + params.iterations
        + " | F: " + schedParams.fitness.toFixed(5)
        + " | E: " + schedParams.error.toFixed(5)
      );

    },
    iterations: 1
  };


  async.each(Object.keys(options), function(key, cb){

    if (key === "network") {
      console.log("NNC | EVOLVE OPTION | " + key + ": " + options[key].networkId + " | " + options[key].successRate.toFixed(2) + "%");
      // options.mutation = neataptic.methods.mutation[key];
      // options.mutation = neataptic.methods.mutation.FFW;
    }
    else if (key === "mutation") {
      console.log("NNC | EVOLVE OPTION | " + key + ": " + options[key]);
      options.mutation = neataptic.methods.mutation[options[key]];
      // options.mutation = neataptic.methods.mutation.FFW;
    }
    else if ((key === "activation") && (options[key] !== undefined)) {
      console.log("NNC | EVOLVE OPTION | " + key + ": " + options[key]);
      options.activation = neataptic.Methods.Activation[options[key]];
    }
    else if (key === "cost") {
      console.log("NNC | EVOLVE OPTION | " + key + ": " + options[key]);
      options.cost = neataptic.Methods.Cost[options[key]];
    }
    else if (key !== "activation") {
      console.log("NNC | EVOLVE OPTION | " + key + ": " + options[key]);
    }
    cb();

  }, function(){


    // const hiddenLayerSize = params.trainingSet[0].datum.input.length + params.trainingSet[0].datum.output.length;
    // const hiddenLayerSize = parseInt(0.5*(params.trainingSet[0].datum.input.length));

    switch (params.architecture) {

      case "loadedNetwork":
        network = neataptic.Network.fromJSON(options.network.network);
        console.log("NNC"
          + " | EVOLVE ARCH | LOADED: " + options.network.networkId
          + " | IN: " + options.network.network.input
          + " | OUT: " + options.network.network.output
        );

      break;

      case "perceptron":
        console.log("NNC | EVOLVE ARCH"
          + "   | " + params.architecture
          + " | HIDDEN LAYER NODES: " + params.hiddenLayerSize
          + "\n"
        );

        network = new neataptic.architect.Perceptron(
          params.trainingSet[0].datum.input.length, 
          params.hiddenLayerSize,
          params.trainingSet[0].datum.output.length
        );

      break;

      default:
        console.log("NNC | EVOLVE ARCH   | " + params.architecture + "\n");
        network = new neataptic.Network(
          params.trainingSet[0].datum.input.length, 
          params.trainingSet[0].datum.output.length
        );
    }

    let trainingSet = [];

    async.each(params.trainingSet, function(datumObj, cb){

      debug("DATUM | " + datumObj.name);

      trainingSet.push({ 
        input: datumObj.datum.input, 
        output: datumObj.datum.output
      });

      cb();

    }, function(){

      console.log(chalkAlert("\n========================\nNNC | START EVOLVE\n========================"
        + "\nIN:            " + params.trainingSet[0].datum.input.length
        + "\nOUT:           " + params.trainingSet[0].datum.output.length
        + "\nTRAINING DATA: " + trainingSet.length
        + "\n========================\n"
     ));

      async function networkEvolve() {
        const results = await network.evolve(trainingSet, options);
        if (callback !== undefined) { callback(null, results); }
      }

      networkEvolve().catch(function(err){
        console.error(chalkError("NNC NETWORK EVOLVE ERROR: " + err));
        quit("NNC NETWORK EVOLVE ERROR: " + err);
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
    console.log(chalkAlert("START NETWORK DEFINED: " + options.network.networkId));
  }

  // options.log = params.log;
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

      var elapsedInt = moment().valueOf() - startTime;

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

      console.log("NNC"
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
    cb();

  }, function(){

    // const hiddenLayerSize = parseInt(0.5*(params.trainingSet[0].datum.input.length));

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
          params.trainingSet[0].datum.input.length, 
          options.hiddenLayerSize,
          params.trainingSet[0].datum.output.length
        );
    }

    let trainingSet = [];

    async.each(params.trainingSet, function(datumObj, cb){

      debug("DATUM | " + datumObj.name);

      trainingSet.push({ 
        input: datumObj.datum.input, 
        output: datumObj.datum.output
      });

      cb();

    }, function(){

      console.log(chalkAlert("\n========================\nNNC | START TRAIN"
        + "\nIN:       " + params.trainingSet[0].datum.input.length
        + "\nHIDDEN:   " + options.hiddenLayerSize
        + "\nOUT:      " + params.trainingSet[0].datum.output.length
        + "\nTRAINING: " + trainingSet.length
      ));

      async function networkTrain() {

        console.log(chalkAlert("\n\nSTART TRAIN\nOPTIONS\n" + jsonPrint(options)));

        const results = await network.train(trainingSet, options);

        if (callback !== undefined) { callback(null, results); }
      }

      networkTrain().catch(function(err){
        console.error(chalkError("NNC NETWORK TRAIN ERROR: " + err));
      });

    });

  });
}

process.on("message", function(m) {

  console.log(chalkAlert("NEURAL NET RX MESSAGE"
    + " | OP: " + m.op
    // + "\n" + jsonPrint(m)
  ));

  let evolveOptions = {};
  let trainParams = {};

  switch (m.op) {

    case "INIT":
      statsObj.testRunId = m.testRunId;
      // statsObj.neuralNetworkFile = "neuralNetwork_" + m.testRunId + ".json";
      // statsObj.defaultNeuralNetworkFile = "neuralNetwork.json";
      console.log(chalkInfo("NNC | NEURAL NET INIT"
        + " | TEST RUN ID: " + statsObj.testRunId
        // + " | NEURAL NETWORK FILE: " + statsObj.neuralNetworkFile
        // + " | DEFAULT NEURAL NETWORK FILE: " + statsObj.defaultNeuralNetworkFile
      ));

    break;

    case "TEST_EVOLVE":
      testEvolve({runId: statsObj.testRunId}, function(pass){
        process.send({op:"TEST_EVOLVE_COMPLETE", results: pass});
      });
    break;

    case "STATS":
      showStats();
    break;

    case "TRAIN":

      statsObj.training.startTime = moment().valueOf();
      statsObj.training.testRunId = m.testRunId;
      statsObj.training.iterations = m.iterations;
      statsObj.training.trainingSet = {};
      statsObj.training.trainingSet.length = m.trainingSet.length;
      statsObj.training.trainingSet.numInputs = m.trainingSet[0].datum.input.length;
      statsObj.training.trainingSet.numOutputs = m.trainingSet[0].datum.output.length;

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

        console.log(chalkAlert("\n\nNNC | NEURAL NET TRAIN"
          + "\nNETWORK:    " + m.network.networkId + " | " + m.network.successRate.toFixed(2) + "%"
          // + "\nNETWORK:    " + jsonPrint(m.network)
          + "\nINPUTS:     " + statsObj.training.trainingSet.numInputs
          + "\nOUTPUTS:    " + statsObj.training.trainingSet.numOutputs
          + "\nDATA PTS:   " + m.trainingSet.length
          + "\nITERATIONS: " + statsObj.training.iterations
          + "\n"
        ));
      }
      else {
        console.log(chalkAlert("\n\nNNC | NEURAL NET TRAIN"
          + "\nINPUTS:     " + statsObj.training.trainingSet.numInputs
          + "\nOUTPUTS:    " + statsObj.training.trainingSet.numOutputs
          + "\nDATA PTS:   " + m.trainingSet.length
          + "\nITERATIONS: " + statsObj.training.iterations
          + "\n"
        ));
      }

      train(trainParams, function(err, results){

        if (err) {
          console.error(chalkError("NNC TRAIN ERROR: " + err));
          console.trace("NNC TRAIN ERROR");
          process.send({op:"TRAIN_COMPLETE", error: err, statsObj: statsObj});
        }
        else {

          console.log(chalkAlert("\nNNC | TRAIN RESULTS"
            + " | " + "TIME: " + results.time
            + " | " + "ITERATIONS: " + results.iterations
            + " | " + "ERROR: " + results.error
            + "\n"
          ));

          statsObj.training.endTime = moment().valueOf();
          statsObj.training.elapsed = results.time;

          let exportedNetwork = network.toJSON();

          let networkObj = new NeuralNetwork();
          networkObj.testRunId = statsObj.training.testRunId;
          networkObj.networkId = statsObj.training.testRunId;
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

          console.log(chalkAlert("NNC | TRAIN COMPLETE"));
          // console.log(chalkAlert("NNC | NORMALIZATION\n" + jsonPrint(networkObj.normalization)));

          process.send({op:"TRAIN_COMPLETE", networkObj: networkObj, statsObj: statsObj});
          showStats();
        }
      });
    break;
    

    case "EVOLVE":

      statsObj.training.startTime = moment().valueOf();
      statsObj.training.testRunId = m.testRunId;
      statsObj.training.iterations = m.iterations;
      statsObj.training.trainingSet = {};
      statsObj.training.trainingSet.length = m.trainingSet.length;
      statsObj.training.trainingSet.numInputs = m.trainingSet[0].datum.input.length;
      statsObj.training.trainingSet.numOutputs = m.trainingSet[0].datum.output.length;

      statsObj.inputs = {};
      statsObj.inputs = m.inputs;
      statsObj.outputs = {};
      statsObj.outputs = m.outputs;

      evolveOptions = {
        runId: m.testRunId,
        architecture: m.architecture,
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
        activation: m.activation,
        cost: m.cost,
        clear: m.clear
      };

      statsObj.evolve.options = {
        // network: m.network,
        architecture: m.architecture,
        mutation: m.mutation,
        mutationRate: m.mutationRate,
        activation: m.activation,
        equal: m.equal,
        cost: m.cost,
        clear: m.clear,
        error: m.error,
        popsize: m.popsize,
        elitism: m.elitism,
        iterations: m.iterations,
        log: m.log
      };

      if (m.network && (m.network !== undefined)) {

        evolveOptions.network = m.network;
        statsObj.evolve.options.network = m.network;

        console.log(chalkAlert("\n\nNNC | NEURAL NET EVOLVE"
          + "\nNETWORK:    " + m.network.networkId + " | " + m.network.successRate.toFixed(2) + "%"
          // + "\nNETWORK:    " + jsonPrint(m.network)
          + "\nINPUTS:     " + statsObj.training.trainingSet.numInputs
          + "\nOUTPUTS:    " + statsObj.training.trainingSet.numOutputs
          + "\nDATA PTS:   " + m.trainingSet.length
          + "\nITERATIONS: " + statsObj.training.iterations
          + "\n"
        ));
      }
      else {
        console.log(chalkAlert("\n\nNNC | NEURAL NET EVOLVE"
          + "\nINPUTS:     " + statsObj.training.trainingSet.numInputs
          + "\nOUTPUTS:    " + statsObj.training.trainingSet.numOutputs
          + "\nDATA PTS:   " + m.trainingSet.length
          + "\nITERATIONS: " + statsObj.training.iterations
          + "\n"
        ));
      }


      evolve(evolveOptions, function(err, results){

        if (err) {
          console.error(chalkError("NNC EVOLVE ERROR: " + err));
          console.trace("NNC EVOLVE ERROR");
          process.send({op:"EVOLVE_COMPLETE", error: err, statsObj: statsObj});
        }
        else {

          console.log(chalkAlert("\nNNC | EVOLVE RESULTS"
            + " | " + "TIME: " + results.time
            + " | " + "ITERATIONS: " + results.iterations
            + " | " + "ERROR: " + results.error
            + "\n"
          ));

          statsObj.training.endTime = moment().valueOf();
          statsObj.training.elapsed = results.time;
          // statsObj.evolve = {};
          // statsObj.evolve.results = {};
          statsObj.evolve.results = results;

          let exportedNetwork = network.toJSON();

          let networkObj = new NeuralNetwork();
          networkObj.testRunId = statsObj.training.testRunId;
          networkObj.networkId = statsObj.training.testRunId;
          networkObj.network = exportedNetwork;
          networkObj.numInputs = exportedNetwork.input;
          networkObj.numOutputs = exportedNetwork.output;
          networkObj.evolve = {};
          networkObj.evolve.results = {};
          networkObj.evolve.results = results;
          networkObj.evolve.options = {};
          networkObj.evolve.options = evolveOptions;
          // networkObj.evolve.options.network = null;
          // if (evolveOptions.network){
          //   networkObj.evolve.options.network = {};
          //   networkObj.evolve.options.network.networkId = evolveOptions.network.networkId;
          // }
          networkObj.elapsed = statsObj.training.elapsed;

          console.log(chalkAlert("NNC | EVOLVE COMPLETE"));
          // console.log(chalkAlert("NNC | NORMALIZATION\n" + jsonPrint(networkObj.normalization)));

          process.send({op:"EVOLVE_COMPLETE", networkObj: networkObj, statsObj: statsObj});
          showStats();
        }

      });
    break;

    default:
      console.log(chalkError("NNC | NEURAL NETIZE UNKNOWN OP ERROR"
        + " | " + m.op
      ));
  }
});

function initStatsUpdate(cnf, callback){

  console.log(chalkInfo("NNC | initStatsUpdate | INTERVAL: " + cnf.statsUpdateIntervalTime));

  setInterval(function () {

    statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);
    statsObj.timeStamp = moment().format(defaultDateTimeFormat);

    saveFile(statsFolder, statsFile, statsObj, function(){
      process.send({op:"STATS", statsObj: statsObj});
    });

  }, cnf.statsUpdateIntervalTime);

  callback(null, cnf);
}

function initialize(cnf, callback){

  cnf.processName = process.env.TNN_PROCESS_NAME || "neuralNetworkChild";

  cnf.verbose = process.env.TNN_VERBOSE_MODE || false ;
  cnf.globalTestMode = process.env.TNN_GLOBAL_TEST_MODE || false ;
  cnf.testMode = process.env.TNN_TEST_MODE || false ;
  cnf.quitOnError = process.env.TNN_QUIT_ON_ERROR || false ;

  cnf.statsUpdateIntervalTime = process.env.TNN_STATS_UPDATE_INTERVAL || 60000;

  console.log("NNC | CONFIG\n" + jsonPrint(cnf));

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
      // if (err.status !== 404){
      //   console.log("err.status: " + err.status);
        quit();
      // }
    }
    initStatsUpdate(cnf, function(){
      console.log("NNC | " + cnf.processName + " STARTED " + getTimeStamp() + "\n");
      process.send({op: "READY"});
    });
  });
}, 1 * ONE_SECOND);



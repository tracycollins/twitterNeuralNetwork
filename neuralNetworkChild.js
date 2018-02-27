/*jslint node: true */
"use strict";

let ONE_SECOND = 1000 ;
// let ONE_MINUTE = ONE_SECOND*60 ;

const async = require("async");
const _ = require("lodash");
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

// const neataptic = require("neataptic");
const neataptic = require("./js/neataptic");
let network;

const mongoose = require("mongoose");
mongoose.Promise = global.Promise;

const neutralNetworkModel = require("@threeceelabs/mongoose-twitter/models/neuralNetwork.server.model");

let NeuralNetwork;

const wordAssoDb = require("@threeceelabs/mongoose-twitter");
const dbConnection = wordAssoDb();

dbConnection.on("error", console.error.bind(console, "connection error:"));
dbConnection.once("open", function() {
  console.log("CONNECT: TWEET SERVER MONGOOSE default connection open");
  NeuralNetwork = mongoose.model("NeuralNetwork", neutralNetworkModel.NeuralNetworkSchema);
});

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
// const Dropbox = require('dropbox').Dropbox;
const Dropbox = require("./js/dropbox").Dropbox;

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

// statsObj.inputTypes = [];

statsObj.evolve = {};
statsObj.evolve.startTime = moment().valueOf();
statsObj.evolve.endTime = moment().valueOf();
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
    + " | PROCESS NAME: " + configuration.processName
    + " | PID: " + process.pid    
  );
  process.exit();
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

function printDatum(title, input){

  // console.log("\nNNT | ------------- " + title + " -------------");
  // console.log("printDatum\n" + jsonPrint(input));

  let row = "";
  let col = 0;
  let rowNum = 0;
  const COLS = 20;

  console.log("\nNNT | ------------- " + title + " -------------");

  input.forEach(function(value, i){
    if (col < COLS){
      // row = row + (bit ? "X" : ".");
      row = row + " " + value.toFixed(2);
      col += 1;
    }
    else {
      console.log("NNT | ROW " + rowNum + " | " + row);
      // row = bit ? "X" : ".";
      row = value.toFixed(2);
      col = 1;
      rowNum += 1;
    }
  });
}

function convertDatum(params, datum, generateInputRaw, callback){

  const inputTypes = Object.keys(params.inputsObj.inputs).sort();

  // console.log("convertedDatum params\n" + jsonPrint(params));

  let convertedDatum = {};
  convertedDatum.user = {};
  convertedDatum.user = datum.screenName;
  convertedDatum.input = [];
  convertedDatum.output = [];
  convertedDatum.inputRaw = [];

  switch (datum.classification) {
    case "left":
    convertedDatum.output = [1, 0, 0];
    break;
    case "neutral":
    convertedDatum.output = [0, 1, 0];
    break;
    case "right":
    convertedDatum.output = [0, 0, 1];
    break;
    case "default":
    convertedDatum.output = [0, 0, 0];
    break;
  }

  async.eachSeries(inputTypes, function(inputType, cb0){


    const inNames = params.inputsObj.inputs[inputType].sort();

    async.eachSeries(inNames, function(inName, cb1){

      const inputName = inName;

      if (generateInputRaw) {
        convertedDatum.inputRaw.push(inputName);
      }

      if ((datum.histograms[inputType] !== undefined) && (datum.histograms[inputType][inputName] !== undefined)){
        // convertedDatum.input.push(1);

        if ((params.trainingSet.maxInputHashMap === undefined) || (params.trainingSet.maxInputHashMap[inputType] === undefined)) {
          debug(chalkAlert("UNDEFINED??? params.trainingSet.maxInputHashMap." + inputType + " | " + inputName));
          convertedDatum.input.push(1);
        }
        else {
          const inputValue = (params.trainingSet.maxInputHashMap[inputType][inputName] > 0) ? datum.histograms[inputType][inputName]/params.trainingSet.maxInputHashMap[inputType][inputName] : 1;
          convertedDatum.input.push(inputValue);
        }

        async.setImmediate(function() {
          cb1();
        });
      }
      else {
        convertedDatum.input.push(0);
        async.setImmediate(function() {
          cb1();
        });
      }

    }, function(){
      cb0();
    });

  }, function(){
    callback(null, convertedDatum);
  });
}

function trainingSetPrepAndEvolve(params, options, callback){

  let trainingSet = [];
  let inputRaw = [];
  let generateInputRaw = true;
  
  console.log("NNC | TRAINING SET PREP + EVOLVE"
    + " | DATA LENGTH: " + params.trainingSet.data.length
  );

  const shuffledTrainingData = _.shuffle(params.trainingSet.data);

  async.eachSeries(shuffledTrainingData, function(datum, cb){

    // console.log("datum\n" + jsonPrint(datum));

    convertDatum(params, datum, generateInputRaw, function(err, datumObj){

      if (datumObj.inputRaw.length > 0) { 
        generateInputRaw = false;
        inputRaw = datumObj.inputRaw;
      }

      // console.log("TRAIN DATUM | " + datumObj.output + " | " + datumObj.user);
      // printDatum(datumObj.user, datumObj.input);

      trainingSet.push({ 
        input: datumObj.input, 
        output: datumObj.output
      });

      async.setImmediate(function() {
        cb();
      });

    });

  }, function(){

    console.log(chalkAlert("NNC | START EVOLVE"
      + " | " + configuration.processName
      + " | IN: " + params.inputsObj.meta.numInputs
      + " | IN: " + trainingSet[0].input.length
      + " | OUT: " + params.trainingSet.meta.numOutputs
      + " | OUT: " + trainingSet[0].output.length
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

        if (callback !== undefined) { callback(err, null); }

      });

    });
  });
}

function evolve(params, callback){

  debug("evolve params.network\n" + jsonPrint(params.network));

  if (params.architecture === undefined) { params.architecture = "random"; }

  let options = {};

  if ((params.network !== undefined) && params.networkObj) {
    options.networkObj = params.networkObj;
    params.architecture = "loadedNetwork";
    debug(chalkAlert("NNC | START NETWORK DEFINED: " + options.networkObj.networkId));
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
        + " | IN: " + params.inputsObj.meta.numInputs
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

    network = {};

    switch (params.architecture) {

      case "loadedNetwork":
        network = neataptic.Network.fromJSON(options.networkObj.network);

        console.log("NNC"
          + " | " + configuration.processName
          + " | EVOLVE ARCH | LOADED: " + options.networkObj.networkId
          + " | IN: " + options.networkObj.network.input
          + " | OUT: " + options.networkObj.network.output
        );

        trainingSetPrepAndEvolve(params, options, function(err, results){
          callback(err, results);
        });

      break;

      case "perceptron":
        console.log("NNC | EVOLVE ARCH"
          + " | " + configuration.processName
          + " | " + params.architecture
          + " | HIDDEN LAYER NODES: " + params.hiddenLayerSize
        );

        network = new neataptic.architect.Perceptron(
          params.trainingSet.meta.numInputs, 
          params.hiddenLayerSize,
          params.trainingSet.meta.numOutputs
        );

        trainingSetPrepAndEvolve(params, options, function(err, results){
          callback(err, results);
        });

      break;

      default:
        console.log("NNC | EVOLVE ARCH"
          + " | " + configuration.processName
          + " | " + params.architecture.toUpperCase()
          + " | INPUTS: " + params.inputsObj.meta.numInputs
          + " | OUTPUTS: " + params.trainingSet.meta.numOutputs
        );

        network = new neataptic.Network(
          params.inputsObj.meta.numInputs, 
          3
        );

        // network.nodes[0].name = "magnitude";
        // network.nodes[0].inputType = "sentiment";
        // network.nodes[1].name = "score";
        // network.nodes[1].inputType = "sentiment";

        // const nnInputTypes = Object.keys(params.inputs);

        // let nodeIndex = 2; // skip 

        // async.eachSeries(nnInputTypes, function(inputType, cb0){

        //   const typeInputArray = params.inputs[inputType];

        //   async.eachSeries(typeInputArray, function(inputName, cb1){

        //     console.log("IN [" + nodeIndex + "]: " + inputName);
        //     if (network.nodes[nodeIndex].type !== "input") {
        //       console.log(chalkError("NOT INPUT ERROR " + nodeIndex + " | " + inputName));
        //       return cb1("NN NOT INPUT NODE ERROR");
        //     }
        //     network.nodes[nodeIndex].name = inputName;
        //     network.nodes[nodeIndex].inputType = inputType;
        //     nodeIndex += 1;

        //     cb1();

        //   }, function(err){

        //     if (err) {
        //       return cb0(err);
        //     }

        //     console.log("... END " + inputType);
        //     cb0(err);

        //   });

        // }, function(err){

        //   if (err) {
        //     return callback(err, null);
        //   }

        //   nodeIndex = network.nodes.length - network.output;
        //   console.log("OUTPUT INDEX START " + nodeIndex);

        //   if (network.nodes[nodeIndex].type !== "output") {
        //     console.log(chalkError("NOT OUTPUT ERROR " 
        //       + nodeIndex 
        //       + "\n" + jsonPrint(network.nodes[nodeIndex])
        //     ));
        //     console.log(folder + "/" + entry.name);
        //     return callback("NN NOT OUTPUT NODE ERROR", null);
        //   }

        //   network.nodes[nodeIndex].name = "left";
        //   nodeIndex += 1;
        //   network.nodes[nodeIndex].name = "neutral";
        //   nodeIndex += 1;
        //   network.nodes[nodeIndex].name = "right";

        //   console.log("... END NETWORK NODE UPDATE: " + configuration.processName);

        // });

        trainingSetPrepAndEvolve(params, options, function(err, results){
          callback(err, results);
        });

    }

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
    
    case "EVOLVE":

      statsObj.training.startTime = moment().valueOf();
      statsObj.training.testRunId = m.testRunId;
      statsObj.training.seedNetworkId = m.seedNetworkId;
      statsObj.training.seedNetworkRes = m.seedNetworkRes;
      statsObj.training.iterations = m.iterations;

      statsObj.inputsId = m.inputsId;
      statsObj.inputsObj = {};
      statsObj.inputsObj = m.inputsObj;
      statsObj.outputs = {};
      statsObj.outputs = m.outputs;

      evolveOptions = {};
      evolveOptions = {
        runId: m.testRunId,
        threads: m.threads,
        architecture: m.architecture,
        seedNetworkId: m.seedNetworkId,
        seedNetworkRes: m.seedNetworkRes,
        inputsId: m.inputsId,
        inputsObj: m.inputsObj,
        outputs: m.outputs,
        trainingSet: m.trainingSet,
        normalization: m.normalization,
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

      if (m.networkObj && (m.networkObj !== undefined)) {

        evolveOptions.networkObj = m.networkObj;
        statsObj.evolve.options.networkObj = m.networkObj;

        console.log(chalkAlert("NNC | EVOLVE | " + getTimeStamp()
          + " | " + configuration.processName
          + " | " + m.testRunId
          + "\n SEED: " + m.seedNetworkId
          + " | SEED RES %: " + m.seedNetworkRes.toFixed(2)
          + "\n THREADs: " + m.threads
          + "\n NET: " + m.networkObj.networkId + " | " + m.networkObj.successRate.toFixed(2) + "%"
          // + " | IN: " + m.trainingSet.meta.numInputs
          // + " | OUT: " + m.trainingSet.meta.numOutputs
          + "\n TRAINING SET: " + m.trainingSet.meta.setSize
          + " | ITRS: " + statsObj.training.iterations
        ));
      }
      else {
        console.log(chalkAlert("NNC | EVOLVE | " + getTimeStamp()
          + " | " + configuration.processName
          + " | " + m.testRunId
          + "\n SEED: " + "---"
          + " | SEED RES %: " + "---"
          + "\n THREADs: " + m.threads
          // + " | IN: " + m.trainingSet.meta.numInputs
          // + " | OUT: " + m.trainingSet.meta.numOutputs
          + "\n TRAINING SET: " + m.trainingSet.meta.setSize
          + " | ITRS: " + statsObj.training.iterations
        ));
      }

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

          // exportedNetwork.nodes[0].name = "magnitude";
          // exportedNetwork.nodes[0].inputType = "sentiment";
          // exportedNetwork.nodes[1].name = "score";
          // exportedNetwork.nodes[1].inputType = "sentiment";

          const nnInputTypes = Object.keys(evolveOptions.inputsObj.inputs).sort();

          // let nodeIndex = 2; // skip 
          let nodeIndex = 0; // 

          async.eachSeries(nnInputTypes, function(inputType, cb0){

            const typeInputArray = evolveOptions.inputsObj.inputs[inputType].sort();

            async.eachSeries(typeInputArray, function(inputName, cb1){

              debug("IN [" + nodeIndex + "]: " + inputName);

              if (exportedNetwork.nodes[nodeIndex].type !== "input") {
                console.log(chalkError("NOT INPUT ERROR " + nodeIndex + " | " + inputName));
                return cb1("NN NOT INPUT NODE ERROR");
              }

              exportedNetwork.nodes[nodeIndex].name = inputName;
              exportedNetwork.nodes[nodeIndex].inputType = inputType;
              nodeIndex += 1;

              cb1();

            }, function(err){

              if (err) {
                return cb0(err);
              }

              debug("... END NN NODE NAME TYPE: " + inputType);
              cb0(err);

            });

          }, function(err){

            if (err) {
              // return callback(err, null);
            }

            nodeIndex = exportedNetwork.nodes.length - exportedNetwork.output;
            debug("OUTPUT INDEX START " + nodeIndex);

            if (exportedNetwork.nodes[nodeIndex].type !== "output") {
              console.log(chalkError("NOT OUTPUT ERROR " 
                + nodeIndex 
                + "\n" + jsonPrint(exportedNetwork.nodes[nodeIndex])
              ));
              // console.log(folder + "/" + entry.name);
              // return callback("NN NOT OUTPUT NODE ERROR", null);
            }

            exportedNetwork.nodes[nodeIndex].name = "left";
            nodeIndex += 1;
            exportedNetwork.nodes[nodeIndex].name = "neutral";
            nodeIndex += 1;
            exportedNetwork.nodes[nodeIndex].name = "right";

            debug("... END NETWORK NODE UPDATE: " + statsObj.training.testRunId);

            let networkObj = {};

            const defaultResults = {
              error: 0,
              iterations: 0
            };

            networkObj.networkCreateMode = "evolve";
            networkObj.successRate = 0;
            networkObj.matchRate = 0;
            networkObj.testRunId = statsObj.training.testRunId;
            networkObj.networkId = statsObj.training.testRunId;
            networkObj.seedNetworkId = statsObj.training.seedNetworkId;
            networkObj.seedNetworkRes = statsObj.training.seedNetworkRes;
            networkObj.network = {};
            networkObj.network = exportedNetwork;
            networkObj.numInputs = exportedNetwork.input;
            networkObj.numOutputs = exportedNetwork.output;
            networkObj.inputsId = evolveOptions.inputsId;
            networkObj.inputsObj = {};
            networkObj.inputsObj = evolveOptions.inputsObj;
            networkObj.outputs = {};
            networkObj.outputs = evolveOptions.outputs;
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

          });


        }
      });

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



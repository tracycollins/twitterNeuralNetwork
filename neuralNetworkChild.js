/*jslint node: true */
"use strict";

let ONE_SECOND = 1000 ;
// let ONE_MINUTE = ONE_SECOND*60 ;

const async = require("async");
const os = require("os");

let hostname = os.hostname();
hostname = hostname.replace(/\.home/g, "");
hostname = hostname.replace(/\.local/g, "");
hostname = hostname.replace(/\.fios-router\.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");

const defaultDateTimeFormat = "YYYY-MM-DD HH:mm:ss ZZ";
const compactDateTimeFormat = "YYYYMMDD HHmmss";

const neataptic = require("neataptic");
let network;


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
statsObj.evolve.evolveParams = {};

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
  debug(chalkInfo("FULL PATH " + fullPath));

  let options = {};

  options.contents = JSON.stringify(jsonObj, null, 2);
  options.path = fullPath;
  options.mode = "overwrite";
  options.autorename = false;

  dropboxClient.filesUpload(options)
    .then(function(response){
      debug(chalkLog("... SAVED DROPBOX JSON | " + options.path));
      callback(null, response);
    })
    .catch(function(error){
      console.error(chalkError("NNC | " + moment().format(defaultDateTimeFormat) 
        + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
        + "\nERROR: " + jsonPrint(error)));
      callback(error.error, null);
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
    console.log("NNC | STATS\n" + jsonPrint(statsObj));
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

function train (params, callback){

  let trainingSet = [];

  async.each(params.trainingSet, function(item, cb){
    trainingSet.push(item.datum);
    cb();
  }, function(){

    console.log(chalkAlert("NNC | START TRAIN"
      + " | " + statsObj.training.trainingSet.numInputs + " INPUTS"
      + " | " + statsObj.training.trainingSet.numOutputs + " OUTPUTS"
    ));

    network = new neataptic.Network(
      statsObj.training.trainingSet.numInputs, 
      statsObj.training.trainingSet.numOutputs
    );

    let options = {
      log: 1,
      error: 0.03,
      iterations: params.iterations,
      rate: 0.3
    };

    let results = network.train(trainingSet, options);

    if (callback !== undefined) { callback(results); }
  });

}

let activateInterval;
function activateNetwork(n, input, callback){

  let output;
  output = n.activate(input);
  callback(output);

}

function testEvolve(callback){
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
    log: 100,
    error: 0.03,
    iterations: 10000,
    mutationRate: 0.7
  })
  .then(function(results){

    console.log(chalkAlert("NNC | TEST EVOLVE RESULTS\n" + jsonPrint(results)));

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

  if (params.architecture === undefined) { params.architecture = "random"; }

  let options = {};

  if (params.network !== undefined) {
    options.network = params.network;
    params.architecture = "loadedNetwork";
    console.log(chalkAlert("START NETWORK DEFINED: " + options.network.networkId));
  }

  options.elitism = params.elitism;
  options.equal = params.equal;
  options.error = params.error;
  options.iterations = params.iterations;
  options.log = params.log;
  options.mutation = params.mutation;
  options.mutationRate = params.mutationRate;
  options.popsize = params.popsize;

  async.each(Object.keys(options), function(key, cb){

    if (key === "network") {
      console.log("NNC | EVOLVE OPTION | " + key + ": " + options[key].networkId + " | " + options[key].successRate.toFixed(2) + "%");
      // options.mutation = neataptic.methods.mutation[key];
      // options.mutation = neataptic.methods.mutation.FFW;
    }
    else if (key === "mutation") {
      console.log("NNC | EVOLVE OPTION | " + key + ": " + options[key]);
      // options.mutation = neataptic.methods.mutation[key];
      options.mutation = neataptic.methods.mutation.FFW;
    }
    else if ((key === "activation") && (options[key] !== undefined)) {
      console.log("NNC | EVOLVE OPTION | " + key + ": " + options[key]);
      options.activation = neataptic.Methods.Activation[key];
    }
    else if (key === "cost") {
      console.log("NNC | EVOLVE OPTION | " + key + ": " + options[key]);
      options.cost = neataptic.Methods.Cost[key];
    }
    else if (key !== "activation") {
      console.log("NNC | EVOLVE OPTION | " + key + ": " + options[key]);
    }
    cb();

  }, function(){


    const hiddenLayerSize = params.trainingSet[0].datum.input.length + params.trainingSet[0].datum.output.length;

    switch (params.architecture) {

      case "loadedNetwork":
        console.log("NNC | EVOLVE ARCH | LOADED: " + options.network.networkId);
        network = neataptic.Network.fromJSON(options.network.network);

      break;

      case "perceptron":
        console.log("NNC | EVOLVE ARCH | " + params.architecture);
        network = new neataptic.Architect.Perceptron(
          params.trainingSet[0].datum.input.length, 
          hiddenLayerSize,
          params.trainingSet[0].datum.output.length
        );
      break;

      default:
        console.log("NNC | EVOLVE ARCH | " + params.architecture);
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

      console.log(chalkAlert("NNC | START EVOLVE"
        + "\nIN:            " + params.trainingSet[0].datum.input.length
        + "\nOUT:           " + params.trainingSet[0].datum.output.length
        + "\nTRAINING DATA: " + trainingSet.length
        // + "\nMUTATION\n" + options.mutation.toString()
        // + "\nOPTIONS\n" + jsonPrint(options)
      ));

      network.evolve(trainingSet, options)
      .then(function(results){
        if (callback !== undefined) { callback(results); }
      });

    });

  });


}

process.on("message", function(m) {

  debug(chalkAlert("NEURAL NET RX MESSAGE"
    + " | OP: " + m.op
    + "\n" + jsonPrint(m)
  ));

  let evolveParams;

  switch (m.op) {

    case "INIT":
      statsObj.testRunId = m.testRunId;
      statsObj.neuralNetworkFile = "neuralNetwork_" + m.testRunId + ".json";
      statsObj.defaultNeuralNetworkFile = "neuralNetwork.json";
      console.log(chalkInfo("NNC | NEURAL NET INIT"
        + " | TEST RUN ID: " + statsObj.testRunId
        + " | NEURAL NETWORK FILE: " + statsObj.neuralNetworkFile
        + " | DEFAULT NEURAL NETWORK FILE: " + statsObj.defaultNeuralNetworkFile
      ));

    break;

    case "TEST_EVOLVE":
      testEvolve(function(pass){
        process.send({op:"TEST_EVOLVE_COMPLETE", results: pass});
      });
    break;

    case "STATS":
      // showStats(m.options);
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

      statsObj.inputArraysFile = m.inputArraysFile;

      console.log(chalkAlert("NNC | NEURAL NET TRAIN"
        + " | " + m.trainingSet.length + " TRAINING DATA POINTS"
      ));

      // let trainParams = { trainingSet: m.trainingSet, iterations: m.iterations };

      train({trainingSet: m.trainingSet, iterations: m.iterations}, function(results){

        console.log(chalkAlert("NNC | TRAIN RESULTS\n" + jsonPrint(results)));

        statsObj.training.endTime = moment().valueOf();
        statsObj.training.elapsed = moment().valueOf() - statsObj.training.startTime;

        let exportedNetwork = network.toJSON();

        let networkObj = {};
        networkObj.trainParams = {};
        networkObj.trainParams.trainingSet = m.trainingSet;
        networkObj.trainParams.iterations = m.iterations;
        networkObj.networkId = statsObj.testRunId;
        networkObj.testRunId = statsObj.testRunId;
        networkObj.neuralNetworkFile = statsObj.neuralNetworkFile;
        networkObj.inputArraysFile = statsObj.inputArraysFile;
        networkObj.normalization = {};
        networkObj.normalization = m.normalization;
        networkObj.network = {};
        networkObj.network = exportedNetwork;
        networkObj.training = {};
        networkObj.training = statsObj.training;

        console.log(chalkAlert("NNC | TRAINING COMPLETE"));
        console.log(chalkAlert("NNC | NORMALIZATION\n" + jsonPrint(networkObj.normalization)));

        process.send({op:"TRAIN_COMPLETE", networkObj: networkObj, statsObj: statsObj});

        showStats();
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

      statsObj.inputArraysFile = m.inputArraysFile;

      if (m.network) {
        console.log(chalkAlert("\n\nNNC | NEURAL NET EVOLVE"
          + "\nNETWORK:    " + m.network.networkId + " | " + m.network.successRate.toFixed(2) + "%"
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


      evolveParams = {
        network: m.network,
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
        network: m.network,
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

      evolve(evolveParams, function(results){

        console.log(chalkAlert("NNC | EVOLVE RESULTS\n" + jsonPrint(results)));

        statsObj.training.endTime = moment().valueOf();
        statsObj.training.elapsed = results.time;

        let exportedNetwork = network.toJSON();

        let networkObj = {};
        networkObj.evolveParams = {};
        networkObj.evolveParams = evolveParams;
        networkObj.networkId = statsObj.testRunId;
        networkObj.testRunId = statsObj.testRunId;
        networkObj.elapsed = statsObj.training.elapsed;
        networkObj.neuralNetworkFile = statsObj.neuralNetworkFile;
        networkObj.inputArraysFile = statsObj.inputArraysFile;
        networkObj.normalization = {};
        networkObj.normalization = m.normalization;
        networkObj.network = {};
        networkObj.network = exportedNetwork;
        networkObj.training = {};
        networkObj.training = statsObj.training;

        console.log(chalkAlert("NNC | EVOLVE COMPLETE"));
        console.log(chalkAlert("NNC | NORMALIZATION\n" + jsonPrint(networkObj.normalization)));

        process.send({op:"EVOLVE_COMPLETE", networkObj: networkObj, statsObj: statsObj});
        showStats();

      });
    break;
    default:
      console.log(chalkError("NNC | NEURAL NETIZE UNKNOWN OP ERROR"
        + " | " + m.op
        // + "\n" + jsonPrint(m)
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



/*jslint node: true */
"use strict";

let ONE_SECOND = 1000 ;
// let ONE_MINUTE = ONE_SECOND*60 ;

const os = require("os");
let hostname = os.hostname();
hostname = hostname.replace(/\.home/g, "");
hostname = hostname.replace(/\.local/g, "");
hostname = hostname.replace(/\.fios-router\.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");

const defaultDateTimeFormat = "YYYY-MM-DD HH:mm:ss ZZ";
const compactDateTimeFormat = "YYYYMMDD HHmmss";

// let evolveRunning = false;
// let evolveReady = true;

const neataptic = require("neataptic");
// const neataptic = require("./js/neataptic/neataptic.js");
let network;

const EventEmitter2 = require("eventemitter2").EventEmitter2;
let configEvents = new EventEmitter2({
  wildcard: true,
  newListener: true,
  maxListeners: 20,
  verboseMemoryLeak: true
});

let trainingSet = [];

let configuration = {};
configuration.verbose = false;
configuration.globalTestMode = false;
configuration.testMode = false; // 
configuration.keepaliveInterval = 30*ONE_SECOND;
configuration.rxQueueInterval = 1*ONE_SECOND;

// let S = require("string");
const util = require("util");
const moment = require("moment");
const Dropbox = require("dropbox");
// const HashMap = require("hashmap").HashMap;
// const async = require("async");
const debug = require("debug")("la");
// const debugLang = require("debug")("lang");
// const debugQ = require("debug")("queue");

const chalk = require("chalk");
const chalkAlert = chalk.red;
// const chalkRed = chalk.red;
// const chalkRedBold = chalk.bold.red;
const chalkError = chalk.bold.red;
const chalkWarn = chalk.red;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;
// const chalkInfoBold = chalk.bold.black;
// const chalkConnect = chalk.blue;
// const chalkDisconnect = chalk.yellow;


// let resetInProgressFlag = false;

// function reset(cause, callback){

//   if (!resetInProgressFlag) {

//     let c = cause;
//     resetInProgressFlag = true;

//     setTimeout(function(){
//       resetInProgressFlag = false;
//       console.log(chalkError(moment().format(compactDateTimeFormat) + " | RESET: " + c));
//       if (callback) { callback(); }
//     }, 1*ONE_SECOND);

//   }
// }

const jsonPrint = function (obj){
  if (obj) {
    return JSON.stringify(obj, null, 2);
  }
  else {
    return "UNDEFINED";
  }
};

console.log("\n\n=================================");
console.log("HOST:          " + hostname);
console.log("PROCESS ID:    " + process.pid);
console.log("PROCESS ARGS:  " + util.inspect(process.argv, {showHidden: false, depth: 1}));
console.log("=================================");

process.on("message", function(msg) {
  if (msg === "shutdown") {
    console.log("\n\n!!!!! RECEIVED PM2 SHUTDOWN !!!!!\n\n***** Closing all connections *****\n\n");
    setTimeout(function() {
      console.log("**** Finished closing connections ****\n\n ***** RELOADING neuralNetwork.js NOW *****\n\n");
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
statsObj.heap = process.memoryUsage().heapUsed/(1024*1024);
statsObj.maxHeap = process.memoryUsage().heapUsed/(1024*1024);

statsObj.startTime = moment().valueOf();
statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);

statsObj.training = {};
statsObj.training.startTime = 0;
statsObj.training.endTime = 0;

// ==================================================================
// DROPBOX
// ==================================================================
const DROPBOX_WORD_ASSO_ACCESS_TOKEN = process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN ;
const DROPBOX_WORD_ASSO_APP_KEY = process.env.DROPBOX_WORD_ASSO_APP_KEY ;
const DROPBOX_WORD_ASSO_APP_SECRET = process.env.DROPBOX_WORD_ASSO_APP_SECRET;
const DROPBOX_NN_CONFIG_FILE = process.env.DROPBOX_NN_CONFIG_FILE || "neuralNetworkConfig.json";
const DROPBOX_NN_STATS_FILE = process.env.DROPBOX_NN_STATS_FILE || "neuralNetworkStats.json";

let dropboxConfigFolder = "/config/utility/" + hostname;
let dropboxConfigFile = hostname + "_" + DROPBOX_NN_CONFIG_FILE;
let statsFolder = "/stats/" + hostname + "/neuralNetwork";
let statsFile = DROPBOX_NN_STATS_FILE;

console.log("DROPBOX_NN_CONFIG_FILE: " + DROPBOX_NN_CONFIG_FILE);
console.log("DROPBOX_NN_STATS_FILE : " + DROPBOX_NN_STATS_FILE);

debug("dropboxConfigFolder : " + dropboxConfigFolder);
debug("dropboxConfigFile : " + dropboxConfigFile);

debug("statsFolder : " + statsFolder);
debug("statsFile : " + statsFile);

console.log("DROPBOX_WORD_ASSO_ACCESS_TOKEN :" + DROPBOX_WORD_ASSO_ACCESS_TOKEN);
console.log("DROPBOX_WORD_ASSO_APP_KEY :" + DROPBOX_WORD_ASSO_APP_KEY);
console.log("DROPBOX_WORD_ASSO_APP_SECRET :" + DROPBOX_WORD_ASSO_APP_SECRET);

const dropboxClient = new Dropbox({ accessToken: DROPBOX_WORD_ASSO_ACCESS_TOKEN });

const neuralNetworkFolder = dropboxConfigFolder + "/neuralNetworks";

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
      console.error(chalkError(moment().format(defaultDateTimeFormat) 
        + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
        + "\nERROR: " + error.error));
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
  statsObj.heap = process.memoryUsage().heapUsed/(1024*1024);
  statsObj.maxHeap = Math.max(statsObj.maxHeap, statsObj.heap);

  if (options) {
    console.log("NN STATS\n" + jsonPrint(statsObj));
  }
  else {
    console.log(chalk.green("S - NN"
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
  console.log(process.argv[1]
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

  network = new neataptic.Architect.Perceptron(
    statsObj.training.trainingSet.numInputs, 
    statsObj.training.trainingSet.numInputs+statsObj.training.trainingSet.numOutputs, 
    statsObj.training.trainingSet.numOutputs
  );

  let options = {
    log: 1,
    error: 0.03,
    iterations: params.iterations,
    rate: 0.3
  };

  let results = network.train(params.trainingSet, options);

  if (callback !== undefined) { callback(results); }
}

function evolve (params, callback){

  let options = {
    mutation: neataptic.Methods.Mutation.FFW,
    equal: true,
    popsize: 100,
    elitism: 10,
    log: 1,
    error: 0.03,
    iterations: params.iterations,
    mutationRate: 0.5
  };

  console.log("EVOLVE"
    + " | INPUTS: " + statsObj.training.trainingSet.numInputs
    + " | OUTPUTS: " + statsObj.training.trainingSet.numOutputs
    + " | SET: " + params.trainingSet.length + " DATA POINTS"
    + " | ITERATIONS: " + options.iterations
    // + "\nOPTIONS\n" + jsonPrint(options)
  );

  statsObj.training.evolve = {};
  statsObj.training.evolve.options = {};
  statsObj.training.evolve.options = options;

  network = new neataptic.Network(statsObj.training.trainingSet.numInputs, statsObj.training.trainingSet.numOutputs);

  let results = network.evolve(params.trainingSet, options);
  
  if (callback !== undefined) { callback(results); }
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
      console.log(chalkInfo("NEURAL NET INIT"
        + " | TEST RUN ID: " + statsObj.testRunId
        + " | NEURAL NETWORK FILE: " + statsObj.neuralNetworkFile
        + " | DEFAULT NEURAL NETWORK FILE: " + statsObj.defaultNeuralNetworkFile
      ));
    break;

    case "STATS":
      showStats(m.options);
    break;

    case "TRAIN":

      trainingSet = m.trainingSet;

      statsObj.training.startTime = moment().valueOf();
      statsObj.training.testRunId = m.testRunId;
      statsObj.training.iterations = m.iterations;
      statsObj.training.trainingSet = {};
      statsObj.training.trainingSet.length = trainingSet.length;
      statsObj.training.trainingSet.numInputs = trainingSet[0]["input"].length;
      statsObj.training.trainingSet.numOutputs = trainingSet[0]["output"].length;

      statsObj.inputArraysFile = m.inputArraysFile;

      console.log(chalkAlert("NN CHILD: NEURAL NET TRAIN"
        + " | " + trainingSet.length + " TRAINING DATA POINTS"
      ));

      let trainParams = {
        trainingSet: trainingSet,
        iterations: m.iterations
      };

      train(trainParams, function(results){

        console.log(chalkAlert("TRAIN RESULTS\n" + jsonPrint(results)));

        statsObj.training.endTime = moment().valueOf();
        statsObj.training.elapsed = moment().valueOf() - statsObj.training.startTime;

        let exportedNetwork = network.toJSON();

        let networkObj = {};
        networkObj.trainParams = {};
        networkObj.trainParams = trainParams;
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

        console.log(chalkAlert("TRAINING COMPLETE"));
        console.log(chalkAlert("NORMALIZATION\n" + jsonPrint(networkObj.normalization)));

        saveFile(neuralNetworkFolder, statsObj.defaultNeuralNetworkFile, networkObj, function(err){
          if (err){
            console.error(chalkError("*** SAVE DEFAULT NEURAL NETWORK FILE ERROR | " + defaultNeuralNetworkFile + " | " + err));
          }
          else {
            console.log(chalkLog("SAVED DEFAULT NEURAL NETWORK FILE"
              + " | " + neuralNetworkFolder + "/" + statsObj.defaultNeuralNetworkFile
            ));
          }

          saveFile(neuralNetworkFolder, statsObj.neuralNetworkFile, networkObj, function(err){
            if (err){
              console.error(chalkError("*** SAVE NEURAL NETWORK FILE ERROR | " + neuralNetworkFile + " | " + err));
            }
            else {
              console.log(chalkLog("SAVED NEURAL NETWORK FILE"
                + " | " + neuralNetworkFolder + "/" + statsObj.neuralNetworkFile
              ));
            }
            process.send({op:"TRAIN_COMPLETE", networkObj: networkObj, statsObj: statsObj});
          });
        });

        showStats();
      });
    break;

    case "EVOLVE":

      trainingSet = m.trainingSet;

      statsObj.training.startTime = moment().valueOf();
      statsObj.training.testRunId = m.testRunId;
      statsObj.training.iterations = m.iterations;
      statsObj.training.trainingSet = {};
      statsObj.training.trainingSet.length = trainingSet.length;
      statsObj.training.trainingSet.numInputs = trainingSet[0]["input"].length;
      statsObj.training.trainingSet.numOutputs = trainingSet[0]["output"].length;

      statsObj.inputArraysFile = m.inputArraysFile;

      console.log(chalkAlert("NN CHILD: NEURAL NET EVOLVE"
        + " | " + trainingSet.length + " TRAINING DATA POINTS"
      ));

      evolveParams = {
        trainingSet: trainingSet,
        iterations: m.iterations
      };

      evolve(evolveParams, function(results){

        console.log(chalkAlert("EVOLVE RESULTS\n" + jsonPrint(results)));

        // if (err){
        //   console.error(chalkError("*** EVOLVE ERROR\n" + err));
        // }

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

        console.log(chalkAlert("TRAINING COMPLETE"));
        console.log(chalkAlert("NORMALIZATION\n" + jsonPrint(networkObj.normalization)));

        process.send({op:"EVOLVE_COMPLETE", networkObj: networkObj, statsObj: statsObj});
        showStats();

      });
    break;
    default:
      console.log(chalkError("NEURAL NETIZE UNKNOWN OP ERROR"
        + " | " + m.op
        // + "\n" + jsonPrint(m)
      ));
  }
});

function initStatsUpdate(cnf, callback){

  console.log(chalkInfo("initStatsUpdate | INTERVAL: " + cnf.statsUpdateIntervalTime));

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

  cnf.processName = process.env.NN_PROCESS_NAME || "neuralNetworkChild";

  cnf.verbose = process.env.NN_VERBOSE_MODE || false ;
  cnf.globalTestMode = process.env.NN_GLOBAL_TEST_MODE || false ;
  cnf.testMode = process.env.NN_TEST_MODE || false ;
  cnf.quitOnError = process.env.NN_QUIT_ON_ERROR || false ;

  cnf.statsUpdateIntervalTime = process.env.NN_STATS_UPDATE_INTERVAL || 60000;

  console.log("CONFIG\n" + jsonPrint(cnf));

  debug(chalkWarn("dropboxConfigFolder: " + dropboxConfigFolder));
  debug(chalkWarn("dropboxConfigFile  : " + dropboxConfigFile));

  callback(null, cnf);
}

configEvents.on("newListener", function(data){
  console.log(chalkInfo("*** NEW CONFIG EVENT LISTENER: " + data));
});

configEvents.on("removeListener", function(data){
  console.log(chalkInfo("*** REMOVED CONFIG EVENT LISTENER: " + data));
});

setTimeout(function(){

  initialize(configuration, function(err, cnf){

    if (err && (err.status !== 404)) {
      console.error(chalkError("***** INIT ERROR *****\n" + jsonPrint(err)));
      // if (err.status !== 404){
      //   console.log("err.status: " + err.status);
        quit();
      // }
    }


    initStatsUpdate(cnf, function(){
      console.log(cnf.processName + " STARTED " + getTimeStamp() + "\n");
    });
  });
}, 1 * ONE_SECOND);



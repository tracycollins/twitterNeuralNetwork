/*jslint node: true */
"use strict";

let inputArrays = {};

const OFFLINE_MODE = false;

const os = require("os");
const util = require("util");
const S = require("string");
const moment = require("moment");
const arrayUnique = require("array-unique");

require("isomorphic-fetch");
const Dropbox = require('dropbox').Dropbox;

const EventEmitter2 = require("eventemitter2").EventEmitter2;
const async = require("async");
const chalk = require("chalk");
const debug = require("debug")("tnn");
const debugCache = require("debug")("cache");
const debugQ = require("debug")("queue");
const commandLineArgs = require("command-line-args");

// const neataptic = require("neataptic");
const neataptic = require("./js/neataptic");

const fs = require("fs");

const inputTypes = ["emoji", "hashtags", "images", "mentions", "urls", "words"];
inputTypes.sort();

let trainingSetLabels = {};
trainingSetLabels.inputsRaw = [];
trainingSetLabels.inputs = {};
trainingSetLabels.outputs = ["left", "neutral", "right"];

inputTypes.forEach(function(type){
  trainingSetLabels.inputs[type] = [];
});

let configuration = {};
configuration.processName = "nnNodeNameUpdate";
configuration.useLocalNetworksOnly = false;
configuration.statsUpdateIntervalTime = 10000;
configuration.trainingSetsDir = "/config/utility/default/trainingSets";

configuration.DROPBOX = {};
configuration.DROPBOX.DROPBOX_WORD_ASSO_ACCESS_TOKEN = process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN ;
configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_KEY = process.env.DROPBOX_WORD_ASSO_APP_KEY ;
configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_SECRET = process.env.DROPBOX_WORD_ASSO_APP_SECRET;
configuration.DROPBOX.DROPBOX_TNN_CONFIG_FILE = process.env.DROPBOX_TNN_CONFIG_FILE || "nnNodeNameUpdateConfig.json";
configuration.DROPBOX.DROPBOX_TNN_STATS_FILE = process.env.DROPBOX_TNN_STATS_FILE || "nnNodeNameUpdateStats.json";

const defaultDateTimeFormat = "YYYY-MM-DD HH:mm:ss ZZ";
const compactDateTimeFormat = "YYYYMMDD_HHmmss";

let hostname = os.hostname();
hostname = hostname.replace(/.local/g, "");
hostname = hostname.replace(/.home/g, "");
hostname = hostname.replace(/.at.net/g, "");
hostname = hostname.replace(/.fios-router/g, "");
hostname = hostname.replace(/.fios-router.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");

const chalkAlert = chalk.red;
const chalkBlue = chalk.blue;
const chalkRedBold = chalk.bold.red;
const chalkError = chalk.bold.red;
const chalkWarn = chalk.red;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;
const chalkNetwork = chalk.blue;

function msToTime(d) {
  const duration = parseInt(d);
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
statsObj.errors = {};
statsObj.startTimeMoment = moment();
statsObj.startTime = moment().valueOf();
statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);

statsObj.totalInputs = 0;

const DEFAULT_RUN_ID = hostname + "_" + process.pid + "_" + statsObj.startTimeMoment.format(compactDateTimeFormat);

if (process.env.TNN_RUN_ID !== undefined) {
  statsObj.runId = process.env.TNN_RUN_ID;
  console.log(chalkAlert("NNT | ENV RUN ID: " + statsObj.runId));
}
else {
  statsObj.runId = DEFAULT_RUN_ID;
  console.log(chalkAlert("NNT | DEFAULT RUN ID: " + statsObj.runId));
}

const HashMap = require("hashmap").HashMap;
let bestNetworkHashMap = new HashMap();

let currentBestNetwork;
let networkCreateResultsHashmap = {};

const jsUcfirst = function(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
};

const configEvents = new EventEmitter2({
  wildcard: true,
  newListener: true,
  maxListeners: 20,
  verboseMemoryLeak: true
});

let stdin;

const jsonPrint = function (obj, prefix){
  if (obj) {
    if (prefix) {
      return JSON.stringify(obj, null, 2).replace(/^./gm, prefix);
    }
    return JSON.stringify(obj, null, 2);
  }
  else {
    return "UNDEFINED";
  }
};


const enableStdin = { name: "enableStdin", alias: "i", type: Boolean, defaultValue: true };
const quitOnError = { name: "quitOnError", alias: "q", type: Boolean, defaultValue: true };
const verbose = { name: "verbose", alias: "v", type: Boolean };
const testMode = { name: "testMode", alias: "X", type: Boolean, defaultValue: false };

const optionDefinitions = [
  enableStdin, 
  quitOnError, 
  verbose, 
  testMode
];

const commandLineConfig = commandLineArgs(optionDefinitions);
console.log(chalkInfo("NNT | COMMAND LINE CONFIG\nNNT | " + jsonPrint(commandLineConfig)));
console.log("NNT | COMMAND LINE OPTIONS\nNNT | " + jsonPrint(commandLineConfig));

process.on("message", function(msg) {
  if (msg === "shutdown") {
    console.log("\n\nNNT | !!!!! RECEIVED PM2 SHUTDOWN !!!!!\n\n***** Closing all connections *****\n\n");
    setTimeout(function() {
      console.log("NNT | **** Finished closing connections ****"
        + "\n\n NNT | ***** RELOADING nnNodeNameUpdate.js NOW *****\n\n");
      process.exit(0);
    }, 1500);
  }
  else {
    console.log("NNT | R<\n" + jsonPrint(msg));
  }
});

statsObj.commandLineConfig = commandLineConfig;

console.log("\n\nNNT | =================================");
console.log("NNT | HOST:          " + hostname);
console.log("NNT | PROCESS ID:    " + process.pid);
console.log("NNT | RUN ID:        " + statsObj.runId);
console.log("NNT | PROCESS ARGS:  " + util.inspect(process.argv, {showHidden: false, depth: 1}));
console.log("NNT | =================================");

// ==================================================================
// DROPBOX
// ==================================================================

const dropboxConfigFolder = "/config/utility";
const dropboxConfigDefaultFolder = "/config/utility/default";
const dropboxConfigHostFolder = "/config/utility/" + hostname;

const dropboxConfigFile = hostname + "_" + configuration.DROPBOX.DROPBOX_TNN_CONFIG_FILE;

const statsFolder = "/stats/" + hostname + "/neuralNetwork";
const statsFile = "nnNodeNameUpdate_" + statsObj.runId + ".json";

const globalBestNetworkFolder = "/config/utility/best/neuralNetworks";
const localNetworkFolder = "/config/utility/" + hostname + "/neuralNetworks/local";
const bestNetworkFolder = "/config/utility/" + hostname + "/neuralNetworks/best";

configuration.neuralNetworkFolder = globalBestNetworkFolder;

console.log("NNT | DROPBOX_TNN_CONFIG_FILE: " + configuration.DROPBOX.DROPBOX_TNN_CONFIG_FILE);
console.log("NNT | DROPBOX_TNN_STATS_FILE : " + configuration.DROPBOX.DROPBOX_TNN_STATS_FILE);

debug("dropboxConfigFolder : " + dropboxConfigFolder);
debug("dropboxConfigHostFolder : " + dropboxConfigHostFolder);
debug("dropboxConfigFile : " + dropboxConfigFile);

debug("NNT | DROPBOX_WORD_ASSO_ACCESS_TOKEN :" + configuration.DROPBOX.DROPBOX_WORD_ASSO_ACCESS_TOKEN);
debug("NNT | DROPBOX_WORD_ASSO_APP_KEY :" + configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_KEY);
debug("NNT | DROPBOX_WORD_ASSO_APP_SECRET :" + configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_SECRET);

let dropboxClient = new Dropbox({ accessToken: configuration.DROPBOX.DROPBOX_WORD_ASSO_ACCESS_TOKEN });

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

function indexOfMax (arr, callback) {

  if (arr.length === 0) {
    console.log(chalkAlert("NNT | indexOfMax: 0 LENG ARRAY: -1"));
    return(callback(-2, arr)) ; 
  }

  if ((arr[0] === arr[1]) && (arr[1] === arr[2])){
    debug(chalkAlert("NNT | indexOfMax: ALL EQUAL"));
    debug(chalkAlert("NNT | ARR" 
      + " | " + arr[0].toFixed(2) 
      + " - " + arr[1].toFixed(2) 
      + " - " + arr[2].toFixed(2)
    ));
    if (arr[0] === 0) { return(callback(-4, arr)); }
    return(callback(4, [1,1,1])) ; 
  }

  debug("NNT | B4 ARR: " + arr[0].toFixed(2) + " - " + arr[1].toFixed(2) + " - " + arr[2].toFixed(2));
  arrayNormalize(arr);
  debug("NNT | AF ARR: " + arr[0].toFixed(2) + " - " + arr[1].toFixed(2) + " - " + arr[2].toFixed(2));

  if (((arr[0] === 1) && (arr[1] === 1)) 
    || ((arr[0] === 1) && (arr[2] === 1))
    || ((arr[1] === 1) && (arr[2] === 1))){

    debug(chalkAlert("NNT | indexOfMax: MULTIPLE SET"));

    debug(chalkAlert("NNT | ARR" 
      + " | " + arr[0].toFixed(2) 
      + " - " + arr[1].toFixed(2) 
      + " - " + arr[2].toFixed(2)
    ));

    async.eachOf(arr, function(val, index, cb0){
      if (val < 1) {
        arr[index] = 0;
      }
      // async.setImmediate(function() { 
        cb0(); 
      // });
    }, function(){
      callback(3, arr); 
    });

  }
  else {

    let max = 0;
    let maxIndex = -1;

    async.eachOfSeries(arr, function(val, index, cb1){
      if (val > max) {
        maxIndex = index;
        max = val;
      }
      // async.setImmediate(function() { 
        cb1(); 
      // });
    }, function(){

      async.eachOf(arr, function(val, index, cb2){
        if (val < 1) {
          arr[index] = 0;
        }
        // async.setImmediate(function() { 
          cb2(); 
        // });
      }, function(){
        callback(maxIndex, arr); 
      });

    });

  }
}

function showStats(options){

  statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);

  if (options) {
    console.log("NNT | STATS\nNNT | " + jsonPrint(statsObj));
  }
  else {
    console.log(chalkLog("NNT | S"
      + " | RUN " + statsObj.elapsed
      + " | NOW " + moment().format(compactDateTimeFormat)
      + " | STRT " + moment(parseInt(statsObj.startTime)).format(compactDateTimeFormat)
    ));

  }
}

function quit(options){

  console.log(chalkAlert( "\n\nNNT | ... QUITTING ...\n\n" ));

  statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);

  showStats();

  setTimeout(function(){

    process.exit();

  }, 1000);
}

process.on( "SIGINT", function() {
  quit("SIGINT");
});

process.on("exit", function() {
});


function saveFile (params, callback){

  const fullPath = params.folder + "/" + params.file;

  debug(chalkInfo("LOAD FOLDER " + params.folder));
  debug(chalkInfo("LOAD FILE " + params.file));
  debug(chalkInfo("FULL PATH " + fullPath));

  let options = {};

  options.contents = JSON.stringify(params.obj, null, 2);
  options.path = fullPath;
  options.mode = params.mode || "overwrite";
  options.autorename = params.autorename || false;


  const dbFileUpload = function () {

    dropboxClient.filesUpload(options)
    .then(function(){
      debug(chalkLog("SAVED DROPBOX JSON | " + options.path));
      if (callback !== undefined) { return callback(null); }
    })
    .catch(function(error){
      if (error.status === 413){
        console.error(chalkError("NNT | " + moment().format(compactDateTimeFormat) 
          + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: 413"
          // + " ERROR\n" + jsonPrint(error.error)
        ));
        if (callback !== undefined) { return callback(error.error_summary); }
      }
      else if (error.status === 429){
        console.error(chalkError("NNT | " + moment().format(compactDateTimeFormat) 
          + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: TOO MANY WRITES"
          // + " ERROR\n" + "jsonPrint"(error.error)
        ));
        if (callback !== undefined) { return callback(error.error_summary); }
      }
      else if (error.status === 500){
        console.error(chalkError("NNT | " + moment().format(compactDateTimeFormat) 
          + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: DROPBOX SERVER ERROR"
          // + " ERROR\n" + jsonPrint(error.error)
        ));
        if (callback !== undefined) { return callback(error.error_summary); }
      }
      else {
        console.trace(chalkError("NNT | " + moment().format(compactDateTimeFormat) 
          + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: " + error
          + " | ERROR\n" + jsonPrint(error)
          // + " ERROR\n" + jsonPrint(params)
        ));
        if (callback !== undefined) { return callback(error); }
      }
    });
  };

  if (options.mode === "add") {

    dropboxClient.filesListFolder({path: params.folder})
    .then(function(response){

      debug(chalkLog("DROPBOX LIST FOLDER"
        + " | " + options.path
        + " | " + jsonPrint(response)
      ));

      let fileExits = false;

      async.each(response.entries, function(entry, cb){

        console.log(chalkInfo("NNT | DROPBOX FILE"
          + " | " + params.folder
          + " | " + getTimeStamp(entry.client_modified)
          + " | " + entry.name
          // + " | " + entry.content_hash
          // + "\n" + jsonPrint(entry)
        ));

        if (entry.name === params.file) {
          fileExits = true;
        }

        cb();

      }, function(err){
        if (err) {
          console.log(chalkError("NNT | *** ERROR DROPBOX SAVE FILE: " + err));
          if (callback !== undefined) { 
            return(callback(err, null));
          }
          return;
        }
        if (fileExits) {
          console.log(chalkAlert("NNT | ... DROPBOX FILE EXISTS ... SKIP SAVE | " + fullPath));
          if (callback !== undefined) { callback(err, null); }
        }
        else {
          console.log(chalkAlert("NNT | ... DROPBOX DOES NOT FILE EXIST ... SAVING | " + fullPath));
          dbFileUpload();
        }
      });
    })
    .catch(function(err){
      console.log(chalkError("NNT | *** DROPBOX FILES LIST FOLDER ERROR\n" + jsonPrint(err)));
      if (callback !== undefined) { callback(err, null); }
    });
  }
  else {
    dbFileUpload();
  }
}

function saveFileRetry (timeout, path, file, jsonObj, callback){
  setTimeout(function(){
    console.log(chalkError("NNT | SAVE RETRY | TIMEOUT: " + timeout + " | " + path + "/" + file));
    saveFile({folder:path, file:file, obj:jsonObj}, function(err){
      if (err) {
        console.log(chalkError("NNT | SAVE RETRY ON ERROR: " + path + "/" + file));
        // saveFileRetry(timeout, path, file, jsonObj);
      }
      if (callback !== undefined) { callback(err); }
    });
  }, timeout);
}

function loadFile(path, file, callback) {

  debug(chalkInfo("LOAD FOLDER " + path));
  debug(chalkInfo("LOAD FILE " + file));
  debug(chalkInfo("FULL PATH " + path + "/" + file));

  let fullPath = path + "/" + file;

  if (OFFLINE_MODE) {
    if (hostname === "mbp2") {
      fullPath = "/Users/tc/Dropbox/Apps/wordAssociation" + path + "/" + file;
      debug(chalkInfo("OFFLINE_MODE: FULL PATH " + fullPath));
    }
    fs.readFile(fullPath, "utf8", function(err, data) {

      if (err) {
        console.log(chalkError(getTimeStamp()
          + " | *** ERROR LOADING FILE FROM DROPBOX FILE"
          + " | " + fullPath
          // + "\n" + jsonPrint(data)
        ));
        return(callback(err, null));
      }

      debug(chalkLog(getTimeStamp()
        + " | LOADING FILE FROM DROPBOX FILE"
        + " | " + fullPath
        // + "\n" + jsonPrint(data)
      ));

      if (file.match(/\.json$/gi)) {
        try {
          let fileObj = JSON.parse(data);
          callback(null, fileObj);
        }
        catch(e){
          console.trace(chalkError("NNT | JSON PARSE ERROR: " + e));
          callback(e, null);
        }
      }
      else if (file.match(/\.txt$/gi)) {
        callback(null, data);
      }
      else {
        callback(null, null);
      }
    });
   }
  else {
    dropboxClient.filesDownload({path: fullPath})
    .then(function(data) {
      debug(chalkLog(getTimeStamp()
        + " | LOADING FILE FROM DROPBOX FILE: " + fullPath
      ));

      let payload = data.fileBinary;
      debug(payload);

      if (file.match(/\.json$/gi)) {
        try {
          let fileObj = JSON.parse(payload);
          callback(null, fileObj);
        }
        catch(e){
          console.trace(chalkError("NNT | JSON PARSE ERROR: " + e));
          // callback(e, null);
        }
      }
      else if (file.match(/\.txt$/gi)) {
        callback(null, data);
      }
      else {
        callback(null, null);
      }
    })
    .catch(function(error) {
      debug(chalkError("NNT | DROPBOX loadFile ERROR: " + fullPath + "\n" + jsonPrint(error)));
      console.log(chalkError("NNT | !!! DROPBOX READ " + fullPath + " ERROR"));
      // console.log(chalkError("NNT | " + error.error.error_summary));

      if (error.response.status === 404) {
        console.error(chalkError("NNT | !!! DROPBOX READ FILE (E404)" + fullPath + " NOT FOUND"
          + " ... SKIPPING ...")
        );
        return(callback(null, null));
      }
      if (error.response.status === 409) {
        console.error(chalkError("NNT | !!! DROPBOX READ FILE (E409)" + fullPath + " NOT FOUND"
          + " ... SKIPPING ...")
        );
        return(callback(error, null));
      }
      if (error.response.status === 0) {
        console.error(chalkError("NNT | !!! DROPBOX NO RESPONSE"
          + " ... NO INTERNET CONNECTION? ... SKIPPING ..."));
        return(callback(null, null));
      }
      callback(error, null);
    });
  }
}

function getFileMetadata(path, file, callback) {

  const fullPath = path + "/" + file;
  debug(chalkInfo("FOLDER " + path));
  debug(chalkInfo("FILE " + file));
  debug(chalkInfo("getFileMetadata FULL PATH: " + fullPath));

  dropboxClient.filesGetMetadata({path: fullPath})
    .then(function(response) {
      debug(chalkInfo("FILE META\n" + jsonPrint(response)));
      return(callback(null, response));
    })
    .catch(function(error) {
      console.log(chalkError("GET FILE METADATA ERROR\n" + jsonPrint(error)));
      return(callback(error, null));
    });
}

let statsUpdateInterval;

function initStatsUpdate(cnf, callback){

  console.log(chalkBlue("NNT | INIT STATS UPDATE INTERVAL | " + cnf.statsUpdateIntervalTime + " MS"));

  clearInterval(statsUpdateInterval);

  statsUpdateInterval = setInterval(function () {

    statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);
    statsObj.timeStamp = moment().format(defaultDateTimeFormat);
 
    showStats();

  }, cnf.statsUpdateIntervalTime);

  callback(null, cnf);
}

function printDatum(title, input){

  let row = "";
  let col = 0;
  let rowNum = 0;
  const COLS = 50;

  debug("\nNNT | ------------- " + title + " -------------");

  input.forEach(function(bit, i){
    if (i === 0) {
      row = row + bit.toFixed(10) + " | " ;
    }
    else if (i === 1) {
      row = row + bit.toFixed(10);
    }
    else if (i === 2) {
      debug("NNT | ROW " + rowNum + " | " + row);
      row = bit ? "X" : ".";
      col = 1;
      rowNum += 1;
    }
    else if (col < COLS){
      row = row + (bit ? "X" : ".");
      col += 1;
    }
    else {
      debug("NNT | ROW " + rowNum + " | " + row);
      row = bit ? "X" : ".";
      col = 1;
      rowNum += 1;
    }
  });
}

function printNetworkObj(title, nnObj){
  console.log(chalkNetwork(title
    // + " | " + nnObj.networkId
    + " | SUCCESS: " + nnObj.successRate.toFixed(2) + "%"
  ));
}


function loadNetworkDropboxFolder(folder, callback){

  console.log(chalkNetwork("NNT | ... LOADING DROPBOX NN FOLDER | " + folder));

  if (configuration.useLocalNetworksOnly) {
    return (callback(null, []));
  }

  let options = {path: folder};
  // let newBestNetwork = false;

  dropboxClient.filesListFolder(options)
  .then(function(response){

    console.log(chalkLog("DROPBOX LIST FOLDER"
      + " | " + options.path
      + " | " + jsonPrint(response)
    ));

    let nnArray = [];

    async.eachSeries(response.entries, function(entry, cb){

      console.log(chalkInfo("NNT | DROPBOX NETWORK FOUND"
        + " | " + getTimeStamp(entry.client_modified)
        + " | " + entry.name
        // + " | " + entry.content_hash
        // + "\n" + jsonPrint(entry)
      ));

      loadFile(folder, entry.name, function(err, networkObj){

        if (err) {
          console.log(chalkError("NNT | DROPBOX NETWORK LOAD FILE ERROR: " + err));
          return cb();
        }

        console.log(chalkInfo("NNT | + NN HASH MAP"
          + " | " + networkObj.successRate.toFixed(2) + "%"
          + " | " + getTimeStamp(networkObj.createdAt)
          + " | IN: " + networkObj.numInputs
          + " | OUT: " + networkObj.numOutputs
          + " | " + networkObj.networkCreateMode
          + " | " + networkObj.networkId
        ));

        networkObj.network.nodes[0].name = "magnitude";
        networkObj.network.nodes[0].inputType = "sentiment";
        networkObj.network.nodes[1].name = "score";
        networkObj.network.nodes[1].inputType = "sentiment";

        const nnInputTypes = Object.keys(networkObj.inputs).sort();

        let nodeIndex = 2; // skip 

        async.eachSeries(nnInputTypes, function(inputType, cb0){

          const typeInputArray = networkObj.inputs[inputType].sort();

          async.eachSeries(typeInputArray, function(inputName, cb1){

            console.log("IN [" + nodeIndex + "]: " + inputName);
            if (networkObj.network.nodes[nodeIndex].type !== "input") {
              console.log(chalkError("NOT INPUT ERROR " + nodeIndex + " | " + inputName));
              return cb1("NOT INPUT ERROR");
            }
            networkObj.network.nodes[nodeIndex].name = inputName;
            networkObj.network.nodes[nodeIndex].inputType = inputType;
            nodeIndex++;

            cb1();

          }, function(){

            console.log("... END " + inputType);
            cb0();

          });

        }, function(err){

          nodeIndex = networkObj.network.nodes.length - networkObj.network.output;
          console.log("OUTPUT INDEX START " + nodeIndex);

          if (networkObj.network.nodes[nodeIndex].type !== "output") {
            console.log(chalkError("NOT OUTPUT ERROR " 
              + nodeIndex 
              + "\n" + jsonPrint(networkObj.network.nodes[nodeIndex])
            ));
            console.log(folder + "/" + entry.name);
            return cb("NOT OUTPUT ERROR");
          }


          networkObj.network.nodes[nodeIndex].name = "left";
          nodeIndex++;
          networkObj.network.nodes[nodeIndex].name = "neutral";
          nodeIndex++;
          networkObj.network.nodes[nodeIndex].name = "right";

          console.log("... END NETWORK UPDATE: " + networkObj.networkId);

          saveFile({folder: folder, file: entry.name, obj: networkObj}, function(err){
            console.log("... SAVED NETWORK: " + folder + "/" + entry.name);
            cb();
          });

        });


      });

    }, function(){
      if (callback !== undefined) { callback(null, nnArray); }
    });

  })
  .catch(function(err){
    console.log(chalkError("NNT | *** DROPBOX FILES LIST FOLDER ERROR\n" + jsonPrint(err)));
    if (callback !== undefined) { callback(err, null); }
  });
}

function initInputArrays(cnf, callback){

  statsObj.totalInputs = 2;

  console.log(chalkBlue("NNT | INIT INPUT ARRAYS"));
  debug(chalkBlue("NNT | INIT INPUT ARRAYS cnf\nNNT | " + jsonPrint(cnf)));

  let folder = dropboxConfigDefaultFolder;
  let inputFilePrefix = "defaultInput";

  trainingSetLabels.inputsRaw = [];
  trainingSetLabels.inputsRaw.push("magnitude");
  trainingSetLabels.inputsRaw.push("score");

  async.eachSeries(inputTypes, function(inputType, cb){

    const inputFile = inputFilePrefix + jsUcfirst(inputType) + ".json";

    console.log("NNT | INIT " + inputType.toUpperCase() + " INPUT ARRAY: " + inputFile);


    loadFile(folder, inputFile, function(err, inputArrayObj){
      if (!err) {
        debug(jsonPrint(inputArrayObj));

        arrayUnique(inputArrayObj[inputType]);

        inputArrayObj[inputType].sort();

        inputArrays[inputType] = {};
        inputArrays[inputType] = inputArrayObj[inputType];

        trainingSetLabels.inputs[inputType] = inputArrays[inputType];

        trainingSetLabels.inputsRaw = trainingSetLabels.inputsRaw.concat(inputArrays[inputType]);  // inputsRaw is one unified array of input labels

        statsObj.totalInputs += inputArrayObj[inputType].length;

        console.log(chalkBlue("NNT"
          + " | LOADED " + inputType.toUpperCase() + " ARRAY"
          + " | " + inputArrayObj[inputType].length + " " + inputType.toUpperCase()
        ));
        cb();
      }
      else {
        console.log(chalkError("NNT | ERROR: loadFile: " + dropboxConfigFolder + "/" + inputFile));
        cb(err);
      }
    });

  }, function(err){
    if (err){
      console.log(chalkError("NNT | ERR\nNNT | " + jsonPrint(err)));
      callback(err);
    }
    else {
      callback();
    }
  });
}

function initialize(cnf, callback){

  debug(chalkBlue("INITIALIZE cnf\n" + jsonPrint(cnf)));

  if (debug.enabled || debugCache.enabled || debugQ.enabled){
    console.log("\nNNT | %%%%%%%%%%%%%%\nNNT |  DEBUG ENABLED \nNNT | %%%%%%%%%%%%%%\n");
  }

  cnf.processName = process.env.TNN_PROCESS_NAME || "nnNodeNameUpdate";
  cnf.runId = process.env.TNN_RUN_ID || statsObj.runId;

  cnf.verbose = process.env.TNN_VERBOSE_MODE || false ;
  cnf.quitOnError = process.env.TNN_QUIT_ON_ERROR || false ;
  cnf.enableStdin = process.env.TNN_ENABLE_STDIN || true ;

  loadFile(dropboxConfigHostFolder, dropboxConfigFile, function(err, loadedConfigObj){

    let commandLineConfigKeys;
    let configArgs;

    if (!err) {
      console.log("NNT | " + dropboxConfigFile + "\n" + jsonPrint(loadedConfigObj));
      // OVERIDE CONFIG WITH COMMAND LINE ARGS

      commandLineConfigKeys = Object.keys(commandLineConfig);

      commandLineConfigKeys.forEach(function(arg){
        cnf[arg] = commandLineConfig[arg];
        console.log("NNT | --> COMMAND LINE CONFIG | " + arg + ": " + cnf[arg]);
      });

      configArgs = Object.keys(cnf);

      configArgs.forEach(function(arg){
        console.log("NNT | FINAL CONFIG | " + arg + ": " + cnf[arg]);
      });

      if (cnf.enableStdin){

        console.log("NNT | STDIN ENABLED");

        stdin = process.stdin;
        if(stdin.setRawMode  !== undefined) {
          stdin.setRawMode( true );
        }
        stdin.resume();
        stdin.setEncoding( "utf8" );
        stdin.on( "data", function( key ){

          switch (key) {
            case "\u0003":
              process.exit();
            break;

            // case "d":
            //   configuration.enableHeapDump = !configuration.enableHeapDump;
            //   console.log(chalkRedBold("HEAP DUMP: " + configuration.enableHeapDump));
            // break;
            case "v":
              configuration.verbose = !configuration.verbose;
              console.log(chalkRedBold("NNT | VERBOSE: " + configuration.verbose));
            break;
            case "n":
              configuration.interruptFlag = true;
              console.log(chalkRedBold("NNT | *** INTERRUPT ***"));
            break;
            case "q":
              quit();
            break;
            case "Q":
              quit();
            break;
            case "s":
              showStats();
            break;
            case "S":
              showStats(true);
            break;
            default:
              console.log(
                "\n" + "q/Q: quit"
                + "\n" + "s: showStats"
                + "\n" + "S: showStats verbose"
              );
          }

        });
      }

      initStatsUpdate(cnf, function(err, cnf2){

        if (err) {
          console.log(chalkError("NNT | ERROR initStatsUpdate\n" + err));
          return(callback(err, cnf2));
        }

        debug("initStatsUpdate cnf2\n" + jsonPrint(cnf2));

        initInputArrays(cnf2, function(err){
          return(callback(err, cnf2));
        });

      });
    }
    else {
      console.error(chalkError("NNT | ERROR LOAD DROPBOX CONFIG: " + dropboxConfigFile
        // + "\n" + jsonPrint(err)
        // + "\n" + err
      ));

      if ((err.response.status === 404) || (err.response.status === 409)){
        // OVERIDE CONFIG WITH COMMAND LINE ARGS

        commandLineConfigKeys = Object.keys(commandLineConfig);

        commandLineConfigKeys.forEach(function(arg){
          cnf[arg] = commandLineConfig[arg];
          console.log("NNT | --> COMMAND LINE CONFIG | " + arg + ": " + cnf[arg]);
        });

        configArgs = Object.keys(cnf);

        configArgs.forEach(function(arg){
          console.log("NNT | _FINAL CONFIG | " + arg + ": " + cnf[arg]);
        });

        if (cnf.enableStdin){

          console.log("NNT | STDIN ENABLED");

          stdin = process.stdin;
          if(stdin.setRawMode  !== undefined) {
            stdin.setRawMode( true );
          }
          stdin.resume();
          stdin.setEncoding( "utf8" );
          stdin.on( "data", function( key ){

            switch (key) {
              case "\u0003":
                process.exit();
              break;
              case "v":
                configuration.verbose = !configuration.verbose;
                console.log(chalkRedBold("NNT | VERBOSE: " + configuration.verbose));
              break;
              case "q":
                quit();
              break;
              case "Q":
                quit();
              break;
              case "s":
                showStats();
              break;
              case "S":
                showStats(true);
              break;
              default:
                console.log(
                  "\n" + "q/Q: quit"
                  + "\n" + "s: showStats"
                  + "\n" + "S: showStats verbose"
                );
            }
          });
        }

        initStatsUpdate(cnf, function(err, cnf2){
          if (err) {
            console.log(chalkError("NNT | ERROR initStatsUpdate\n" + jsonPrint(err)));
          }
          debug("initStatsUpdate cnf2\n" + jsonPrint(cnf2));

          initInputArrays(cnf2, function(err){
            return(callback(err, cnf2));
          });

        });
      }
      else {
        callback(err, null);
      }
     }
  });
}

console.log(chalkInfo("NNT | " + getTimeStamp() 
  + " | WAIT 5 SEC FOR MONGO BEFORE INITIALIZE CONFIGURATION"
));

function initMain(cnf, callback){
  console.log(chalkAlert("***===*** INIT MAIN ***===***"));
}

function initTimeout(callback){

  console.log(chalkError("\nNNT | SET TIMEOUT | " + moment().format(compactDateTimeFormat) + "\n"));

  initialize(configuration, function(err, cnf){

    if (err && (err.response.status !== 404) && (err.response.status !== 409)) {
      console.error(chalkError("NNT | ***** INIT ERROR *****\n" + jsonPrint(err)));
      quit();
    }

    configuration = cnf;

    console.log(chalkBlue("\n\nNNT | " + cnf.processName + " STARTED " + getTimeStamp() + "\n" + jsonPrint(configuration)));

    loadNetworkDropboxFolder(cnf.neuralNetworkFolder, function(err, dropboxNetworksArray){
      quit();
    });

  });
}

initTimeout(function(){

  initMain(configuration, function(){
    debug(chalkLog("FIRST INIT MAIN CALLBACK"
    ));
  });

});


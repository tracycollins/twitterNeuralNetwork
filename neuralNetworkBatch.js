/*jslint node: true */
"use strict";

const DEFAULT_EVOLVE_ITERATIONS = 50;
const DEFAULT_MAX_INSTANCES = 3;
const DEFAULT_STATS_INTERVAL = 60000;

let configuration = {};

const slackOAuthAccessToken = "xoxp-3708084981-3708084993-206468961315-ec62db5792cd55071a51c544acf0da55";
const slackChannel = "#nn_batch";

const defaultDateTimeFormat = "YYYY-MM-DD HH:mm:ss ZZ";
const compactDateTimeFormat = "YYYYMMDD_HHmmss";

const os = require("os");
const pm2 = require("pm2");
const Slack = require("slack-node");
const async = require("async");
const defaults = require("object.defaults/immutable");
const moment = require("moment");
const chalk = require("chalk");
const debug = require("debug")("nnb");
const commandLineArgs = require("command-line-args");
const Dropbox = require("dropbox");
const deepcopy = require("deep-copy");

const chalkAlert = chalk.red;
const chalkBlue = chalk.blue;
const chalkRedBold = chalk.bold.red;
const chalkError = chalk.bold.red;
const chalkWarn = chalk.red;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;

let hostname = os.hostname();
hostname = hostname.replace(/.local/g, "");
hostname = hostname.replace(/.home/g, "");
hostname = hostname.replace(/.at.net/g, "");
hostname = hostname.replace(/.fios-router/g, "");
hostname = hostname.replace(/.fios-router.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");

function jsonPrint(obj) {
  if (obj) {
    return JSON.stringify(obj, null, 2);
  } 
  else {
    return obj;
  }
}

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


const enableStdin = { name: "enableStdin", alias: "i", type: Boolean, defaultValue: true };
const quitOnError = { name: "quitOnError", alias: "q", type: Boolean, defaultValue: true };
const verbose = { name: "verbose", alias: "v", type: Boolean };

const testMode = { name: "testMode", alias: "T", type: Boolean, defaultValue: false };
const loadNeuralNetworkFileRunID = { name: "loadNeuralNetworkFileRunID", alias: "N", type: String };
const evolveIterations = { name: "evolveIterations", alias: "I", type: Number};

const optionDefinitions = [enableStdin, quitOnError, verbose, evolveIterations, testMode, loadNeuralNetworkFileRunID];

const commandLineConfig = commandLineArgs(optionDefinitions);
console.log(chalkInfo("COMMAND LINE CONFIG\n" + jsonPrint(commandLineConfig)));
console.log("COMMAND LINE OPTIONS\n" + jsonPrint(commandLineConfig));


// ==================================================================
// DROPBOX
// ==================================================================

const DROPBOX_WORD_ASSO_ACCESS_TOKEN = process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN || "nknEWsIkD5UAAAAAAAQouTDFRBKfwsFzuS8PPi2Q_JVYnpotNuaHiddNtmG4mUTi";
// const DROPBOX_WORD_ASSO_APP_KEY = process.env.DROPBOX_WORD_ASSO_APP_KEY ;
// const DROPBOX_WORD_ASSO_APP_SECRET = process.env.DROPBOX_WORD_ASSO_APP_SECRET;

let dropboxClient = new Dropbox({ accessToken: DROPBOX_WORD_ASSO_ACCESS_TOKEN });

const DROPBOX_NNB_CONFIG_FILE = process.env.DROPBOX_NNB_CONFIG_FILE || "neuralNetworkBatchConfig.json";
// const DROPBOX_NNB_STATS_FILE = process.env.DROPBOX_NNB_STATS_FILE || "neuralNetworkBatchStats.json";

const dropboxConfigFolder = "/config/utility";
// const dropboxConfigDefaultFolder = "/config/utility/default";
const dropboxConfigHostFolder = "/config/utility/" + hostname;
const dropboxConfigFile = hostname + "_" + DROPBOX_NNB_CONFIG_FILE;


let stdin;

let statsObj = {};

statsObj.commandLineConfig = commandLineConfig;

statsObj.hostname = hostname;
statsObj.pid = process.pid;

statsObj.startTimeMoment = moment();
statsObj.startTime = moment().valueOf();
statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);


const NNB_RUN_ID = hostname + "_" + process.pid + "_" + statsObj.startTimeMoment.format(compactDateTimeFormat);
statsObj.runId = NNB_RUN_ID;
console.log(chalkAlert("RUN ID: " + statsObj.runId));

const statsFolder = "/stats/" + hostname + "/neuralNetworkBatch";
const statsFile = "neuralNetworkBatch_" + statsObj.runId + ".json";
console.log(chalkInfo("STATS FILE : " + statsFolder + "/" + statsFile));

let processPollInterval;
let statsUpdateInterval;

function showStats(options){

  statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);

  if (options) {
    console.log("\n\nSTATS\n" + jsonPrint(statsObj));
  }
  else {
    console.log(chalkLog("\nS"
      + " | RUN " + statsObj.elapsed
      + " | NOW " + moment().format(compactDateTimeFormat)
      + " | STRT " + moment(parseInt(statsObj.startTime)).format(compactDateTimeFormat)
      + " | ITERATIONS " + configuration.evolveIterations
    ));

  }
}

let slack = new Slack(slackOAuthAccessToken);
function slackPostMessage(channel, text, callback){

  debug(chalkInfo("SLACK POST: " + text));

  slack.api("chat.postMessage", {
    text: text,
    channel: channel
  }, function(err, response){
    if (err){
      console.error(chalkError("*** SLACK POST MESSAGE ERROR\n" + err));
    }
    else {
      debug(response);
    }
    if (callback !== undefined) { callback(err, response); }
  });
}

function quit(){

  console.log(chalkAlert( "\n\n... QUITTING ...\n\n" ));

  showStats(true);

  clearInterval(processPollInterval);
  clearInterval(statsUpdateInterval);

  statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);

  const slackText = "QUIT BATCH\n" + getTimeStamp() + "\n" + statsObj.runId;

  slackPostMessage(slackChannel, slackText, function(){
    setTimeout(function(){
      pm2.disconnect();   // Disconnects from PM2
      process.exit();
    }, 1500);
  });
}

let appHashMap = {};

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
      debug(chalkLog("SAVED DROPBOX JSON | " + options.path));
      callback(null, response);
    })
    .catch(function(error){
      console.error(chalkError(moment().format(defaultDateTimeFormat) 
        + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
        + "\nERROR: " + error
        + "\nERROR: " + jsonPrint(error)
        // + "\nERROR\n" + jsonPrint(error)
      ));
      callback(error, null);
    });
}

function loadFile(path, file, callback) {

  console.log(chalkInfo("LOAD FOLDER " + path));
  console.log(chalkInfo("LOAD FILE " + file));
  console.log(chalkInfo("FULL PATH " + path + "/" + file));

  let fileExists = false;

  dropboxClient.filesListFolder({path: path})
    .then(function(response) {

        async.each(response.entries, function(folderFile, cb) {

          debug("FOUND FILE " + folderFile.name);

          if (folderFile.name === file) {
            debug(chalkRedBold("SOURCE FILE EXISTS: " + path + "/" + file));
            fileExists = true;
          }

          cb();

        }, function(err) {

          if (err) {
            console.log(chalkError("ERR\n" + jsonPrint(err)));
            return(callback(err, null));
          }

          if (fileExists) {

            dropboxClient.filesDownload({path: path + "/" + file})
              .then(function(data) {
                console.log(chalkLog(getTimeStamp()
                  + " | LOADING FILE FROM DROPBOX FILE: " + path + "/" + file
                ));

                let payload = data.fileBinary;
                debug(payload);

                if (file.match(/\.json$/gi)) {
                  let fileObj = JSON.parse(payload);
                  return(callback(null, fileObj));
                }
                else {
                  return(callback(null, payload));
                }

              })
              .catch(function(error) {
                console.log(chalkError("DROPBOX loadFile ERROR: " + file + "\n" + error));
                console.log(chalkError("!!! DROPBOX READ " + file + " ERROR"));
                console.log(chalkError(jsonPrint(error)));

                if (error.status === 404) {
                  console.error(chalkError("!!! DROPBOX READ FILE " + file + " NOT FOUND"
                    + " ... SKIPPING ...")
                  );
                  return(callback(null, null));
                }
                if (error.status === 0) {
                  console.error(chalkError("!!! DROPBOX NO RESPONSE"
                    + " ... NO INTERNET CONNECTION? ... SKIPPING ..."));
                  return(callback(null, null));
                }
                return(callback(error, null));
              });
          }
          else {
            console.log(chalkError("*** FILE DOES NOT EXIST: " + path + "/" + file));
            return(callback({status: 404}, null));
          }
        });
    })
    .catch(function(err) {
      console.log(chalkError("*** ERROR DROPBOX LOAD FILE\n" + err));
      callback(err, null);
    });
}

function initStatsUpdate(cnf, callback){

  console.log(chalkBlue("INIT STATS UPDATE INTERVAL | " + cnf.statsUpdateIntervalTime + " MS"));

  clearInterval(statsUpdateInterval);

  statsUpdateInterval = setInterval(function () {

    statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);
    statsObj.timeStamp = moment().format(defaultDateTimeFormat);

    saveFile(statsFolder, statsFile, statsObj, function(){
      showStats();
    });

  }, cnf.statsUpdateIntervalTime);

  callback(null, cnf);
}

function initStdIn(){
  console.log("STDIN ENABLED");
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
        console.log(chalkRedBold("VERBOSE: " + configuration.verbose));
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

function initBatch(callback){

  console.log(chalkAlert("INIT BATCH"
    + " | " + getTimeStamp()
  ));

  pm2.connect(function(err) {

    if (err) {
      console.error(err);
      process.exit(2);
    }

    let options = {};
    options.script = "twitterNeuralNetwork.js";
    options.cwd = "/Volumes/RAID1/projects/twitterNeuralNetwork";
    options.autorestart = false;
    options.env = {};
    options.env.NODE_ENV = "production";
    options.env.BATCH_MODE = true;
    options.env.GCLOUD_PROJECT = "graphic-tangent-627";
    options.env.GOOGLE_PROJECT = "graphic-tangent-627";
    options.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN = "nknEWsIkD5UAAAAAAAQouTDFRBKfwsFzuS8PPi2Q_JVYnpotNuaHiddNtmG4mUTi";
    // options.env.DROPBOX_WORD_ASSO_APP_KEY = "qlb9k4dp01t9iqk";
    // options.env.DROPBOX_WORD_ASSO_APP_SECRET = "wqslhe2t95zfn19";
    options.env.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FOLDER = "/config/twitter";
    options.env.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FILE = "altthreecee00.json";
    options.env.TNN_PROCESS_NAME = "nnb";
    options.env.TNN_EVOLVE_ITERATIONS = configuration.evolveIterations;
    options.env.TNN_TWITTER_DEFAULT_USER = "altthreecee00";
    options.env.TNN_TWITTER_USERS = {"altthreecee00": "altthreecee00", "ninjathreecee": "ninjathreecee"};

    let instanceConfigArray = [];
    let instanceIndex = 0;

    for (instanceIndex=0; instanceIndex < configuration.maxInstances; instanceIndex +=1){

      const runId = hostname + "_" + process.pid + "_" + instanceIndex;
      const instanceName = "nnb_" + runId;
      const neuralNetworkFile = "neuralNetwork_" + instanceName + ".json";

      let logfile = "/Users/tc/logs/batch/neuralNetwork/" + instanceName + ".log";

      if (hostname.includes("google")){
        logfile = "/home/tc/logs/batch/neuralNetwork/" + instanceName + ".log";
      }
      
      let currentOptions = defaults(options, {
        name: instanceName,
        out_file: logfile,
        error_file: logfile
      });

      currentOptions.env.TNN_PROCESS_NAME = instanceName;
      currentOptions.env.TNN_RUN_ID = runId;
      currentOptions.env.TNN_NEURAL_NETWORK_FILE = neuralNetworkFile;

      debug("CURRENT OPTIONS\n" + jsonPrint(currentOptions));
      console.log("OPTIONS"
        + " | " + currentOptions.name
        + " | TNN_RUN_ID: " + currentOptions.env.TNN_RUN_ID
        + " | " + currentOptions.out_file
      );

      const opt = deepcopy(currentOptions);

      instanceConfigArray.push(opt);
    }

    async.each(instanceConfigArray, function(instanceConfig, cb){

      debug("START\n" + jsonPrint(instanceConfig));

      pm2.start(instanceConfig, function(err, apps) {

        if (err) { throw err; }

        // console.log("PM2 LAUNCHED | " + instanceConfig.name);
        // console.log("APP\n" + jsonPrint(apps[0]));
        console.log("START"
          + " | " + apps[0].pm2_env.name
          + " | PM2 ID: " + apps[0].pm2_env.pm_id
          + " | PID: " + apps[0].process.pid
          + " | TNN_RUN_ID: " + apps[0].pm2_env.TNN_RUN_ID
          + " | STATUS: " + apps[0].pm2_env.status
        );

        appHashMap[apps[0].pm2_env.name] = apps[0];

        slackPostMessage(slackChannel, "\nNNB INSTANCE STARTED\n" + instanceConfig.name + "\n" + getTimeStamp(), function(){
          cb(err);
        });

      });
    }, function(err){

      if (err) { throw err; }

      console.log("\nALL LAUNCHED\n");

      Object.keys(appHashMap).forEach(function(appName){
        console.log("LAUNCHED"
          + " | " + appName
          + " | PM2 ID: " + appHashMap[appName].pm2_env.pm_id
          + " | PID: " + appHashMap[appName].process.pid
          + " | STATUS: " + appHashMap[appName].pm2_env.status
        );
      });

      processPollInterval = setInterval(function(){

        pm2.list(function(err, apps){
          if (err) { throw err; }
          if ((Object.keys(appHashMap).length === 0) || (apps.length === 0 )) { 
            quit(); 
          }
          else  {
            showStats();
            console.log("\nAPPS______________________");
            apps.forEach(function(app){
              console.log(app.name
                + " | PM2 ID: " + app.pm2_env.pm_id
                + " | PID: " + app.pid
                + " | STATUS: " + app.pm2_env.status
                + " | START: " + moment(parseInt(app.pm2_env.created_at)).format(compactDateTimeFormat)
                + " | UPTIME: " + app.pm2_env.pm_uptime
              );
              if (appHashMap[app.name] && app.pm2_env.status === "stopped"){

                console.log(chalkAlert("XXX STOPPED | " + app.name));

                pm2.delete(app.pm2_env.pm_id, function(err, results){

                  slackPostMessage(slackChannel, "\nNNB INSTANCE STOPPED\n" + app.name + "\n" + getTimeStamp());

                  delete appHashMap[app.name];

                  if (err) { throw err; }

                  debug("PM2 DELETE RESULTS\n" + results);

                  if ((Object.keys(appHashMap).length === 0) || (apps.length === 0 )) { 
                    quit(); 
                  }
                });
              }
            });
          }
        });
      }, 10000);

      callback();
    });
  });
}

function initialize(cnf, callback){

  console.log(chalkBlue("INITIALIZE cnf\n" + jsonPrint(cnf)));

  if (debug.enabled){
    console.log("\n%%%%%%%%%%%%%%\n DEBUG ENABLED \n%%%%%%%%%%%%%%\n");
  }

  cnf.processName = process.env.NNB_PROCESS_NAME || "neuralNetworkBatch";

  cnf.verbose = process.env.NNB_VERBOSE_MODE || false ;
  cnf.quitOnError = process.env.NNB_QUIT_ON_ERROR || false ;
  cnf.enableStdin = process.env.NNB_ENABLE_STDIN || true ;
  cnf.evolveIterations = process.env.NNB_EVOLVE_ITERATIONS || DEFAULT_EVOLVE_ITERATIONS ;
  cnf.maxInstances = process.env.NNB_MAX_INSTANCES || DEFAULT_MAX_INSTANCES ;

  cnf.classifiedUsersFile = process.env.NNB_CLASSIFIED_USERS_FILE || "classifiedUsers.json";
  cnf.classifiedUsersFolder = dropboxConfigHostFolder + "/classifiedUsers";
  cnf.statsUpdateIntervalTime = process.env.NNB_STATS_UPDATE_INTERVAL || DEFAULT_STATS_INTERVAL;

  debug(chalkWarn("dropboxConfigFolder: " + dropboxConfigFolder));
  debug(chalkWarn("dropboxConfigFile  : " + dropboxConfigFile));

  loadFile(dropboxConfigHostFolder, dropboxConfigFile, function(err, loadedConfigObj){

    let commandLineConfigKeys;
    let configArgs;

    if (!err) {
      console.log(dropboxConfigFile + "\n" + jsonPrint(loadedConfigObj));

      if (loadedConfigObj.NNB_EVOLVE_ITERATIONS  !== undefined){
        console.log("LOADED NNB_EVOLVE_ITERATIONS: " + loadedConfigObj.NNB_EVOLVE_ITERATIONS);
        cnf.evolveIterations = loadedConfigObj.NNB_EVOLVE_ITERATIONS;
      }

      if (loadedConfigObj.NNB_MAX_INSTANCES  !== undefined){
        console.log("LOADED NNB_MAX_INSTANCES: " + loadedConfigObj.NNB_MAX_INSTANCES);
        cnf.maxInstances = loadedConfigObj.NNB_MAX_INSTANCES;
      }

      if (loadedConfigObj.NNB_VERBOSE_MODE  !== undefined){
        console.log("LOADED NNB_VERBOSE_MODE: " + loadedConfigObj.NNB_VERBOSE_MODE);
        cnf.verbose = loadedConfigObj.NNB_VERBOSE_MODE;
      }

      if (loadedConfigObj.NNB_TEST_MODE  !== undefined){
        console.log("LOADED NNB_TEST_MODE: " + loadedConfigObj.NNB_TEST_MODE);
        cnf.testMode = loadedConfigObj.NNB_TEST_MODE;
      }

      if (loadedConfigObj.NNB_NEURAL_NETWORK_FILE_RUNID  !== undefined){
        console.log("LOADED NNB_NEURAL_NETWORK_FILE_RUNID: " + loadedConfigObj.NNB_NEURAL_NETWORK_FILE_RUNID);
        cnf.loadNeuralNetworkFileRunID = loadedConfigObj.NNB_NEURAL_NETWORK_FILE_RUNID;
      }

      if (loadedConfigObj.NNB_ENABLE_STDIN  !== undefined){
        console.log("LOADED NNB_ENABLE_STDIN: " + loadedConfigObj.NNB_ENABLE_STDIN);
        cnf.enableStdin = loadedConfigObj.NNB_ENABLE_STDIN;
      }

      if (loadedConfigObj.NNB_STATS_UPDATE_INTERVAL  !== undefined) {
        console.log("LOADED NNB_STATS_UPDATE_INTERVAL: " + loadedConfigObj.NNB_STATS_UPDATE_INTERVAL);
        cnf.statsUpdateIntervalTime = loadedConfigObj.NNB_STATS_UPDATE_INTERVAL;
      }

      if (loadedConfigObj.NNB_KEEPALIVE_INTERVAL  !== undefined) {
        console.log("LOADED NNB_KEEPALIVE_INTERVAL: " + loadedConfigObj.NNB_KEEPALIVE_INTERVAL);
        cnf.keepaliveInterval = loadedConfigObj.NNB_KEEPALIVE_INTERVAL;
      }

      // OVERIDE CONFIG WITH COMMAND LINE ARGS

      commandLineConfigKeys = Object.keys(commandLineConfig);

      commandLineConfigKeys.forEach(function(arg){
        cnf[arg] = commandLineConfig[arg];
        console.log("--> COMMAND LINE CONFIG | " + arg + ": " + cnf[arg]);
      });

      configArgs = Object.keys(cnf);

      configArgs.forEach(function(arg){
        console.log(chalkAlert(">>> FINAL CONFIG (FILE) | " + arg + ": " + cnf[arg]));
      });

      if (cnf.enableStdin){
        initStdIn();
      }

      initStatsUpdate(cnf, function(err, cnf2){
        if (err) {
          console.log(chalkError("ERROR initStatsUpdate\n" + err));
        }
        return(callback(err, cnf2));
      });
    }
    else {

      if (err.status === 404){
        // OVERIDE CONFIG WITH COMMAND LINE ARGS

        commandLineConfigKeys = Object.keys(commandLineConfig);

        commandLineConfigKeys.forEach(function(arg){
          cnf[arg] = commandLineConfig[arg];
          debug("--> COMMAND LINE CONFIG | " + arg + ": " + cnf[arg]);
        });

        configArgs = Object.keys(cnf);

        configArgs.forEach(function(arg){
          console.log(chalkAlert(">>> FINAL CONFIG | " + arg + ": " + cnf[arg]));
        });

        if (cnf.enableStdin){
          initStdIn();
        }

        initStatsUpdate(cnf, function(err, cnf2){
          if (err) {
            console.log(chalkError("ERROR initStatsUpdate\n" + jsonPrint(err)));
          }
          debug("initStatsUpdate cnf2\n" + jsonPrint(cnf2));
        });

        callback(null, cnf);
      }
      else {
        console.error(chalkError("ERROR LOAD DROPBOX CONFIG: " + dropboxConfigFile
          + "\n" + jsonPrint(err)
        ));
        callback(err, cnf);
      }
    }
  });
}

initialize(configuration, function(err, cnf){
  if (err) { throw err; }
  configuration = cnf;
  statsObj.configuration = {};
  statsObj.configuration = configuration;

  slackPostMessage(slackChannel, statsObj.runId + "\nSTARTED\n" + getTimeStamp());

  initBatch(function(){
    console.log(chalkAlert("INITIALIZED"));
  });
});

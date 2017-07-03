/*jslint node: true */
"use strict";

let configuration = {
  maxInstances: 3,
  evolveIterations: 100
};

const slackOAuthAccessToken = "xoxp-3708084981-3708084993-206468961315-ec62db5792cd55071a51c544acf0da55";
const slackChannel = "#tnn_batch";

const defaultDateTimeFormat = "YYYY-MM-DD HH:mm:ss ZZ";
const compactDateTimeFormat = "YYYYMMDD_HHmmss";

const os = require("os");
const pm2 = require("pm2");
const Slack = require("slack-node");
const async = require("async");
const defaults = require("object.defaults/immutable");
const moment = require("moment");
const chalk = require("chalk");
const debug = require("debug")("tnn");
const commandLineArgs = require("command-line-args");

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

let statsObj = {};

statsObj.commandLineConfig = commandLineConfig;

statsObj.hostname = hostname;
statsObj.pid = process.pid;

statsObj.startTimeMoment = moment();
statsObj.startTime = moment().valueOf();
statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);

const TNN_RUN_ID = hostname + "_" + process.pid + "_" + statsObj.startTimeMoment.format(compactDateTimeFormat);
statsObj.runId = TNN_RUN_ID;
console.log(chalkAlert("RUN ID: " + statsObj.runId));

let processPollInterval;

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

pm2.connect(function(err) {

  if (err) {
    console.error(err);
    process.exit(2);
  }

  let options = {};
  options.script = "twitterNeuralNetwork.js";
  options.cmd = "/Volumes/RAID1/projects/twitterNeuralNetwork";
  options.autorestart = false;
  options.env = {};
  options.env.NODE_ENV = "production";
  options.env.BATCH_MODE = true;
  options.env.GCLOUD_PROJECT = "graphic-tangent-627";
  options.env.GOOGLE_PROJECT = "graphic-tangent-627";
  options.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN = "nknEWsIkD5UAAAAAAAQouTDFRBKfwsFzuS8PPi2Q_JVYnpotNuaHiddNtmG4mUTi";
  options.env.DROPBOX_WORD_ASSO_APP_KEY = "qlb9k4dp01t9iqk";
  options.env.DROPBOX_WORD_ASSO_APP_SECRET = "wqslhe2t95zfn19";
  options.env.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FOLDER = "/config/twitter";
  options.env.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FILE = "altthreecee00.json";
  options.env.TNN_PROCESS_NAME = "tnn";
  options.env.TNN_EVOLVE_ITERATIONS = configuration.evolveIterations;
  options.env.TNN_TWITTER_DEFAULT_USER = "altthreecee00";
  options.env.TNN_TWITTER_USERS = {"altthreecee00": "altthreecee00", "ninjathreecee": "ninjathreecee"};

  let instanceConfigArray = [];
  let instanceIndex = 0;

  for (instanceIndex=0; instanceIndex < configuration.maxInstances; instanceIndex +=1){

    const instanceName = "tnn_" + hostname + "_" + process.pid + "_" + instanceIndex;

    let logfile = "/Users/tc/logs/batch/tnn/" + instanceName + ".log";

    if (hostname.includes("google")){
      logfile = "/home/tc/logs/batch/tnn/" + instanceName + ".log";
    }
    
    let currentOptions = defaults(options, {
      name: instanceName,
      out_file: logfile,
      error_file: logfile
    });

    currentOptions.env.TNN_PROCESS_NAME = instanceName;
    debug("CURRENT OPTIONS\n" + jsonPrint(currentOptions));

    instanceConfigArray.push(currentOptions);

  }

  async.each(instanceConfigArray, function(instanceConfig, cb){

    debug("START\n" + jsonPrint(instanceConfig));

    pm2.start(instanceConfig, function(err, apps) {

      // console.log("PM2 LAUNCHED | " + instanceConfig.name);
      // console.log("APP\n" + jsonPrint(apps[0]));
      console.log("START"
        + " | " + apps[0].pm2_env.name
        + " | PM2 ID: " + apps[0].pm2_env.pm_id
        + " | PID: " + apps[0].process.pid
        + " | STATUS: " + apps[0].pm2_env.status
      );

      appHashMap[apps[0].pm2_env.name] = apps[0];

      slackPostMessage(slackChannel, instanceConfig.name + "\nSTARTED " + getTimeStamp(), function(){
        cb(err);
      });

    });

  }, function(err){

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
            // if (app.pm2_env.status === "stopped"){
              console.log(chalkAlert("XXX STOPPED | " + app.name));
              pm2.delete(app.pm2_env.pm_id, function(err, results){
                delete appHashMap[app.name];
                if (err) { throw err; }
                if ((Object.keys(appHashMap).length === 0) || (apps.length === 0 )) { 
                  quit(); 
                }
              });
            }
          });
        }
       })
    }, 10000);

    // quit();
  });


});
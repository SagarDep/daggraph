#!/usr/bin/env node
'use strict';
const Chalk = require('chalk');
const path = require('path');
const fs = require('fs');
var Inquirer = require("inquirer");
const DAGGER_ANALYZER = require('./dagger/DaggerAnalyzer');
const GRAPH_MAPPER = require('./graph/GraphMapper');
const opn = require('opn');
const log = console.log;

// Chart types
const BUBBLE_CHART = "Bubble chart";
const TREE_CHART = "Tree chart";
const LINKED_NODE_CHART = "Linked node chart";
const CHART = "Chart";
const RAW_DATA = "Raw data";
const JSON_TYPE = "Json";

// Main code //
const self = module.exports = {
  init: (input, flags) => {

    // Default project path is the current folder
    var rootPath = './';

    // Check for specified path and validate
    if (input[0] !== undefined) {
      if (!fs.lstatSync(input[0]).isDirectory()) {
        log(Chalk.red('Path is not a directory'));
        process.exit(2);
      } else {
        rootPath = input[0];
      }
    }

    // If is not a gradle folder, stop
    if (!isGradleFolder(rootPath)) {
      log(Chalk.red(`This is not a gradle folder`));
      process.exit(2);
    }

    // Scan the folder structure and get the dagger components
    DAGGER_ANALYZER.findComponents(rootPath)
    .then(components => {

      if (components.length == 0) {
        log(Chalk.red(`Couldn't find any components, are you sure this project is using Dagger?`));
        process.exit(2);
      }

      // Ask question about generating chart or exporting raw data
      askChartOrExportRawDataQuestion()
      .then((answer) => {
        let fileDataPromise;
        switch(answer.action){
          case CHART:
            fileDataPromise = askChartTypeQuestions()
              .then((answers) => getGraphDataFromChartType(answers.chart_type, components));
            break;
          case RAW_DATA:
            fileDataPromise = askRawDataQuestions()
              .then((answer) => getRawDataForDataStructure(answer.data_structure, components));
            break;
        }
        fileDataPromise.then((fileData) => createFileAndSave(fileData));
      });  

    }).catch(msg => log(msg));
  }
};

function askChartOrExportRawDataQuestion(){
  const chartOrRawQuestion = [{
    type: "list",
    name: "action",
    message: "Do you want to generate a chart or export raw data?",
    choices: [CHART,RAW_DATA]
  }];
  return Inquirer.prompt(chartOrRawQuestion);
}

function askChartTypeQuestions(){
  const chartQuestions = [{
    type: "list",
    name: "chart_type",
    message: "What kind of chart do you want to generate?",
    choices: [BUBBLE_CHART,TREE_CHART,LINKED_NODE_CHART]
  }];
  return Inquirer.prompt(chartQuestions);
}

function askRawDataQuestions(){
  const rawTypeQuestion = [{
    type: "list",
    name: "data_structure",
    message: "How do you want to export the data?",
    choices: [JSON_TYPE]
  }];
  return Inquirer.prompt(rawTypeQuestion);
}

function getRawDataForDataStructure(type, components){
  let fileContent;
  let fileName;
  switch(type){
    case JSON_TYPE:
      fileContent = JSON.stringify(components, null, 2);
      fileName = "dependency.json";
      break;
  }
  return Promise.resolve({
    'fileContent' : fileContent,
    'fileName' : fileName
  });
}

function getGraphDataFromChartType(chartType, components){
  let jsonFileContent;
  let placeholderPath;
  let fileName;
  
  switch(chartType) {
    case BUBBLE_CHART:
      jsonFileContent = GRAPH_MAPPER.toBubbleGraph(components);
      placeholderPath = path.join(__dirname, 'graph', 'bubble', 'placeholder_index.html');
      fileName = 'dependency_bubble_graph.html';
      break;
    case TREE_CHART:
      jsonFileContent = GRAPH_MAPPER.toTreeGraph(components);
      placeholderPath = path.join(__dirname, 'graph', 'tree', 'placeholder_index.html');
      fileName = 'dependency_tree_graph.html';
      break;
    case LINKED_NODE_CHART:
      jsonFileContent = GRAPH_MAPPER.toLinkedNodes(components);
      placeholderPath = path.join(__dirname, 'graph', 'linked_nodes', 'placeholder_index.html');
      fileName = 'dependency_linked_nodes_graph.html';
      break;
  }
  let fileContent = fs.readFileSync(placeholderPath, 'utf8').replace('JSON_PLACEHOLDER', JSON.stringify(jsonFileContent, null, 2));

  return Promise.resolve({
    'fileContent' : fileContent,
    'fileName' : fileName
  });
}

function createFileAndSave(fileData){
  const output_path = path.join('build', fileData.fileName);
  const absFilePath = path.join(process.cwd(), output_path);

  try {
    fs.statSync(getBuildFolderPath())
  } catch(e) {
    fs.mkdirSync(getBuildFolderPath());
  }

  log(`Opening: ${Chalk.green(absFilePath)}`);

  fs.writeFile(output_path, fileData.fileContent, function(err) {
    opn(absFilePath, { wait: false });
  }); 
}

function isGradleFolder(rootPath){
  return fs.existsSync(path.join(rootPath, 'build.gradle'));
}

function getBuildFolderPath(){
  return path.join(process.cwd(), 'build');
}
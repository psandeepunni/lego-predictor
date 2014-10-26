var fs = require('fs'),
	wstream = fs.createWriteStream('./lego-set-details.csv');
    readline = require('readline'),
  	async = require('async'),
  	request = require('request'),
  	cheerio = require('cheerio'),
  	phantom = require('phantom'),
  	uniquePartsRegex = /^There\sare\sa\stotal\sof\s(\d{1,})\sparts,\swith\s(\d{1,})\sunique\sparts\/colors/i,
	priceRegex = /(\d{1,}\.\d{1,})/i,
	metricRegex = /Standard:\s*(\d{1,}\.\d{1,})\s*x\s*(\d{1,}\.\d{1,})\s*x\s*(\d{1,}\.\d{1,})/i,
	weightRegex = /Weight:\s*(\d{1,}\.\d{1,})\s*lbs\s*\/\s*(\d{1,}\.\d{1,})\s*kg/i,
	brickSetPriceRegex = /US\s*\$\s*(\d{1,}\.*\d{0,})/i;
	
var rd = readline.createInterface({
    input: fs.createReadStream('./URL.csv'),
    output: process.stdout,
    terminal: false
});

function writeToCSV(line) {
	line= line.replace(/undefined/g, '-1');
	wstream.write(line+'\n');
}

var queue = async.queue(function (task, callback) {
    async.parallel([
      function(bricksetCallback){
    		scrapeBrickSetPage(task.bricksetUrl,function(err,result){
    			if (err) {
    	 			bricksetCallback(err,null);
    	 		} else {
    	 			bricksetCallback(null,result);
    	 		}
    	 	});
    	},
      function(brickpickerCallback){
    	 	scrapeBrickPickerPage(task.brickpickerUrl,function(err,result){
    	 		if (err) {
    	 			brickpickerCallback(err,null);
    	 		} else {
    	 			brickpickerCallback(null,result);
    	 		}
    	 	});
       },
      function(rebrickableCallback){
    		scrapeRebrickablePage(task.rebrickableUrl,function(err,result){
    			if (err) {
    				rebrickableCallback(err,null);
    			} else {
    				rebrickableCallback(null,result);
    			}
    		});
    	}
	],
  function(err,results){

		if (err) {
			callback(err);
		} else {
			
			var str = task.setId + ',' + results[0]['Name']+',';
			str = str + results[0]['Set type']+',';
			str = str + results[0]['Theme group']+',';
			str = str + results[0]['Theme']+',';
			str = str + results[0]['Subtheme']+',';
			str = str + results[0]['Year released']+',';
			str = str + results[0]['Pieces']+',';
			str = str + results[0]['Minifigs']+',';
			str = str + results[0]['uniqueParts']+',';
			str = str + results[0]['Age range']+',';
			str = str + results[0]['Availability']+',';
			str = str + results[1]['length']+',';
			str = str + results[1]['width']+',';
			str = str + results[1]['height']+',';
			str = str + results[1]['weight']+',';
			str = str + results[0]['USRP']+',';
			str = str + results[1]['currentUSRP'];
			writeToCSV(str);
			callback();
		}
	});
}, 10);

queue.drain = function() {
    console.log('all items have been scraped and written to csv');
	wstream.end();
	process.exit(0);
}

function scrapeRebrickablePage(url,callback) {
	//There are a total of 2741 parts, with 542 unique parts/colors.
	phantom.create(function (ph) {
	  ph.createPage(function (page) {
	    page.open(url, function (status) {
	        console.log("opened "+url+" ? ", status);
			page.evaluate(function () { return document.documentElement.innerHTML; }, function (result) {
				var $ = cheerio.load(result);
				var partsInfo = $('#set_inv_list > p:nth-child(4)').text();
				console.log('unique parts = '+partsInfo);
				var matches = uniquePartsRegex.exec(partsInfo);
				var uniqueParts = -1;
				if (matches && matches.length === 3) {
					uniqueParts = parseInt(matches[2],10);
				}
				callback(null,{"uniqueParts" : uniqueParts});
				ph.exit();
			});
	    });
	  });
	});
}

function scrapeBrickSetPage(url,callback) {

	var scrapeResult = {};
	request(url, function (err, response, body) {
		if (err) callback(err,null);
		var $ = cheerio.load(body);
		var details = $('#body > div.outerwrap > div > aside > section:nth-child(2) > div > dl');
		var detailList = details.text().trim().split("\n");
		for (var i = 0; i < detailList.length; i = i + 2) {
			var dt = detailList[i];
			var dd = detailList[i+1];
			if (dt === "RRP") {
				console.log('price : '+dd);
				var matches = brickSetPriceRegex.exec(dd);
				console.log('array : ' + JSON.stringify(matches));
				scrapeResult["USRP"] = (matches && matches.length === 2)?matches[1]:-1;
			} else {
				scrapeResult[dt] = dd;
			}
		}
		callback(null,scrapeResult);
	});
}

function scrapeBrickPickerPage(url, callback) {
	request(url, function (err, response, body) {
		if (err) callbacZk(err,null);
	    var $ = cheerio.load(body);
	    var currentUSRP = $('#contentwrapper > div.widgetbox.padding0.nomargin > div > table > tbody > tr:nth-child(1) > td:nth-child(2)').text().trim().replace("$ ","");
		var usPriceMatches = priceRegex.exec(currentUSRP);
		var usPrice = (usPriceMatches)?usPriceMatches[0]:-1;

		var size = $('#contentwrapper > div:nth-child(1) > div:nth-child(2) > div > div > ul > li.ruler > div').text().trim().replace("\r\n\t","");
		var metricMatches = metricRegex.exec(size);
		var weightMatches = weightRegex.exec(size);
		var length = -1;
		var width = -1;
		var height = -1;
		var weight = -1;
		if (metricMatches && metricMatches.length === 4) {
			length = metricMatches[1];
			width = metricMatches[2];
			height = metricMatches[3];
		}
		if (weightMatches && weightMatches.length === 3) {
			weight = weightMatches[2];
		}
		callback(null,{"currentUSRP" : usPrice,"length" : length, "width" : width, "height" : height, "weight" : weight});
	});
}

var lineNo = 0;
rd.on('line', function(line) {
	var record = line.split(",");
	if (lineNo > 0) {
		var legoSetId = record[0];
		var legoSetRebrickableUrl = record[2];
		var legoSetBricksetUrl = record[3];
		var legoSetBrickpickerUrl = record[4];
		queue.push({"setId" : legoSetId,"rebrickableUrl" : legoSetRebrickableUrl,"bricksetUrl" : legoSetBricksetUrl, "brickpickerUrl" : legoSetBrickpickerUrl});
	} else {
	writeToCSV('setid,name,type,themeGroup,theme,subtheme,year,partCount,minifigCount,uniqueParts,age_range,availability,length,width,height,weight,USRP,currentUSRP');	
	}
	lineNo++;
});

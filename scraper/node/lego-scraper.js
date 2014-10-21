var fs = require('fs'),
	wstream = fs.createWriteStream('./lego-data-set.csv');
    readline = require('readline'),
  	async = require('async'),
  	request = require('request'),
  	cheerio = require('cheerio'),
  	phantom = require('phantom'),
  	uniquePartsRegex = /^There\sare\sa\stotal\sof\s(\d{1,})\sparts,\swith\s(\d{1,})\sunique\sparts\/colors/i,
	priceRegex = /^(\d{1,}\.\d{1,})/i,
	metricRegex = /Standard:\s(\d{1,}\.\d{1,})\sx\s(\d{1,}\.\d{1,})\sx\s(\d{1,}\.\d{1,})/i,
	weightRegex = /Weight:\s(\d{1,}\.\d{1,})\slbs\s\/\s(\d{1,}\.\d{1,})\skg/i;
	
var rd = readline.createInterface({
    input: fs.createReadStream('./URL.csv'),
    output: process.stdout,
    terminal: false
});

function writeToCSV(line) {
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
			
			var str = task.setId + ',' + results[0]['name']+',';
			str = str + results[0]['type']+',';
			str = str + results[0]['themeGroup']+',';
			str = str + results[0]['theme']+',';
			str = str + results[0]['subtheme']+',';
			str = str + results[0]['year']+',';
			str = str + results[0]['partCount']+',';
			str = str + results[0]['minifigCount']+',';
			str = str + results[0]['USRP']+',';
			str = str + results[0]['UKRP']+',';
			str = str + results[0]['availability']+',';
			str = str + results[1]['currentUSRP']+',';
			str = str + results[1]['currentUKRP']+',';
			str = str + results[1]['length']+',';
			str = str + results[1]['width']+',';
			str = str + results[1]['height']+',';
			str = str + results[1]['weight']+',';
			str = str + results[2]['uniqueParts'];
			writeToCSV(str);
			callback();
		}
	});
}, 1);

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
		var setName = $('#body > div.outerwrap > div > aside > section:nth-child(2) > div > dl > dd:nth-child(4)').text();
		var setType = $('#body > div.outerwrap > div > aside > section:nth-child(2) > div > dl > dd:nth-child(6)').text();
		var themeGroup = $('#body > div.outerwrap > div > aside > section:nth-child(2) > div > dl > dd:nth-child(8)').text();
		var theme = $('#body > div.outerwrap > div > aside > section:nth-child(2) > div > dl > dd:nth-child(10) > a').text();
		var subtheme = $('#body > div.outerwrap > div > aside > section:nth-child(2) > div > dl > dd:nth-child(12) > a').text();
		var releaseYear = $('#body > div.outerwrap > div > aside > section:nth-child(2) > div > dl > dd:nth-child(14) > a').text();
		var partCount = $('#body > div.outerwrap > div > aside > section:nth-child(2) > div > dl > dd:nth-child(16) > a').text();
		var minifigCount = $('#body > div.outerwrap > div > aside > section:nth-child(2) > div > dl > dd:nth-child(18) > a').text();
		var retailprice = $('#body > div.outerwrap > div > aside > section:nth-child(2) > div > dl > dd:nth-child(20)').text().split(" / ");
		var availability = $('#body > div.outerwrap > div > aside > section:nth-child(2) > div > dl > dd:nth-child(26)').text();

		scrapeResult["name"] = setName;
		scrapeResult["type"] = setType;
		scrapeResult["themeGroup"] = themeGroup;
		scrapeResult["theme"] = theme;
		scrapeResult["subtheme"] = subtheme;
		scrapeResult["year"] = releaseYear;
		scrapeResult["partCount"] = partCount;
		scrapeResult["minifigCount"] = minifigCount;
		if (retailprice.length === 3) {
			scrapeResult["USRP"] = retailprice[1].replace("US$","");
			scrapeResult["UKRP"] =  retailprice[0].replace("£","");
		} else {
			scrapeResult["USRP"] = -1;
			scrapeResult["UKRP"] =  -1;
		}
		scrapeResult["availability"] = availability;
		callback(null,scrapeResult);
	});
}

function scrapeBrickPickerPage(url, callback) {
	request(url, function (err, response, body) {
		if (err) callback(err,null);
	    var $ = cheerio.load(body);
	    var currentUSRP = $('#contentwrapper > div.widgetbox.padding0.nomargin > div > table > tbody > tr:nth-child(1) > td:nth-child(2)').text().trim().replace("$ ","");
		var currentUKRP = $('#contentwrapper > div.widgetbox.padding0.nomargin > div > table > tbody > tr:nth-child(2) > td:nth-child(2)').text().trim().replace("£ ","");
		var usPriceMatches = priceRegex.exec(currentUSRP);
		var ukPriceMatches = priceRegex.exec(currentUKRP);
		var usPrice = (usPriceMatches)?usPriceMatches[1]:-1;
		var ukPrice = (ukPriceMatches)?ukPriceMatches[1]:-1;
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
		callback(null,{"currentUSRP" : usPrice, "currentUKRP" : ukPrice, "length" : length, "width" : width, "height" : height, "weight" : weight});
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
		writeToCSV('setid,name,type,themeGroup,theme,subtheme,year,partCount,minifigCount,USRP,UKRP,availability,currentUSRP,currentUKRP,length,width,height,weight,uniqueParts');
	}
	lineNo++;
});

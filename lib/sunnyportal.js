var request = require('request');
var fs = require('fs');
var flow = require('flow')


var LOGIN_URL = '/Templates/Start.aspx';
var OPEN_INVERTER_URL = '/FixedPages/InverterSelection.aspx';
var SET_FILE_DATE_URL = '/FixedPages/InverterSelection.aspx';
var CURRENT_PRODUCTION_URL = '/Dashboard?_=1';
var DOWNLOAD_RESULTS_URL = '/Templates/DownloadDiagram.aspx?down=diag';


/**
 * Sunny Portal API Node Library
 * For interfacing with Sunny Portal.
 *
 * @module
 * @param {Object} opts  Need to pass in a url, username, password, and you plantOID.
 */
var SunnyPortal = function(opts) {

	if(!opts.url) {
		throw new Error('URL Option Must Be Defined');
	}
	if(!opts.username) {
		throw new Error('Username Must Be Defined');
	}
	if(!opts.password) {
		throw new Error('Password Must Be Defined');
	}
	if(!opts.plantOID) {
		throw new Error('Plant OID Must Be Defined');
	}

	var url = opts.url;
	var username = opts.username;
	var password = opts.password;
	var plantOID = opts.plantOID;

	var _login = function(callback) {
		var jar = request.jar();

		var options = {
			'method': 'POST',
			'url': url + LOGIN_URL,
			'headers': {
			  'Connection': 'keep-alive',
			  'Cache-Control': 'max-age=0',
			  'Upgrade-Insecure-Requests': '1',
			  'Origin': 'https://www.sunnyportal.com',
			  'Content-Type': ['application/x-www-form-urlencoded', 'application/x-www-form-urlencoded'],
			  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.129 Safari/537.36',
			  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
			  'Sec-Fetch-Site': 'same-origin',
			  'Sec-Fetch-Mode': 'navigate',
			  'Sec-Fetch-User': '?1',
			  'Sec-Fetch-Dest': 'document',
			  'Referer': 'https://www.sunnyportal.com/Templates/Start.aspx',
			  'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
			},
			form: {
			  '__EVENTTARGET': '',
			  '__EVENTARGUMENT': '',
			  'ctl00$ContentPlaceHolder1$Logincontrol1$txtUserName': username,
			  'ctl00$ContentPlaceHolder1$Logincontrol1$txtPassword': password,
			  'ctl00$ContentPlaceHolder1$Logincontrol1$LoginBtn': 'Anmelden',
			  'ctl00$ContentPlaceHolder1$hiddenLanguage': 'de-de'
			},

			jar : jar
		  };
		  request(options, function (error, response) { 
			if (error) throw new Error(error);
			if(response.headers.location && response.headers.location=='/FixedPages/HoManLive.aspx') {
				callback(error, jar);
			} else {
				callback(new Error('Login Failed'));
			}
		  });

	};

	var _openInverter = function(jar, callback) {

		var requestOpts = {
			method : 'GET',
			strictSSL : false,
			jar : jar
		}	

		request(url + OPEN_INVERTER_URL, requestOpts, function (err, httpResponse, body) {
			
			if (err) {
				console.error('Could not open inverter')
				callback(err);
			}
			callback(err, body);
		});
	};

	var _setFileDate = function(month, day, year,jar,  callback) {
		//Javascript: January=0. Sunnyportal: January=1;
		var month = month+1;

		var form = {
			__EVENTTARGET:'',
			ctl00$ContentPlaceHolder1$UserControlShowInverterSelection1$DeviceSelection$HiddenPlantOID : plantOID,
			ctl00$ContentPlaceHolder1$UserControlShowInverterSelection1$SelectedIntervalID:'3',
			ctl00$ContentPlaceHolder1$UserControlShowInverterSelection1$UseIntervalHour:'0',
			ctl00$ContentPlaceHolder1$UserControlShowInverterSelection1$_datePicker$textBox: month + '/' + day + '/' + year,
			ctl00$HiddenPlantOID : plantOID
		}

		var requestOpts = {
			method : 'POST',
			form : form,
			// Service does not have a valid cert
			strictSSL : false,
			jar : jar
		};

		request.post(url + SET_FILE_DATE_URL, requestOpts, function (err, httpResponse, body) {
			if (err) {
				console.error('login failed:', err);
				callback(err);
				return ;
			};
			callback(err, body);
		});	
	};

	var _downloadResults = function(jar, callback) {
		var requestOpts = {
			method : 'GET',
			strictSSL : false,
			jar : jar
		}
		request(url + DOWNLOAD_RESULTS_URL, requestOpts, function(err, httpResponse, body) {
			if (err) {
				console.error('login failed:', err);
				callback(err);
				return ;
			};
			callback(err, body);
		});
	}

	/**
	* Returns the current production at this moment in time.
	*
	* @method currentProduction
	* @param {Number} month
	* @param {Number} day
	* @param {Number} year 
	* @param {Function} callback A callback function once current production is recieved.  Will return a JSON object of the current status.
	*/
	var currentProduction = function(callback) {
		_login(function(err, jar) {
			if(err) {
				callback(err);
			}

			var requestOpts = {
				method : 'GET',
				strictSSL : false,
				jar : jar
			}	
			//The timestamp is just ignored. Using 1.
			request(url + CURRENT_PRODUCTION_URL, requestOpts, function (err, httpResponse, body) {
				if (err) {
					console.error('Could not get instance production')
					callback(err);
				}
				callback(err, JSON.parse(body));
			});
		});
	};

	/**
	* Returns historical production for a given day.  
	*
	* @method historicalProduction
	* @param {Number} month 0=January
	* @param {Number} day
	* @param {Number} year 
	* @param {Function} callback A callback function once historical production is recieved. Will return a JSON object of the days production.
	*/
	var historicalProduction = function(month, day, year, callback) {

		// Due to app dependencies, you cannot just download the document.  
		//You need to crawl the application such that items get added to your session.  
		//Then you may download the days data.
		//
		//You could make this more efficient by not loging in everytime but... I just wanted something quick and dirty.
		var finalJar;
		flow.exec(
			function() {
				_login(this);
			},
			function(err, jar) {
				finalJar = jar;
				_openInverter(finalJar, this);
			},
			function(err, body) {
				_setFileDate(month, day, year, finalJar, this);
			},
			function(err, body) {
				_downloadResults(finalJar, this);
			},
			function(err, body) {
				var response = {};

				var lineItems = body.split('\n');
				//Skip the first line. It is a header
				for(i=1; i<lineItems.length; i++) {
					var entries = lineItems[i].split(';');
					if(entries[0] && entries[1]) {
						//8:30 PM 
						var ampm = entries[0].split(' ')[1];
						var time = entries[0].split(' ')[0];
						var hour = parseInt(time.split(':')[0]);
						var minute = parseInt(time.split(':')[1]);

						if(ampm == 'PM' && hour < 12) {
							hour += 12;
						}
						if(ampm == 'AM' && hour == 12) {
							hour = 0;
						}

						var date = new Date(year, month, day, hour, minute);
						//If set to midnight the next day, add another day. Their response is messed up
						if(hour == 0 && minute == 0) {
							date.setDate(date.getDate() + 1);
						}
						//Unix Time
						response[(date.getTime()/1000)] = parseFloat(entries[1]);
					}
				}
				
				callback(err, response);
			}
		);
	};

	return {
		currentProduction : currentProduction,
		historicalProduction : historicalProduction
	};

};

module.exports = SunnyPortal;

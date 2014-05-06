
var assert = require('assert');
var SunnyPortal = require('../lib/sunnyportal')
var opts = {
	url : 'https://sunnyportal.com',
	username : 'YOUR USERNAME',
	password : 'YOUR PASSWORD',
	plantOID : 'YOUR PLANT ID'
}

var month = 4;
var day = 4;
var year = 2014;

//These are not proper unit tests but should be used as examples on how to access the API.
describe('testSunnyPortalAPI',function() {
	this.timeout(30000);
	it('should return an integer value for current production', function(done) {
		var sunnyPortal = new SunnyPortal(opts);
		sunnyPortal.currentProduction(function(err, body) {
			console.log(body);
			assert(err ==null);
			assert(body.PV >= 0);
			done();
		});
	});

	it('should return data for a specific production date', function(done) {
		var sunnyPortal = new SunnyPortal(opts);
		sunnyPortal.historicalProduction(month,day,year,function(err, response) {
			console.log(response);
			assert(err == null);
			assert(response.length=(24*4));
			
			for(var k in response) {
				if(!isNaN(k)) {
					var date = new Date(k*1000);
					assert(month == date.getMonth());
					//Check for the one rollover day.
					assert(day == date.getDate() || (day+ 1) == date.getDate());
					assert(year == date.getFullYear());
					assert(response[k] >= 0 && response[k] <= 10000);
				}
			}
			

			done();
		});
	});


});
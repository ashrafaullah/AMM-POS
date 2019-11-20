var app 	= require('express')();
var server 	= require('http').Server(app);
var bodyParser = require('body-parser');
var Datastore = require('nedb');

var Inventory = require('./inventory');

app.use(bodyParser.json());

module.exports = app;

// Database stuff
var Transactions = new Datastore({
	filename: './server/databases/transactions.db',
	autoload: true
});

var CustomId = new Datastore({
	filename: './server/databases/index.db',
	autoload: true
});

CustomId.getAutoincrementId = function (onFind) {
    this.update(
        { _id: '__autoid__' },
        { $inc: { seq: 1 } },
        { upsert: true, returnUpdatedDocs: true },
        function (err, affected, autoid) {
            if(onFind) {
							onFind(err, autoid.seq);
						}
        }
    );
    return this;
};

app.get('/', function (req, res) {
	res.send('Transactions API');
});

// GET all transactions
app.get('/all', function (req, res) {

	Transactions.find({}, function (err, docs) {
		res.send(docs);
	});
});

// GET all transactions
app.get('/limit', function (req, res) {

	var limit = parseInt(req.query.limit, 10);
	if (!limit) limit = 5;

	Transactions.find({}).limit(limit).sort({ date: -1 }).exec(function (err, docs) {
	  res.send(docs);
	});
});

// GET total sales for the current day
app.get('/day-total', function (req, res) {

  var startDate;
	var endDate;

	// if date is provided
	if (req.query.date) {
		startDate = new Date(req.query.date);
		startDate.setHours(0,0,0,0);

		endDate = new Date(req.query.date);
		endDate.setHours(23,59,59,999);
	}
	else {

		// beginning of current day
		startDate = new Date();
		startDate.setHours(0,0,0,0);

		// end of current day
		endDate = new Date();
		endDate.setHours(23,59,59,999);
	}


	Transactions.find({ date: { $gte: startDate.toJSON(), $lte: endDate.toJSON() }, status: 1 }, function (err, docs) {

		var result = {
			date: startDate
		};

		if (docs) {

			var total = docs.reduce(function (p, c) {
				return p + c.total;
			}, 0.00);

			result.total = parseFloat(parseFloat(total).toFixed(2));

			res.send(result);
		}
		else {
			result.total = 0;
			res.send(result);
		}
	});
});

// GET total in a given day that was sold but not received
app.get('/day-to-be-received', function (req, res) {

  var startDate;
	var endDate;

	// if date is provided
	if (req.query.date) {
		startDate = new Date(req.query.date);
		startDate.setHours(0,0,0,0);

		endDate = new Date(req.query.date);
		endDate.setHours(23,59,59,999);
	}
	else {

		// beginning of current day
		startDate = new Date();
		startDate.setHours(0,0,0,0);

		// end of current day
		endDate = new Date();
		endDate.setHours(23,59,59,999);
	}


	Transactions.find({ date: { $gte: startDate.toJSON(), $lte: endDate.toJSON() }, status: 2 }, function (err, docs) {

		var result = {
			date: startDate
		};

		if (docs) {

			var total = docs.reduce(function (p, c) {
				return p + c.total;
			}, 0.00);

			result.total = parseFloat(parseFloat(total).toFixed(2));

			res.send(result);
		}
		else {
			result.total = 0;
			res.send(result);
		}
	});
});

// GET transactions for date
app.get('/by-date', function (req, res) {

	var startDate;
	var endDate;

	// if date is provided
	if (req.query.date) {
		startDate = new Date(req.query.date);
		startDate.setHours(0,0,0,0);

		endDate = new Date(req.query.date);
		endDate.setHours(23,59,59,999);
	}
	else {

		// beginning of current day
		startDate = new Date();
		startDate.setHours(0,0,0,0);

		// end of current day
		endDate = new Date();
		endDate.setHours(23,59,59,999);
	}

	Transactions.find({ date: { $gte: startDate.toJSON(), $lte: endDate.toJSON() } }, function (err, docs) {
		if (docs)
			res.send(docs);
	});
});

// Add new transaction
app.post('/new', function (req, res) {

	var newTransaction = req.body;

	CustomId.getAutoincrementId( function(err, custom_id){
		if(err){
			res.status(500).send(err);
		} else{
			newTransaction._id = custom_id.toString();
			Transactions.insert(newTransaction, function (err, transaction) {
				if (err)
					res.status(500).send(err);
				else {
					res.status(200).send({"id":newTransaction._id});
					Inventory.decrementInventory(transaction.products);
				}
			});
		}
	});
});

// Add customer name to this transaction
app.post('/update', function (req, res) {

	var targetId = req.body.id;
	var params = req.body.params;

	Transactions.update(
		{_id: targetId},
		{$set: params},
		{},
		function (err, numReplaced)  {
		if (err)
			res.status(500).send(err);
		else {
			res.sendStatus(200);
		}
	});
});


// GET single transaction
app.get('/:transactionId', function (req, res) {

	Transactions.find({ _id: req.params.transactionId }, function (err, doc) {
		if (doc)
			res.send(doc[0]);
	});
});

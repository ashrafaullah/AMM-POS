angular.module('utils.autofocus', [])

.directive('autofocus', ['$timeout', function($timeout) {
  return {
    restrict: 'A',
    link : function($scope, $element) {
      $timeout(function() {
        $element[0].focus();
      });
    }
  };
}]);

var pos = angular.module('POS', [
  'utils.autofocus',
  'ngRoute',
  'ngAnimate',
  'lr.upload',
  'ui.odometer',
]);


///////////////////////////////////////////////////
////////////////// Socket.io ////////////////// //
//////////////////////////////////////////////////

var serverAddress;

if (window.location.host === 'pos.dev')
  serverAddress = 'http://pos.dev';
else
  serverAddress = 'http://localhost:8080';

var socket = io.connect(serverAddress);


/////////////////////////////////////////////////////
////////////////// Controllers ////////////////// //
////////////////////////////////////////////////////

pos.controller('body', function ($scope, $location, Settings) {

  $scope.onHomePage = function () {
    return ($location.path() === '/' || $location.path() === '#/');
  };

  Settings.get().then(function (settings) {
    $scope.settings = settings;
  });

});

// Inventory Section

pos.controller('inventoryController', function ($scope, $location, Inventory) {

  // get and set inventory
  Inventory.getProducts().then(function (products) {
    $scope.inventory = angular.copy(products);
  });

  // go to edit page
  $scope.editProduct = function (productId) {
    $location.path('/inventory/product/' + productId);
  };

});

pos.controller('newProductController', function ($scope, $location, $route, Inventory) {

  $scope.addMultipleProducts = false;

  $scope.createProduct = function (product) {

    Inventory.createProduct($scope.newProduct).then(function (product) {

      if ($scope.addMultipleProducts) refreshForm();
      else $location.path('/inventory');

    });

  };

  var refreshForm = function () {
    $scope.newProuct = {};
  };

});

pos.controller('editProductController', function ($scope, $location, $routeParams, Inventory, upload) {

  // get and set inventory
  Inventory.getProduct($routeParams.productId).then(function (product) {
    $scope.product = angular.copy(product);
  });

  $scope.saveProduct = function (product) {

    Inventory.updateProduct(product).then(function (updatedProduct) {
      console.log('updated!');
    });

    $location.path('/inventory');
  };

  $scope.deleteProduct = function () {
    Inventory.removeProduct($scope.product._id).then(function () {
      $location.path('/inventory');
    });
  };


  $scope.doUpload = function () {
    console.log('yoyoyo');

    upload({
      url: '/upload',
      method: 'POST',
      data: {
        anint: 123,
        aBlob: Blob([1,2,3]), // Only works in newer browsers
        aFile: $scope.product.image, // a jqLite type="file" element, upload() will extract all the files from the input and put them into the FormData object before sending.
      }
    }).then(
      function (response) {
        console.log(response.data); // will output whatever you choose to return from the server on a successful upload
      },
      function (response) {
          console.error(response); //  Will return if status code is above 200 and lower than 300, same as $http
      }
    );
  };

});

// POS Section
pos.controller('posController', function ($scope, $routeParams, Inventory, Transactions) {

  $scope.barcode = '';


  function barcodeHandler (e) {

      $scope.barcodeNotFoundError = false;

      $scope.barcode = $('#product-entry').val();

      var regex=/^[0-9]+$/;

      // if enter is pressed
      if (e.which === 13) {

        if(!$scope.barcode.match(regex)){
          for(var i = 0; i < $scope.inventory.length; i++) {
            if($scope.inventory[i].name === $scope.barcode) {
              $scope.barcode = $scope.inventory[i].barcode;
              break;
            }
          }
        }

        if ($scope.isValidProduct($scope.barcode)) {
          $scope.addProductToCart($scope.barcode);
          $scope.barcode = '';
          $scope.productsList = '';
          $scope.$digest();
          $('#product-entry').val($scope.barcode);
        }
        else {
          window.alert('Referência não encontrada: ' + $scope.barcode);
          console.log('invalid product: ' + $scope.barcode);
          // $scope.barcodeNotFoundError = true;
        }
      }
  }

  $('#product-entry').off('keypress').on('keypress', barcodeHandler);


  //document.getElementById('product-quantity').onblur = function (event) {
  //  var blurEl = this;
  //  setTimeout(function() {
  //    blurEl.focus();
  //  }, 1000);
  //};


  var rawCart = {
    products: [],
    total: 0,
  };

  var startCart = function () {
    var cartJSON = localStorage.getItem('cart');

    if (cartJSON) {
      $scope.cart = JSON.parse(cartJSON);
    }
    else {
      startFreshCart();
    }

  };

  var updateCartInLocalStorage = function () {
    var cartJSON = JSON.stringify($scope.cart);
    localStorage.setItem('cart', cartJSON);
    socket.emit('update-live-cart', $scope.cart);
  };

  $scope.updateCartTotals = function () {
    $scope.cart.total = _.reduce($scope.cart.products, function (total, product) {
      var weightedPrice = parseFloat( product.price * product.quantity );
      return total + weightedPrice;
    }, 0);

    updateCartInLocalStorage();
  };

  var startFreshCart = function () {
      localStorage.removeItem('cart');
      $scope.cart = angular.copy(rawCart);
      $scope.updateCartTotals();
  };

  $scope.refreshInventory = function () {
    Inventory.getProducts().then(function (products) {
      $scope.inventory = angular.copy(products);
      $scope.inventoryLastUpdated = new Date();
    });
  };

  $scope.refreshInventory();

if($routeParams.transactionId){
  $scope.operation = "edit";
  var transactionId = $routeParams.transactionId;

  Transactions.getOne(transactionId).then(function (transaction) {
    $scope.transaction = angular.copy(transaction);

    startFreshCart();
    $scope.transactionId = {"id":transactionId};
    $scope.cart.products = $scope.transaction.products;
    $scope.cart.total = $scope.transaction.total;
  });
}else{
  $scope.operation = "new";
  startCart();
}

  var addProductAndUpdateCart = function (product) {
    $scope.cart.products = $scope.cart.products.concat([product]);
    $scope.updateCartTotals();
    $scope.barcode = '';
  };

  $scope.cleanProduct = function (product) {
    product.cart_item_id = $scope.cart.products.length + 1;

    delete product.quantity_on_hand;
    return product;
  };

  var productAlreadyInCart = function (barcode) {
    var product = _.find($scope.cart.products, { barcode: barcode.toString() });

    if (product) {
      product.quantity = product.quantity + 1;
      $scope.updateCartTotals();
    }

    return product;
  };

  $scope.addProductToCart = function (barcode) {

    // I could check if product was already in cart,
    // but I prefer to do the same that supermarket does:
    // simply add a new item, even if it is the same

    //if (productAlreadyInCart(barcode)) return;
    //else {

    var product = angular.copy(_.find($scope.inventory, { barcode: barcode.toString() }));
    product = $scope.cleanProduct(product);
    product.quantity = 1;
    addProductAndUpdateCart(product);

    //}
  };

  $scope.addManualItem = function (product) {
    product.quantity = 1;
    product = $scope.cleanProduct(product);
    addProductAndUpdateCart(product);
  };

  $scope.removeProductFromCart = function (cart_item_id) {
    for(var i = 0; i < $scope.cart.products.length; i++) {
    if($scope.cart.products[i].cart_item_id == cart_item_id) {
        $scope.cart.products.splice(i, 1);
        break;
    }
  }

    $scope.updateCartTotals();
  };

  $scope.isValidProduct = function (barcode) {
    return _.find($scope.inventory, { barcode: barcode.toString() });
  };


  $scope.order = function() {
    if($scope.operation === "new"){
      console.log("newOrder");
      $scope.newOrder();
    }else if ($scope.operation === "edit") {
      console.log("editOrder");
      $scope.editOrder();
    }
    // the type of operation will be used in order directive.
    // That's the solely reason why I'm returning it.
    return $scope.operation;
  };

  $scope.newOrder = function () {
    var cart = angular.copy($scope.cart);
    cart.payment = 0;
    cart.date = new Date();

    // save to database
    Transactions.add(cart).then(function (res) {
      // id of this transaction
      $scope.transactionId = res;
    });

  };

  $scope.editOrder = function () {
    var cart = angular.copy($scope.cart);
    cart.payment = 0;
    cart.editDate = new Date();
    var data = {id: $routeParams.transactionId, params: cart};

    // save to database
    Transactions.update(data).then(function (res) {
      // id of this transaction
    });

  };

  $scope.finishOrder = function (info) {
    info.status = 0; // order is closed, but it is not paid.
    var data = {id: $scope.transactionId.id, params: info};

    Transactions.update(data).then(function (res) {
      socket.emit('cart-transaction-complete', {});
      // clear cart and start fresh
      startFreshCart();
    });
    $scope.refreshInventory();
  };

  $scope.addQuantity = function (product) {
    product.quantity = product.quantity + 1;
    $scope.updateCartTotals();
  };

  $scope.removeQuantity = function (product) {
    if (product.quantity > 1) {
      product.quantity = product.quantity - 1;
      $scope.updateCartTotals();
    }
  };

});

pos.controller('transactionsController', function ($scope, $location, Transactions) {

 // I'll will limit to the last 300 transactions, because it was getting slow
 // when I had thousands of transactions.
  Transactions.get(300).then(function (transactions) {
    $scope.transactions = _.sortBy(transactions, 'date').reverse();
  });

  // get yesterday's date
  var yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  Transactions.getTotalForDay().then(function (dayTotal) {
    $scope.todayTotal = dayTotal.total;
  });

  Transactions.getTotalForDay(yesterday).then(function (dayTotal) {
    $scope.yesterdayTotal = dayTotal.total;
  });

  $scope.getNumberOfProducts = function (products) {
    return _.reduce(products, function (s, product) {
      return s + product.quantity;
    }, 0);
  };

});

pos.controller('viewTransactionController', function ($scope, $routeParams, Transactions) {

  var transactionId = $routeParams.transactionId;

  Transactions.getOne(transactionId).then(function (transaction) {
    $scope.transaction = angular.copy(transaction);
  });

  $scope.printReceipt = function (info) {
      // print receipt
      if(!info.status){
        // when info.status is null, we assume the order is payed => status=1
        info.status = 1;
      }

      var data = {id: transactionId, params: info};

      // update database
      Transactions.update(data).then(function (res) {
        // refresh page
        Transactions.getOne(transactionId).then(function (transaction) {
          $scope.transaction = angular.copy(transaction);
        });
      });
    };
});


pos.controller('liveCartController', function ($scope, Transactions, Settings) {

  $scope.recentTransactions = [];

  var n = new Date();
  var day = n.getDate();
  var month = n.getMonth() + 1;
  var year = n.getFullYear();
  $scope.todayDate =  day + "/" + month + "/" + year;

  var getTransactionsData = function () {
    Transactions.get(10).then(function (transactions) {
      $scope.recentTransactions = _.sortBy(transactions, 'date').reverse();
    });

    Transactions.getTotalForDay(n).then(function (dayTotal) {
      $scope.dayTotal = dayTotal.total;
    });

    Transactions.getToBeReceivedForDay(n).then(function (dayToBeReceived) {
      $scope.dayToBeReceived = dayToBeReceived.total;
    });
  };

  // tell the server the page was loaded.
  // the server will them emit update-live-cart-display
  socket.emit('live-cart-page-loaded', { forreal: true });

  // update the live cart and recent transactions
  socket.on('update-live-cart-display', function (liveCart) {
    $scope.liveCart = liveCart;
    getTransactionsData();
    $scope.$digest();
  });

});

///////////////////////////////////////////////////
////////////////// Directives ////////////////// //
////////////////////////////////////////////////////

pos.directive('navMenu',function ($location) {
  return {
    restrict: 'E',
    scope: {
    },
    templateUrl: 'templates/directives/nav-menu.html',
    link: function (scope) {

      scope.isActive = function (url) {
        if (url === 'transactions')
          url = 'transaction';

        url = '/' + url;
        return $location.path().indexOf(url) !== -1;
      };

    }
  };

});

pos.directive('preventEnterFireing', function() {
  return {
    link: function(scope, element, attrs) {
      element.keypress(function(e) {
        if (e.keyCode == 13) {
          e.preventDefault();
          $('#product-entry').focus();
          return;
        }
      });
    }
  };
});

pos.directive('productForm',function ($location) {
  return {
    restrict: 'E',
    scope: {
      product: '=',
      onSave: '&'
    },
    templateUrl: 'templates/directives/product-form.html',
    link: function (scope, el) {

      // highlight barcode field
      var $barcode = el.find('form').eq(0).find('input').eq(0);
      var $name = el.find('form').eq(0).find('input').eq(1);
      $barcode.select();

      scope.tabOnEnter = function ($event) {
        if ($event.keyCode === 13) {
          $name.select();
          $event.preventDefault();
        }
      };

      scope.save = function () {
        scope.onSave({ product: scope.product });
      };

    }
  };

});

pos.directive('addManualItem',function () {
  return {
    restrict: 'E',
    scope: {
      addItem: '&'
    },
    templateUrl: 'templates/directives/add-manual-item.html',
    link: function (scope, el) {

      scope.add = function () {
        if(!scope.manualItem.name){
          scope.manualItem.name = "----";
        }
        scope.addItem({item: scope.manualItem});
        el.find('div').eq(0).modal('hide');
        scope.manualItem = '';
      };

    }
  };

});

pos.directive('order', function($location){
  return {
    restrict: 'E',
    scope: {
      finishOrder: '&',
      order: '&',
      cartTotal: '=',
      transactionId: '='
    },
    templateUrl: 'templates/directives/order.html',
    link: function (scope, el) {

      var operation;

      scope.focusName = function () {
        $('#orderCustomerName').select();
      };

      scope.openOrder = function () {
        // operation may be "new" or "edit"
        operation = scope.order();
      };

      scope.addCustomerName = function () {
        var name = angular.copy(scope.customerName);
        if (!name) name = "";

        var orderInfo = {
          customerName:name
        };

        scope.finishOrder({info:orderInfo});

        el.find('div').eq(0).modal('hide');
        //[TODO]: mixing jQuery and Angulajs doesn't appear to be the best solution
        // Find a more elegant way in the future.
        // It was done as a workaround for the same problem described here:
        // https://stackoverflow.com/questions/22056147/bootstrap-modal-backdrop-remaining
        $('body').removeClass('modal-open');
        $('.modal-backdrop').remove();

        delete scope.customerName;

        if(operation === 'edit'){
          $location.path('/transactions');
        }
      };
    }
  };
});

pos.directive('checkout', function (Settings) {
  return {
    restrict: 'E',
    scope: {
      printReceipt: '&',
      cartTotal: '='
    },
    templateUrl: 'templates/directives/checkout.html',
    link: function (scope, el) {

      $paymentField = el.find('form').eq(0).find('input').eq(0);

      scope.focusPayment = function () {
        $('#checkoutPaymentAmount').select();
      };

      scope.getChangeDue = function () {
        if (scope.paymentAmount && scope.paymentAmount > scope.cartTotal - scope.discountAmount) {
          var change =  parseFloat(scope.paymentAmount) - (parseFloat(scope.cartTotal) - parseFloat(scope.discountAmount));
          return change;
        }
        else
          return 0;
      };

      scope.print = function () {
        if (scope.cartTotal - scope.discountAmount > scope.paymentAmount) return;

        var paymentAmount = angular.copy(scope.paymentAmount);
        var discountAmount = angular.copy(scope.discountAmount);

        scope.previousCartInfo = {
          total: angular.copy(scope.cartTotal),
          paymentAmount: paymentAmount,
          discountAmount: discountAmount
        };

        var value = {
          payment:paymentAmount,
          discount:discountAmount
        };

        scope.printReceipt({data:value});
        scope.transactionComplete = true;

        scope.closeModal();
      };

      scope.toBeReceived = function () {
        var paymentAmount = 0;
        var discountAmount = angular.copy(scope.discountAmount);

        scope.previousCartInfo = {
          total: angular.copy(scope.cartTotal),
          paymentAmount: paymentAmount,
          discountAmount: discountAmount
        };

        var value = {
          payment:paymentAmount,
          discount:discountAmount,
          status:2 // we must inform that order was not payed. It is to be received => status 2
        };

        scope.printReceipt({data:value});
        scope.transactionComplete = true;

        scope.closeModal();
      };

      scope.closeModal = function () {
        el.find('div').eq(0).modal('hide');
        delete scope.paymentAmount;
        delete scope.discountAmount;
        scope.transactionComplete = false;
      };

    }
  };

});

pos.directive('receipt',function (Settings) {
  return {
    restrict: 'E',
    scope: {
      transaction: '='
    },
    templateUrl: 'templates/directives/receipt.html',
    link: function (scope) {

      scope.backupDate = new Date();

      Settings.get().then(function (settings) {
        scope.settings = settings;
      });

    }
  };

});

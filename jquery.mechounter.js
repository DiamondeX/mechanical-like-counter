;(function (factory) {
  'use strict';
  if (typeof define === 'function' && define.amd) {
    // Register as an anonymous AMD module:
    define([
      'jquery',
      'jquery.ui.widget'
    ], factory);
  } else if (typeof exports === 'object') {
    // Node/CommonJS:
    factory(
      require('jquery'),
      require('./vendor/jquery.ui.widget')
    );
  } else {
    // Browser globals:
    factory(window.jQuery);
  }
}(function($){

  //******************************
  //      extending jQuery
  //******************************

  var pluginName = "mechounter";

  $.fn[pluginName] = function(action, param1, param2){
    var options = param1;
    if(action == null || typeof action === "object"){
      options = action || {};
      action = "create";
    }

    if(action === "get"){
      return this.eq(0).data(pluginName);
    }

    if(action === "getValue"){
      return this.eq(0).data(pluginName).getValue();
    }

    if(action === "create"){
      return this.each(function(){

        var $el = $(this);

        if($el.data(pluginName)) return;
        $el.data(pluginName, new Mecntr($el, options));

      });
    }

    if(action === "getDefaults"){
      return Mecntr.defaultOptions;
    }

    return this.each(function(){
      var mecntr = $(this).data(pluginName);
      if(mecntr) mecntr.execute(action, param1, param2);
    });
  };

  //******************************
  //   Precalculated constants
  //******************************

  var toLog10 = 0.4342944819032518; // === 1 / Math.log(10)
  var frLog10 = 2.302585092994046;  // === Math.log(10)

  //******************************
  //  Main calculation functions
  //******************************

  function lgSpeed(t, k){
    k = k || 1;
    return Math.pow(10, k*t-2);
  }

  function lgValue(t, k){
    k = k || 1;
    return toLog10 * lgSpeed(t, k) / k;
  }

  function lgValueBySpeed(s, k){
    k = k || 1;
    return toLog10 * s / k;
  }

  function timeByLgVal(v, k){
    k = k || 1;
    return timeByLgSpeed(v * k * frLog10, k);
  }

  function timeByLgSpeed(s, k){
    k = k || 1;
    return (toLog10 * Math.log(s) + 2) / k;
  }

  //******************************
  //      Helper functions
  //******************************

  function repeatStr(t, str){
    var s = str;
    while(--t){ s+= str }
    return s;
  }

  ///////////////////////////////////////////////

  //*********************************************
  //      MechanicalCounter (Mecntr) Class
  //*********************************************

  function Mecntr(el, opts){

    var self = this;

    this._opts = opts = $.extend(Mecntr.defaultOptions, opts);

    if(opts.mask){
      this._parseMask(opts.mask, this._opts);
    }

    this._validateOpts();

    this.$el = $(el).addClass(this._opts.baseClass);

    Object.defineProperty(this, "_height", {
      enumerable: true,
      configurable: true,
      get: function(){
        var h = self.$el.height();
        if(h <= 0) return -10000;
        Object.defineProperty(self, "_height", {
          value: h,
          writable: true,
          enumerable: true
        });
        return h;
      }
    });
    this._digits = [];

    this._initDom();

    return {
      execute: function (action, param1, param2) {
        return self.execute(action, param1, param2);
      },
      spinTo: function(newVal, delayMs){
        return self.spinTo(newVal, delayMs);
      },
      resetTo: function(newVal){
        return self.resetTo(newVal);
      },
      setImmediate: function(newVal){
        return self.resetTo(newVal);
      },
      getValue: function(){
        return self.getValue();
      },
      destroy: function(){
        return self.destroy();
      }
    }

  };

  Mecntr.defaultOptions = {
    mask: " 3,2",
    decimalSep: ".",
    thousandSep: "",
    value: 0,
    baseClass: pluginName,
    showDigitMs: 300,
    refreshDelayMs: 30,
    resetDelayMs: 2500,
    perceptibleShift: 0.2,
    onBeforeSpin: function(delayMs, valueDelta, startValue){},
    onSpinStep: function(timeFromStartMs, currentValue){}
  };
  Mecntr.pluginName = pluginName;

  var allActions = "spinTo,resetTo,setImmediate,destroy".split(",");
  Mecntr.prototype.execute = function (action, param1, param2) {
    if(!~allActions.indexOf(action)) return;
    this[action](param1, param2);
  };

  Mecntr.prototype._parseMask = function (mask, o){

    mask = /(\D?)(\d+)((\D)(\d+))?/.exec(mask);

    if(!mask) return;

    o = o || {};

    o.thousandSep = mask[1];

    o.digits = mask[2];

    o.decimalSep = mask[4] || ".";

    o.decimals = mask[5];

  };

  Mecntr.prototype._validateOpts = function () {
    var o = this._opts;
    o.digits   = Math.min(15,         Math.max(1, Math.floor(+o.digits)   || 1));
    o.decimals = Math.min(o.digits-1, Math.max(0, Math.floor(+o.decimals) || 0));
    o.intDigits = o.digits - o.decimals;
    o.multiplier = Math.pow(10, o.decimals);
  };

  Mecntr.prototype._makeSpan = function (type, text){
    return "<span class='" + this._opts.baseClass + "-" + type + "'>" + text + "</span>";
  };

  Mecntr.prototype._addSpan = function (type, text){
    return $(this._makeSpan(type, text)).prependTo(this.$el);
  };

  Mecntr.prototype._initDom = function (){
    var self = this
    , o = this._opts
    , decimals = o.decimals
    , intDigits = o.intDigits
    ;

    this._oldHtml = this.$el.html();
    this.$el.html("");
    this._digitStr = this._makeSpan("digit","");
    this._thousandSepStr = this._makeSpan("thousandSep", o.thousandSep);

    if(decimals){
      while(decimals--) this._addDecimalDigit();
      $(this._makeSpan("decimalSep", o.decimalSep)).prependTo(self.$el);
    }

    this._addDigit = o.thousandSep ? this._addIntDigitWithSep : this._addIntDigit;

    this._intDigits = 0;
    this._addIntDigit();
    while(--intDigits) this._addDigit();

    this.setImmediate(o.value);

  };

  Mecntr.prototype.setImmediate = function(v){
    this._setImmediate(v * this._opts.multiplier);
  };

  Mecntr.prototype._setImmediate = function(v){

    clearInterval(this._interval);

    var o = this._opts
    , dLen = this._digits.length
    ;
    var digit, d = 1, frac, empty;

    this._value = v;
    frac = this._digits[0].setVisValue(v);
    v = Math.floor(v * 0.1);

    while(v > 0 || d < o.digits || d < dLen){
      empty = v < 1 && d >= o.digits;

      digit = this._digits[d++] || this._addDigit();
      frac = digit.setVisValue(v + frac, empty);
      v = Math.floor(v * 0.1);
    }

    this._dropEmptyDigits();

  };

  Mecntr.prototype._addDecimalDigit = function(sep){
    var digit = new Digit(this, sep);
    this._digits.push(digit);
    return digit;
  };

  Mecntr.prototype._addIntDigit = function(sep){
    this._intDigits++;
    return this._addDecimalDigit(sep);
  };

  Mecntr.prototype._addIntDigitWithSep = function(){
    return this._addIntDigit(this._intDigits % 3 === 0);
  };

  Mecntr.prototype._calcSlowdownParams = function(aDif, delay, cb){
    var t2 = timeByLgVal(aDif)  // time in seconds of spin slowdown
    , t2o     // old value of "t2"
    , t1 = 0  // time in seconds of constant spin speed
    , k = 1   // spin slowdown intensification coefficient (initial value would be minimal)
    , ko = k  // old value of "k"
    , kf = 1  // fraction of modification coefficient for "k"
    , spN = 0 // initial spin speed of spin slowdown (rounds of dif per second)
    , sp_ = 1 // constant spin speed
    , dt = t2 // value delta for "t2" correction
    ;

    if(t2 > delay){

      do {
        t2o = t2;

        k *= 1 + kf;
        t2 = timeByLgVal(aDif, k);
        if(t2 < delay) {
          kf *= 0.5;
          k = ko;
        }else{
          ko = k;
        }
      } while(t2o !== t2);

    }else{

      do {
        t2o = t2;

        dt *= 0.5;
        t2 += spN > sp_ ? dt : -dt;
        t1 = delay - t2;
        sp_ = lgSpeed(t2);
        spN = (aDif - lgValueBySpeed(sp_)) / t1;
      } while(t2o !== t2);

    }

    cb(t1, t2, k, lgSpeed(t2, k));

  };

  Mecntr.prototype._setSpeed = function(spN){
    var o = this._opts;
    this._speed = spN * 0.001;
    this._perceptibleDgt = toLog10 * Math.log(this._speed * o.multiplier) - o.perceptibleShift;
  };

  Mecntr.prototype.getValue = function(){
    return this._value / this._opts.multiplier;
  };

  Mecntr.prototype.spinTo = function(newVal, delayMs){
    this._spinTo(newVal * this._opts.multiplier, delayMs);
  };

  Mecntr.prototype._spinTo = function(newVal, delayMs){

    if(this._isResetInProgress){
      this._onResetDone = function(){
        this._spinTo(newVal, delayMs);
      };
      return;
    }

    if(!delayMs || this._value === newVal){
      clearInterval(this._interval);
      this._setImmediate(newVal);
      return;
    }

    var self = this
    , o = this._opts
    , oldVal = this._value
    , delay = delayMs * 0.001
    , dif = newVal - oldVal
    , isInc = dif > 0
    , sgn = isInc ? 1 : -1
    , aDif = Math.abs(dif)
    , k = 1   // spin slowdown intensification coefficient (k >= 1 always)
    , spN = 0 // initial spin speed (rounds of dif per second)
    , t1 = 0  // time in seconds of constant spin speed
    , t2      // time in seconds of spin slowdown
    ;

    clearInterval(self._interval);
    this._setImmediate(oldVal);

    this._calcSlowdownParams(aDif, delay, function (t1_, t2_, k_, spN_){
      t1 = t1_; t2 = t2_; k = k_; spN = spN_;
    });

    this._startTime = Date.now();
    this._setSpeed(spN);
    this._maxPerceptibleDgt = this._perceptibleDgt;

    this._currentValues = function(timeMs){
      var t = timeMs * 0.001;

      if(t <= t1){
        self._value = oldVal + sgn * spN * t;
        return;
      }
      t -= t1;

      spN = lgSpeed(t2 - t, k);
      self._setSpeed(spN);
      self._value = newVal - sgn * lgValueBySpeed(spN, k);
      if(sgn * self._value < sgn * oldVal){
        self._value = oldVal;
      }
    };

    (function(){
      var d = 0
      , dLen = self._digits.length
      , digit
      , oV = oldVal
      , nV = newVal
      , oFl = Math.floor(oV)  //floor part
      , nFl = Math.floor(nV)  //floor part
      , oFr = oV - oFl     //flaction part
      , nFr = nV - nFl     //flaction part
      ;

      while(nV >= 0.1 || d < dLen){
        digit = self._digits[d++] || self._addDigit();
        digit.createValueUpdaterForSet(oV, nV, isInc);

        oFr = oFl % 10 === 9 ? oFr : 0;
        oFl = Math.floor(oFl * 0.1);
        oV = oFl + oFr;

        nFr = nFl % 10 === 9 ? nFr : 0;
        nFl = Math.floor(nFl * 0.1);
        nV = nFl + nFr;
      }

    })();

    o.onBeforeSpin(delayMs, dif, oldVal);

    self._interval = setInterval(function(){

      var t = self._elapsed();

      if(t >= delayMs){
        clearInterval(self._interval);
        self._setImmediate(newVal);
        return;
      }

      self._currentValues(t);
      o.onSpinStep(t, self._value);

      var v = self._value + isInc  //when increasing we need a one value margin
      , dLen = self._digits.length
      ;
      var d = 0, frac = 0, empty;

      while(d < dLen){
        empty = v < 1 && d >= o.digits;

        frac = self._digits[d++]._updateValue(v, frac, empty);
        v = v * 0.1;
      }

      self._dropEmptyDigits();

    }, o.refreshDelayMs);

  };

  Mecntr.prototype.resetTo = function(newVal){
    this._resetTo(newVal * this._opts.multiplier);
  };

  Mecntr.prototype._resetTo = function(newVal){

    var o = this._opts;

    if(this._value === newVal){
      this._finalizeValueReset(newVal);
      return;
    }

    this._isResetInProgress = true;

    var self = this
    , oldVal = this._value
    , delayMs = o.resetDelayMs
    , delay = delayMs * 0.001
    , dLen = self._digits.length
    , maxDif = 0
    , t1   // time in seconds of constant spin speed
    , t2   // time in seconds of spin slowdown
    , k    // spin slowdown intensification coefficient (k >= 1 always)
    , spN  // initial spin speed (rounds of dif per second)
    ;

    //searching for maximum digit value difference while reset
    (function(v){
      var dif
      , d = 0
      ;

      while(d < dLen){
        dif = self._digits[d++].prepareValueIntervalForReset(v);
        if(dif > maxDif) maxDif = dif;
        v = Math.floor(v * 0.1);
      }
      delay = delay * 0.1 * maxDif;
      delayMs = delayMs * 0.1 * maxDif;

      //adding incufficient digits for new value
      while(v > 0){
        self._addDigit().setVisValue(v);
        v = Math.floor(v * 0.1);
      }
    })(newVal);

    this._calcSlowdownParams(maxDif, delay, function (t1_, t2_, k_, spN_){
      t1 = t1_; t2 = t2_; k = k_; spN = spN_;
    });

    //creating value update methods for each digit of old value
    (function(){
      var d = 0
      , v2 = lgValueBySpeed(spN, k)
      ;

      while(d < dLen){
        self._digits[d++].createValueUpdaterForReset(k, t2, spN, v2);
      }

    })();

    //setup and run animation
    this._startTime = Date.now();
    clearInterval(self._interval);
    self._interval = setInterval(function(){
      var d = 0, t = self._elapsed();

      if(t >= delayMs){
        self._finalizeValueReset(newVal);
        return;
      }

      t *= 0.001;

      while(d < dLen){
        self._digits[d++]._updateValue(t);
      }

    }, o.refreshDelayMs);

  };

  Mecntr.prototype._finalizeValueReset = function(newVal){
    clearInterval(this._interval);
    this._isResetInProgress = null;
    this._setImmediate(newVal);
    if(this._onResetDone){
      this._onResetDone();
      this._onResetDone = null;
    }
  };

  Mecntr.prototype._dropEmptyDigits = function(){
    var d = this._digits.length
    , digit = this._digits[--d]
    ;

    if(!digit.wasted) return;

    do {
      digit.remove();
      this._intDigits--;
      digit = this._digits[--d];
    } while(digit.wasted);

    this._digits.length = ++d;

  };

  Mecntr.prototype._elapsed = function(){
    return Date.now() - this._startTime;
  };

  Mecntr.prototype.destroy = function(){
    clearInterval(this._interval);
    this.$el.removeClass(this._opts.baseClass).html(this._oldHtml);
    delete this.$el.data()[pluginName];
  };

  //************************************
  //            Digit Class
  //   (helper for MechanicalCounter)
  //************************************

  function Digit(owner, sep){
    this.owner = owner;
    var o = this.owner._opts;

    if(sep){
      this.$sep = $(owner._thousandSepStr).prependTo(owner.$el);
    }

    this.$el = $(owner._digitStr).prependTo(owner.$el);
    this.$el.html(owner._makeSpan("rect", "0") + repeatStr(2, owner._makeSpan("card", "")));

    this.$all = this.$el.add(this.$sep);
    this._showMs = o.showDigitMs;
    this._num = owner._digits.length;
    this.$all.animate({
      width: "toggle",
      opacity: 0.01
    }, 0);

    var $cards = this.$el.find("." +o.baseClass + "-card");
    this.$card0 = $cards.eq(0);
    this.$card1 = $cards.eq(1);
    this.empty = true;
    this.wasted = false;
  };

  Digit.prototype.reveal = function(){
    this.$all.animate({
      width: "toggle"
    }, this._showMs).animate({
      opacity: 1
    }, this._showMs);
  };

  Digit.prototype.remove = function(immediate){

    if(immediate) return this.$all.remove();

    var self = this;

    self.$all.stop(true).animate({
      opacity:0.01
    }, this._showMs).hide(this._showMs,function(){
      self.$all.remove();
    });

  };

  Digit.prototype.prepareValueIntervalForReset = function(dstVal){
    this._srcVal = this._value % 10;
    this._dstVal = dstVal % 10;
    if(this._dstVal < this._srcVal) this._dstVal += 10;
    this._aDif = this._dstVal - this._srcVal;

    return this._aDif;
  };

  Digit.prototype.createValueUpdaterForReset = function(k, t2_, spN, v2){
    var self = this
    , t2
    , t1 = 0
    , delay
    ;

    if(v2 > this._aDif){
      t2 = timeByLgVal(this._aDif, k);
    }else{
      t2 = t2_;
      t1 = (this._aDif - v2) / spN;
    }

    delay = t1 + t2;

    this._updateValue = function(t){
      if(t > delay){
        self.setVisValue(self._dstVal);
        return;
      }

      if(t <= t1){
        self.setVisValue(self._srcVal + spN * t);
        return;
      }

      t -= t1;
      self.setVisValue(self._dstVal - lgValue(t2 - t, k));
    }
  };

  Digit.prototype.createValueUpdaterForSet = function(oldVisVal, newVisVal, isInc){

    //we'll need integer value much more frequently then boolean
    isInc = +isInc;

    // no need for updater
    if(oldVisVal === newVisVal) {
      this._updateValue = function(){ return 0; };
      return;
    }

    this._setVisValue = isInc ? this.setVis2Value : this.setVisValue;

    // special last digit updater
    if(this._num === 0){
      this._updateValue = function(value){ return this._setVisValue(value - isInc); };
      return;
    }

    // creating value up or down limiter
    var limit;
    if(isInc){
      limit = function(v){
        if(v < oldVisVal) return oldVisVal;
        if(newVisVal < v) return newVisVal;
        return v;
      };
    }else{
      // looks like this variant of limit function never affect value!!
      limit = function(v){
        if(v < newVisVal) return newVisVal;
        if(oldVisVal < v) return oldVisVal;
        return v;
      };
    }

    //a number of highest digits can have only dependent move style (impulsive)
    //in cases of constant spin speed for visual comfort
    //so, it accept "fracPrev" parameter as well
    var maxPercDiff = this._num - this.owner._maxPerceptibleDgt;
    if(maxPercDiff >= 1){
      this._updateValue = function(value, fracPrev, empty){
        var round = Math.floor(value);
        return this._setVisValue(limit(round + fracPrev), empty);
      };
      return;
    }

    // this updater can change its move style over time
    this._updateValue = function(value, fracPrev, empty){
      //a kind of indicator of digit spin speed level
      var percDiff = this._num - this.owner._perceptibleDgt;

      //fastest spin speed level - digit spinning is near or entirely not perceptible
      //thus it's spinning independently of other digits
      if(percDiff < 1){
        return this._setVisValue(limit(value - isInc), empty);
      }

      var round = Math.floor(value);

      //medium spin speed level - digit spinning becomes perceptible
      //thus it's spinning partially dependent on previos digit
      if(percDiff < 2){
        percDiff--;
        var frac = value - round;
        frac = percDiff * fracPrev + (1 - percDiff) * (frac - isInc);
        return this._setVisValue(limit(round + frac), empty);
      }

      //slowest spin speed level - digit spins fully dependent on previos digit
      return this._setVisValue(limit(round + fracPrev), empty);
    };
  };

  Digit.prototype.setVisValue = function(value, empty){

    this._value = value;

    var round = Math.floor(value);

    var rnDgt = round % 10
    , frac = value - round
    ;

    var shift0 = frac * this.owner._height;
    var shift1 = shift0 - this.owner._height;

    this.$card0.css("top", shift0 + "px"); //positive - lower  / smaller
    this.$card1.css("top", shift1 + "px"); //negative - higher / bigger

    var zero = empty ? "" : "0";
    var zRnDgt = zero + rnDgt;
    if(this._zRnDgt !== zRnDgt){
      this._zRnDgt = zRnDgt;
      this.$card0.text(rnDgt === 0 ? zero : rnDgt);
      this.$card1.text(rnDgt === 9 ? zero : rnDgt + 1);
    }

    empty = rnDgt === 0 && frac < 0.3 && empty;
    if(!this.empty && empty) this.wasted = true;
    if(this.empty && !empty) this.reveal();
    this.empty = empty;

    return rnDgt !== 9 ? 0 : frac;
  };

  Digit.prototype.setVis2Value = function(value, empty){
    var frac = this.setVisValue(value, empty);
    return frac ? (frac - 1) : 0;
  };

}));

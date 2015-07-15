(function($){

  var dbgLog, adgd, dgp, dgd;

  //var PiD4 = 0.7853981633974483; // === Math.Pi / 4;
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

  window.MechanicalCounter = Mecntr;

  function Mecntr(el, opts){

    var self = this;

    this._opts = opts = $.extend({
      mask: " 3,2",
      decimalSep: ".",
      thousandSep: "",
      value: 0,
      baseClass: "mechounter",
      showDigitMs: 300,
      slowdownMs: 19000,
      perceptibleChangeMs: 600,
      refreshDelayMs: 30,
      resetDelayMs: 2500,
      onBeforeSpin: function(delayMs, valueDelta, startValue){},
      onSpinStep: function(timeFromStartMs, currentValue){}
    }, opts);

    if(opts.mask){
      this._parseMask(opts.mask, this._opts);
    }

    this._validateOpts();

    this.el = el;
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
    //this._height = this.$el.height();
    this._digits = [];

    this._initDom();

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
    , html = ""
    , o = this._opts
    , decimals = o.decimals
    , intDigits = o.intDigits
    , digit = null
    ;

    this.$el.html("");
    this._digitStr = this._makeSpan("digit","");
    this._thousandSepStr = this._makeSpan("thousandSep", o.thousandSep);

    if(decimals){
      while(decimals--) digit = this._addDecimalDigit(digit);
      $(this._makeSpan("decimalSep", o.decimalSep)).prependTo(self.$el);
    }

    this._addDigit = o.thousandSep ? this._addIntDigitWithSep : this._addIntDigit;

    this._intDigits = 0;
    digit = this._addIntDigit(digit);
    while(--intDigits) digit = this._addDigit(digit);

    this.fillValue(o.value);

  };

  Mecntr.prototype.fillValue = function(v){
    this._fillValue(v * this._opts.multiplier);
  };

  Mecntr.prototype._fillValue = function(v){

    var o = this._opts
    , dLen = this._digits.length
    ;
    var digit, d = 1, frac, empty;

    this._value = v;
    frac = this._digits[0].setVisValue(v);
    v = Math.floor(v * 0.1);

    while(v > 0 || d < o.digits || d < dLen){
      empty = v < 1 && d >= o.digits;

      digit = this._digits[d++] || this._addDigit(digit);
      frac = digit.setVisValue(v + frac, empty);
      v = Math.floor(v * 0.1);
    }

    this.dropEmptyDigits();

  };

  Mecntr.prototype._addDecimalDigit = function(digit, sep){
    digit = new Digit(this, digit, sep);
    this._digits.push(digit);
    return digit;
  };

  Mecntr.prototype._addIntDigit = function(digit, sep){
    this._intDigits++;
    return this._addDecimalDigit(digit, sep);
  };

  Mecntr.prototype._addIntDigitWithSep = function(digit){
    return this._addIntDigit(digit, this._intDigits % 3 === 0);
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
    , i = 0   // calculation iteration index
    ;

    if(t2 > delay){

      do {
        i++;
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

      console.log(" iterations (1): ", i, ", k:", k, ", t2:", t2, ", sp:", lgSpeed(t2)*0.001);

    }else{

      do {
        i++;
        t2o = t2;

        dt *= 0.5;
        t2 += spN > sp_ ? dt : -dt;
        t1 = delay - t2;
        sp_ = lgSpeed(t2);
        spN = (aDif - lgValueBySpeed(sp_)) / t1;
      } while(t2o !== t2);

      console.log(" iterations (2): ", i, ", t2:", t2, ", sp:", spN*0.001);

    }

    cb(t1, t2, k, lgSpeed(t2, k));

  };

  Mecntr.prototype._getUpdateValueBuilder = function(oV, nV){
    var d = 0
    , oFl = Math.floor(oV)
    , nFl = Math.floor(nV)
    , oFr = oV - oFl
    , nFr = nV - nFl
    ;

    return function(digit){
      digit.createValueUpdaterForSet(oV, nV);
      oFr = oFl % 10 === 9 ? oFr : 0;
      oFl = Math.floor(oFl * 0.1);
      oV = oFl + oFr;
      nFr = nFl % 10 === 9 ? nFr : 0;
      nFl = Math.floor(nFl * 0.1);
      nV = nFl + nFr;
      return digit;
    }

  }

  Mecntr.prototype._setSpeed = function(spN){
    this._speed = spN * 0.001;
    this._perceptibleDgt = toLog10 * Math.log(this._speed * this._opts.multiplier);
  };

  Mecntr.prototype.getValue = function(){
    return this._value / this._opts.multiplier;
  }

  Mecntr.prototype.setValue = function(newVal, delayMs){
    newVal *= this._opts.multiplier;

    if(!delayMs || this._value === newVal){
      clearInterval(self._interval);
      this._fillValue(newVal);
      return;
    }

    this._setValue(newVal, delayMs);

  };

  Mecntr.prototype._setValue = function(newVal, delayMs){
    var self = this
    , o = this._opts
    , oldVal = this._value
    , delay = delayMs * 0.001
    , dif = newVal - oldVal
    , sgn = dif < 0 ? -1 : 1
    , aDif = Math.abs(dif)
    , k = 1   // spin slowdown intensification coefficient (k >= 1 always)
    , spN = 0 // initial spin speed (rounds of dif per second)
    , t1 = 0  // time in seconds of constant spin speed
    , t2      // time in seconds of spin slowdown
    ;

    this._calcSlowdownParams(aDif, delay, function (t1_, t2_, k_, spN_){
      t1 = t1_; t2 = t2_; k = k_; spN = spN_;
    });

    this._startTime = Date.now();
    this._setSpeed(spN);
    this._maxPerceptibleDgt = this._perceptibleDgt;

    $("#debug").text("delaySec="+delay+" t1="+t1+" t2="+t2+" oldVal="+oldVal+" newVal="+newVal);

    this._currentValues = function(timeMs){
      var t = timeMs * 0.001;

      if(t <= t1){
        console.log("curVal: linear");
        self._value = oldVal + sgn * spN * t;
        return;
      }
      console.log("curVal: logarithmic");
      t -= t1;

      spN = lgSpeed(t2 - t, k);
      self._setSpeed(spN);
      self._value = newVal - sgn * lgValueBySpeed(spN, k);
      if(sgn * self._value < sgn * oldVal){
        self._value = oldVal;
      }
    }

    //this._buildValueUpdater = this._getUpdateValueBuilder(oldVal, newVal);

    (function(){
      var d = 0
      , dLen = self._digits.length
      , digit
      , oV = oldVal
      , nV = newVal
      , oFl = Math.floor(oV)
      , nFl = Math.floor(nV)
      , oFr = oV - oFl
      , nFr = nV - nFl
      ;

      while(nV >= 0.1 || d < dLen){
        digit = self._digits[d++] || self._addDigit(digit);
        digit.createValueUpdaterForSet(oV, nV);
        oFr = oFl % 10 === 9 ? oFr : 0;
        oFl = Math.floor(oFl * 0.1);
        oV = oFl + oFr;
        nFr = nFl % 10 === 9 ? nFr : 0;
        nFl = Math.floor(nFl * 0.1);
        nV = nFl + nFr;
      }

    })();

    clearInterval(self._interval);

    o.onBeforeSpin(delayMs, dif, oldVal);

    self._dbgStep = function(stepBack, isTrace){
      if(stepBack) {
        this._dbgTime -= this._opts.refreshDelayMs * 2;
      }
      var t = self._elapsed();

      if(t >= delayMs){
        $("#debug2").text("dbgStep: overtime: t="+t);
        clearInterval(self._interval);
        self._fillValue(newVal);
        return;
      }

      self._currentValues(t);
      o.onSpinStep(t, self._value);

      if(1){
        self._isTrace = isTrace;
        $("#debug2").text("dbgStep: t="+t+" v="+self._value+" sp="+self._speed);
        console.log("_________\ndbgStep: t="+t+" v="+self._value+" sp="+self._speed);
        console.log("perc=", self._perceptibleDgt);
      }

      if(0){
        //console.log(self._value);
        self._fillValue(self._value);
        return;
      }

      var v = self._value
      , dLen = self._digits.length
      ;
      var digit, d = 0, frac = 0, empty;

      while(d < dLen){
        empty = v < 1 && d >= o.digits;

        if(1){
          console.groupCollapsed("d="+d+" updateValue: v="+v+" fracPrev="+frac+" empty="+empty);
        }

        frac = self._digits[d++]._updateValue(v, frac, empty);
        v = v * 0.1;

        if(1){
          console.groupEnd();
        }
      }

    }
    if(!this._dbgMode){
      self._interval = setInterval(self._dbgStep, o.refreshDelayMs);
    }else{
      self._dbgTime = 0;
      console.log("now use 'debug step'!");
    }

  };

  Mecntr.prototype.resetValue = function(newVal){
    this._resetValue(newVal * this._opts.multiplier);
  };

  Mecntr.prototype._resetValue = function(newVal){

    var o = this._opts;

    if(this._value === newVal){
      clearInterval(this._interval);
      this._isResetInProgress = null;
      this._fillValue(newVal);
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

    dbgLog = window.dbgLog = {
      adgd: []
    };
    adgd = dbgLog.adgd;

    (function(v){
      var dif
      , d = 0
      , digit
      ;

      while(d < dLen){
        adgd.push({
          d: d,
          dgd: []
        });
        dgp = adgd[d];
        digit = self._digits[d++];
        dif = digit.prepareValueIntervalForReset(v);
        if(dif > maxDif) maxDif = dif;
        v = Math.floor(v * 0.1);
      }
      delay = delay * 0.1 * maxDif;
      delayMs = delayMs * 0.1 * maxDif;

      while(v > 0){
        digit = self._addDigit(digit);
        digit.setVisValue(v);
        v = Math.floor(v * 0.1);
      }
    })(newVal);

    this._calcSlowdownParams(maxDif, delay, function (t1_, t2_, k_, spN_){
      t1 = t1_; t2 = t2_; k = k_; spN = spN_;
    });

    dbgLog.t1 = t1;
    dbgLog.t2 = t2;
    dbgLog.k = k;
    dbgLog.spN = spN;

    (function(){
      var d = 0
      , v2 = lgValueBySpeed(spN, k)
      ;

      while(d < dLen){
        dgp = adgd[d];
        self._digits[d++].createValueUpdaterForReset(k, t2, spN, v2);
      }

    })();

    this._startTime = Date.now();

    clearInterval(self._interval);

    self._interval = setInterval(function(){
      var d = 0, t = self._elapsed();

      if(t >= delayMs){
        clearInterval(self._interval);
        this._isResetInProgress = null;
        self._fillValue(newVal);
        return;
      }

      t *= 0.001;

      while(d < dLen){
        dgp = adgd[d];
        dgd = dgp.dgd;
        self._digits[d++]._updateValue(t);
      }

    }, o.refreshDelayMs);

  };

  Mecntr.prototype.dropEmptyDigits = function(){
    var d = this._digits.length
    , digit = this._digits[--d]
    ;

    if(!digit.empty){
      this._digits.forEach(function(digit){
        digit.isNew = null;
      });
      return;
    }

    do {
      digit.remove(digit.isNew);
      digit = this._digits[--d];
      this._intDigits--;
    } while(digit.empty);

    this._digits.length = d + 1;
    this._digits.forEach(function(digit){
      digit.isNew = null;
    });
  };

  Mecntr.prototype._elapsed = function(){
    if(this._dbgMode){
      this._dbgTime += this._opts.refreshDelayMs;
      return this._dbgTime;
    }

    return Date.now() - this._startTime;
  };

  //************************************
  //            Digit Class
  //   (helper for MechanicalCounter)
  //************************************

  function Digit(owner, dirDigit, sep){
    this.owner = owner;
    this._dirDigit = dirDigit;
    var o = this.owner._opts;

    if(sep){
      this.$sep = $(owner._thousandSepStr).prependTo(owner.$el);
    }

    this.$el = $(owner._digitStr).prependTo(owner.$el);
    this.$el.html(owner._makeSpan("rect", "0") + repeatStr(2, owner._makeSpan("card", "")));

    this.$all = this.$el.add(this.$sep);
    this._showMs = o.showDigitMs;
    this._refreshRate = o.refreshDelayMs / o.perceptibleChangeMs;
    this._num = owner._digits.length;
    this.$all.animate({
      width: "toggle",
      opacity: 0.01
    }, 0).animate({
      width: "toggle"
    }, this._showMs).animate({
      opacity: 1
    }, this._showMs);

    var $cards = this.$el.find("." +o.baseClass + "-card");
    this.$card0 = $cards.eq(0);
    this.$card1 = $cards.eq(1);

    this._state = this.STATE_LINKED;
  };

  Digit.prototype.STATE_LINKED  = 0;
  Digit.prototype.STATE_LINKING = 1;
  Digit.prototype.STATE_FREE    = 2;

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
    this._srcVal = this._oldVisVal % 10;
    this._dstVal = dstVal % 10;
    if(this._dstVal < this._srcVal) this._dstVal += 10;
    this._aDif = this._dstVal - this._srcVal;

    dgp.src = this._srcVal;
    dgp.dst = this._dstVal;
    dgp.dif = this._aDif;

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

  Digit.prototype.createValueUpdaterForSet = function(oldVisVal, newVisVal){
    if(oldVisVal === newVisVal) {
      this._updateValue = function(){ return 0; };
      return;
    }

    if(this._num === 0){
      this._updateValue = function(value){ return this.setVisValue(value); };
      return;
    }

    var maxPercDiff = this._num - this.owner._maxPerceptibleDgt;
    var correction = 0;
    var limit;

    if(oldVisVal < newVisVal){
      limit = function(v){
        if(v < oldVisVal) return oldVisVal;
        if(newVisVal < v) return newVisVal;
        return v;
      };
    }else{
      limit = function(v){
        if(v < newVisVal) return newVisVal;
        if(oldVisVal < v) return oldVisVal;
        return v;
      };
    }

    this._updateValue = function(value, fracPrev, empty){
      var percDiff = this._num - this.owner._perceptibleDgt;

      console.log("from=", oldVisVal, " to=", newVisVal, " maxPercDiff=", maxPercDiff);

      if(percDiff < 1){
        console.log("evenly: percDiff=", percDiff, " val=", value);
        value += correction;
        console.log("corrected=", value, " limited=", limit(value));
        return this.setVisValue(limit(value), empty);
      }

      var floor = Math.floor(value);
      var frac, fracNow = value - floor;

      if(percDiff < 2){
        console.log("halfevenly: percDiff=", percDiff, " fracNow=", fracNow, " fracPrev=", fracPrev);
        percDiff--;
        frac = percDiff * fracPrev + (1 - percDiff + correction) * fracNow;
        console.log("frac=", frac, " val=", floor + frac, " limited=", limit(floor + frac));
        return this.setVisValue(limit(floor + frac), empty);
      }

      console.log("impulsive: percDiff=", percDiff, " fracPrev=", fracPrev);
      console.log("val=", floor + fracPrev, " limited=", limit(floor + fracPrev));
      return this.setVisValue(limit(floor + fracPrev), empty);
    }
  };

  Digit.prototype.updateValue = function(value, fracPrev, empty){

    var percDiff = this._num - this.owner._perceptibleDgt;

    if(percDiff < 1){
      console.log("evenly: percDiff=", percDiff);
      return this.setVisValue(value, empty);
    }

    var floor = Math.floor(value);
    var frac, fracNow = value - floor;

    if(percDiff < 2){
      percDiff--;
      frac = percDiff * fracPrev + (1 - percDiff) * fracNow;
      console.log("halfevenly: percDiff=", percDiff, " fracNow=", fracNow, " fracPrev=", fracPrev, " frac=", frac);
      return this.setVisValue(floor + frac, empty);
    }

    console.log("impulsive: percDiff=", percDiff, " fracPrev=", fracPrev, " frac=", frac);
    return this.setVisValue(floor + fracPrev, empty);
  }

  Digit.prototype.setFinal = function(sgn, fl, frac){
    this._state = this.STATE_LINKED;
    this._sgn = sgn;
    this._final = {
      v: fl + frac,
      fl: fl,
      frac: frac,
      nextFrac: fl % 10 === 9 ? frac : 0
    };
    this._final.sgnV = sgn * this._final.v
    return this;
  };

  Digit.prototype.nearest = function(value, frac, empty){

    var percDiff = this._num - 1 - this.owner._perceptibleDgt;
    var isGibrib = percDiff > 0 && percDiff < 1;
    if(isGibrib) console.group("digit#"+this._num+": percDiff="+percDiff);

    this._oldVal = this._value;

    var sgn = this._sgn;

    if(sgn * value > this._final.sgnV){
      value = this._final.v;
    }

    //if(value === this._value) return this._fracNext;
    this._value = value;

    if(sgn < 0){
      if(value > this._oldVisVal) value = this._oldVisVal;
    }else{
      if(value < this._oldVisVal) value = this._oldVisVal;
    }

    var floor = Math.floor(value)
    , flDgt = floor % 10
    , isChange = this._floor !== floor
    , frac2 = value - floor
    ;

    if(isChange) this._floor = floor;

    if(this._state === this.STATE_FREE){
      this._state = this.STATE_LINKING;
    }

    if(this._state === this.STATE_LINKING){
      if(isChange || (frac2 * 10 >= 9)){
        this._state = this.STATE_LINKED;
      }
    }

    if(sgn < 0){

      if(floor + frac > this._oldVisVal){
        frac = this._oldVisVal - Math.floor(this._oldVisVal);
        if(floor !== this._oldVisVal - frac) console.error("er 23");
      }
      if(this._oldVisVal === floor + frac) frac *= 0.9;

    } else {
      if(floor + frac < this._oldVisVal){
        frac = this._oldVisVal - Math.floor(this._oldVisVal);
        if(floor !== this._oldVisVal - frac) console.error("er 24");
      } else {
        if(this._state === this.STATE_LINKING){

          frac = frac2;

        }
      }
    }

    var shift0 = frac * this.owner._height;
    var shift1 = shift0 - this.owner._height;

    this.$card0.css("top", shift0 + "px");
    this.$card1.css("top", shift1 + "px");

    if(isChange){
      var zero = empty ? "" : "0";
      this.$card0.text(flDgt === 0 ? zero : flDgt);
      this.$card1.text(flDgt === 9 ? zero : flDgt + 1);
    }
    this._frac = frac;
    this._fracNext = flDgt !== 9 ? 0 : frac;
    this._oldVisVal = floor + frac;

    this.empty = flDgt === 0 && frac < 0.3 && empty;
    console.groupEnd();
    return this._fracNext;
  };

  Digit.prototype.setValue = function(value, empty){

    this._oldVal = this._value;
    this._state = this.STATE_FREE;

    var sgn = this._sgn;

    if(this._final && sgn * value > this._final.sgnV){
      value = this._final.v;
    }

    if(value === this._value) return this._fracNext;
    this._value = value;

    if(sgn < 0){
      if(value > this._oldVisVal) value = this._oldVisVal;
    }else{
      if(value < this._oldVisVal) value = this._oldVisVal;
    }

    var floor = Math.floor(value)
    , flDgt = floor % 10
    , isChange = this._floor !== floor
    , frac = value - floor
    ;

    if(isChange) this._floor = floor;

    var shift0 = frac * this.owner._height;
    var shift1 = shift0 - this.owner._height;

    this.$card0.css("top", shift0 + "px");
    this.$card1.css("top", shift1 + "px");

    if(isChange){
      var zero = empty ? "" : "0";
      this.$card0.text(flDgt === 0 ? zero : flDgt);
      this.$card1.text(flDgt === 9 ? zero : flDgt + 1);
    }
    this._frac = frac;
    this._fracNext = flDgt !== 9 ? 0 : frac;
    this._oldVisVal = floor + frac;

    this.empty = flDgt === 0 && frac < 0.3 && empty;
    return this._fracNext;
  };

  Digit.prototype.setVisValue = function(value, empty){
    this._oldVal = this._value;

    this._value = value;
    this._floor = Math.floor(value);

    var flDgt = this._floor % 10
    , frac = value - this._floor
    ;

    var shift0 = frac * this.owner._height;
    var shift1 = shift0 - this.owner._height;

    this.$card0.css("top", shift0 + "px");
    this.$card1.css("top", shift1 + "px");

    var zero = empty ? "" : "0";
    this.$card0.text(flDgt === 0 ? zero : flDgt);
    this.$card1.text(flDgt === 9 ? zero : flDgt + 1);

    this._frac = frac;
    this._fracNext = flDgt !== 9 ? 0 : frac;
    this._oldVisVal = value;

    this.empty = flDgt === 0 && frac < 0.3 && empty;
    return this._fracNext;
  };

  Digit.prototype.setNew = function(){
    this.isNew = true;
    return this;
  };

})(jQuery);

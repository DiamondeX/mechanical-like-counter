(function($){

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

    this._opts = opts = $.extend({
      mask: " 3,2",
      decimalSep: ".",
      thousandSep: "",
      value: 0,
      baseClass: "mechounter",
      showDigitMs: 300,
      slowdownMs: 19000,
      perceptibleChangeMs: 600,
      refreshDelayMs: 30
    }, opts);

    if(opts.mask){
      this._parseMask(opts.mask, this._opts);
    }

    this._validateOpts();

    this.el = el;
    this.$el = $(el).addClass(this._opts.baseClass);
    this._height = this.$el.height();
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
    frac = this._digits[0].setValue(v);
    v = Math.floor(v/10);

    while(v > 0 || d < o.digits || d < dLen){
      empty = v < 1 && d >= o.digits;

      digit = this._digits[d++] || this._addDigit(digit);
      if(frac){
        frac = digit.setVisValue(v + frac, empty);
      }else{
        digit.setIntValue(v, empty);
      }
      v = Math.floor(v/10);
    }

    this.dropEmptyDigits();

  };

  Mecntr.prototype._setFinals = function(v, sgn){

    var d = 0
    , dLen = this._digits.length
    , fl = Math.floor(v)
    , frac = v - fl
    ;

    while(d < dLen){
      frac = this._digits[d++].setFinal(sgn, fl, frac)._final.nextFrac;
      fl = Math.floor(fl/10);
    }
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

  Mecntr.prototype._appendDigit = function(digit){
    var fl = Math.floor(digit._final.v * 0.1)
    , frac = digit._final.nextFrac
    ;

    return this._addDigit().setNew().setFinal(digit._sgn, fl, frac);
  };

  Mecntr.prototype._setSpeed = function(spN){
    this._speed = spN * 0.001;
    this._perceptibleDgt = toLog10 * Math.log(this._speed * this._opts.multiplier);
  };

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

    t2 = timeByLgVal(aDif);

    if(t2 > delay){

      //iterative calculation of parameters
      (function(){
        var i = 0
        , t2o
        , kk = 0.5
        , ko = k
        ;

        do {
          i++;
          t2o = t2;

          k *= 1 + kk;
          t2 = timeByLgVal(aDif, k);
          if(t2 < delay) {
            kk *= 0.5;
            k = ko;
          }else{
            ko = k;
          }
        } while(t2o !== t2);

        console.log(" iterations (1): ", i, ", k:", k, ", t2:", t2, ", sp:", lgSpeed(t2)*0.001);
      })();

    }else{

      //iterative calculation of parameters
      (function(){
        var i = 0
        , t2o
        , sp_ = 1
        , mod = t2
        ;

        do {
          i++;
          t2o = t2;

          mod *= 0.5;
          t2 += spN > sp_ ? mod : -mod;
          t1 = delay - t2;
          sp_ = lgSpeed(t2);
          spN = (aDif - lgValueBySpeed(sp_)) / t1;
        } while(t2o !== t2);

        console.log(" iterations (2): ", i, ", t2:", t2, ", sp:", spN*0.001);

      })();

    }

    this._startTime = Date.now();
    this._setSpeed(spN);
    this._setFinals(newVal, sgn);

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
    }

    clearInterval(self._interval);

    window.initDraw(delayMs, dif, oldVal);
    self._interval = setInterval(function(){
      var t = self._elapsed();

      if(t >= delayMs){
        clearInterval(self._interval);
        self._fillValue(newVal);
        return;
      }

      self._currentValues(t);
      window.draw(t, self._value);

      var v = self._value
      , dLen = self._digits.length
      ;
      var digit, d = 0, frac, empty;

      while(d < self._perceptibleDgt && (v >= 0.1 || d < o.digits || d < dLen)){

        digit = self._digits[d++] || self._appendDigit(digit);
        digit.setValue(v);
        v = v/10;

      }

      if(v >= 0.1 || d < o.digits || d < dLen){
        empty = v < 1 && d >= o.digits;

        digit = self._digits[d++] || self._appendDigit(digit);
        frac = digit.setValue(v, empty);
        v = v/10;

        while(v >= 0.1 || d < o.digits || d < dLen){
          empty = v < 1 && d >= o.digits;

          digit = self._digits[d++] || self._appendDigit(digit);
          frac = digit.nearest(v, frac, empty);
          v = v/10;
        }
      }

      self.dropEmptyDigits();

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

    if(value === this._value) return this._fracNext;
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

  Digit.prototype.setIntValue = function(value, empty){
    this._oldVal = this._value;

    if(value === this._value) return 0;

    this._value = this._floor = value;

    var shift1 = -this.owner._height;

    value %= 10;
    var zero = empty ? "" : "0";
    this.$card0.css("top",         "0px").text(value === 0 ? zero : value);
    this.$card1.css("top", shift1 + "px").text(value === 9 ? zero : value + 1);

    this._frac = 0;
    this._fracNext = 0;
    this._oldVisVal = value;

    this.empty = value === 0 && empty;
    return 0;
  };

  Digit.prototype.setNew = function(){
    this.isNew = true;
    return this;
  };

})(jQuery);

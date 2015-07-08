(function($){

  var PiD4 = 0.7853981633974483; // === Math.Pi / 4;
  var toLog10 = 0.4342944819032518; // === 1 / Math.log(10)

  var $dbg = $("#debug");

  function repeatStr(t, str){
    var s = str;
    while(--t){ s+= str }
    return s;
  }

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
      refreshDelayMs: 16
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

  }

  Mecntr.prototype._parseMask = function (mask, o){

    mask = /(\D?)(\d+)((\D)(\d+))?/.exec(mask);

    if(!mask) return;

    o = o || {};

    o.thousandSep = mask[1];

    o.digits = mask[2];

    o.decimalSep = mask[4] || ".";

    o.decimals = Math.min(+mask[5] || 0, o.digits-1);

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
    , lead
    , thGroups
    ;
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

    this._perceptibleDgt = 0;
    this._value = v;
    frac = this._digits[0].setValue(v);
    v = Math.floor(v/10);

    while(v > 0 || d < o.digits || d < dLen){
      empty = v < 1 && d >= o.digits;

      digit = this._digits[d++];
      if(!digit) digit = this._addDigit();
      if(frac){
        frac = digit.setValue(v + frac, empty);
      }else{
        digit.setIntValue(v, empty);
      }
      v = Math.floor(v/10);
    }

    this.dropEmptyDigits();

  };

  Mecntr.prototype.spinValue = function(v){
    this._spinValue(v * this._opts.multiplier);
  };

  Mecntr.prototype._spinValue = function(v){

    var o = this._opts
    , dLen = this._digits.length
    ;
    var digit, d = 0, frac, empty;

    this._perceptibleDgt = dLen;
    this._value = v;

    while(v >= 0.3 || d < o.digits || d < dLen){
      empty = v < 1 && d >= o.digits;

      digit = this._digits[d++];
      if(!digit) digit = this._addDigit();
      digit.setValue(v, empty);
      v = v >= 1 ? v/10 : 0;
    }

    this.dropEmptyDigits();

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

  Mecntr.prototype.setValue = function(val, delayMs){
    var o = this._opts;

    if(!delayMs){
      this.fillValue(val);
      return;
    }

    this._setValue(val, delayMs);

  };

  Mecntr.prototype._setValue = function(val, delayMs){
    var self = this
    , o = this._opts
    , finalVal = val * o.multiplier
    , oldValue = this._value
    , dif = finalVal - oldValue
    , t2 = Math.min(delayMs, o.slowdownMs) // this._slowdownMs
    , t1 = delayMs - t2 // this._uniformMs
    , speed0 = dif/(t1 + t2 * PiD4)
    ;

    window.initDraw(delayMs, dif, oldValue);

    function calcPerceptible(speed){
      var p = speed * o.perceptibleChangeMs;
      p = Math.ceil( Math.log(p) * toLog10 );
      return Math.max(0, p);
    }

    this._perceptibleDgt = calcPerceptible(speed0);
    this._startTime = Date.now();

    console.log({
      finalVal: finalVal,
      dif: dif,
      t2: t2,
      t1: t1,
      speed0: speed0,
      startTime: this._startTime,
      _perceptibleDgt: this._perceptibleDgt
    });

    function logify(dv){
      return dif * Math.log(1+dv/dif * 1.718281828459045);
    }

    this._currentValue = function(t){ //(v-v0)/dv ==> Math.log(1+(v-v0)/dv * 1.718281828459045)
      //$dbg.text("1. "+t+", "+speed0 * t);
      //if(t <= t1) return speed0 * t + oldValue; // === v
      if(t <= t1) return logify(logify(logify(logify(speed0 * t)))) + oldValue;

      t -= t1;
      var sin = t / t2
      , ang = Math.asin(sin)
      , cos = Math.cos(ang)
      , sqr = cos * sin
      ;
      self._perceptibleDgt = calcPerceptible(speed0 * cos);
      //return speed0 * ((sqr + ang) * 0.5 * t2 + t1) + oldValue;
      return logify(logify(logify(logify(speed0 * ((sqr + ang) * 0.5 * t2 + t1))))) + oldValue;
    }

    clearInterval(self._interval);
    self._interval = setInterval(function(){
      var t = self._elapsed();

      if(t >= delayMs){
        clearInterval(self._interval);
        self._fillValue(finalVal);
        return;
      }
      //self._fillValue(self._currentValue(t));
      //return;

      var v = self._currentValue(t)
      , dLen = self._digits.length
      ;
      window.draw(t, v);
      var digit, d = 0, frac, empty;

      self._value = v;

      while(d < self._perceptibleDgt && (v >= 0.1 || d < o.digits || d < dLen)){
        digit = self._digits[d++];
        if(!digit) digit = self._addDigit();
        digit.setValue(v);
        v = v/10;
      }

      if(v >= 0.1 || d < o.digits || d < dLen){
        empty = v < 1 && d >= o.digits;
        digit = self._digits[d++];
        if(!digit) digit = self._addDigit();
        frac = digit.setValue(v, empty);
        v = Math.floor(v/10);

        while(v > 0 || d < o.digits || d < dLen){
          empty = v < 1 && d >= o.digits;

          digit = self._digits[d++];
          if(!digit) digit = self._addDigit();
          frac = digit.runToValue(v + frac, empty);
          v = Math.floor(v/10);
        }
      }

      self.dropEmptyDigits();

    }, o.refreshDelayMs);

  };

  Mecntr.prototype.dropEmptyDigits = function(){
    var d = this._digits.length
    , digit = this._digits[--d]
    ;

    if(!digit.empty) return;

    do {
      digit.remove();
      digit = this._digits[--d];
      this._intDigits--;
    } while(digit.empty);

    this._digits.length = d + 1;
  }

  Mecntr.prototype._elapsed = function(){
    return Date.now() - this._startTime;
  }

  function Digit(owner, sep){
    this.owner = owner;
    var o = this.owner._opts;

    if(sep) this.$sep = $(owner._thousandSepStr).prependTo(owner.$el);
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

    var $cards = this.$el.find("." +owner._opts.baseClass + "-card");
    this.$card0 = $cards.eq(0);
    this.$card1 = $cards.eq(1);
  }

  Digit.prototype.remove = function(aniDelayMs){
    var self = this;

    if(aniDelayMs == null) aniDelayMs = this._showMs;
    if(aniDelayMs){
      aniDelayMs = Math.floor(aniDelayMs/2);
      self.$all.animate({
        opacity:0.01
      }, aniDelayMs).hide(aniDelayMs,function(){
        self.$all.remove();
      });
    }else{
      self.$all.remove();
    }
  }

  Digit.prototype.runToValue = function(value, empty){
    if(value === this._value) return this._frac;

    var dif = value - this._value;

    if(Math.abs(dif) > this._refreshRate){

      value = this._value + this._refreshRate * (dif > 0 ? 1 : -1);

    }

    return this.setValue(value, empty);

  };

  Digit.prototype.setValue = function(value, empty){
    if(value === this._value) return this._frac;

    this._value = value;
    var floor = Math.floor(value);
    var newDigit = this._floor !== floor

    if(newDigit) this._floor = floor;

    value -= floor;
    var shift0 = value * this.owner._height;
    var shift1 = shift0 - this.owner._height;

    this.$card0.css("top", shift0 + "px");
    this.$card1.css("top", shift1 + "px");

    floor %= 10;
    if(newDigit){
      var zero = empty ? "" : "0";
      this.$card0.text(floor === 0 ? zero : floor);
      this.$card1.text(floor === 9 ? zero : floor + 1);
    }
    this._frac = floor !== 9 ? 0 : value;
    this.empty = floor === 0 && value < 0.3 && empty;
    return this._frac;
  };

  Digit.prototype.setIntValue = function(value, empty){
    if(value === this._value) return 0;

    this._value = this._floor = value;
    this._frac = 0;

    var shift1 = -this.owner._height;

    value %= 10;
    var zero = empty ? "" : "0";
    this.$card0.css("top",         "0px").text(value === 0 ? zero : value);
    this.$card1.css("top", shift1 + "px").text(value === 9 ? zero : value + 1);
    this.empty = value === 0 && empty;
    return 0;
  };

})(jQuery);

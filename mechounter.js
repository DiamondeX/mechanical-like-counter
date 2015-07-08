(function($){

  var PiD4 = 0.7853981633974483; // === Math.Pi / 4;
  var toLog10 = 0.4342944819032518; // === 1 / Math.log(10)
  var frLog10 = 2.302585092994046;  // === Math.log(10)

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
    , oldValue = this._value
    , finalVal = val * o.multiplier
    , dif = finalVal - oldValue
    , sgn = dif < 0 ? -1 : 1
    , aDif = Math.abs(dif)
    , k = 1
    , spN = 0
    , spNms
    , delay = delayMs * 0.001
    , t1 = 0 //in seconds
    , t2     //in seconds
    , t1ms
    , t2ms
    ;

    if(false){
//      var nnnnn
//      // начальная скорость вращения
//
//      // время на замедление последнего разряда в секундах
//        , lgFinSlow = 2
//
//      // число разрядов разности значений счетчика
//        , lgDif   = toLog10 * Math.log(aDif)
//
//      // разрядность длительности (в секундах) изменения значения
//        , lgDelay = toLog10 * Math.log(delayMs * 0.001)
//
//      // время, в течении которого происходит снижение (по модулю) скорости изменения значения
//        , t2 = (lgDif + lgFinSlow) * 1000 // this._slowdownMs
//
//      //время, в течении которого скорость изменения значения постоянна
//        , t1 // this._uniformMs
//
//      //длина интервала равномерного изменения значения
//        , aDif1
//      ;
    }

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

    t2 = timeByLgVal(aDif);
    console.log("dif:", dif, " old->new:", oldValue, finalVal);
    console.log("delayMs:", delayMs);
    console.log("t2_0:", t2);

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

        console.log(" iterations (1): ", i, ", k:", k);
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

        console.log(" iterations (2): ", i);
        console.log("t2_1:", t2);

      })();

    }

    t1ms = t1 * 1000;
    t2ms = t2 * 1000;

    window.initDraw(delayMs, aDif, oldValue);

    this._startTime = Date.now();
    this._speed = spN * 0.001;

    var dbgL = 0;
    var dbgE = 0;
    var dbgLval = 0;
    var dbgEval = 0;
    var dbgLsp = 0;
    var dbgEsp = 0;
    var dbgLt = 0;
    var dbgEt = 0;
    var log = [];

    this._currentValues = function(tMs){
      var t = tMs * 0.001;

      if(t <= t1){
        self._value = oldValue + sgn * spN * t;

        $('#debug').text("linear");
        dbgLt = tMs;
        dbgLval = self._value;
        dbgLsp = self._speed;
        if(++dbgL === 1) console.log("L0: t:",dbgLt,", v:", dbgLval, ", sp:", dbgLsp);

        return;
      }

      t -= t1;
      t = t2 - t;

      spN = lgSpeed(t, k);

      self._speed = spN * 0.001;
      self._value = finalVal - sgn * lgValueBySpeed(spN, k);
      log.push(lgValueBySpeed(spN, k));

      $('#debug').text("exponential");
      dbgEt = tMs;
      dbgEval = self._value;
      dbgEsp = self._speed;
      if(++dbgE === 1) console.log("E0: t:",dbgEt,", v:", dbgEval, ", sp:", dbgEsp);

    }

    clearInterval(self._interval);
    self._interval = setInterval(function(){
      var t = self._elapsed();

      if(t >= delayMs){
        clearInterval(self._interval);
        console.log("LF: t:",dbgLt,", v:", dbgLval, ", sp:", dbgLsp);
        console.log("EF: t:",dbgEt,", v:", dbgEval, ", sp:", dbgEsp, log);
        self._fillValue(finalVal);
        return;
      }
      self._currentValues(t);
      self._fillValue(self._value);
      return;

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

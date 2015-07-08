function speed(t, k){
  k = k || 1;
  return Math.pow(10, k*t-2);
}

var toLog10 = 0.4342944819032518; // === 1 / Math.log(10)
var frLog10 = 2.302585092994046;  // === Math.log(10)
function value(t, k){
  k = k || 1;
  return toLog10 * Math.pow(10, k*t-2) / k;
}

function time(v, k){
  k = k || 1;
  return (toLog10 * Math.log(v * k * frLog10) + 2) / k;
}

function tSpeed(s, k){
  k = k || 1;
  return (toLog10 * Math.log(s) + 2) / k;
}

dif = 60000;
delay = 5000;

t0 = time(dif) * 1000;
if(t0 > delay){
  i = 0;
  k = 1;
  kk = 0.5;
  t0o = t0;
  while(Math.abs(t0o/delay - 1) > 1e-14){
    i++;
    t0o = time(dif, k) * 1000;
    if(t0o < delay) {
      k /= 1 + kk;
      kk /= 2;
    }
    k *= 1 + kk;
  }
  console.log(" iterations (1): ", i);
  k = t0/(delay - dz);
}else{
  t1 = delay - t0;
  spN = dif / t1;
  t2 = tSpeed(spN);
  t2o = -1;
  i = 0;
  while(t2o !== t2){
    i++;
    t2o = t2;
    t1 = delay - t2;
    spN = dif / t1;
    t2 = tSpeed(spN);
  }
  console.log(" iterations (2): ", i);
}


(function ss(delayMs){
  var toLog10 = 0.4342944819032518; // === 1 / Math.log(10)
  var self = this
  , finalVal = 100000
  , oldValue = 10
  , dif = finalVal - oldValue
  , sgn = dif < 0 ? -1 : 1
  , aDif = Math.abs(dif)
  , percept = 300
  , lgFinSlow = 2 // время на замедление последнего разряда в секундах
  , speed0

  // сколько разрядов надо "сбросить" всего
  //(здесь и далее "сброс разряда" - снижение скорости изменения значения в 10 раз)
  // фактически, число разрядов разности значений счетчика
  , lgDif   = toLog10 * Math.log(aDif)

  //разрядность длительности (в секундах) изменения значения
  , lgDelay = toLog10 * Math.log(delayMs / 1000)

  //время, в течении которого происходит снижение (по модулю) скорости изменения значения
  , t2 = (lgDif + lgFinSlow) * 1000 // this._slowdownMs

  //время, в течении которого скорость изменения значения постоянна
  , t1 // this._uniformMs

  //длина интервала равномерного изменения значения
  , aDif1
  ;

  console.log("t2_", t2);

  if(t2 > delayMs){
    t2 = delayMs;
    t1 = 0;
  }else{
    t2 = Math.max(0.01, lgDif - lgDelay);
    console.log("t2 _", t2);
    aDif1 = aDif - Math.pow(10, t2);
    t2 = (t2 + lgFinSlow) * 1000;
    t1 = delayMs - t2;
    speed0 = sgn * aDif1 / t1;
  }

  console.log({
    _00_oldValue: oldValue,
    _01_finalVal: finalVal,
    _02_dif: dif,
    _03_sgn: sgn,
    _04_aDif: aDif,
    _05_aDif1: aDif1,
    _06_lgDif: lgDif,
    _07_delayMs: delayMs,
    _08_lgDelay: lgDelay,
    _09_t2: t2,
    _10_t1: t1,
    _11_speed0: speed0
  });
  window.qlog = {
    oldValue: oldValue,
    finalVal: finalVal,
    dif: dif,
    sgn: sgn,
    aDif: aDif,
    aDif1: aDif1,
    lgDif: lgDif,
    delayMs: delayMs,
    lgDelay: lgDelay,
    t2: t2,
    t1: t1,
    speed0: speed0
  }

})(60000);

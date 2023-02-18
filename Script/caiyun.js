/**
彩云天气
参考地址：https://raw.githubusercontent.com/Peng-YM/QuanX/master/Tasks/caiyun.js
**/
const $ = API("caiyun");
const ERR = MYERR();

let display_location = $.read("display_location");
if (display_location === undefined) {
  display_location = false;
} else {
  display_location = JSON.parse(display_location);
}

if (typeof $request !== "undefined") {
  // get location from request url
  const url = $request.url;
  const res =
    url.match(/weather\/.*?\/(.*)\/(.*)\?/) ||
    url.match(/geocode\/([0-9.]*)\/([0-9.]*)\//) ||
    url.match(/geocode=([0-9.]*),([0-9.]*)/) ||
    url.match(/v2\/availability\/([0-9.]*)\/([0-9.]*)\//);
  if (res === null) {
    $.info(`❌ 正则表达式匹配错误，🥬 无法从URL: ${url} 获取位置。`);
    $.done({ body: $request.body });
  }
  const location = {
    latitude: res[1],
    longitude: res[2],
  };
  if (!$.read("location")) {
    $.notify("[彩云天气]", "", "🎉🎉🎉 获取定位成功。");
  }
  if (display_location) {
    $.info(
      `纬度:${location.latitude}, 经度:${location.longitude}`
    );
  }

  $.write(res[1], "#latitude");
  $.write(res[2], "#longitude");

  $.write(location, "location");
  $.done({ body: $request.body });
} else {
  // this is a task
  !(async () => {
    const { caiyun, tencent } = $.read("token") || {};

    if (!caiyun) {
      throw new ERR.TokenError("❌ 未找到彩云Token令牌");
    } else if (caiyun.indexOf("http") !== -1) {
      throw new ERR.TokenError("❌ Token令牌 并不是 一个链接！");
    } else if (!tencent) {
      throw new ERR.TokenError("❌ 未找到腾讯地图Token令牌");
    } else if (!$.read("location")) {
      // no location
      $.notify(
        "[彩云天气]",
        "❌ 未找到定位",
        "🤖 您可能没有正确设置MITM，请检查重写是否成功。"
      );
    } else {
      await scheduler();
    }
  })()
    .catch((err) => {
      if (err instanceof ERR.TokenError)
        $.notify(
          "[彩云天气]",
          err.message,
          "🤖 由于API Token具有时效性，请前往\nhttps://t.me/cool_scripts\n获取最新Token。",
          {
            "open-url": "https://t.me/cool_scripts",
          }
        );
      else $.notify("[彩云天气]", "❌ 出现错误", JSON.stringify(err, Object.getOwnPropertyNames(err)));
    })
    .finally(() => $.done());
}

async function scheduler() {
  const now = new Date();
  $.log(
    `Scheduler activated at ${now.getMonth() + 1}月${now.getDate()}日${now.getHours()}时${now.getMinutes()}分`
  );
  await query();
  weatherAlert();
  realtimeWeather();
}

async function query() {
  const location = $.read("location") || {};
  $.info(location);
  const isNumeric = (input) => input && !isNaN(input);
  if (!isNumeric(location.latitude) || !isNumeric(location.longitude)) {
    throw new Error("❌ 经纬度设置错误！");
  }

  if (Number(location.latitude) > 90 || Number(location.longitude) > 180) {
    throw new Error(
      "🤖 地理小课堂：经度的范围是0~180，纬度是0~90哦。请仔细检查经纬度是否设置正确。"
    );
  }
  // query API
  const url = `https://api.caiyunapp.com/v2.5/${$.read("token").caiyun}/${$.read("location").longitude},${$.read("location").latitude}/weather?lang=zh_CN&hourlysteps=72&dailysteps=3&alert=true&&unit=metric:v2`;

  $.log("Query weather...");

  const weather = await $.http.get({
    url,
    headers: {
      "User-Agent": "ColorfulCloudsPro/5.0.10 (iPhone; iOS 14.0; Scale/3.00)",
    },
  })
    .then((resp) => {
      const body = JSON.parse(resp.body);
      if (body.status === "failed") {
        throw new Error(body.error);
      }
      return body;
    })
    .catch((err) => {
      throw err;
    });
  $.weather = weather;

  const now = new Date().getTime();
  const addressUpdated = $.read("address_updated");
  let address = $.read("address");
  if (addressUpdated === undefined || now - addressUpdated > 30 * 60 * 1000) {
    await $.wait(Math.random() * 2000);
    $.log("Query location...");
    address = await $.http.get(
      `https://apis.map.qq.com/ws/geocoder/v1/?key=${$.read("token").tencent}&location=${$.read("location").latitude},${$.read("location").longitude}`
    )
      .then((resp) => {
        const body = JSON.parse(resp.body);
        if (body.status !== 0) {
          throw new ERR.TokenError("❌ 腾讯地图Token错误");
        }
        return body.result.address_component;
      })
      .catch((err) => {
        throw err;
      });
    $.write(address, "address");
    $.write(now, "address_updated");
  }

  if (display_location == true) {
    $.info(JSON.stringify(address));
  }
  $.address = address;
}

function weatherAlert() {
  const data = $.weather.result.alert;
  const address = $.address;
  const alerted = $.read("alerted") || [];

  if (data.status === "ok") {
    data.content.forEach((alert) => {
      if (alerted.indexOf(alert.alertId) === -1) {
        $.notify(
          `📍 ${address.city} ${address.district} ${address.street}`,
          alert.title,
          alert.description
        );
        alerted.push(alert.alertId);
        if (alerted.length > 10) {
          alerted.shift();
        }
        $.write(alerted, "alerted");
      }
    });
  }
}

function realtimeWeather() {
  const data = $.weather.result;
  const address = $.address;

  const alert = data.alert;
  const alertInfo =
    alert.content.length == 0
      ? ""
      : alert.content.reduce((acc, curr) => {
        if (curr.status === "预警中") {
          return acc + "\n" + mapAlertCode(curr.code) + "预警";
        } else {
          return acc;
        }
      }, "[预警]") + "\n";

  const realtime = data.realtime;
  const minutely = data.minutely;
  const hourly = data.hourly;
  const daily = data.daily;
  // const keypoint = data.forecast_keypoint;

  // let hourlySkycon = "[未来4小时]\n";
  // for (let i = 0; i < 4; i++) {
  //   const skycon = hourly.skycon[i];
  //   const temperature = hourly.temperature[i];
  //   const dt = new Date(skycon.datetime);
  //   const now = dt.getHours() + 1;
  //   dt.setHours(dt.getHours() + 1);
  //   hourlySkycon +=
  //     `${now}-${dt.getHours() + 1}时 ${mapSkycon(skycon.value)} ${temperature.value}℃` +
  //     (i == 3 ? "" : "\n");
  // }

  let dailySkycon = "[未来2天]\n";
  for (let i = 1; i < 3; i++) {
    const skycon = daily.skycon[i];
    const temperature = daily.temperature[i];
    const dt = new Date(temperature.date);
    const day = dt.toLocaleDateString();
    dailySkycon +=
      `${day} ${mapSkycon(skycon.value)} ${temperature.min}-${temperature.max}℃` +
      (i == 2 ? "" : "\n");
  }

  let twoHourProbability = "[未来2小时]\n";
  if (minutely.probability[0] != 0 || minutely.probability[1] != 0 || minutely.probability[2] != 0 || minutely.probability[3] != 0) {
    twoHourProbability += `降水概率、强度/半小时: ${(minutely.probability[0] * 100).toFixed(0)}%-${minutely.precipitation_2h[29].toFixed(2)},  ${(minutely.probability[1] * 100).toFixed(0)}%-${minutely.precipitation_2h[59].toFixed(2)},  ${(minutely.probability[2] * 100).toFixed(0)}%-${minutely.precipitation_2h[89].toFixed(2)},  ${(minutely.probability[3] * 100).toFixed(0)}%-${minutely.precipitation_2h[119].toFixed(2)}\n`;
  } else {
    for (let i = 1; i < 3; i++) {
      const skycon = hourly.skycon[i];
      const temperature = hourly.temperature[i];
      const wind = hourly.wind[i];
      const dt = new Date(skycon.datetime);
      twoHourProbability += `${dt.getHours()}时 ${mapSkycon(skycon.value)} ${temperature.value}℃  ${mapWind(wind.speed, wind.direction)}\n`
    }
  }

  $.notify(
    `📍 ${address.city} ${address.district} ${address.street}`,
    `${mapSkycon(realtime.skycon)} ${realtime.temperature}℃  空气质量 ${realtime.air_quality.description.usa}`,
    `😷 PM2.5浓度 ${realtime.air_quality.pm25}μg/m3  AQI ${realtime.air_quality.aqi.usa}
💨 ${mapWind(realtime.wind.speed, realtime.wind.direction)}  降水 ${realtime.precipitation.local.intensity.toFixed(2)}mm/h
🌡 温度 ${daily.temperature[0].min} - ${daily.temperature[0].max}℃  能见度 ${realtime.visibility}km
💡 ${hourly.description}
${twoHourProbability}${alertInfo}${dailySkycon}`
  );
}

// 🌞 紫外线 ${realtime.life_index.ultraviolet.desc}
// 湿度 ${(realtime.humidity * 100).toFixed(0)}%
// 🌡 体感${realtime.life_index.comfort.desc} ${realtime.apparent_temperature}℃
// 📏 最近的降水带在${realtime.precipitation.nearest.distance} 公里外呢
// ${hourlySkycon}

/************************** 天气对照表 *********************************/

function mapAlertCode(code) {
  const names = {
    "01": "🌪 台风",
    "02": "⛈ 暴雨",
    "03": "❄️ 暴雪",
    "04": "❄ 寒潮",
    "05": "💨 大风",
    "06": "💨 沙尘暴",
    "07": "☄️ 高温",
    "08": "☄️ 干旱",
    "09": "⚡️ 雷电",
    "10": "💥 冰雹",
    "11": "❄️ 霜冻",
    "12": "💨 大雾",
    "13": "💨 霾",
    "14": "❄️ 道路结冰",
    "15": "🔥 森林火灾",
    "16": "⛈ 雷雨大风",
  };

  const intensity = {
    "01": "蓝色",
    "02": "黄色",
    "03": "橙色",
    "04": "红色",
  };

  const res = code.match(/(\d{2})(\d{2})/);
  return `${names[res[1]]} ${intensity[res[2]]}`;
}

function mapWind(speed, direction) {
  let description = "";
  let d_description = "";

  if (speed < 1) {
    description = "无风";
    return description;
  } else if (speed <= 5) {
    description = "1级"; // 微风徐徐";
  } else if (speed <= 11) {
    description = "2级"; // 清风";
  } else if (speed <= 19) {
    description = "3级"; // 树叶摇摆";
  } else if (speed <= 28) {
    description = "4级"; // 树枝摇动";
  } else if (speed <= 38) {
    description = "5级"; // 风力强劲";
  } else if (speed <= 49) {
    description = "6级"; // 风力强劲";
  } else if (speed <= 61) {
    description = "7级"; // 风力超强";
  } else if (speed <= 74) {
    description = "8级"; // 狂风大作";
  } else if (speed <= 88) {
    description = "9级"; // 狂风呼啸";
  } else if (speed <= 102) {
    description = "10级"; // 暴风毁树";
  } else if (speed <= 117) {
    description = "11级"; // 暴风毁树";
  } else if (speed <= 133) {
    description = "12级"; // 飓风";
  } else if (speed <= 149) {
    description = "13级"; // 台风";
  } else if (speed <= 166) {
    description = "14级"; // 强台风";
  } else if (speed <= 183) {
    description = "15级"; // 强台风";
  } else if (speed <= 201) {
    description = "16级"; // 超强台风";
  } else if (speed <= 220) {
    description = "17级"; // 超强台风";
  }

  if (direction >= 348.76 || direction <= 11.25) {
    d_description = "北";
  } else if (direction >= 11.26 && direction <= 33.75) {
    d_description = "北东北";
  } else if (direction >= 33.76 && direction <= 56.25) {
    d_description = "东北";
  } else if (direction >= 56.26 && direction <= 78.75) {
    d_description = "东东北";
  } else if (direction >= 78.76 && direction <= 101.25) {
    d_description = "东";
  } else if (direction >= 101.26 && direction <= 123.75) {
    d_description = "东东南";
  } else if (direction >= 123.76 && direction <= 146.25) {
    d_description = "东南";
  } else if (direction >= 146.26 && direction <= 168.75) {
    d_description = "南东南";
  } else if (direction >= 168.76 && direction <= 191.25) {
    d_description = "南";
  } else if (direction >= 191.26 && direction <= 213.75) {
    d_description = "南西南";
  } else if (direction >= 213.76 && direction <= 236.25) {
    d_description = "西南";
  } else if (direction >= 236.26 && direction <= 258.75) {
    d_description = "西西南";
  } else if (direction >= 258.76 && direction <= 281.25) {
    d_description = "西";
  } else if (direction >= 281.26 && direction <= 303.75) {
    d_description = "西西北";
  } else if (direction >= 303.76 && direction <= 326.25) {
    d_description = "西北";
  } else if (direction >= 326.26 && direction <= 348.75) {
    d_description = "北西北";
  }

  return `${d_description}风 ${description}`;
}

// 天气状况 --> 自然语言描述
function mapSkycon(skycon) {
  const map = {
    CLEAR_DAY: ["☀️ 白天晴朗"],
    CLEAR_NIGHT: ["✨ 夜间晴朗"],
    PARTLY_CLOUDY_DAY: ["⛅️ 白天多云"],
    PARTLY_CLOUDY_NIGHT: ["☁️ 夜间多云"],
    CLOUDY: ["☁️ 阴"],
    LIGHT_HAZE: ["😤 轻度雾霾"],
    MODERATE_HAZE: ["😤 中度雾霾"],
    HEAVY_HAZE: ["😤 重度雾霾"],
    LIGHT_RAIN: ["💧 小雨"],
    MODERATE_RAIN: ["💦 中雨"],
    HEAVY_RAIN: ["🌧 大雨"],
    STORM_RAIN: ["⛈ 暴雨"],
    FOG: ["🌫️ 雾"],
    LIGHT_SNOW: ["🌨 小雪"],
    MODERATE_SNOW: ["❄️ 中雪"],
    HEAVY_SNOW: ["☃️ 大雪"],
    STORM_SNOW: ["⛄️暴雪"],
    DUST: ["💨 浮尘"],
    SAND: ["💨 沙尘"],
    WIND: ["🌪 大风"],
  };
  return map[skycon];
}

/************************** ERROR *********************************/
function MYERR() {
  class TokenError extends Error {
    constructor(message) {
      super(message);
      this.name = "TokenError";
    }
  }

  return {
    TokenError,
  };
}

// prettier-ignore
/*********************************** API *************************************/
function ENV() { const e = "undefined" != typeof $task, t = "undefined" != typeof $loon, s = "undefined" != typeof $httpClient && !t, i = "function" == typeof require && "undefined" != typeof $jsbox; return { isQX: e, isLoon: t, isSurge: s, isNode: "function" == typeof require && !i, isJSBox: i, isRequest: "undefined" != typeof $request, isScriptable: "undefined" != typeof importModule } } function HTTP(e = { baseURL: "" }) { const { isQX: t, isLoon: s, isSurge: i, isScriptable: n, isNode: o } = ENV(), r = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&\/\/=]*)/; const u = {}; return ["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS", "PATCH"].forEach(l => u[l.toLowerCase()] = (u => (function (u, l) { l = "string" == typeof l ? { url: l } : l; const h = e.baseURL; h && !r.test(l.url || "") && (l.url = h ? h + l.url : l.url); const a = (l = { ...e, ...l }).timeout, c = { onRequest: () => { }, onResponse: e => e, onTimeout: () => { }, ...l.events }; let f, d; if (c.onRequest(u, l), t) f = $task.fetch({ method: u, ...l }); else if (s || i || o) f = new Promise((e, t) => { (o ? require("request") : $httpClient)[u.toLowerCase()](l, (s, i, n) => { s ? t(s) : e({ statusCode: i.status || i.statusCode, headers: i.headers, body: n }) }) }); else if (n) { const e = new Request(l.url); e.method = u, e.headers = l.headers, e.body = l.body, f = new Promise((t, s) => { e.loadString().then(s => { t({ statusCode: e.response.statusCode, headers: e.response.headers, body: s }) }).catch(e => s(e)) }) } const p = a ? new Promise((e, t) => { d = setTimeout(() => (c.onTimeout(), t(`${u} URL: ${l.url} exceeds the timeout ${a} ms`)), a) }) : null; return (p ? Promise.race([p, f]).then(e => (clearTimeout(d), e)) : f).then(e => c.onResponse(e)) })(l, u))), u } function API(e = "untitled", t = !1) { const { isQX: s, isLoon: i, isSurge: n, isNode: o, isJSBox: r, isScriptable: u } = ENV(); return new class { constructor(e, t) { this.name = e, this.debug = t, this.http = HTTP(), this.env = ENV(), this.node = (() => { if (o) { return { fs: require("fs") } } return null })(), this.initCache(); Promise.prototype.delay = function (e) { return this.then(function (t) { return ((e, t) => new Promise(function (s) { setTimeout(s.bind(null, t), e) }))(e, t) }) } } initCache() { if (s && (this.cache = JSON.parse($prefs.valueForKey(this.name) || "{}")), (i || n) && (this.cache = JSON.parse($persistentStore.read(this.name) || "{}")), o) { let e = "root.json"; this.node.fs.existsSync(e) || this.node.fs.writeFileSync(e, JSON.stringify({}), { flag: "wx" }, e => console.log(e)), this.root = {}, e = `${this.name}.json`, this.node.fs.existsSync(e) ? this.cache = JSON.parse(this.node.fs.readFileSync(`${this.name}.json`)) : (this.node.fs.writeFileSync(e, JSON.stringify({}), { flag: "wx" }, e => console.log(e)), this.cache = {}) } } persistCache() { const e = JSON.stringify(this.cache, null, 2); s && $prefs.setValueForKey(e, this.name), (i || n) && $persistentStore.write(e, this.name), o && (this.node.fs.writeFileSync(`${this.name}.json`, e, { flag: "w" }, e => console.log(e)), this.node.fs.writeFileSync("root.json", JSON.stringify(this.root, null, 2), { flag: "w" }, e => console.log(e))) } write(e, t) { if (this.log(`SET ${t}`), -1 !== t.indexOf("#")) { if (t = t.substr(1), n || i) return $persistentStore.write(e, t); if (s) return $prefs.setValueForKey(e, t); o && (this.root[t] = e) } else this.cache[t] = e; this.persistCache() } read(e) { return this.log(`READ ${e}`), -1 === e.indexOf("#") ? this.cache[e] : (e = e.substr(1), n || i ? $persistentStore.read(e) : s ? $prefs.valueForKey(e) : o ? this.root[e] : void 0) } delete(e) { if (this.log(`DELETE ${e}`), -1 !== e.indexOf("#")) { if (e = e.substr(1), n || i) return $persistentStore.write(null, e); if (s) return $prefs.removeValueForKey(e); o && delete this.root[e] } else delete this.cache[e]; this.persistCache() } notify(e, t = "", l = "", h = {}) { const a = h["open-url"], c = h["media-url"]; if (s && $notify(e, t, l, h), n && $notification.post(e, t, l + `${c ? "\n多媒体:" + c : ""}`, { url: a }), i) { let s = {}; a && (s.openUrl = a), c && (s.mediaUrl = c), "{}" === JSON.stringify(s) ? $notification.post(e, t, l) : $notification.post(e, t, l, s) } if (o || u) { const s = l + (a ? `\n点击跳转: ${a}` : "") + (c ? `\n多媒体: ${c}` : ""); if (r) { require("push").schedule({ title: e, body: (t ? t + "\n" : "") + s }) } else console.log(`${e}\n${t}\n${s}\n\n`) } } log(e) { this.debug && console.log(`[${this.name}] LOG: ${this.stringify(e)}`) } info(e) { console.log(`[${this.name}] INFO: ${this.stringify(e)}`) } error(e) { console.log(`[${this.name}] ERROR: ${this.stringify(e)}`) } wait(e) { return new Promise(t => setTimeout(t, e)) } done(e = {}) { s || i || n ? $done(e) : o && !r && "undefined" != typeof $context && ($context.headers = e.headers, $context.statusCode = e.statusCode, $context.body = e.body) } stringify(e) { if ("string" == typeof e || e instanceof String) return e; try { return JSON.stringify(e, null, 2) } catch (e) { return "[object Object]" } } }(e, t) }
/*****************************************************************************/

//event network-changed script-path=proxy-auto-switch.js
//version: 1.0
//telegram: @docofcard

//根据SSID和MCC-MNC自动切换ProxyGroup
//请根据自己的需求和配置改动脚本内容
//将脚本放到surge文件夹内,然后在文本模式下将代码复制到[script]下
//TwitchSwitch = type=event,event-name=network-changed,script-path=proxy-auto-switch.js

//通知（可按照需要自己修改）
let TITLE = '自动切换规则!';
let SUBTITLE_CELLULAR = '蜂窝网络: ';
let SUBTITLE_WIFI = 'Wi-Fi: ';
let Proxy_UK = 'ProxyUK: ';
let Proxy_HK = 'ProxyHK: ';
let ABOUT_IP = 'IP: ';


//ssid 连接特定WiFi时切换规则（改为你自己的SSID）
let UKWiFi = [
            "UK_ssid1",
            "UK_ssid2"
    ];
let HKWiFi = [
            "HK_ssid1",
            "HK_ssid2"
    ];

//mcc-mnc 使用特定漫游SIM卡时切换规则（改为你自己的SIM卡MCCMNC, 查询https://cellidfinder.com/mcc-mnc）
let UKCarrier = [
            "234-33",
            "234-20",
            "234-91"
    ];
let HKCarrier = [
            "454-00",
            "454-07",
            "454-12",
            "454-14"
    ];

//自动切换规则，“”中的规则在需要切换的ProxyGroup中必须要有;
let Direct = "DIRECT";
let Reject = "REJECT";

//根据wifi-ssid切换规则;
let NETWORK = "";
if ($network.v4.primaryInterface == "en0") {
    NETWORK += SUBTITLE_WIFI + $network.wifi.ssid;
    ABOUT_IP += $network.v4.primaryAddress;
    if (UKWiFi.indexOf($network.wifi.ssid) != -1) {
        $surge.setSelectGroupPolicy('🇬🇧ProxyUK',Direct);
            $notification.post(TITLE, NETWORK, Proxy_UK + Direct + '\n' + ABOUT_IP);
        $surge.setSelectGroupPolicy('🇭🇰ProxyHK', Reject);
    } else if (HKWiFi.indexOf($network.wifi.ssid) != -1) {
        $surge.setSelectGroupPolicy('🇬🇧ProxyUK',Reject);
        $surge.setSelectGroupPolicy('🇭🇰ProxyHK', Direct);
            $notification.post(TITLE, NETWORK, Proxy_HK + Direct + '\n' + ABOUT_IP);
    } else {
        $surge.setSelectGroupPolicy('🇬🇧ProxyUK',Reject);
        $surge.setSelectGroupPolicy('🇭🇰ProxyHK', Reject);
            $notification.post(TITLE, NETWORK, Proxy_UK + Reject + '\n' + Proxy_HK + Reject + '\n' + ABOUT_IP);
    }

//根据mcc-mnc切换规则;
}else if ($network.v4.primaryInterface == "pdp_ip0") {
    NETWORK += SUBTITLE_CELLULAR + " " + $network['cellular-data'].radio;
    if (UKCarrier.indexOf($network['cellular-data'].carrier) != -1) {
        $surge.setSelectGroupPolicy('🇬🇧ProxyUK',Direct);
            $notification.post(TITLE, NETWORK, Proxy_UK + Direct + '\n' + ABOUT_IP);
        $surge.setSelectGroupPolicy('🇭🇰ProxyHK', Reject);
    } else if (HKCarrier.indexOf($network['cellular-data'].carrier) != -1) {
        $surge.setSelectGroupPolicy('🇬🇧ProxyUK',Reject);
        $surge.setSelectGroupPolicy('🇭🇰ProxyHK', Direct);
            $notification.post(TITLE, NETWORK, Proxy_HK + Direct + '\n' + ABOUT_IP);
    } else {
        $surge.setSelectGroupPolicy('🇬🇧ProxyUK',Reject);
        $surge.setSelectGroupPolicy('🇭🇰ProxyHK', Reject);
            $notification.post(TITLE, NETWORK, Proxy_UK + Reject + '\n' + Proxy_HK + Reject + '\n' + ABOUT_IP);
    }

}

$done();
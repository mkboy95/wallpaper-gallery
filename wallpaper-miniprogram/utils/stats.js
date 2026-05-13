var api = require("./api");

var _statsCache = {};
var _cacheTimestamp = 0;
var CACHE_DURATION = 10 * 60 * 1000;

function loadStats(series) {
  series = series || "mobile";
  var now = Date.now();

  if (_statsCache[series] && (now - _cacheTimestamp < CACHE_DURATION)) {
    return Promise.resolve(_statsCache[series]);
  }

  return api.getHotStats().then(function(hotStats) {
    var statsMap = {};
    if (Array.isArray(hotStats)) {
      for (var i = 0; i < hotStats.length; i++) {
        var stat = hotStats[i];
        statsMap[stat.image_id] = {
          views: stat.views || stat.total_views || 0,
          downloads: stat.downloads || stat.total_downloads || 0
        };
      }
    }
    _statsCache[series] = statsMap;
    _cacheTimestamp = now;
    return statsMap;
  }).catch(function() {
    return {};
  });
}

function getStatsForImage(imageId, series) {
  series = series || "mobile";
  if (_statsCache[series] && _statsCache[series][imageId]) {
    return _statsCache[series][imageId];
  }
  return null;
}

module.exports = {
  loadStats: loadStats,
  getStatsForImage: getStatsForImage
};

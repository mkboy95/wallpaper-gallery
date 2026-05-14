var wallpaperService = require("../../services/wallpaper");
var api = require("../../utils/api");

Page({
  data: {
    dateGroups: [],
    currentDate: "",
    wallpapers: [],
    currentPage: 1,
    totalPages: 1,
    pageSize: 28,
    loading: true
  },

  onLoad: function() {
    this.loadLatestWallpapers();
  },

  onShow: function() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
  },

  loadLatestWallpapers: function() {
    var that = this;
    that.setData({ loading: true, _phase1Wallpapers: [] });

    wallpaperService.fetchLatestWallpapers().then(function(wallpapers) {
      if (wallpapers && wallpapers.length > 0) {
        that.setData({ _phase1Wallpapers: wallpapers.slice() });
        that.groupByDate(wallpapers);
      }
      that.setData({ loading: false });
      that.loadCategoriesInBackground();
    }).catch(function() {
      that.setData({ loading: false });
      that.loadCategoriesInBackground();
    });
  },

  loadCategoriesInBackground: function() {
    var that = this;
    api.getCategoryNames().then(function(names) {
      if (!names || names.length === 0) return;

      var phase2Wallpapers = [];
      var loaded = 0;
      var total = names.length;

      for (var i = 0; i < names.length; i++) {
        (function(catName) {
          api.getWallpapers(catName).then(function(wps) {
            for (var w = 0; w < wps.length; w++) {
              phase2Wallpapers.push(wps[w]);
            }
            loaded++;
            if (loaded === total) {
              var phase1 = that.data._phase1Wallpapers || [];
              var merged = phase1.concat(phase2Wallpapers);
              that.groupByDate(merged);
            }
          }).catch(function() {
            loaded++;
            if (loaded === total) {
              var phase1 = that.data._phase1Wallpapers || [];
              var merged = phase1.concat(phase2Wallpapers);
              if (merged.length > 0) {
                that.groupByDate(merged);
              }
            }
          });
        })(names[i]);
      }
    });
  },

  groupByDate: function(allWallpapers) {
    var that = this;
    var processed = allWallpapers.map(wallpaperService.processWallpaper).filter(Boolean);

    var seen = {};
    var unique = [];
    for (var i = 0; i < processed.length; i++) {
      var key = processed[i].filename || processed[i].id || ("_" + i);
      if (!seen[key]) {
        seen[key] = true;
        unique.push(processed[i]);
      }
    }

    var dateGroups = {};
    for (var j = 0; j < unique.length; j++) {
      var wp = unique[j];
      var date = that.extractDateFromWallpaper(wp);
      if (!dateGroups[date]) {
        dateGroups[date] = [];
      }
      dateGroups[date].push(wp);
    }

    var groups = [];
    for (var k in dateGroups) {
      groups.push({
        date: k,
        wallpapers: dateGroups[k],
        count: dateGroups[k].length
      });
    }
    groups.sort(function(a, b) {
      return b.date.localeCompare(a.date);
    });

    that.setData({
      dateGroups: groups,
      loading: false
    });
  },

  extractDateFromWallpaper: function(wp) {
    if (wp.createdAt) {
      var d = wp.createdAt.split("T")[0];
      if (d) return d;
    }
    var fname = wp.filename || wp.id || "";
    var match = fname.match(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
    if (match) {
      return match[1] + "-" + match[2] + "-" + match[3];
    }
    if (wp.category) {
      return wp.category;
    }
    return "未知日期";
  },

  onDateTap: function(e) {
    var date = e.currentTarget.dataset.date;
    var groups = this.data.dateGroups;
    var wallpapers = [];
    for (var i = 0; i < groups.length; i++) {
      if (groups[i].date === date) {
        wallpapers = groups[i].wallpapers;
        break;
      }
    }
    getApp().globalData.dateWallpapers = wallpapers;
    wx.navigateTo({
      url: "/pages/date/date?date=" + encodeURIComponent(date)
    });
  },

  onImageError: function(e) {
    var wp = e.currentTarget.dataset.item;
    if (!wp) return;
    var groups = this.data.dateGroups;
    for (var g = 0; g < groups.length; g++) {
      var wps = groups[g].wallpapers;
      for (var w = 0; w < wps.length; w++) {
        if (wps[w].id === wp.id) {
          if (wps[w]._fallbackStep === undefined) {
            wps[w]._fallbackStep = 1;
            this.setData({ ["dateGroups[" + g + "].wallpapers[" + w + "].thumbnailUrl"]: wps[w].thumbnailCdnUrl || wps[w].thumbnailProxyUrl || "" });
          } else if (wps[w]._fallbackStep === 1) {
            wps[w]._fallbackStep = 2;
            this.setData({ ["dateGroups[" + g + "].wallpapers[" + w + "].thumbnailUrl"]: wps[w].thumbnailProxyUrl || "" });
          }
          return;
        }
      }
    }
  },

  onWallpaperTap: function(e) {
    var wallpaper = e.currentTarget.dataset.item;
    if (wallpaper && wallpaper.id) {
      getApp().globalData.currentWallpaper = {
        category: wallpaper.category || "", subcategory: wallpaper.subcategory || "",
        filename: wallpaper.filename || wallpaper.id || "", displayTitle: wallpaper.displayTitle || "",
        resolution: wallpaper.resolution || null, size: wallpaper.size || 0, format: wallpaper.format || "",
        path: wallpaper.path || "", thumbnailPath: wallpaper.thumbnailPath || "",
        previewPath: wallpaper.previewPath || "", cdnTag: wallpaper.cdnTag || "",
        urlbase: wallpaper.urlbase || "", isBing: !!(wallpaper.urlbase || wallpaper.isBing)
      };
      wx.navigateTo({
        url: "/pages/detail/detail?id=" + wallpaper.id + "&url=" + encodeURIComponent(wallpaper.url || wallpaper.thumbnailUrl || "") + "&preview=" + encodeURIComponent(wallpaper.previewUrl || wallpaper.thumbnailUrl || "")
      });
    }
  }
});

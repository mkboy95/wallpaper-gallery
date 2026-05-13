var wallpaperService = require("../../services/wallpaper");
var api = require("../../utils/api");

Page({
  data: {
    dateGroups: [],
    selectedDate: "",
    selectedWallpapers: [],
    loading: true,
    statusBarHeight: 44,
    navBarHeight: 44,
    menuButtonTop: 48,
    menuButtonHeight: 32
  },

  onLoad: function() {
    var that = this;
    wx.getDeviceInfo({
      success: function(res) {
        var statusBarHeight = res.statusBarHeight || 44;
        that.initNavBar(statusBarHeight);
      },
      fail: function() {
        that.initNavBar(44);
      }
    });
    that.loadAllWallpapers();
  },

  initNavBar: function(statusBarHeight) {
    var that = this;
    try {
      var menuButton = wx.getMenuButtonBoundingClientRect();
      var navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height;
      that.setData({
        statusBarHeight: statusBarHeight,
        navBarHeight: navBarHeight,
        menuButtonTop: menuButton.top,
        menuButtonHeight: menuButton.height
      });
    } catch (e) {
      that.setData({
        statusBarHeight: statusBarHeight,
        navBarHeight: 44,
        menuButtonTop: statusBarHeight + 6,
        menuButtonHeight: 32
      });
    }
  },

  goBack: function() {
    wx.navigateBack({
      delta: 1,
      fail: function() {
        wx.switchTab({ url: "/pages/index/index" });
      }
    });
  },

  loadAllWallpapers: function() {
    var that = this;
    that.setData({ loading: true });

    api.getLatestWallpapers().then(function(wallpapers) {
      if (!wallpapers || wallpapers.length === 0) {
        that.setData({ loading: false });
        return;
      }
      that.processAndGroup(wallpapers);
    }).catch(function() {
      that.setData({ loading: false });
    });
  },

  processAndGroup: function(allWallpapers) {
    var that = this;
    var processed = allWallpapers.map(wallpaperService.processWallpaper).filter(Boolean);

    var dateGroups = {};
    for (var i = 0; i < processed.length; i++) {
      var wp = processed[i];
      var date = that.extractDateFromWallpaper(wp);
      if (!dateGroups[date]) {
        dateGroups[date] = [];
      }
      dateGroups[date].push(wp);
    }

    var groups = [];
    for (var key in dateGroups) {
      groups.push({
        date: key,
        wallpapers: dateGroups[key],
        count: dateGroups[key].length
      });
    }
    groups.sort(function(a, b) {
      return b.date.localeCompare(a.date);
    });

    var selectedDate = groups.length > 0 ? groups[0].date : "";
    var selectedWallpapers = groups.length > 0 ? groups[0].wallpapers : [];

    that.setData({
      dateGroups: groups,
      selectedDate: selectedDate,
      selectedWallpapers: selectedWallpapers,
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
    var selectedWallpapers = [];
    for (var i = 0; i < groups.length; i++) {
      if (groups[i].date === date) {
        selectedWallpapers = groups[i].wallpapers;
        break;
      }
    }
    this.setData({
      selectedDate: date,
      selectedWallpapers: selectedWallpapers
    });
  },

  onImageError: function(e) {
    var wp = e.currentTarget.dataset.item;
    if (!wp) return;
    var wallpapers = this.data.selectedWallpapers;
    for (var w = 0; w < wallpapers.length; w++) {
      if (wallpapers[w].id === wp.id) {
        if (wallpapers[w]._fallbackStep === undefined) {
          wallpapers[w]._fallbackStep = 1;
          this.setData({ ["selectedWallpapers[" + w + "].thumbnailUrl"]: wallpapers[w].thumbnailCdnUrl || wallpapers[w].thumbnailProxyUrl || "" });
        } else if (wallpapers[w]._fallbackStep === 1) {
          wallpapers[w]._fallbackStep = 2;
          this.setData({ ["selectedWallpapers[" + w + "].thumbnailUrl"]: wallpapers[w].thumbnailProxyUrl || "" });
        }
        return;
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

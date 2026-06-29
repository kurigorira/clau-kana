// manifest と各科目の問題JSONを読み込む。読み込んだ内容はメモリにキャッシュする。
(function (global) {
  "use strict";

  var manifestCache = null;
  var subjectCache = {}; // subjectId -> data

  function fetchJSON(url) {
    return fetch(url, { cache: "no-cache" }).then(function (res) {
      if (!res.ok) throw new Error("読み込み失敗: " + url + " (" + res.status + ")");
      return res.json();
    });
  }

  function getManifest() {
    if (manifestCache) return Promise.resolve(manifestCache);
    return fetchJSON("data/manifest.json").then(function (m) {
      manifestCache = m;
      return m;
    });
  }

  function getSubject(subjectId) {
    if (subjectCache[subjectId]) return Promise.resolve(subjectCache[subjectId]);
    return getManifest().then(function (m) {
      var meta = (m.subjects || []).filter(function (s) {
        return s.id === subjectId;
      })[0];
      if (!meta) throw new Error("科目が見つかりません: " + subjectId);
      return fetchJSON(meta.file).then(function (data) {
        var merged = { meta: meta, decks: data.decks || [] };
        subjectCache[subjectId] = merged;
        return merged;
      });
    });
  }

  // 科目内の全カードを {card, deck} の配列で返す
  function allCards(subjectData) {
    var out = [];
    (subjectData.decks || []).forEach(function (deck) {
      (deck.cards || []).forEach(function (card) {
        out.push({ card: card, deck: deck });
      });
    });
    return out;
  }

  global.Data = {
    getManifest: getManifest,
    getSubject: getSubject,
    allCards: allCards
  };
})(window);

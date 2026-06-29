// localStorage を使った進捗・正誤の保存。ログイン不要。
// 保存キー: kana-quiz:v1
(function (global) {
  "use strict";

  var KEY = "kana-quiz:v1";

  function loadAll() {
    try {
      var raw = global.localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveAll(data) {
    try {
      global.localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      // 容量超過・プライベートモードなどは黙って無視
    }
  }

  // カード1枚の記録を返す（なければ初期値）
  function getCard(cardId) {
    var all = loadAll();
    return all[cardId] || { correct: 0, incorrect: 0, last: null };
  }

  // 採点結果を記録。correct: true/false
  function record(cardId, correct) {
    var all = loadAll();
    var c = all[cardId] || { correct: 0, incorrect: 0, last: null };
    if (correct) {
      c.correct += 1;
      c.last = "correct";
    } else {
      c.incorrect += 1;
      c.last = "incorrect";
    }
    all[cardId] = c;
    saveAll(all);
  }

  // 直近で「不正解」だったカードIDの集合を返す
  function wrongSet() {
    var all = loadAll();
    var set = {};
    Object.keys(all).forEach(function (id) {
      if (all[id] && all[id].last === "incorrect") set[id] = true;
    });
    return set;
  }

  // デッキ（カードID配列）の正答率などを集計
  function deckStats(cardIds) {
    var all = loadAll();
    var answered = 0;
    var correct = 0;
    var wrong = 0;
    cardIds.forEach(function (id) {
      var c = all[id];
      if (c && c.last) {
        answered += 1;
        if (c.last === "correct") correct += 1;
        else wrong += 1;
      }
    });
    return {
      total: cardIds.length,
      answered: answered,
      correct: correct,
      wrong: wrong,
      rate: answered ? Math.round((correct / answered) * 100) : null
    };
  }

  function resetAll() {
    try {
      global.localStorage.removeItem(KEY);
    } catch (e) {}
  }

  global.Storage = {
    getCard: getCard,
    record: record,
    wrongSet: wrongSet,
    deckStats: deckStats,
    resetAll: resetAll
  };
})(window);

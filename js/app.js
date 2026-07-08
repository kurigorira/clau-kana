// 画面描画・ハッシュルーティング・学習ロジック。
(function (global) {
  "use strict";

  var app = document.getElementById("app");
  var headerTitle = document.getElementById("header-title");

  // ---------- ユーティリティ ----------
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      if (k === "class") node.className = attrs[k];
      else if (k === "html") node.innerHTML = attrs[k];
      else if (k === "text") node.textContent = attrs[k];
      else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") {
        node.addEventListener(k.slice(2), attrs[k]);
      } else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      if (c == null) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  function clear() {
    app.innerHTML = "";
  }

  function shuffleArray(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function showError(msg) {
    clear();
    app.appendChild(el("div", { class: "card error" }, [
      el("p", { text: "エラー: " + msg }),
      el("a", { class: "btn", href: "#/" }, ["ホームに戻る"])
    ]));
  }

  function parseHash() {
    var raw = (location.hash || "#/").replace(/^#/, "");
    var qIndex = raw.indexOf("?");
    var path = qIndex >= 0 ? raw.slice(0, qIndex) : raw;
    var query = {};
    if (qIndex >= 0) {
      raw.slice(qIndex + 1).split("&").forEach(function (pair) {
        var kv = pair.split("=");
        query[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || "");
      });
    }
    var parts = path.split("/").filter(function (p) { return p !== ""; });
    return { parts: parts, query: query };
  }

  function imageNode(card) {
    if (!card.image) return null;
    return el("img", { class: "card-image", src: card.image, alt: "問題画像", loading: "lazy" });
  }

  // ---------- ビュー: ホーム（科目選択） ----------
  function viewHome() {
    headerTitle.textContent = "花奈の問題集";
    clear();
    Data.getManifest().then(function (m) {
      var grid = el("div", { class: "subject-grid" }, []);
      (m.subjects || []).forEach(function (s) {
        grid.appendChild(
          el("a", {
            class: "subject-card",
            href: "#/subject/" + s.id,
            style: "border-color:" + s.color
          }, [
            el("span", { class: "subject-emoji", text: s.emoji || "📚" }),
            el("span", { class: "subject-name", text: s.name })
          ])
        );
      });
      app.appendChild(el("p", { class: "lead", text: m.subtitle || "" }));
      app.appendChild(grid);
    }).catch(function (e) { showError(e.message); });
  }

  // ---------- ビュー: デッキ一覧 ----------
  function viewSubject(subjectId) {
    clear();
    Data.getSubject(subjectId).then(function (sub) {
      headerTitle.textContent = sub.meta.name;

      // 復習対象のカード数を集計
      var wrong = Storage.wrongSet();
      var allIds = Data.allCards(sub).map(function (x) { return x.card.id; });
      var wrongCount = allIds.filter(function (id) { return wrong[id]; }).length;

      app.appendChild(el("div", { class: "row-actions" }, [
        el("a", { class: "btn ghost", href: "#/" }, ["← ホーム"]),
        el("a", {
          class: "btn warn" + (wrongCount ? "" : " disabled"),
          href: wrongCount ? "#/review/" + subjectId : "#"
        }, ["🔁 間違えた問題を復習 (" + wrongCount + ")"]),
        el("a", { class: "btn ghost", href: "#/print/" + subjectId }, ["🖨 全問題を印刷"])
      ]));

      var list = el("div", { class: "deck-list" }, []);
      (sub.decks || []).forEach(function (deck) {
        var ids = (deck.cards || []).map(function (c) { return c.id; });
        var st = Storage.deckStats(ids);
        var badge = st.rate == null
          ? el("span", { class: "badge gray", text: "未学習" })
          : el("span", {
              class: "badge " + (st.rate >= 80 ? "green" : st.rate >= 50 ? "yellow" : "red"),
              text: "正答率 " + st.rate + "%"
            });

        list.appendChild(el("div", { class: "deck-card" }, [
          el("div", { class: "deck-head" }, [
            el("h3", { text: deck.title }),
            badge
          ]),
          el("p", { class: "deck-meta", text: ids.length + "問 ・ 学習済み " + st.answered + "問" }),
          el("div", { class: "deck-actions" }, [
            el("a", { class: "btn", href: "#/quiz/" + subjectId + "/" + deck.id + "?mode=test" }, ["📝 テスト"]),
            el("a", { class: "btn ghost", href: "#/quiz/" + subjectId + "/" + deck.id + "?mode=flash" }, ["🃏 暗記カード"]),
            el("a", { class: "btn ghost", href: "#/print/" + subjectId + "/" + deck.id }, ["🖨 印刷"])
          ])
        ]));
      });
      if (!(sub.decks || []).length) {
        list.appendChild(el("p", { class: "lead", text: "まだ問題が登録されていません。" }));
      }
      app.appendChild(list);
    }).catch(function (e) { showError(e.message); });
  }

  // ---------- クイズ・セッション ----------
  function startQuiz(opts) {
    // opts: { title, cards:[{card,deck}], mode, shuffle, subjectId }
    var cards = opts.shuffle ? shuffleArray(opts.cards) : opts.cards;
    var session = {
      title: opts.title,
      mode: opts.mode, // "test" | "flash"
      cards: cards,
      index: 0,
      revealed: false,
      correct: 0,
      wrong: 0,
      subjectId: opts.subjectId
    };
    renderQuizCard(session);
  }

  function renderQuizCard(session) {
    clear();
    headerTitle.textContent = session.title;

    if (session.index >= session.cards.length) {
      return renderResult(session);
    }

    var item = session.cards[session.index];
    var card = item.card;
    var total = session.cards.length;
    var pos = session.index + 1;

    // 進捗バー
    var progress = el("div", { class: "progress" }, [
      el("div", { class: "progress-bar", style: "width:" + Math.round((pos - 1) / total * 100) + "%" }, [])
    ]);

    var children = [
      progress,
      el("p", { class: "counter", text: pos + " / " + total + (session.mode === "test" ? " ・ テスト" : " ・ 暗記カード") }),
      el("div", { class: "qa-card" }, [
        el("span", { class: "qa-label", text: "問題" }),
        imageNode(card),
        el("p", { class: "qa-question", text: card.question })
      ])
    ];

    if (!session.revealed) {
      children.push(el("button", {
        class: "btn big",
        onclick: function () { session.revealed = true; renderQuizCard(session); }
      }, ["答えを見る"]));
    } else {
      var hasAnswer = card.answer && String(card.answer).trim() !== "";
      children.push(el("div", { class: "qa-answer" }, [
        el("span", { class: "qa-label", text: "答え" }),
        hasAnswer
          ? el("p", { class: "qa-answer-text", text: card.answer })
          : el("p", { class: "qa-answer-text muted", text: "（このカードにはPDFの解答が付いていません）" }),
        card.explanation ? el("p", { class: "qa-explanation", text: "💡 " + card.explanation }) : null
      ]));

      if (session.mode === "test") {
        children.push(el("p", { class: "grade-prompt", text: "自己採点してください" }));
        children.push(el("div", { class: "grade-actions" }, [
          el("button", {
            class: "btn ok",
            onclick: function () { gradeAndNext(session, true); }
          }, ["⭕ 正解"]),
          el("button", {
            class: "btn ng",
            onclick: function () { gradeAndNext(session, false); }
          }, ["❌ 不正解"])
        ]));
      } else {
        children.push(el("button", {
          class: "btn big",
          onclick: function () { session.index += 1; session.revealed = false; renderQuizCard(session); }
        }, [session.index + 1 >= total ? "終了する" : "次の問題 →"]));
      }
    }

    children.push(el("a", { class: "btn ghost small quit", href: "#/subject/" + session.subjectId }, ["やめる"]));
    app.appendChild(el("div", { class: "quiz-wrap" }, children));
  }

  function gradeAndNext(session, correct) {
    var card = session.cards[session.index].card;
    Storage.record(card.id, correct);
    if (correct) session.correct += 1; else session.wrong += 1;
    session.index += 1;
    session.revealed = false;
    renderQuizCard(session);
  }

  function renderResult(session) {
    clear();
    headerTitle.textContent = "結果";

    if (session.mode !== "test") {
      // 暗記モードは採点なし
      app.appendChild(el("div", { class: "result-card" }, [
        el("h2", { text: "おつかれさま！🌸" }),
        el("p", { class: "lead", text: session.cards.length + "問の暗記カードを確認しました。" }),
        el("div", { class: "row-actions center" }, [
          el("a", { class: "btn", href: "#/subject/" + session.subjectId }, ["デッキ一覧へ"]),
          el("button", { class: "btn ghost", onclick: function () {
            session.index = 0; session.revealed = false; renderQuizCard(session);
          } }, ["もう一度"])
        ])
      ]));
      return;
    }

    var total = session.correct + session.wrong;
    var rate = total ? Math.round((session.correct / total) * 100) : 0;
    var msg = rate >= 80 ? "すばらしい！🎉" : rate >= 50 ? "その調子！💪" : "復習でばっちりにしよう！📚";

    app.appendChild(el("div", { class: "result-card" }, [
      el("h2", { text: msg }),
      el("div", { class: "score-ring " + (rate >= 80 ? "green" : rate >= 50 ? "yellow" : "red") }, [
        el("span", { class: "score-rate", text: rate + "%" }),
        el("span", { class: "score-sub", text: "正答率" })
      ]),
      el("p", { class: "lead", text: "正解 " + session.correct + " / " + total + "問（不正解 " + session.wrong + "問）" }),
      el("div", { class: "row-actions center" }, [
        el("a", { class: "btn", href: "#/subject/" + session.subjectId }, ["デッキ一覧へ"]),
        session.wrong > 0
          ? el("a", { class: "btn warn", href: "#/review/" + session.subjectId }, ["🔁 間違えた問題を復習"])
          : null,
        el("button", { class: "btn ghost", onclick: function () {
          session.index = 0; session.revealed = false; session.correct = 0; session.wrong = 0;
          renderQuizCard(session);
        } }, ["もう一度"])
      ])
    ]));
  }

  // ---------- ビュー: クイズ起動 ----------
  function viewQuiz(subjectId, deckId, query) {
    Data.getSubject(subjectId).then(function (sub) {
      var deck = (sub.decks || []).filter(function (d) { return d.id === deckId; })[0];
      if (!deck) return showError("デッキが見つかりません: " + deckId);
      var cards = (deck.cards || []).map(function (c) { return { card: c, deck: deck }; });
      if (!cards.length) return showError("このデッキには問題がありません。");
      startQuiz({
        title: sub.meta.name + " ・ " + deck.title,
        cards: cards,
        mode: query.mode === "flash" ? "flash" : "test",
        shuffle: true,
        subjectId: subjectId
      });
    }).catch(function (e) { showError(e.message); });
  }

  // ---------- ビュー: 復習（科目内の不正解カード） ----------
  function viewReview(subjectId) {
    Data.getSubject(subjectId).then(function (sub) {
      var wrong = Storage.wrongSet();
      var cards = Data.allCards(sub).filter(function (x) { return wrong[x.card.id]; });
      if (!cards.length) {
        clear();
        headerTitle.textContent = "復習";
        app.appendChild(el("div", { class: "result-card" }, [
          el("h2", { text: "復習する問題はありません ✨" }),
          el("p", { class: "lead", text: "間違えた問題が出たら、ここに集まります。" }),
          el("a", { class: "btn", href: "#/subject/" + subjectId }, ["デッキ一覧へ"])
        ]));
        return;
      }
      startQuiz({
        title: sub.meta.name + " ・ 復習",
        cards: cards,
        mode: "test",
        shuffle: true,
        subjectId: subjectId
      });
    }).catch(function (e) { showError(e.message); });
  }

  // ---------- ビュー: 印刷（A4） ----------
  function viewPrint(subjectId, deckId, query) {
    clear();
    Data.getSubject(subjectId).then(function (sub) {
      headerTitle.textContent = sub.meta.name + " 印刷";
      var decks = deckId
        ? (sub.decks || []).filter(function (d) { return d.id === deckId; })
        : (sub.decks || []);
      if (!decks.length) return showError("印刷する問題が見つかりません。");

      var showAnswers = query.answers !== "0";
      var backHref = "#/subject/" + subjectId;
      var toggleHref = "#/print/" + subjectId + (deckId ? "/" + deckId : "") +
        "?answers=" + (showAnswers ? "0" : "1");

      // 画面のみ表示するツールバー（印刷時は隠す）
      var toolbar = el("div", { class: "no-print print-toolbar" }, [
        el("a", { class: "btn ghost", href: backHref }, ["← 戻る"]),
        el("button", { class: "btn", onclick: function () { window.print(); } }, ["🖨 印刷する"]),
        el("a", { class: "btn ghost", href: toggleHref }, [showAnswers ? "解答を隠す" : "解答を表示"]),
        el("span", { class: "print-hint", text: "※ 印刷ダイアログで用紙サイズ「A4」を選んでください" })
      ]);

      var today = new Date();
      var dateStr = today.getFullYear() + "年" + (today.getMonth() + 1) + "月" + today.getDate() + "日";

      var docNodes = [
        el("div", { class: "print-head" }, [
          el("h1", { class: "print-title", text: sub.meta.name + "　" + (deckId ? decks[0].title : "全問題") }),
          el("span", { class: "print-date", text: dateStr })
        ])
      ];

      // 問題
      var problemSection = el("section", { class: "print-section" }, []);
      decks.forEach(function (deck) {
        problemSection.appendChild(el("h2", { class: "print-deck", text: deck.title }));
        var ol = el("ol", { class: "print-list" }, []);
        (deck.cards || []).forEach(function (card) {
          ol.appendChild(el("li", { class: "print-item" }, [
            imageNode(card),
            el("span", { text: card.question })
          ]));
        });
        problemSection.appendChild(ol);
      });
      docNodes.push(problemSection);

      // 解答（PDFに解答があるものだけ。問題番号と揃うよう value を明示）
      function hasAns(card) { return card.answer && String(card.answer).trim() !== ""; }
      if (showAnswers) {
        var decksWithAns = decks.filter(function (deck) {
          return (deck.cards || []).some(hasAns);
        });
        if (decksWithAns.length) {
          var answerSection = el("section", { class: "print-section print-answers" }, [
            el("h1", { class: "print-title", text: "解答" })
          ]);
          decksWithAns.forEach(function (deck) {
            answerSection.appendChild(el("h2", { class: "print-deck", text: deck.title }));
            var ol = el("ol", { class: "print-list" }, []);
            (deck.cards || []).forEach(function (card, i) {
              if (!hasAns(card)) return;
              ol.appendChild(el("li", { class: "print-item", value: i + 1 }, [
                el("span", { class: "print-answer", text: card.answer }),
                card.explanation ? el("span", { class: "print-explanation", text: "　" + card.explanation }) : null
              ]));
            });
            answerSection.appendChild(ol);
          });
          docNodes.push(answerSection);
        }
      }

      app.appendChild(toolbar);
      app.appendChild(el("div", { class: "print-doc" }, docNodes));
    }).catch(function (e) { showError(e.message); });
  }

  // ---------- ルーター ----------
  function route() {
    var h = parseHash();
    var p = h.parts;
    window.scrollTo(0, 0);
    if (p.length === 0) return viewHome();
    if (p[0] === "subject" && p[1]) return viewSubject(p[1]);
    if (p[0] === "quiz" && p[1] && p[2]) return viewQuiz(p[1], p[2], h.query);
    if (p[0] === "review" && p[1]) return viewReview(p[1]);
    if (p[0] === "print" && p[1]) return viewPrint(p[1], p[2], h.query);
    return viewHome();
  }

  window.addEventListener("hashchange", route);
  window.addEventListener("DOMContentLoaded", function () {
    // 進捗リセットボタン
    var resetBtn = document.getElementById("reset-btn");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        if (confirm("学習の進捗（正答率・復習リスト）をすべて消去します。よろしいですか？")) {
          Storage.resetAll();
          route();
        }
      });
    }
    route();
  });
})(window);

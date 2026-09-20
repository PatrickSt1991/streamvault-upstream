/*
 * Flex gap for the Chromium WebViews before Chrome 84 (Samsung Tizen 3.0
 * through 6.0). Those engines ignore `gap` on a flex container, so every
 * gapped flex layout collapses onto itself. vite.config.ts inlines this file
 * into the tizen5 flavour's index.html; it is plain ES5 because it runs as
 * written, ahead of the transpiled bundle.
 *
 * How the two halves fit: the CSS pass in vite.config.ts renames every `gap`
 * to the `grid-gap` alias. Grid containers then space natively (Chrome 57+).
 * Flex containers still ignore it — but the engine COMPUTES the property for
 * every element regardless, so this script reads `grid-row-gap` and
 * `grid-column-gap` off each flex container's computed style and turns them
 * into margins on the children:
 *
 *   row:      every item after the first gets margin-left: <column-gap>
 *   column:   every item after the first gets margin-top:  <row-gap>
 *   reverse:  the same, on the opposite side
 *   wrap:     every item gets margin-right and margin-bottom (the last item
 *             of a line and the last line carry one extra gap — the price of
 *             not knowing where lines break)
 *
 * Because the decision is made per element from computed style, Tailwind's
 * atomic utilities (`flex flex-col gap-3 lg:flex-row lg:gap-4`) work without
 * the stylesheet knowing which classes meet on one element. A margin the
 * page set itself is preserved: the gap is added to it, and restored when
 * the container stops being a gapped flexbox. A MutationObserver re-applies
 * on every DOM change, so framework re-renders and class toggles are
 * covered; a resize re-applies everything for media-query flips.
 *
 * Positioned and display:none children take no part, as in real flex gap.
 * Percentage gaps are not resolved (Tailwind never emits one).
 */
(function () {
  'use strict';
  if (!window.MutationObserver || !window.getComputedStyle) return;

  // Feature test: two empty items in a column flexbox with gap:1px make the
  // box 1px tall wherever flex gap is supported. Then this script has no job.
  var probe = document.createElement('div');
  probe.style.cssText = 'display:flex;flex-direction:column;position:absolute;visibility:hidden';
  probe.style.gap = '1px';
  probe.appendChild(document.createElement('div'));
  probe.appendChild(document.createElement('div'));
  var host = document.body || document.documentElement;
  host.appendChild(probe);
  var supported = probe.scrollHeight === 1;
  host.removeChild(probe);
  if (supported) return;

  // Per child: { marginLeft: { orig: <inline value the page had>, set: <what we
  // wrote>, added: <px of gap in it> }, ... }. `set` lets us tell our own write
  // from an inline style the page put there itself afterwards.
  var MARK = '__tizenFlexGap';

  // The margin the page asked for on this side, from a class or its own inline
  // style, with any gap we added on an earlier pass taken back out.
  function pageMargin(kid, style, prop) {
    var m = kid[MARK] && kid[MARK][prop];
    var computed = parseFloat(style[prop]) || 0;
    if (m && kid.style[prop] === m.set) return computed - m.added;
    return computed;
  }

  function hasKeys(o) {
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) return true;
    return false;
  }

  // Read phase: decide every write for one container without touching the DOM,
  // so a batch of containers costs one style recalc, not one per child.
  function plan(el, out) {
    if (el.nodeType !== 1 || !el.firstElementChild) return;
    var cs = getComputedStyle(el);
    var display = cs.display;
    var flex = display === 'flex' || display === 'inline-flex';
    var rowGap = flex ? parseFloat(cs.gridRowGap) || 0 : 0;
    var colGap = flex ? parseFloat(cs.gridColumnGap) || 0 : 0;
    var direction = cs.flexDirection || 'row';
    var column = direction.indexOf('column') === 0;
    var reverse = direction.indexOf('reverse') > 0;
    var wrap = flex && cs.flexWrap && cs.flexWrap !== 'nowrap';
    var kids = el.children;
    var first = true;
    for (var i = 0; i < kids.length; i++) {
      var kid = kids[i];
      var want = {};
      if (rowGap || colGap) {
        var ks = getComputedStyle(kid);
        var outOfFlow = ks.display === 'none' || ks.position === 'absolute' || ks.position === 'fixed';
        if (!outOfFlow) {
          if (wrap) {
            if (colGap) want.marginRight = { total: pageMargin(kid, ks, 'marginRight') + colGap, added: colGap };
            if (rowGap) want.marginBottom = { total: pageMargin(kid, ks, 'marginBottom') + rowGap, added: rowGap };
          } else if (first) {
            first = false;
          } else if (column) {
            var vside = reverse ? 'marginBottom' : 'marginTop';
            if (rowGap) want[vside] = { total: pageMargin(kid, ks, vside) + rowGap, added: rowGap };
          } else {
            var hside = reverse ? 'marginRight' : 'marginLeft';
            if (colGap) want[hside] = { total: pageMargin(kid, ks, hside) + colGap, added: colGap };
          }
        }
      }
      if (kid[MARK] || hasKeys(want)) out.push({ kid: kid, want: want });
    }
  }

  // Write phase.
  function commit(items) {
    for (var i = 0; i < items.length; i++) {
      var kid = items[i].kid;
      var want = items[i].want;
      var marks = kid[MARK] || {};
      var prop;
      for (prop in marks) {
        if (!(prop in want)) {
          // No longer ours: give the page back what it had, unless the page
          // has since written its own inline value there.
          if (kid.style[prop] === marks[prop].set) kid.style[prop] = marks[prop].orig;
          delete marks[prop];
        }
      }
      for (prop in want) {
        var m = marks[prop];
        if (!m || kid.style[prop] !== m.set) {
          // First time, or the page wrote its own inline value since: that
          // is what to restore later.
          m = marks[prop] = { orig: kid.style[prop], set: null, added: 0 };
        }
        var value = want[prop].total + 'px';
        if (kid.style[prop] !== value) kid.style[prop] = value;
        m.set = kid.style[prop];
        m.added = want[prop].added;
      }
      kid[MARK] = hasKeys(marks) ? marks : null;
    }
  }

  var queued = 0;
  function mark(el, stamp, list) {
    if (el && el.nodeType === 1 && el.__tizenFlexGapStamp !== stamp) {
      el.__tizenFlexGapStamp = stamp;
      list.push(el);
    }
  }

  function run(elements) {
    var items = [];
    for (var i = 0; i < elements.length; i++) plan(elements[i], items);
    commit(items);
    observer.takeRecords(); // our own style writes: not a reason to run again
  }

  var observer = new MutationObserver(function (records) {
    var stamp = ++queued;
    var todo = [];
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      if (r.type === 'childList') {
        mark(r.target, stamp, todo);
        for (var j = 0; j < r.addedNodes.length; j++) {
          var n = r.addedNodes[j];
          if (n.nodeType !== 1) continue;
          mark(n, stamp, todo);
          var all = n.getElementsByTagName('*');
          for (var k = 0; k < all.length; k++) mark(all[k], stamp, todo);
        }
      } else {
        // A class or style change can alter this element's own display,
        // direction or gap, and whether it still counts among its siblings.
        mark(r.target, stamp, todo);
        mark(r.target.parentNode, stamp, todo);
      }
    }
    run(todo);
  });

  function everything() {
    var all = document.getElementsByTagName('*');
    var list = [];
    for (var i = 0; i < all.length; i++) list.push(all[i]);
    run(list);
  }

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style'],
  });
  window.addEventListener('resize', everything);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', everything);
  } else {
    everything();
  }
})();

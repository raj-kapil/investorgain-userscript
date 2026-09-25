// ==UserScript==
// @name         InvestorGain IPO GMP - Est. Profit Column
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Adds Est. Profit column after GMP and removes Rating, IPO Size, Updated ON, Anchor columns
// @author       You
// @license MIT
// @updateURL    https://raw.githubusercontent.com/raj-kapil/investorgain-userscript/main/investorgain-gmp.user.js
// @downloadURL  https://raw.githubusercontent.com/raj-kapil/investorgain-userscript/main/investorgain-gmp.user.js
// @match        https://www.investorgain.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    const CLASS_HEAD = '__tm_profit_h__';
    const CLASS_CELL = '__tm_profit_c__';
    const CLASS_HIDDEN = '__tm_hidden_col__';

    // Columns to remove (lowercase, partial match)
    const REMOVE_COLUMNS = ['rating', 'ipo size', 'updated on', 'anchor'];

    function getNum(s) {
        const m = String(s).match(/\d+(?:\.\d+)?/);
        return m ? parseFloat(m[0]) : NaN;
    }

    function removeColumns(table) {
        const rows = Array.from(table.querySelectorAll('tr'));
        if (rows.length < 2) return;

        const hRow = rows[0];
        const hCells = Array.from(hRow.children);

        // Find indices of columns to remove
        const removeIndices = [];
        hCells.forEach((c, i) => {
            const t = c.textContent.trim().toLowerCase();
            if (REMOVE_COLUMNS.some(col => t.includes(col))) {
                removeIndices.push(i);
            }
        });

        if (removeIndices.length === 0) return;

        // Remove cells from every row (headers + data)
        // Sort descending so removal indices don't shift
        const sorted = [...removeIndices].sort((a, b) => b - a);

        rows.forEach(row => {
            const cells = Array.from(row.children);
            sorted.forEach(idx => {
                if (cells[idx]) {
                    cells[idx].style.display = 'none';
                }
            });
        });
    }

    function addProfit() {
        const table = document.querySelector('table');
        if (!table) return false;

        // Remove unwanted columns first
        removeColumns(table);

        const rows = Array.from(table.querySelectorAll('tr'));
        if (rows.length < 2) return false;

        const hRow = rows[0];
        const hCells = Array.from(hRow.children);

        let gi = -1, li = -1;
        hCells.forEach((c, i) => {
            const t = c.textContent.trim().toLowerCase();
            if (gi < 0 && t.includes('gmp')) gi = i;
            if (li < 0 && t.includes('lot')) li = i;
        });

        if (gi < 0 || li < 0) return false;

        // Add/update header
        let hProfit = hRow.querySelector('.' + CLASS_HEAD);
        if (!hProfit) {
            const ref = hRow.children[gi];
            if (!ref) return false;

            hProfit = document.createElement('th');
            hProfit.className = CLASS_HEAD;
            hProfit.style.cssText = 'color: #16a34a; font-weight: bold; padding: 10px; text-align: center; border: 1px solid #ddd;';
            ref.parentNode.insertBefore(hProfit, ref.nextSibling);
        }

        hProfit.textContent = 'Est. Profit';

        // Add/update data cells
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const cells = Array.from(row.children);

            if (cells.length <= Math.max(gi, li)) continue;

            const gCell = cells[gi];
            const lCell = cells[li];

            if (!gCell || !lCell) continue;

            let pCell = row.querySelector('.' + CLASS_CELL);
            if (!pCell) {
                pCell = document.createElement('td');
                pCell.className = CLASS_CELL;
                pCell.style.cssText = 'color: #16a34a; font-weight: 600; padding: 10px; text-align: center; border: 1px solid #ddd; white-space: nowrap;';
                gCell.parentNode.insertBefore(pCell, gCell.nextSibling);
            }

            const g = getNum(gCell.textContent);
            const l = getNum(lCell.textContent);

            pCell.textContent = (!isNaN(g) && !isNaN(l) && g > 0)
                ? '₹' + Math.round(g * l).toLocaleString('en-IN')
                : '-';
        }

        return true;
    }

    // Initial run
    addProfit();

    // Retry loop (React takes time to hydrate)
    for (let i = 0; i < 15; i++) {
        setTimeout(addProfit, 300 + i * 200);
    }

    // Observe only the table, not the whole body
    const table = document.querySelector('table');
    if (table) {
        const observer = new MutationObserver(() => {
            clearTimeout(observer.debounceTimer);
            observer.debounceTimer = setTimeout(addProfit, 100);
        });

        observer.observe(table, {
            childList: true,
            subtree: true
        });
    }
})();

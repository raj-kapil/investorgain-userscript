// ==UserScript==
// @name         InvestorGain IPO GMP - Est. Profit Column
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Adds Total Price and Est. Profit columns to right of GMP; removes Rating, IPO Size, Updated ON, Anchor, Lot, Price; renames BOA DT to Allotment
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

    const CLASS_HEAD_PROFIT = '__tm_profit_h__';
    const CLASS_CELL_PROFIT = '__tm_profit_c__';
    const CLASS_HEAD_TOTAL  = '__tm_total_h__';
    const CLASS_CELL_TOTAL  = '__tm_total_c__';
    const CLASS_HIDE        = '__tm_hide__';
    const STYLE_ID          = '__tm_style__';

    const REMOVE_COLUMNS = ['rating', 'ipo size', 'updated on', 'anchor', 'lot', 'price'];
    const RENAME_COLUMNS = { 'boa dt': 'Allotment' };

    function getNum(s) {
        const m = String(s).match(/\d+(?:\.\d+)?/);
        return m ? parseFloat(m[0]) : NaN;
    }

    function injectStyle() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `.__tm_hide__ { display: none !important; }`;
        (document.head || document.documentElement).appendChild(style);
    }

    function hideColumnsByClass(table) {
        const rows = Array.from(table.querySelectorAll('tr'));
        if (rows.length < 2) return;

        const hRow = rows[0];
        const hCells = Array.from(hRow.children);

        const removeIndices = [];
        hCells.forEach((c, i) => {
            if (c.classList.contains(CLASS_HEAD_PROFIT) || c.classList.contains(CLASS_HEAD_TOTAL)) return;
            const t = c.textContent.trim().toLowerCase();
            if (REMOVE_COLUMNS.some(col => t.includes(col))) {
                removeIndices.push(i);
            }
        });

        if (removeIndices.length === 0) return;

        rows.forEach(row => {
            const cells = Array.from(row.children);
            removeIndices.forEach(idx => {
                if (cells[idx]) cells[idx].classList.add(CLASS_HIDE);
            });
        });
    }

    function renameColumns(table) {
        const hRow = table.querySelector('tr');
        if (!hRow) return;

        Array.from(hRow.children).forEach(cell => {
            if (cell.classList.contains(CLASS_HEAD_PROFIT) || cell.classList.contains(CLASS_HEAD_TOTAL)) return;
            const t = cell.textContent.trim().toLowerCase();
            for (const [match, newName] of Object.entries(RENAME_COLUMNS)) {
                if (t.includes(match)) {
                    if (cell.children.length === 0) {
                        cell.textContent = newName;
                    } else {
                        let updated = false;
                        cell.childNodes.forEach(node => {
                            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
                                node.textContent = newName;
                                updated = true;
                            }
                        });
                        if (!updated) cell.textContent = newName;
                    }
                    break;
                }
            }
        });
    }

    function addColumns() {
        const table = document.querySelector('table');
        if (!table) return false;

        hideColumnsByClass(table);
        renameColumns(table);

        const rows = Array.from(table.querySelectorAll('tr'));
        if (rows.length < 2) return false;

        const hRow = rows[0];
        const hCells = Array.from(hRow.children);

        // Find ORIGINAL header indices (skip our injected headers)
        let gi = -1, li = -1, pi = -1;
        hCells.forEach((c, i) => {
            if (c.classList.contains(CLASS_HEAD_PROFIT) || c.classList.contains(CLASS_HEAD_TOTAL)) return;
            const t = c.textContent.trim().toLowerCase();
            if (gi < 0 && t.includes('gmp'))  gi = i;
            if (li < 0 && t.includes('lot'))  li = i;
            if (pi < 0 && t.includes('price') && !t.includes('total')) pi = i;
        });

        if (gi < 0 || li < 0 || pi < 0) return false;

        const gmpHeader = hCells[gi];

        // ---- Total Price header: RIGHT of GMP (no custom style) ----
        let hTotal = hRow.querySelector('.' + CLASS_HEAD_TOTAL);
        if (!hTotal) {
            hTotal = document.createElement('th');
            hTotal.className = CLASS_HEAD_TOTAL;
            // Inherit table's native header styling — no inline styles
            gmpHeader.after(hTotal);
        }
        hTotal.textContent = 'Total Price';

        // ---- Est. Profit header: RIGHT of Total Price (no custom style) ----
        let hProfit = hRow.querySelector('.' + CLASS_HEAD_PROFIT);
        if (!hProfit) {
            hProfit = document.createElement('th');
            hProfit.className = CLASS_HEAD_PROFIT;
            // Inherit table's native header styling — no inline styles
            hTotal.after(hProfit);
        }
        hProfit.textContent = 'Est. Profit';

        // ---- Data cells ----
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const cells = Array.from(row.children);

            if (cells.length <= Math.max(gi, li, pi)) continue;

            const gCell = cells[gi];
            const lCell = cells[li];
            const pCell = cells[pi];

            if (!gCell || !lCell || !pCell) continue;

            const g = getNum(gCell.textContent);
            const l = getNum(lCell.textContent);
            const p = getNum(pCell.textContent);

            // Total Price cell → right of GMP (no custom style)
            let tCell = row.querySelector('.' + CLASS_CELL_TOTAL);
            if (!tCell) {
                tCell = document.createElement('td');
                tCell.className = CLASS_CELL_TOTAL;
                gCell.after(tCell);
            }
            tCell.textContent = (!isNaN(p) && !isNaN(l))
                ? '₹' + Math.round(p * l).toLocaleString('en-IN')
                : '-';

            // Est. Profit cell → right of Total Price (no custom style)
            let eCell = row.querySelector('.' + CLASS_CELL_PROFIT);
            if (!eCell) {
                eCell = document.createElement('td');
                eCell.className = CLASS_CELL_PROFIT;
                tCell.after(eCell);
            }
            eCell.textContent = (!isNaN(g) && !isNaN(l) && g > 0)
                ? '₹' + Math.round(g * l).toLocaleString('en-IN')
                : '-';
        }

        return true;
    }

    injectStyle();
    addColumns();
    for (let i = 0; i < 15; i++) {
        setTimeout(addColumns, 300 + i * 200);
    }

    const headObserver = new MutationObserver(() => {
        if (!document.getElementById(STYLE_ID)) injectStyle();
    });
    headObserver.observe(document.documentElement, { childList: true, subtree: true });

    const table = document.querySelector('table');
    if (table) {
        const observer = new MutationObserver(() => {
            clearTimeout(observer.debounceTimer);
            observer.debounceTimer = setTimeout(addColumns, 100);
        });
        observer.observe(table, { childList: true, subtree: true });
    }
})();

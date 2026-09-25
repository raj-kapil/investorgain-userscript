// ==UserScript==
// @name         InvestorGain IPO GMP - Est. Profit Column
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Adds Est. Profit and Total Price columns; removes Rating, IPO Size, Updated ON, Anchor, Lot, Price columns; renames BOA DT to Allotment
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

    // Columns to remove (lowercase, partial match)
    const REMOVE_COLUMNS = [
        'rating',
        'ipo size',
        'updated on',
        'anchor',
        'lot',
        'price'
    ];

    // Column renames: { match: 'new name' }
    const RENAME_COLUMNS = {
        'boa dt': 'Allotment'
    };

    function getNum(s) {
        const m = String(s).match(/\d+(?:\.\d+)?/);
        return m ? parseFloat(m[0]) : NaN;
    }

    function removeColumns(table) {
        const rows = Array.from(table.querySelectorAll('tr'));
        if (rows.length < 2) return;

        const hRow = rows[0];
        const hCells = Array.from(hRow.children);

        const removeIndices = [];
        hCells.forEach((c, i) => {
            const t = c.textContent.trim().toLowerCase();
            if (REMOVE_COLUMNS.some(col => t.includes(col))) {
                removeIndices.push(i);
            }
        });

        if (removeIndices.length === 0) return;

        const sorted = [...removeIndices].sort((a, b) => b - a);
        rows.forEach(row => {
            const cells = Array.from(row.children);
            sorted.forEach(idx => {
                if (cells[idx]) cells[idx].style.display = 'none';
            });
        });
    }

    function renameColumns(table) {
        const hRow = table.querySelector('tr');
        if (!hRow) return;

        Array.from(hRow.children).forEach(cell => {
            const t = cell.textContent.trim().toLowerCase();
            for (const [match, newName] of Object.entries(RENAME_COLUMNS)) {
                if (t.includes(match)) {
                    // Preserve inner HTML structure if present, else just set text
                    if (cell.children.length === 0) {
                        cell.textContent = newName;
                    } else {
                        // Update only text nodes to preserve any nested elements
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

        // 1. Remove unwanted columns
        removeColumns(table);

        // 2. Rename columns (BOA DT -> Allotment)
        renameColumns(table);

        const rows = Array.from(table.querySelectorAll('tr'));
        if (rows.length < 2) return false;

        const hRow = rows[0];
        const hCells = Array.from(hRow.children);

        // Find header indices
        let gi = -1, li = -1, pi = -1, ni = -1;
        hCells.forEach((c, i) => {
            const t = c.textContent.trim().toLowerCase();
            if (gi < 0 && t.includes('gmp'))  gi = i;
            if (li < 0 && t.includes('lot'))  li = i;
            if (pi < 0 && t.includes('price') && !t.includes('total')) pi = i;
            if (ni < 0 && t.includes('name')) ni = i;
        });

        // Need Name + Price + Lot to compute Total Price, GMP + Lot for Est. Profit
        if (ni < 0 || pi < 0 || li < 0 || gi < 0) return false;

        // ---- Add "Total Price" column right after Name ----
        let hTotal = hRow.querySelector('.' + CLASS_HEAD_TOTAL);
        if (!hTotal) {
            const ref = hRow.children[ni];
            if (!ref) return false;

            hTotal = document.createElement('th');
            hTotal.className = CLASS_HEAD_TOTAL;
            hTotal.style.cssText = 'color: #2563eb; font-weight: bold; padding: 10px; text-align: center; border: 1px solid #ddd;';
            ref.parentNode.insertBefore(hTotal, ref.nextSibling);
        }
        hTotal.textContent = 'Total Price';

        // ---- Add "Est. Profit" column right after GMP ----
        let hProfit = hRow.querySelector('.' + CLASS_HEAD_PROFIT);
        if (!hProfit) {
            const ref = hRow.children[gi];
            if (!ref) return false;

            hProfit = document.createElement('th');
            hProfit.className = CLASS_HEAD_PROFIT;
            hProfit.style.cssText = 'color: #16a34a; font-weight: bold; padding: 10px; text-align: center; border: 1px solid #ddd;';
            ref.parentNode.insertBefore(hProfit, ref.nextSibling);
        }
        hProfit.textContent = 'Est. Profit';

        // ---- Fill data cells ----
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const cells = Array.from(row.children);

            if (cells.length <= Math.max(gi, li, pi, ni)) continue;

            const gCell = cells[gi];
            const lCell = cells[li];
            const pCell = cells[pi];
            const nCell = cells[ni];

            if (!gCell || !lCell || !pCell || !nCell) continue;

            const g = getNum(gCell.textContent);
            const l = getNum(lCell.textContent);
            const p = getNum(pCell.textContent);

            // ---- Total Price cell (right of Name) ----
            let tCell = row.querySelector('.' + CLASS_CELL_TOTAL);
            if (!tCell) {
                tCell = document.createElement('td');
                tCell.className = CLASS_CELL_TOTAL;
                tCell.style.cssText = 'color: #2563eb; font-weight: 600; padding: 10px; text-align: center; border: 1px solid #ddd; white-space: nowrap;';
                nCell.parentNode.insertBefore(tCell, nCell.nextSibling);
            }
            tCell.textContent = (!isNaN(p) && !isNaN(l))
                ? '₹' + Math.round(p * l).toLocaleString('en-IN')
                : '-';

            // ---- Est. Profit cell (right of GMP) ----
            let eCell = row.querySelector('.' + CLASS_CELL_PROFIT);
            if (!eCell) {
                eCell = document.createElement('td');
                eCell.className = CLASS_CELL_PROFIT;
                eCell.style.cssText = 'color: #16a34a; font-weight: 600; padding: 10px; text-align: center; border: 1px solid #ddd; white-space: nowrap;';
                gCell.parentNode.insertBefore(eCell, gCell.nextSibling);
            }
            eCell.textContent = (!isNaN(g) && !isNaN(l) && g > 0)
                ? '₹' + Math.round(g * l).toLocaleString('en-IN')
                : '-';
        }

        return true;
    }

    // Initial run
    addColumns();

    // Retry loop (React takes time to hydrate)
    for (let i = 0; i < 15; i++) {
        setTimeout(addColumns, 300 + i * 200);
    }

    // Observe only the table
    const table = document.querySelector('table');
    if (table) {
        const observer = new MutationObserver(() => {
            clearTimeout(observer.debounceTimer);
            observer.debounceTimer = setTimeout(addColumns, 100);
        });

        observer.observe(table, {
            childList: true,
            subtree: true
        });
    }
})();

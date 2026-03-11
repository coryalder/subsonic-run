function addInterval() {
    const container = document.getElementById('intervals-container');
    const newRow = document.createElement('div');
    newRow.className = 'interval-row';
    newRow.style = 'display: grid; grid-template-columns: 2fr 2fr 40px; gap: 1rem; align-items: center; background: #f9f9f9; padding: 1rem; border-radius: 8px; border: 1px solid #eee;';
    newRow.innerHTML = `
        <div>
            <select name="types" style="width: 100%; padding: 0.6rem; border-radius: 6px; border: 1px solid #ddd;">
                <option value="warmup">Warmup</option>
                <option value="run">Run (Fast)</option>
                <option value="walk">Walk (Slow)</option>
                <option value="cooldown">Cooldown</option>
            </select>
        </div>
        <div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <input type="number" name="durations" placeholder="Seconds" required min="1"
                       style="width: 100%; padding: 0.6rem; border-radius: 6px; border: 1px solid #ddd;">
                <span style="font-size: 0.8rem; color: #666;">sec</span>
            </div>
        </div>
        <div style="text-align: right;">
            <button type="button" onclick="removeRow(this)" style="background: none; border: none; color: #e74c3c; font-size: 1.2rem; cursor: pointer;">&times;</button>
        </div>
    `;
    container.appendChild(newRow);
}

function removeRow(btn) {
    const rows = document.querySelectorAll('.interval-row');
    if (rows.length > 1) {
        btn.closest('.interval-row').remove();
    } else {
        alert('A program must have at least one interval.');
    }
}

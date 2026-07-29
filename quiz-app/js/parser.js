export async function fetchSubjects() {
    try {
        const response = await fetch('data/subjects.json');
        return await response.json();
    } catch (e) {
        console.error("Failed to fetch subjects:", e);
        return [];
    }
}

export async function fetchCSV(url) {
    try {
        const response = await fetch(url);
        const text = await response.text();
        return parseCSV(text);
    } catch (e) {
        console.error("Failed to fetch CSV:", e);
        return [];
    }
}

function parseCSV(text) {
    const lines = [];
    let currentLine = [];
    let currentCell = "";
    let inQuotes = false;
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        
        if (char === '"') {
            if (inQuotes && text[i+1] === '"') {
                currentCell += '"';
                i++; // Skip escaped quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            currentLine.push(currentCell.trim());
            currentCell = "";
        } else if (char === '\n' && !inQuotes) {
            currentLine.push(currentCell.trim());
            lines.push(currentLine);
            currentLine = [];
            currentCell = "";
        } else if (char === '\r') {
            // Ignore carriage returns
        } else {
            currentCell += char;
        }
    }
    
    if (currentCell || currentLine.length > 0) {
        currentLine.push(currentCell.trim());
        lines.push(currentLine);
    }

    if (lines.length < 2) return [];
    
    const headers = lines[0].map(h => h.toLowerCase());
    const questions = [];
    
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].length < headers.length || !lines[i][0]) continue;
        
        const row = lines[i];
        const qObj = {};
        
        headers.forEach((header, index) => {
            if (header === 'options') {
                qObj[header] = row[index] ? row[index].split('|').map(o => o.trim()) : [];
            } else {
                qObj[header] = row[index] || "";
            }
        });
        
        questions.push(qObj);
    }
    
    return questions;
}

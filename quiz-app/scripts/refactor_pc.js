const fs = require('fs');
const path = require('path');

const pcJsPath = path.join(__dirname, '../js/pc.js');
let content = fs.readFileSync(pcJsPath, 'utf8');

// 1. Update Global Variables
content = content.replace(
    /let currentQuestions = \[\];/,
    `let subjects = [];\n    let currentSubject = null;\n    let allSubjectsProgress = {};\n    let currentQuestions = [];`
);

// 2. Update saveProgress
content = content.replace(
    /function saveProgress\(\) \{[\s\S]*?localStorage\.setItem\('quiz_pc_progress', JSON\.stringify\(progress\)\);\n    \}/,
    `function saveProgress() {
        if (!currentSubject) return;
        const progress = currentQuestions.map(q => ({
            id: q.id,
            isFavorite: q.isFavorite,
            isNoted: q.isNoted,
            noteText: q.noteText,
            isSubmitted: q.isSubmitted,
            userAnswers: q.userAnswers,
            isCorrect: q.isCorrect
        }));
        localStorage.setItem('quiz_pc_progress_' + currentSubject.id, JSON.stringify(progress));
        
        // Update summary progress for dashboard
        allSubjectsProgress[currentSubject.id] = {
            total: currentQuestions.length,
            submitted: currentQuestions.filter(q => q.isSubmitted).length
        };
    }`
);

// 3. Update loadProgress
content = content.replace(
    /function loadProgress\(\) \{[\s\S]*?const saved = localStorage\.getItem\('quiz_pc_progress'\);/,
    `function loadProgress() {
        if (!currentSubject) return;
        const saved = localStorage.getItem('quiz_pc_progress_' + currentSubject.id);`
);

// 4. Data Loading - Replace fetch('data/ite302c.csv') and updateHome() logic
const dataLoadingReplacement = `
    // ---- Data Loading ----
    fetch('data/subjects.json')
        .then(res => res.json())
        .then(data => {
            subjects = data;
            
            // Check local storage for all subjects progress summary
            subjects.forEach(sub => {
                const saved = localStorage.getItem('quiz_pc_progress_' + sub.id);
                if (saved) {
                    try {
                        const parsed = JSON.parse(saved);
                        const submitted = parsed.filter(q => q.isSubmitted).length;
                        allSubjectsProgress[sub.id] = {
                            total: parsed.length,
                            submitted: submitted
                        };
                    } catch(e) {}
                }
            });
            
            renderSubjectsGrid();
            
            // Render dashboard stats for all subjects optionally, or keep it empty until clicked
        });
        
    function renderSubjectsGrid() {
        const grid = document.getElementById('subjects-grid');
        if (!grid) return;
        grid.innerHTML = '';
        
        subjects.forEach(sub => {
            const prog = allSubjectsProgress[sub.id] || { total: 0, submitted: 0 };
            const pct = prog.total === 0 ? 0 : Math.round((prog.submitted / prog.total) * 100);
            
            let status = prog.submitted === 0 ? "Not started" : (prog.submitted === prog.total ? "Completed" : "In Progress");
            let btnText = prog.submitted > 0 && prog.submitted < prog.total ? 'Continue <i class="fas fa-chevron-right ml-1"></i>' : 'Start <i class="fas fa-chevron-right ml-1"></i>';
            
            const card = document.createElement('div');
            card.className = 'jump-card glass-panel';
            card.innerHTML = \`
                <div class="jump-header">
                    <div class="jump-icon"><i class="\${sub.icon || 'fas fa-book'}"></i></div>
                    <span class="jump-badge">Mixed</span>
                </div>
                <h3>\${sub.id.toUpperCase()}</h3>
                <p>\${prog.total > 0 ? prog.total : '?'} questions • \${prog.total > 0 ? (prog.total - prog.submitted) : '?'} unanswered</p>
                <div class="progress-track">
                    <div class="progress-fill" style="width: \${pct}%"></div>
                </div>
                <div class="jump-footer" style="align-items: center; margin-top: 16px;">
                    <span>\${status}</span>
                    <div style="display:flex; gap:8px;">
                        <button class="btn-ghost btn-restart" data-id="\${sub.id}" style="padding: 4px 8px; font-size: 0.85rem;" title="Restart"><i class="fas fa-redo"></i></button>
                        <button class="btn-primary btn-start" data-id="\${sub.id}" style="padding: 4px 12px; font-size: 0.85rem;">\${btnText}</button>
                    </div>
                </div>
            \`;
            grid.appendChild(card);
        });
        
        // Add listeners
        document.querySelectorAll('.btn-start').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                loadSubject(id);
            });
        });
        
        document.querySelectorAll('.btn-restart').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                if(confirm("Are you sure you want to restart progress for this subject?")) {
                    localStorage.removeItem('quiz_pc_progress_' + id);
                    if (currentSubject && currentSubject.id === id) {
                        currentQuestions.forEach(q => {
                            q.isSubmitted = false;
                            q.isCorrect = undefined;
                            q.userAnswers = [];
                        });
                        saveProgress();
                    }
                    allSubjectsProgress[id] = { total: allSubjectsProgress[id]?.total || 0, submitted: 0 };
                    renderSubjectsGrid();
                }
            });
        });
    }
    
    function loadSubject(id) {
        currentSubject = subjects.find(s => s.id === id);
        if(!currentSubject) return;
        
        fetch('data/' + currentSubject.file)
            .then(res => res.text())
            .then(text => {
                currentQuestions = parseCSV(text);
                loadProgress();
                
                // Switch to practice view
                currentQuestionIndex = 0;
                switchView('practice-view');
                
                // Update specific views
                if (typeof updateDashboard === 'function') updateDashboard();
            });
    }
`;

content = content.replace(
    /\/\/ ---- Data Loading ----[\s\S]*?\.catch\(err => \{\s*console\.error\("CSV loading error:", err\);\s*\}\);/,
    dataLoadingReplacement
);

// 5. Update updateHome to just re-render grid
content = content.replace(
    /function updateHome\(\) \{[\s\S]*?resumeInfo\.style\.display = 'none';\s*\}\s*\}/,
    `function updateHome() {
        if(typeof renderSubjectsGrid === 'function') renderSubjectsGrid();
    }`
);

// 6. Fix any updateDashboard calls that might fail if currentSubject is null
// We don't really need to, updateDashboard checks if currentQuestions.length === 0

fs.writeFileSync(pcJsPath, content, 'utf8');
console.log('pc.js updated successfully.');

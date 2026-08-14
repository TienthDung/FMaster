document.addEventListener('DOMContentLoaded', () => {
    // ---- UI Navigation Logic ----
    const navItems = document.querySelectorAll('.nav-item[data-target]');
    const views = document.querySelectorAll('.view');

    let currentView = 'home-view';
    let isTransitioning = false;

    function switchView(viewId) {
        if (currentView === viewId || isTransitioning) return;
        isTransitioning = true;

        const currentViewEl = document.getElementById(currentView);
        const nextViewEl = document.getElementById(viewId);

        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.dataset.target === viewId) item.classList.add('active');
        });

        updateNavActiveBg();

        if (currentViewEl) {
            // Apply fade out animation inline
            currentViewEl.style.opacity = '0';
            currentViewEl.style.transform = 'scale(0.98) translateY(-10px)';
            currentViewEl.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';

            setTimeout(() => {
                currentViewEl.classList.remove('active');
                currentViewEl.style = ''; // clear inline styles

                nextViewEl.classList.add('active');
                currentView = viewId;

                executeViewLogic(viewId);

                setTimeout(() => { isTransitioning = false; }, 500);
            }, 300);
        } else {
            nextViewEl.classList.add('active');
            currentView = viewId;
            executeViewLogic(viewId);
            isTransitioning = false;
        }
    }

    function executeViewLogic(viewId) {
        if (viewId === 'home-view') {
            if (typeof renderSubjectsGrid === 'function') renderSubjectsGrid();
        }
        if (viewId === 'stats-view') updateDashboard();
        if (viewId === 'practice-view') {
            focusedOptionIndex = 0; // reset focus
            renderQuestion();
        }
        if (viewId === 'flashcard-view') {
            initFlashcards();
        }
        if (viewId === 'search-view') {
            initSearchView();
        }

        // Update all segmented controls to fix background positions after view is visible
        setTimeout(() => {
            if (typeof updateAllSegmentedControls === 'function') {
                updateAllSegmentedControls();
            }
        }, 50);
    }

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (item.dataset.target) switchView(item.dataset.target);
        });
    });

    function updateNavActiveBg() {
        const activeItem = document.querySelector('.nav-menu .nav-item.active[data-target]');
        const navBg = document.querySelector('.nav-active-bg');
        if (activeItem && navBg) {
            navBg.style.transform = `translateY(${activeItem.offsetTop}px)`;
            navBg.style.height = `${activeItem.offsetHeight}px`;
        }
    }

    // Initialize nav background position
    setTimeout(updateNavActiveBg, 50);
    window.addEventListener('resize', updateNavActiveBg);

    // ---- Application State ----
    let subjects = [];
    let currentSubject = null;
    let allSubjectsProgress = {};
    let currentQuestions = [];
    let currentQuestionIndex = 0;
    let focusedOptionIndex = 0;
    let currentSearchFilter = 'all';
    let currentSearchSubject = 'all';
    let currentSearchType = 'all';
    let globalQuestions = [];

    // Modal State
    let currentModalList = [];
    let currentModalIndex = 0;

    // ---- UI Utilities ----
    function showToast(message, type = 'warning') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        let iconHtml = '';
        if (type === 'warning') iconHtml = '<i class="fas fa-exclamation-triangle" style="color: #f59e0b; font-size: 1.2rem;"></i>';
        else if (type === 'info') iconHtml = '<i class="fas fa-info-circle" style="color: var(--primary); font-size: 1.2rem;"></i>';
        else if (type === 'correct') iconHtml = '<i class="fas fa-check-circle" style="color: var(--success); font-size: 1.4rem;"></i>';
        else if (type === 'incorrect') iconHtml = '<i class="fas fa-times-circle" style="color: var(--danger); font-size: 1.4rem;"></i>';

        toast.innerHTML = `
            ${iconHtml}
            <div style="font-size: 0.95rem; font-weight: 500;">${message}</div>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-hiding');
            setTimeout(() => {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300);
        }, 3000);
    }

    // ---- CSV Parsing ----
    function parseCSV(text) {
        const lines = text.split('\n');
        const result = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
            const parts = line.split(regex).map(p => p.replace(/^"|"$/g, '').trim());

            if (parts.length >= 5) {
                let opts = parts[3].split('|').map(o => o.trim().replace(/\\r|\\n/g, ''));
                let correctAnswers = parts[4].split('|').map(ans => ans.trim());
                let explanation = parts.length > 5 ? parts[5].replace(/""/g, '"') : '';

                result.push({
                    id: parts[0],
                    type: parts[1],
                    question: parts[2].replace(/""/g, '"'),
                    options: opts,
                    correctAnswers: correctAnswers,
                    explanation: explanation,
                    userAnswers: [],
                    isSubmitted: false,
                    isCorrect: null,
                    isFavorite: false,
                    isNoted: false,
                    originalIndex: result.length // Store index to jump to
                });
            }
        }
        return result;
    }

    // ---- Home View Logic ----
    // Help Modal Elements
    const helpModal = document.getElementById('help-modal');
    const btnHelp = document.getElementById('btn-help');
    const btnCloseHelpModal = document.getElementById('btn-close-help-modal');

    if (btnHelp && helpModal) {
        btnHelp.addEventListener('click', () => {
            helpModal.classList.add('active');
        });
    }

    if (btnCloseHelpModal && helpModal) {
        btnCloseHelpModal.addEventListener('click', () => {
            helpModal.classList.remove('active');
        });
    }

    // Reset Modal Elements
    const confirmResetModal = document.getElementById('confirm-reset-modal');
    const btnCancelReset = document.getElementById('btn-cancel-reset');
    const btnConfirmReset = document.getElementById('btn-confirm-reset');

    if (btnCancelReset) {
        btnCancelReset.addEventListener('click', () => {
            confirmResetModal.classList.remove('active');
        });
    }

    if (btnConfirmReset) {
        btnConfirmReset.addEventListener('click', () => {
            const targetId = btnConfirmReset.dataset.targetId;
            if (targetId) {
                localStorage.removeItem('quiz_pc_progress_' + targetId);
                if (currentSubject && currentSubject.id === targetId) {
                    currentQuestions.forEach(q => {
                        q.isSubmitted = false;
                        q.isCorrect = undefined;
                        q.userAnswers = [];
                        q.fcStatus = 'not_started';
                    });
                    saveProgress();
                }
                allSubjectsProgress[targetId] = { total: allSubjectsProgress[targetId]?.total || 0, submitted: 0, fcMastered: 0 };
                renderSubjectsGrid();
                delete btnConfirmReset.dataset.targetId;
            } else {
                currentQuestions.forEach(q => {
                    q.isSubmitted = false;
                    q.userAnswers = [];
                    q.isCorrect = undefined;
                });
                saveProgress();
                
                // Also update allSubjectsProgress
                if (currentSubject) {
                    allSubjectsProgress[currentSubject.id] = { total: currentQuestions.length, submitted: 0 };
                    renderSubjectsGrid();
                }
                
                updateDashboard();
                updateSearch();
                renderQuestion();
            }
            confirmResetModal.classList.remove('active');
        });
    }

    // ---- Practice Logic ----
    const btnFav = document.getElementById('btn-favorite');
    const btnNote = document.getElementById('btn-note');
    const optionsContainer = document.querySelector('.options-list');
    const btnSubmit = document.getElementById('btn-submit');
    const btnCarouselPrev = document.getElementById('btn-carousel-prev');
    const btnCarouselNext = document.getElementById('btn-carousel-next');

    function updatePracticeProgress() {
        if (currentQuestions.length === 0) return;
        
        let answered = 0;
        let correctCount = 0;
        let incorrectCount = 0;
        
        currentQuestions.forEach(q => {
            if (q.isSubmitted) {
                answered++;
                if (q.isCorrect) correctCount++;
                else incorrectCount++;
            }
        });
        
        const total = currentQuestions.length;
        const unansweredCount = total - answered;
        const progressPercent = total > 0 ? (answered / total) * 100 : 0;
        
        const fillEl = document.getElementById('practice-progress-fill');
        const textEl = document.getElementById('practice-progress-text');
        const unansEl = document.getElementById('practice-stat-unanswered');
        const corrEl = document.getElementById('practice-stat-correct');
        const incorrEl = document.getElementById('practice-stat-incorrect');
        
        if (fillEl) fillEl.style.width = `${progressPercent}%`;
        if (textEl) textEl.textContent = `${Math.round(progressPercent)}%`;
        if (unansEl) unansEl.textContent = unansweredCount;
        if (corrEl) corrEl.textContent = correctCount;
        if (incorrEl) incorrEl.textContent = incorrectCount;
    }

    function renderQuestion(direction = '') {
        if (currentQuestions.length === 0) return;
        
        updatePracticeProgress();
        const q = currentQuestions[currentQuestionIndex];

        const qCard = document.getElementById('question-card');
        if (qCard) {
            qCard.classList.remove('slide-in-left', 'slide-in-right');
            void qCard.offsetWidth; // trigger reflow
            if (direction === 'left') {
                qCard.classList.add('slide-in-left');
            } else if (direction === 'right') {
                qCard.classList.add('slide-in-right');
            }
        }

        document.querySelector('.question-indicator').textContent = `QUESTION ${currentQuestionIndex + 1} - ${q.type === 'multiple_choice' ? 'MULTIPLE CHOICE' : 'SINGLE CHOICE'}`;

        const qText = document.querySelector('.question-text');
        qText.textContent = `Question ${q.id}: ${q.question}`;

        if (btnFav) btnFav.style.color = q.isFavorite ? '#f59e0b' : 'var(--text-muted)';
        if (btnNote) btnNote.style.color = q.isNoted ? '#60a5fa' : 'var(--text-muted)';

        const noteContainer = document.getElementById('note-area-container');
        const noteTextarea = document.getElementById('question-note-textarea');
        if (noteContainer && noteTextarea) {
            if (q.isNoted) {
                noteContainer.style.display = 'block';
                noteTextarea.value = q.noteText || '';
            } else {
                noteContainer.style.display = 'none';
            }

            // Remove old listener to avoid duplicates
            const newTextarea = noteTextarea.cloneNode(true);
            noteTextarea.parentNode.replaceChild(newTextarea, noteTextarea);

            newTextarea.addEventListener('input', (e) => {
                q.noteText = e.target.value;
                saveProgress();
            });
        }

        if (!optionsContainer) return;
        optionsContainer.innerHTML = '';

        q.options.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            
            const letter = String.fromCharCode(65 + idx); // 0 -> A, 1 -> B
            btn.innerHTML = `
                <div class="option-indicator">${letter}</div>
                <div class="option-text">${opt}</div>
            `;

            if (idx === focusedOptionIndex && !q.isSubmitted) {
                btn.classList.add('focused');
            }

            const isSelected = q.userAnswers.includes(String(idx));
            if (isSelected) {
                btn.classList.add('selected');
            }

            if (q.isSubmitted) {
                btn.disabled = true;
                const isCorrectAns = q.correctAnswers.includes(String(idx));
                if (isCorrectAns) {
                    btn.classList.add('correct');
                } else if (isSelected && !isCorrectAns) {
                    btn.classList.add('incorrect');
                }
            } else {
                btn.onclick = () => toggleOption(idx);
            }

            optionsContainer.appendChild(btn);
        });

        // Explanation rendering
        const existingExplanation = document.getElementById('explanation-container');
        if (existingExplanation) {
            existingExplanation.remove();
        }
        
        if (q.isSubmitted && q.explanation) {
            const explanationDiv = document.createElement('div');
            explanationDiv.id = 'explanation-container';
            explanationDiv.style.marginTop = '20px';
            explanationDiv.style.padding = '16px';
            explanationDiv.style.background = 'rgba(255, 255, 255, 0.03)';
            explanationDiv.style.borderRadius = 'var(--radius-md)';
            explanationDiv.style.borderLeft = '4px solid var(--info)';
            explanationDiv.style.textAlign = 'left';
            explanationDiv.innerHTML = `<strong style="color: var(--info); font-size: 1.1rem; display: block; margin-bottom: 8px;">Explanation:</strong><div style="color: var(--text-light); line-height: 1.5; font-size: 1rem;">${q.explanation}</div>`;
            
            // Insert it after the optionsContainer
            optionsContainer.parentNode.insertBefore(explanationDiv, optionsContainer.nextSibling);
        }

        if (btnSubmit) {
            if (q.isSubmitted) {
                btnSubmit.style.display = 'none';
            } else {
                btnSubmit.style.display = 'inline-block';
                btnSubmit.textContent = "Submit";
                btnSubmit.disabled = false;
                btnSubmit.style.opacity = '1';
            }
        }

        if (btnCarouselPrev) {
            if (currentQuestionIndex === 0) {
                btnCarouselPrev.classList.add('disabled');
            } else {
                btnCarouselPrev.classList.remove('disabled');
            }
        }

        if (btnCarouselNext) {
            if (currentQuestionIndex === currentQuestions.length - 1) {
                btnCarouselNext.classList.add('disabled');
            } else {
                btnCarouselNext.classList.remove('disabled');
            }
        }
    }

    function toggleOption(idx) {
        const q = currentQuestions[currentQuestionIndex];
        if (q.isSubmitted) return;

        const idxStr = String(idx);
        if (q.type === 'single_choice') {
            q.userAnswers = [idxStr];
        } else {
            if (q.userAnswers.includes(idxStr)) {
                q.userAnswers = q.userAnswers.filter(ans => ans !== idxStr);
            } else {
                q.userAnswers.push(idxStr);
            }
        }
        focusedOptionIndex = idx;
        renderQuestion();
    }

    function submitAnswer() {
        const q = currentQuestions[currentQuestionIndex];
        if (q.isSubmitted) {
            return;
        }

        if (q.userAnswers.length === 0) {
            showToast("Please select an answer first.", "warning");
            return;
        }

        // Strict Validation for multiple choice
        if (q.type === 'multiple_choice' && q.userAnswers.length !== q.correctAnswers.length) {
            showToast(`This is a multiple choice question. Please select exactly ${q.correctAnswers.length} options.`, "warning");
            return;
        }

        q.isSubmitted = true;
        const isMatch = q.correctAnswers.length === q.userAnswers.length &&
            q.correctAnswers.every(val => q.userAnswers.includes(val));
        q.isCorrect = isMatch;
        saveProgress();
        renderQuestion();

        if (isMatch) {
            showToast("Awesome! That's correct.", "correct");
        } else {
            showToast("Oops! That's incorrect.", "incorrect");
        }
    }

    if (btnFav) {
        btnFav.addEventListener('click', () => {
            if (currentView !== 'practice-view' || currentQuestions.length === 0) return;
            const q = currentQuestions[currentQuestionIndex];
            q.isFavorite = !q.isFavorite;
            btnFav.style.color = q.isFavorite ? '#f59e0b' : 'var(--text-muted)';
            saveProgress();
        });
    }
    if (btnNote) {
        btnNote.addEventListener('click', () => {
            const q = currentQuestions[currentQuestionIndex];
            q.isNoted = !q.isNoted;
            btnNote.style.color = q.isNoted ? '#60a5fa' : 'var(--text-muted)';
            saveProgress();

            const noteContainer = document.getElementById('note-area-container');
            const noteTextarea = document.getElementById('question-note-textarea');
            if (noteContainer && noteTextarea) {
                if (q.isNoted) {
                    noteContainer.style.display = 'block';
                    noteTextarea.value = q.noteText || '';
                    noteTextarea.focus();
                } else {
                    noteContainer.style.display = 'none';
                }
            }
        });
    }

    if (btnSubmit) {
        btnSubmit.addEventListener('click', submitAnswer);
    }

    if (btnCarouselPrev) {
        btnCarouselPrev.addEventListener('click', () => {
            if (currentQuestionIndex > 0) {
                currentQuestionIndex--;
                focusedOptionIndex = 0;
                renderQuestion('left');
            } else {
                switchView('home-view');
            }
        });
    }

    if (btnCarouselNext) {
        btnCarouselNext.addEventListener('click', () => {
            if (currentQuestionIndex < currentQuestions.length - 1) {
                currentQuestionIndex++;
                focusedOptionIndex = 0;
                renderQuestion('right');
            } else {
                showToast("You have reached the end of the module.", "info");
                switchView('stats-view');
            }
        });
    }
    // ---- Quick Search in Practice ----
    const quickSearchContainer = document.querySelector('.practice-quick-search');
    const btnQuickSearch = document.getElementById('btn-quick-search');
    const inputQuickSearch = document.getElementById('quick-search-input');
    const dropdownQuickSearch = document.getElementById('quick-search-dropdown');

    if (btnQuickSearch && quickSearchContainer && inputQuickSearch) {
        btnQuickSearch.addEventListener('click', (e) => {
            e.stopPropagation();
            quickSearchContainer.classList.toggle('active');
            if (quickSearchContainer.classList.contains('active')) {
                inputQuickSearch.focus();
                renderQuickSearch(inputQuickSearch.value);
            } else {
                dropdownQuickSearch.classList.remove('active');
            }
        });

        inputQuickSearch.addEventListener('input', (e) => {
            renderQuickSearch(e.target.value);
        });

        inputQuickSearch.addEventListener('click', (e) => e.stopPropagation());
        dropdownQuickSearch.addEventListener('click', (e) => e.stopPropagation());

        document.addEventListener('click', () => {
            quickSearchContainer.classList.remove('active');
            dropdownQuickSearch.classList.remove('active');
        });
    }

    function renderQuickSearch(query) {
        if (!query.trim()) {
            dropdownQuickSearch.classList.remove('active');
            return;
        }

        const qLower = query.toLowerCase();
        let results = [];

        currentQuestions.forEach((q, idx) => {
            if ((q.id && q.id.toLowerCase().includes(qLower)) ||
                String(idx + 1).includes(qLower) ||
                q.question.toLowerCase().includes(qLower) ||
                q.options.some(opt => opt.toLowerCase().includes(qLower))) {
                results.push({ q, idx });
            }
        });

        dropdownQuickSearch.innerHTML = '';

        if (results.length === 0) {
            dropdownQuickSearch.innerHTML = '<div style="padding: 16px; color: var(--text-muted); text-align: center; font-size: 0.9rem;">No questions found</div>';
        } else {
            results.slice(0, 10).forEach(result => {
                const item = document.createElement('div');
                item.className = 'quick-search-item';

                item.innerHTML = `
                    <h5>Question ${result.idx + 1}</h5>
                    <p>${result.q.question}</p>
                `;

                item.addEventListener('click', () => {
                    currentQuestionIndex = result.idx;
                    focusedOptionIndex = 0;
                    renderQuestion();
                    quickSearchContainer.classList.remove('active');
                    dropdownQuickSearch.classList.remove('active');
                });

                dropdownQuickSearch.appendChild(item);
            });
        }
        dropdownQuickSearch.classList.add('active');
    }

    // ---- Keyboard Navigation ----
    document.addEventListener('keydown', (e) => {
        if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
            return; // Ignore shortcuts when typing in input or textarea
        }

        // Modal Navigation
        if (modal.classList.contains('active')) {
            switch (e.key) {
                case 'ArrowRight':
                    e.preventDefault();
                    if (currentModalIndex < currentModalList.length - 1) {
                        currentModalIndex++;
                        renderModalQuestion();
                    }
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    if (currentModalIndex > 0) {
                        currentModalIndex--;
                        renderModalQuestion();
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    modal.classList.remove('active');
                    break;
            }
            return; // Dừng xử lý các phím khác nếu Modal đang mở
        }

        if (currentView !== 'practice-view' || currentQuestions.length === 0) return;
        const q = currentQuestions[currentQuestionIndex];

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (!q.isSubmitted) {
                    focusedOptionIndex = (focusedOptionIndex + 1) % q.options.length;
                    renderQuestion();
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                if (!q.isSubmitted) {
                    focusedOptionIndex = (focusedOptionIndex - 1 + q.options.length) % q.options.length;
                    renderQuestion();
                }
                break;

            case 'Enter':
                e.preventDefault();
                if (!q.isSubmitted) {
                    toggleOption(focusedOptionIndex);
                }
                break;
            case ' ':
                e.preventDefault();
                if (q.isSubmitted) {
                    if (currentQuestionIndex < currentQuestions.length - 1) {
                        currentQuestionIndex++;
                        focusedOptionIndex = 0;
                        renderQuestion('right');
                    } else {
                        showToast("You have reached the end of the module.", "info");
                        switchView('stats-view');
                    }
                } else {
                    submitAnswer();
                }
                break;
            case 'Shift':
                e.preventDefault();
                if (!q.isSubmitted) {
                    q.isSubmitted = true;
                    q.isCorrect = false; // Reveal doesn't give a point
                    saveProgress();
                    renderQuestion();
                }
                break;
            case 'ArrowRight':
                e.preventDefault();
                if (currentQuestionIndex < currentQuestions.length - 1) {
                    currentQuestionIndex++;
                    focusedOptionIndex = 0;
                    renderQuestion();
                } else if (q.isSubmitted) {
                    switchView('stats-view');
                }
                break;
            case 'ArrowLeft':
                e.preventDefault();
                if (currentQuestionIndex > 0) {
                    currentQuestionIndex--;
                    focusedOptionIndex = 0;
                    renderQuestion();
                }
                break;
        }
    });

    // ---- Progress Storage ----
    function saveProgress() {
        if (!currentSubject) return;
        const progress = currentQuestions.map(q => ({
            id: q.id,
            isFavorite: q.isFavorite,
            isNoted: q.isNoted,
            noteText: q.noteText,
            isSubmitted: q.isSubmitted,
            userAnswers: q.userAnswers,
            isCorrect: q.isCorrect,
            fcStatus: q.fcStatus // added flashcard sync
        }));
        localStorage.setItem('quiz_pc_progress_' + currentSubject.id, JSON.stringify(progress));
        
        allSubjectsProgress[currentSubject.id] = {
            total: currentQuestions.length,
            submitted: currentQuestions.filter(q => q.isSubmitted).length,
            fcMastered: currentQuestions.filter(q => q.fcStatus === 'mastered').length
        };
    }

    function loadProgress() {
        if (!currentSubject) return;
        const saved = localStorage.getItem('quiz_pc_progress_' + currentSubject.id);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                parsed.forEach(p => {
                    const q = currentQuestions.find(item => item.id === p.id);
                    if (q) {
                        q.isFavorite = p.isFavorite;
                        q.isNoted = p.isNoted;
                        q.noteText = p.noteText;
                        q.isSubmitted = p.isSubmitted;
                        q.userAnswers = p.userAnswers || [];
                        q.isCorrect = p.isCorrect;
                        q.fcStatus = p.fcStatus || 'not_started';
                    }
                });
            } catch (e) { console.error('Failed to load progress', e); }
        }
    }

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
                        const fcMastered = parsed.filter(q => q.fcStatus === 'mastered').length;
                        allSubjectsProgress[sub.id] = {
                            total: parsed.length,
                            submitted: submitted,
                            fcMastered: fcMastered
                        };
                    } catch(e) {}
                }
            });
            
            renderSubjectsGrid();
        })
        .catch(err => {
            console.error("Subjects loading error:", err);
        });
        
    function renderSubjectsGrid() {
        const grid = document.getElementById('subjects-grid');
        if (!grid) return;
        grid.innerHTML = '';
        
        subjects.forEach(sub => {
            const prog = allSubjectsProgress[sub.id] || { total: 0, submitted: 0, fcMastered: 0 };
            const pct = prog.total === 0 ? 0 : Math.round((prog.submitted / prog.total) * 100);
            const fcPct = prog.total === 0 ? 0 : Math.round(((prog.fcMastered || 0) / prog.total) * 100);
            
            const card = document.createElement('div');
            card.className = 'jump-card glass-panel';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.innerHTML = `
                <div class="jump-header" style="margin-bottom: 8px;">
                    <div class="jump-icon"><i class="${sub.icon || 'fas fa-book'}"></i></div>
                    <span class="jump-badge">${prog.total} Qs</span>
                </div>
                <h3 style="margin-bottom: 12px;">${sub.id.toUpperCase()}</h3>
                
                <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 4px; display: flex; justify-content: space-between;">
                    <span>Practice: ${pct}%</span>
                    <span>${prog.submitted} done</span>
                </div>
                <div class="progress-track" style="margin-bottom: 12px;">
                    <div class="progress-fill" style="width: ${pct}%; background: linear-gradient(90deg, #00F2FE, #4FACFE);"></div>
                </div>

                <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 4px; display: flex; justify-content: space-between;">
                    <span>Flashcards: ${fcPct}%</span>
                    <span>${prog.fcMastered || 0} mastered</span>
                </div>
                <div class="progress-track" style="margin-bottom: 16px;">
                    <div class="progress-fill" style="width: ${fcPct}%; background: linear-gradient(90deg, #10b981, #34d399);"></div>
                </div>
                
                <div style="display:flex; gap:12px; margin-top: auto;">
                    <button class="apple-btn apple-btn-fc btn-start-fc" data-id="${sub.id}">
                        <i class="fas fa-layer-group"></i> Flashcards
                    </button>
                    <button class="apple-btn apple-btn-practice btn-start-practice" data-id="${sub.id}">
                        <i class="fas fa-dumbbell"></i> Practice
                    </button>
                    <button class="btn-ghost btn-restart" data-id="${sub.id}" style="padding: 10px 12px; font-size: 0.9rem; border-radius: 12px; background: rgba(255,255,255,0.05);" title="Restart All">
                        <i class="fas fa-redo"></i>
                    </button>
                </div>
            `;
            grid.appendChild(card);
        });
        
        // Add listeners
        // Make the whole card clickable for Practice
        document.querySelectorAll('.jump-card').forEach(card => {
            card.style.cursor = 'pointer';
            card.addEventListener('click', (e) => {
                const id = card.querySelector('.btn-start-practice').dataset.id;
                loadSubject(id, 'practice-view');
            });
        });

        document.querySelectorAll('.btn-start-practice').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = e.currentTarget.dataset.id;
                loadSubject(id, 'practice-view');
            });
        });

        document.querySelectorAll('.btn-start-fc').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = e.currentTarget.dataset.id;
                loadSubject(id, 'flashcard-view');
            });
        });
        
        document.querySelectorAll('.btn-restart').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = e.currentTarget.dataset.id;
                confirmResetModal.classList.add('active');
                btnConfirmReset.dataset.targetId = id;
            });
        });
    }
    
    function loadSubject(id, targetView = 'practice-view') {
        currentSubject = subjects.find(s => s.id === id);
        if(!currentSubject) return;
        
        fetch('data/' + currentSubject.file)
            .then(res => res.text())
            .then(text => {
                currentQuestions = parseCSV(text);
                loadProgress();
                
                // Switch to requested view
                currentQuestionIndex = 0;
                switchView(targetView);
                
                // Set the pill filter active subject name
                const activePill = document.querySelector('.filter-pills .pill.active');
                if (activePill) {
                    activePill.textContent = currentSubject.id.toUpperCase();
                }
                
                if (typeof updateDashboard === 'function') updateDashboard();
                if (typeof updateSearch === 'function') updateSearch();
            })
            .catch(err => {
                console.error("CSV loading error:", err);
            });
    }

    // ---- Dashboard Logic ----
    function updateDashboard() {
        if (currentQuestions.length === 0) return;

        const correct = currentQuestions.filter(q => q.isCorrect === true);
        const incorrect = currentQuestions.filter(q => q.isCorrect === false);
        const unanswered = currentQuestions.filter(q => !q.isSubmitted);
        const favorites = currentQuestions.filter(q => q.isFavorite === true);
        const notes = currentQuestions.filter(q => q.isNoted === true && q.noteText && q.noteText.trim() !== '');

        document.getElementById('stat-correct').textContent = correct.length;
        document.getElementById('stat-incorrect').textContent = incorrect.length;
        document.getElementById('stat-unanswered').textContent = unanswered.length;
        document.getElementById('stat-favorites').textContent = favorites.length;
        document.getElementById('stat-notes').textContent = notes.length;

        const chartContainer = document.getElementById('stats-chart');
        if (chartContainer) {
            chartContainer.innerHTML = '';

            const answeredCount = correct.length + incorrect.length;
            let acc = 0;
            if (answeredCount > 0) acc = Math.round((correct.length / answeredCount) * 100);

            const barGroup = document.createElement('div');
            barGroup.className = 'bar-group';
            barGroup.innerHTML = `
                <div class="bar bar-success" style="height: ${acc}%;"><span>${acc}%</span></div>
                <span class="bar-label">${currentSubject ? currentSubject.id.toUpperCase() : 'SUBJECT'}</span>
            `;
            chartContainer.appendChild(barGroup);
        }

        setupModalTrigger('correct', "Correct Answers", correct);
        setupModalTrigger('incorrect', "Incorrect Answers", incorrect);
        setupModalTrigger('unanswered', "Unanswered Questions", unanswered);
        setupModalTrigger('favorites', "Favorite Questions", favorites);
        setupModalTrigger('notes', "Noted Questions", notes);
    }

    // ---- Modal Logic ----
    const modal = document.getElementById('detail-modal');
    const btnCloseModal = document.getElementById('btn-close-modal');

    if (btnCloseModal) {
        btnCloseModal.addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }

    function showModal(title, list, startIndex = 0) {
        document.getElementById('modal-title').textContent = title;
        currentModalList = list;
        currentModalIndex = startIndex;

        renderModalQuestion();
        modal.classList.add('active');
    }

    function renderModalQuestion() {
        const listContainer = document.getElementById('modal-list');
        listContainer.innerHTML = '';

        if (currentModalList.length === 0) {
            listContainer.innerHTML = '<div style="text-align:center; padding: 40px; color:var(--text-muted);"><i class="fas fa-folder-open" style="font-size: 2rem; margin-bottom: 16px;"></i><p>No questions found in this category.</p></div>';
            return;
        }

        const q = currentModalList[currentModalIndex];

        // Header (Index & Type Badges)
        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.marginBottom = '20px';
        
        const badgeStyle = 'padding: 6px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;';
        
        const countBadge = document.createElement('span');
        countBadge.style.cssText = `${badgeStyle} background: rgba(255,255,255,0.1); color: var(--text-muted);`;
        countBadge.textContent = `Question ${currentModalIndex + 1} of ${currentModalList.length}`;
        
        const typeBadge = document.createElement('span');
        const isMulti = q.type === 'multiple_choice';
        typeBadge.style.cssText = `${badgeStyle} background: ${isMulti ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)'}; color: ${isMulti ? '#34d399' : '#60a5fa'}; border: 1px solid ${isMulti ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)'};`;
        typeBadge.innerHTML = `<i class="fas ${isMulti ? 'fa-check-square' : 'fa-dot-circle'}" style="margin-right: 6px;"></i>${isMulti ? 'Multiple Choice' : 'Single Choice'}`;
        
        header.appendChild(countBadge);
        header.appendChild(typeBadge);
        listContainer.appendChild(header);

        // Question Text
        const qText = document.createElement('h3');
        qText.style.fontSize = '1.25rem';
        qText.style.fontWeight = '500';
        qText.style.marginBottom = '24px';
        qText.style.lineHeight = '1.6';
        qText.textContent = `Question ${q.id}: ${q.question}`;
        listContainer.appendChild(qText);

        // Options
        const optionsList = document.createElement('div');
        optionsList.className = 'options-list';
        optionsList.style.display = 'flex';
        optionsList.style.flexDirection = 'column';
        optionsList.style.gap = '12px';

        q.options.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.style.textAlign = 'left';
            btn.style.padding = '14px 20px';
            btn.style.borderRadius = '12px';
            btn.style.border = '1px solid rgba(255, 255, 255, 0.1)';
            btn.style.background = 'rgba(255, 255, 255, 0.03)';
            btn.style.fontSize = '1rem';
            btn.style.cursor = 'default';
            
            const labelChar = String.fromCharCode(65 + idx);
            const labelSpan = document.createElement('span');
            labelSpan.textContent = `${labelChar}. `;
            labelSpan.style.fontWeight = '600';
            labelSpan.style.marginRight = '8px';
            labelSpan.style.opacity = '0.7';
            
            const textSpan = document.createElement('span');
            textSpan.textContent = opt;
            
            btn.appendChild(labelSpan);
            btn.appendChild(textSpan);
            
            const isSelected = q.userAnswers.includes(String(idx));
            const isCorrectAns = q.correctAnswers.includes(String(idx));

            if (isCorrectAns) {
                btn.style.background = 'rgba(16, 185, 129, 0.15)';
                btn.style.borderColor = 'rgba(16, 185, 129, 0.4)';
                btn.style.color = '#34d399';
                const icon = document.createElement('i');
                icon.className = 'fas fa-check-circle';
                icon.style.float = 'right';
                btn.appendChild(icon);
            } else if (isSelected && !isCorrectAns) {
                btn.style.background = 'rgba(239, 68, 68, 0.15)';
                btn.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                btn.style.color = '#f87171';
                const icon = document.createElement('i');
                icon.className = 'fas fa-times-circle';
                icon.style.float = 'right';
                btn.appendChild(icon);
            }

            optionsList.appendChild(btn);
        });

        listContainer.appendChild(optionsList);
        
        // Explanation
        if (q.explanation && q.explanation.trim() !== '') {
            const explBox = document.createElement('div');
            explBox.style.marginTop = '24px';
            explBox.style.padding = '16px 20px';
            explBox.style.background = 'rgba(16, 185, 129, 0.05)';
            explBox.style.border = '1px solid rgba(16, 185, 129, 0.2)';
            explBox.style.borderLeft = '4px solid #10b981';
            explBox.style.borderRadius = '12px';
            explBox.style.fontSize = '0.95rem';
            explBox.style.color = 'var(--text-main)';
            explBox.style.lineHeight = '1.6';
            explBox.innerHTML = `<div style="font-weight: 600; margin-bottom: 8px; color: #34d399;"><i class="fas fa-lightbulb" style="margin-right: 6px;"></i> Explanation</div>${q.explanation.replace(/\n/g, '<br>')}`;
            listContainer.appendChild(explBox);
        }

        if (q.isNoted && q.noteText) {
            const noteBox = document.createElement('div');
            noteBox.style.marginTop = '16px';
            noteBox.style.padding = '16px 20px';
            noteBox.style.background = 'rgba(96, 165, 250, 0.05)';
            noteBox.style.border = '1px solid rgba(96, 165, 250, 0.2)';
            noteBox.style.borderLeft = '4px solid #3b82f6';
            noteBox.style.borderRadius = '12px';
            noteBox.style.fontSize = '0.95rem';
            noteBox.style.color = '#bfdbfe';
            noteBox.style.lineHeight = '1.6';
            noteBox.innerHTML = `<div style="font-weight: 600; margin-bottom: 8px; color: #60a5fa;"><i class="fas fa-sticky-note" style="margin-right: 6px;"></i> Note</div>${q.noteText.replace(/\n/g, '<br>')}`;
            listContainer.appendChild(noteBox);
        }

        // Footer (Nav Buttons)
        const footerDiv = document.createElement('div');
        footerDiv.style.marginTop = '32px';
        footerDiv.style.paddingTop = '20px';
        footerDiv.style.borderTop = '1px solid rgba(255,255,255,0.08)';
        footerDiv.style.display = 'flex';
        footerDiv.style.justifyContent = 'space-between';
        footerDiv.style.alignItems = 'center';
        
        const btnPrev = document.createElement('button');
        btnPrev.className = 'btn-ghost';
        btnPrev.innerHTML = '<i class="fas fa-chevron-left" style="margin-right: 8px;"></i> Previous';
        btnPrev.style.padding = '10px 16px';
        btnPrev.style.borderRadius = '12px';
        btnPrev.disabled = currentModalIndex === 0;
        if(btnPrev.disabled) btnPrev.style.opacity = '0.3';
        else {
            btnPrev.onclick = () => { currentModalIndex--; renderModalQuestion(); };
        }
        
        const hint = document.createElement('span');
        hint.style.color = 'var(--text-muted)';
        hint.style.fontSize = '0.8rem';
        hint.innerHTML = '<i class="fas fa-keyboard" style="margin-right: 4px;"></i> Use Left/Right keys';
        
        const btnNext = document.createElement('button');
        btnNext.className = 'btn-primary';
        btnNext.innerHTML = 'Next <i class="fas fa-chevron-right" style="margin-left: 8px;"></i>';
        btnNext.style.padding = '10px 16px';
        btnNext.style.borderRadius = '12px';
        btnNext.disabled = currentModalIndex === currentModalList.length - 1;
        if(btnNext.disabled) btnNext.style.opacity = '0.3';
        else {
            btnNext.onclick = () => { currentModalIndex++; renderModalQuestion(); };
        }
        
        footerDiv.appendChild(btnPrev);
        footerDiv.appendChild(hint);
        footerDiv.appendChild(btnNext);
        listContainer.appendChild(footerDiv);
    }

    function setupModalTrigger(type, title, list) {
        const card = document.querySelector(`.stat-card[data-type="${type}"]`);
        if (!card) return;

        const newCard = card.cloneNode(true);
        card.parentNode.replaceChild(newCard, card);

        newCard.addEventListener('click', () => {
            showModal(title, list);
        });
    }

    // ---- Segmented Control Logic ----
    window.updateAllSegmentedControls = function () {
        const controls = document.querySelectorAll('.segmented-control');
        controls.forEach(control => {
            const active = control.querySelector('.pill.active');
            const bg = control.querySelector('.pill-active-bg');
            if (active && bg && active.offsetWidth > 0) {
                bg.style.width = active.offsetWidth + 'px';
                bg.style.transform = `translateX(${active.offsetLeft}px)`;
            }
        });
    };

    function initSegmentedControls() {
        const controls = document.querySelectorAll('.segmented-control');
        controls.forEach(control => {
            const pills = control.querySelectorAll('.pill');

            // Initial setup
            if (control.querySelector('.pill.active')) {
                setTimeout(() => window.updateAllSegmentedControls(), 50);
            }

            // Add click events
            pills.forEach(pill => {
                pill.addEventListener('click', (e) => {
                    const clickedPill = e.currentTarget;

                    // Remove active from all
                    pills.forEach(p => p.classList.remove('active'));
                    // Add to current
                    clickedPill.classList.add('active');
                    // Animate BG
                    window.updateAllSegmentedControls();

                    // Handle filter logic if needed (for Search View)
                    if (control.id === 'search-filter-pills') {
                        const filterVal = clickedPill.getAttribute('data-filter');
                        if (filterVal) {
                            currentSearchFilter = filterVal;
                            const searchInput = document.getElementById('search-input');
                            if (searchInput) searchInput.value = '';
                            updateSearch();
                        }
                    }
                });
            });
        });
    }

    // Window resize to fix pill bg size
    window.addEventListener('resize', () => {
        window.updateAllSegmentedControls();
    });

    // Initialize segmented controls
    initSegmentedControls();

    // =========================================
    // SETTINGS MODAL & THEME TOGGLE
    // =========================================
    const btnSettings = document.getElementById('btn-settings');
    const settingsModal = document.getElementById('settings-modal');
    const btnCloseSettings = document.getElementById('btn-close-settings');
    const themeToggle = document.getElementById('theme-toggle');

    if (btnSettings && settingsModal && btnCloseSettings) {
        btnSettings.addEventListener('click', () => {
            settingsModal.classList.add('active');
        });

        btnCloseSettings.addEventListener('click', () => {
            settingsModal.classList.remove('active');
        });
    }

    // Load theme from localStorage
    const currentTheme = localStorage.getItem('fmaster_theme');
    if (currentTheme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        if (themeToggle) themeToggle.checked = true;
    }

    if (themeToggle) {
        themeToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.documentElement.setAttribute('data-theme', 'light');
                localStorage.setItem('fmaster_theme', 'light');
            } else {
                document.documentElement.removeAttribute('data-theme');
                localStorage.setItem('fmaster_theme', 'dark');
            }
        });
    }

    // Init View
    switchView('home-view');

    // ==========================================
    // FLASHCARDS LOGIC
    // ==========================================
    let fcData = []; // Filtered list for flashcards
    let fcIndex = 0;
    
    const fcSearchInput = document.getElementById('fc-search-input');
    const fcQuickSearchContainer = document.getElementById('fc-quick-search-container');
    const btnFcQuickSearch = document.getElementById('btn-fc-quick-search');
    const dropdownFcSearch = document.getElementById('fc-search-dropdown');
    
    const fcCard = document.getElementById('fc-card');
    const fcFrontContent = document.getElementById('fc-front-content');
    const fcBackContent = document.getElementById('fc-back-content');
    const btnFcPrev = document.getElementById('btn-fc-prev');
    const btnFcNext = document.getElementById('btn-fc-next');
    const fcProgress = document.getElementById('fc-progress');

    const fcFrontOptions = document.getElementById('fc-front-options');
    const btnFcNoIdea = document.getElementById('btn-fc-no-idea');
    const btnFcMaster = document.getElementById('btn-fc-master');
    const fcStatMastered = document.getElementById('fc-stat-mastered');
    const fcStatLearning = document.getElementById('fc-stat-learning');
    const fcStatNew = document.getElementById('fc-stat-new');
    const fcProgressFill = document.getElementById('fc-progress-fill');

    function updateFcStats() {
        if (!currentQuestions || currentQuestions.length === 0) return;
        
        let mastered = 0;
        let learning = 0;
        let notStarted = 0;

        currentQuestions.forEach(q => {
            if (q.fcStatus === 'mastered') mastered++;
            else if (q.fcStatus === 'learning') learning++;
            else notStarted++;
        });

        if (fcStatMastered) fcStatMastered.textContent = `Mastered: ${mastered}`;
        if (fcStatLearning) fcStatLearning.textContent = `In Progress: ${learning}`;
        if (fcStatNew) fcStatNew.textContent = `Not Started: ${notStarted}`;

        const total = currentQuestions.length;
        const percent = Math.round(((mastered + (learning * 0.5)) / total) * 100);
        if (fcProgressFill) fcProgressFill.style.width = `${percent}%`;
        
        saveProgress();
    }

    function initFlashcards() {
        if (typeof currentQuestions !== 'undefined' && currentQuestions.length > 0) {
            fcData = [...currentQuestions];
            fcIndex = 0;
            updateFcStats();
            renderFlashcard(fcIndex, null);
        }
    }

    function renderFlashcard(index, direction = null) {
        if (fcData.length === 0) {
            if(fcFrontContent) fcFrontContent.textContent = "No flashcards found.";
            if(fcFrontOptions) fcFrontOptions.innerHTML = "";
            if(fcBackContent) fcBackContent.textContent = "";
            if(fcProgress) fcProgress.textContent = "0 / 0";
            return;
        }

        const q = fcData[index];
        
        // Render Question
        if(fcFrontContent) {
            fcFrontContent.style.textAlign = 'left';
            fcFrontContent.innerHTML = `<span style="color: #ffffff; font-size: 1.3rem;">Question ${q.id}: ${q.question}</span>`;
        }
        
        // Render Options
        if(fcFrontOptions) {
            fcFrontOptions.innerHTML = "";
            if (q.options && q.options.length > 0) {
                const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
                q.options.forEach((opt, i) => {
                    if (opt.trim() === '') return;
                    const div = document.createElement('div');
                    div.className = 'fc-option-item';
                    div.innerHTML = `<strong>${labels[i] || '-'}.</strong> ${opt}`;
                    fcFrontOptions.appendChild(div);
                });
            }
        }

        // Render Answer
        if(fcBackContent) {
            const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
            const correctTexts = q.correctAnswers.map(idx => {
                const optIdx = parseInt(idx);
                return `<div style="margin-bottom: 8px;"><strong>${labels[optIdx] || '-'}.</strong> ${q.options[optIdx]}</div>`;
            }).join('');
            
            let expHtml = '';
            if (q.explanation) {
                expHtml = `
                    <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.15); margin: 20px 0;">
                    <div style="text-align: left;">
                        <span style="font-size: 1.1rem; color: #ffffff; line-height: 1.6;">${q.explanation}</span>
                    </div>
                `;
            }
            
            fcBackContent.innerHTML = `
                <div style="text-align: left; width: 100%;">
                    <div style="font-size: 1.1rem; color: var(--text-muted); margin-bottom: 12px;">Correct Answer:</div>
                    <div style="font-size: 1.2rem; font-weight: 500; color: #ffffff;">
                        ${correctTexts}
                    </div>
                </div>
                ${expHtml}
            `;
        }
        
        if(fcProgress) fcProgress.textContent = `${index + 1} / ${fcData.length}`;

        if(fcCard) {
            // Temporarily disable transition to snap back instantly without glitch
            fcCard.style.transition = 'none';
            fcCard.classList.remove('is-flipped');
            void fcCard.offsetWidth; // Force reflow
            fcCard.style.transition = ''; // Restore transition
        }

        // Apply slide animation if direction is provided
        if (direction && fcCard) {
            fcCard.classList.remove('slide-out-left', 'slide-out-right', 'slide-in-left', 'slide-in-right');
            
            // Force reflow to restart animation
            void fcCard.offsetWidth;

            if (direction === 'next') {
                fcCard.classList.add('slide-in-right');
            } else if (direction === 'prev') {
                fcCard.classList.add('slide-in-left');
            }
            
            setTimeout(() => {
                fcCard.classList.remove('slide-in-right', 'slide-in-left');
            }, 300);
        }
    }

    // Toggle Flip
    if (fcCard) {
        fcCard.addEventListener('click', (e) => {
            // Prevent flip if clicking on actions
            if (e.target.closest('.fc-actions')) return;
            if (fcData.length === 0) return;
            fcCard.classList.toggle('is-flipped');
        });
    }

    // Action Buttons
    if (btnFcNoIdea) {
        btnFcNoIdea.addEventListener('click', (e) => {
            e.stopPropagation();
            if (fcData.length === 0) return;
            const q = fcData[fcIndex];
            q.fcStatus = 'learning';
            updateFcStats();
            
            // Advance to next card
            btnFcNext.click();
        });
    }

    if (btnFcMaster) {
        btnFcMaster.addEventListener('click', (e) => {
            e.stopPropagation();
            if (fcData.length === 0) return;
            const q = fcData[fcIndex];
            q.fcStatus = 'mastered';
            updateFcStats();
            
            // Advance to next card
            btnFcNext.click();
        });
    }

    // Prev Button
    if (btnFcPrev) {
        btnFcPrev.addEventListener('click', (e) => {
            e.stopPropagation();
            if (fcData.length === 0) return;
            fcIndex = (fcIndex - 1 + fcData.length) % fcData.length;
            renderFlashcard(fcIndex, 'prev');
        });
    }

    // Next Button
    if (btnFcNext) {
        btnFcNext.addEventListener('click', (e) => {
            e.stopPropagation();
            if (fcData.length === 0) return;
            fcIndex = (fcIndex + 1) % fcData.length;
            renderFlashcard(fcIndex, 'next');
        });
    }

    // Search Logic
    function renderFcSearch(query) {
        if (!query.trim()) {
            dropdownFcSearch.classList.remove('active');
            return;
        }

        const qLower = query.toLowerCase();
        let results = [];

        fcData.forEach((q, idx) => {
            if ((q.id && q.id.toLowerCase().includes(qLower)) ||
                String(idx + 1).includes(qLower) ||
                q.question.toLowerCase().includes(qLower) ||
                (q.options && q.options.some(opt => opt.toLowerCase().includes(qLower))) ||
                (q.explanation && q.explanation.toLowerCase().includes(qLower))) {
                results.push({ q, idx });
            }
        });

        dropdownFcSearch.innerHTML = '';

        if (results.length === 0) {
            dropdownFcSearch.innerHTML = '<div style="padding: 16px; color: var(--text-muted); text-align: center; font-size: 0.9rem;">No flashcards found</div>';
        } else {
            results.slice(0, 10).forEach(result => {
                const item = document.createElement('div');
                item.className = 'quick-search-item';

                item.innerHTML = `
                    <h5>Question ${result.idx + 1}</h5>
                    <p>${result.q.question}</p>
                `;

                item.addEventListener('click', () => {
                    fcIndex = result.idx;
                    renderFlashcard(fcIndex, null);
                    fcQuickSearchContainer.classList.remove('active');
                    dropdownFcSearch.classList.remove('active');
                });

                dropdownFcSearch.appendChild(item);
            });
        }

        dropdownFcSearch.classList.add('active');
    }

    if (fcSearchInput && btnFcQuickSearch && fcQuickSearchContainer && dropdownFcSearch) {
        btnFcQuickSearch.addEventListener('click', (e) => {
            e.stopPropagation();
            fcQuickSearchContainer.classList.toggle('active');
            if (fcQuickSearchContainer.classList.contains('active')) {
                fcSearchInput.focus();
                renderFcSearch(fcSearchInput.value);
            } else {
                dropdownFcSearch.classList.remove('active');
            }
        });

        fcSearchInput.addEventListener('click', (e) => e.stopPropagation());
        dropdownFcSearch.addEventListener('click', (e) => e.stopPropagation());

        document.addEventListener('click', () => {
            fcQuickSearchContainer.classList.remove('active');
            dropdownFcSearch.classList.remove('active');
        });

        fcSearchInput.addEventListener('input', (e) => {
            renderFcSearch(e.target.value);
        });
    }

    // Keyboard controls for Flashcard (only when view is active)
    document.addEventListener('keydown', (e) => {
        const flashcardView = document.getElementById('flashcard-view');
        if(!flashcardView) return;
        const isFlashcardView = flashcardView.classList.contains('active');
        if (!isFlashcardView) return;
        
        // Don't trigger if user is typing in search box
        if (document.activeElement === fcSearchInput) return;

        if (e.key === 'ArrowRight') {
            e.preventDefault();
            if(btnFcNext) btnFcNext.click();
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if(btnFcPrev) btnFcPrev.click();
        } else if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            if (fcData.length > 0 && fcCard) {
                fcCard.classList.toggle('is-flipped');
            }
        }
    });

    // ==========================================
    // MAIN SEARCH / EXPLORER LOGIC
    // ==========================================
    const searchViewTitle = document.getElementById('search-view-title');
    const searchInput = document.getElementById('search-input');
    const btnMainSearch = document.getElementById('btn-main-search');
    const searchFilterPills = document.querySelectorAll('#search-filter-pills .pill');
    const searchResultsList = document.getElementById('search-results-list');
    
    // NOTE: currentSearchFilter is already declared at the top of the file

    function initSearchView() {
        if (searchViewTitle) searchViewTitle.innerHTML = 'Global Question Explorer';
        
        // Dynamically populate subject dropdown if not done yet
        const subjectSelect = document.getElementById('search-subject-select');
        if (subjectSelect && subjectSelect.children.length <= 1) {
            subjects.forEach(sub => {
                const opt = document.createElement('option');
                opt.value = sub.id;
                opt.textContent = sub.id.toUpperCase();
                opt.style.background = 'var(--bg-color)';
                opt.style.color = 'var(--text-main)';
                subjectSelect.appendChild(opt);
            });
            
            // Bind change event to the select
            subjectSelect.addEventListener('change', (e) => {
                currentSearchSubject = e.target.value;
                
                const searchInput = document.getElementById('search-input');
                if (searchInput) searchInput.value = '';
                renderMainSearch();
            });
        }
        
        // Dynamically bind change event to type select
        const typeSelect = document.getElementById('search-type-select');
        if (typeSelect && !typeSelect.dataset.bound) {
            typeSelect.dataset.bound = 'true';
            typeSelect.addEventListener('change', (e) => {
                currentSearchType = e.target.value;
                
                const searchInput = document.getElementById('search-input');
                if (searchInput) searchInput.value = '';
                renderMainSearch();
            });
        }
        
        // Ensure all segmented controls update bg
        setTimeout(() => window.updateAllSegmentedControls(), 50);

        if (globalQuestions.length === 0) {
            if (searchResultsList) searchResultsList.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fas fa-circle-notch fa-spin"></i> Loading all subjects...</div>';
            loadGlobalQuestions().then(() => {
                renderMainSearch();
            });
        } else {
            renderMainSearch();
        }
    }

    async function loadGlobalQuestions() {
        globalQuestions = [];
        for (const sub of subjects) {
            try {
                const res = await fetch('data/' + sub.file);
                const text = await res.text();
                const qList = parseCSV(text);
                
                // Load progress for this subject
                const saved = localStorage.getItem('quiz_pc_progress_' + sub.id);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    parsed.forEach(p => {
                        const q = qList.find(item => item.id === p.id);
                        if (q) {
                            q.isFavorite = p.isFavorite;
                            q.isNoted = p.isNoted;
                            q.noteText = p.noteText;
                            q.isSubmitted = p.isSubmitted;
                            q.userAnswers = p.userAnswers || [];
                            q.isCorrect = p.isCorrect;
                            q.fcStatus = p.fcStatus || 'not_started';
                        }
                    });
                }
                
                qList.forEach(q => {
                    q.subjectId = sub.id;
                    globalQuestions.push(q);
                });
            } catch (err) {
                console.error("Failed to load subject " + sub.id, err);
            }
        }
    }

    function renderMainSearch() {
        if (!searchResultsList) return;
        if (globalQuestions.length === 0) return; // Still loading

        const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
        let filtered = globalQuestions;

        // Apply Subject Filter
        if (currentSearchSubject !== 'all') {
            filtered = filtered.filter(q => q.subjectId === currentSearchSubject);
        }

        // Apply Type Filter
        if (currentSearchType !== 'all') {
            filtered = filtered.filter(q => q.type === currentSearchType);
        }

        // Apply Pills Filter
        if (currentSearchFilter !== 'all') {
            filtered = filtered.filter(q => {
                if (currentSearchFilter === 'correct') return q.isCorrect === true;
                if (currentSearchFilter === 'incorrect') return q.isCorrect === false;
                if (currentSearchFilter === 'unanswered') return !q.isSubmitted;
                if (currentSearchFilter === 'favorites') return q.isFavorite === true;
                if (currentSearchFilter === 'notes') return q.isNoted === true || (q.noteText && q.noteText.trim() !== '');
                return true;
            });
        }

        // Apply Text Query Filter
        if (query) {
            filtered = filtered.filter(q => {
                return (q.id && String(q.id).toLowerCase().includes(query)) ||
                       (q.question && q.question.toLowerCase().includes(query)) ||
                       (q.options && q.options.some(opt => opt.toLowerCase().includes(query))) ||
                       (q.explanation && q.explanation.toLowerCase().includes(query));
            });
        }

        searchResultsList.innerHTML = '';
        if (filtered.length === 0) {
            searchResultsList.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">No results found.</div>';
            return;
        }

        // Render Cards
        filtered.forEach(q => {
            const card = document.createElement('div');
            card.className = 'glass-panel search-card-item';
            card.style.padding = '20px';
            card.style.marginBottom = '16px';
            card.style.cursor = 'pointer';
            card.style.borderRadius = '24px'; // Curved corners like Apple design
            card.style.background = 'rgba(255, 255, 255, 0.05)';
            card.style.backdropFilter = 'blur(24px) saturate(180%)';
            card.style.webkitBackdropFilter = 'blur(24px) saturate(180%)';
            card.style.border = '1px solid rgba(255, 255, 255, 0.12)';
            card.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.1)';
            card.style.transition = 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
            card.onmouseenter = () => {
                card.style.background = 'rgba(255, 255, 255, 0.1)';
                card.style.transform = 'translateY(-4px)';
                card.style.boxShadow = '0 15px 35px rgba(0, 0, 0, 0.2)';
                card.style.border = '1px solid rgba(255, 255, 255, 0.2)';
            };
            card.onmouseleave = () => {
                card.style.background = 'rgba(255, 255, 255, 0.05)';
                card.style.transform = 'translateY(0)';
                card.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.1)';
                card.style.border = '1px solid rgba(255, 255, 255, 0.12)';
            };
            
            // Determine Status UI
            let statusHtml = '';
            if (q.isSubmitted) {
                if (q.isCorrect) {
                    statusHtml = `<span style="color: var(--success); font-size: 0.85rem; font-weight: 600;"><i class="fas fa-check-circle"></i> Correct</span>`;
                } else {
                    statusHtml = `<span style="color: var(--danger); font-size: 0.85rem; font-weight: 600;"><i class="fas fa-times-circle"></i> Incorrect</span>`;
                }
            } else {
                statusHtml = `<span style="color: var(--text-muted); font-size: 0.85rem; font-weight: 600;"><i class="fas fa-circle"></i> Unanswered</span>`;
            }
            
            let badgesHtml = '';
            if (q.isFavorite) badgesHtml += `<i class="fas fa-star" style="color: #fbbf24; margin-right: 6px;" title="Favorite"></i>`;
            if (q.isNoted || (q.noteText && q.noteText.trim())) badgesHtml += `<i class="fas fa-sticky-note" style="color: var(--info); margin-right: 6px;" title="Has Note"></i>`;
            if (q.fcStatus === 'mastered') badgesHtml += `<i class="fas fa-brain" style="color: #10b981;" title="Flashcard Mastered"></i>`;
            
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                    <div style="display: flex; gap: 12px; align-items: center;">
                        <span class="badge" style="background: rgba(0,242,254,0.15); color: #00F2FE; border: 1px solid rgba(0,242,254,0.3); font-size: 0.75rem;">${q.subjectId.toUpperCase()}</span>
                        <strong style="color: var(--primary);">Q${q.id}</strong>
                        ${statusHtml}
                    </div>
                    <div>${badgesHtml}</div>
                </div>
                <div style="font-size: 1rem; color: #fff; line-height: 1.5; margin-bottom: 12px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                    ${q.question}
                </div>
                <div style="text-align: right;">
                    <button class="btn-ghost btn-jump" style="padding: 4px 12px; font-size: 0.85rem; pointer-events: none;"><i class="fas fa-info-circle" style="margin-right: 6px;"></i>View Details</button>
                </div>
            `;
            
            // Click on card
            card.addEventListener('click', () => {
                const indexInFiltered = filtered.indexOf(q);
                const searchTitle = currentSearchFilter === 'all' ? 'Search Results' : `Filtered: ${currentSearchFilter}`;
                if (typeof showModal === 'function') {
                    showModal(searchTitle, filtered, indexInFiltered);
                }
            });
            
            searchResultsList.appendChild(card);
        });
    }

    // Attach Search Events
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderMainSearch();
        });
    }
    if (btnMainSearch) {
        btnMainSearch.addEventListener('click', () => {
            renderMainSearch();
        });
    }

    if (searchFilterPills) {
        searchFilterPills.forEach(pill => {
            pill.addEventListener('click', (e) => {
                // Update active class
                searchFilterPills.forEach(p => p.classList.remove('active'));
                e.currentTarget.classList.add('active');
                
                // Move background pill
                const activeBg = document.querySelector('#search-filter-pills .pill-active-bg');
                if (activeBg) {
                    activeBg.style.width = e.currentTarget.offsetWidth + 'px';
                    activeBg.style.transform = `translateX(${e.currentTarget.offsetLeft}px)`;
                }
                
                currentSearchFilter = e.currentTarget.getAttribute('data-filter') || 'all';
                renderMainSearch();
            });
        });
    }

    // Initial load hook - if we navigate to flashcards, make sure they're initialized
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (item.getAttribute('data-target') === 'flashcard-view') {
                // If it's the first time and we have data
                if (fcData.length === 0 && typeof currentQuestions !== 'undefined' && currentQuestions.length > 0) {
                    initFlashcards();
                }
            }
        });
    });

    // We also need to hook into the CSV load success to init flashcards if we are on the view
    if (typeof updateHome === 'function') {
        const originalUpdateHome = updateHome;
        updateHome = function() {
            originalUpdateHome();
            const flashcardView = document.getElementById('flashcard-view');
            if (flashcardView && flashcardView.classList.contains('active')) {
                initFlashcards();
            } else if (fcData.length === 0) {
                initFlashcards(); // preemptive init
            }
        };
    }
}
);





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
        if (viewId === 'home-view') updateHome();
        if (viewId === 'stats-view') updateDashboard();
        if (viewId === 'search-view') updateSearch();
        if (viewId === 'practice-view') {
            focusedOptionIndex = 0; // reset focus
            renderQuestion();
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
    let currentQuestions = [];
    let currentQuestionIndex = 0;
    let focusedOptionIndex = 0;
    let currentSearchFilter = 'all';

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

                result.push({
                    id: parts[0],
                    type: parts[1],
                    question: parts[2].replace(/""/g, '"'),
                    options: opts,
                    correctAnswers: correctAnswers,
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
    function updateHome() {
        if (currentQuestions.length === 0) return;
        const total = currentQuestions.length;
        const submitted = currentQuestions.filter(q => q.isSubmitted).length;
        const pct = total === 0 ? 0 : Math.round((submitted / total) * 100);

        document.getElementById('jump-ite-subtitle').textContent = `${total} questions • ${total - submitted} unanswered`;
        document.getElementById('jump-ite-progress').style.width = `${pct}%`;
        document.getElementById('jump-ite-status').textContent = submitted === 0 ? "Not started" : (submitted === total ? "Completed" : "In Progress");

        const btnContinue = document.getElementById('btn-jump-continue');
        btnContinue.innerHTML = submitted > 0 && submitted < total ? 'Continue <i class="fas fa-chevron-right ml-1"></i>' : 'Start <i class="fas fa-chevron-right ml-1"></i>';

        const resumeInfo = document.getElementById('jump-ite-resume-info');
        if (submitted > 0 && submitted < total) {
            const firstUnanswered = currentQuestions.find(q => !q.isSubmitted);
            if (firstUnanswered) {
                document.getElementById('resume-q-title').textContent = `Resume at Question ${firstUnanswered.originalIndex + 1}:`;
                document.getElementById('resume-q-text').textContent = firstUnanswered.question;
                resumeInfo.style.display = 'block';
            } else {
                resumeInfo.style.display = 'none';
            }
        } else {
            resumeInfo.style.display = 'none';
        }
    }

    const btnJumpContinue = document.getElementById('btn-jump-continue');
    const btnJumpRestart = document.getElementById('btn-jump-restart');

    // Reset Modal Elements
    const confirmResetModal = document.getElementById('confirm-reset-modal');
    const btnCancelReset = document.getElementById('btn-cancel-reset');
    const btnConfirmReset = document.getElementById('btn-confirm-reset');

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

    if (btnJumpContinue) {
        btnJumpContinue.addEventListener('click', () => {
            // Find first unanswered
            const idx = currentQuestions.findIndex(q => !q.isSubmitted);
            currentQuestionIndex = idx !== -1 ? idx : 0;
            switchView('practice-view');
        });
    }

    if (btnJumpRestart) {
        btnJumpRestart.addEventListener('click', () => {
            confirmResetModal.classList.add('active');
        });
    }

    if (btnCancelReset) {
        btnCancelReset.addEventListener('click', () => {
            confirmResetModal.classList.remove('active');
        });
    }

    if (btnConfirmReset) {
        btnConfirmReset.addEventListener('click', () => {
            currentQuestions.forEach(q => {
                q.isSubmitted = false;
                q.userAnswers = [];
                q.isCorrect = null;
            });
            saveProgress();
            updateHome();
            currentQuestionIndex = 0;
            confirmResetModal.classList.remove('active');
            switchView('practice-view');
        });
    }

    // ---- Search View Logic ----
    const searchInput = document.getElementById('search-input');

    if (searchInput) {
        searchInput.addEventListener('input', updateSearch);
    }

    function updateSearch() {
        const query = (searchInput ? searchInput.value.toLowerCase() : '');
        let filtered = currentQuestions;

        if (currentSearchFilter === 'correct') filtered = filtered.filter(q => q.isCorrect === true);
        else if (currentSearchFilter === 'incorrect') filtered = filtered.filter(q => q.isCorrect === false);
        else if (currentSearchFilter === 'unanswered') filtered = filtered.filter(q => !q.isSubmitted);
        else if (currentSearchFilter === 'favorites') filtered = filtered.filter(q => q.isFavorite);
        else if (currentSearchFilter === 'notes') filtered = filtered.filter(q => q.isNoted && q.noteText && q.noteText.trim() !== '');

        if (query) {
            filtered = filtered.filter(q => {
                return (q.id && q.id.toLowerCase().includes(query)) ||
                    String(q.originalIndex + 1).includes(query) ||
                    q.question.toLowerCase().includes(query) ||
                    q.options.some(opt => opt.toLowerCase().includes(query));
            });
        }

        const listContainer = document.getElementById('search-results-list');
        if (!listContainer) return;
        listContainer.innerHTML = '';

        if (filtered.length === 0) {
            listContainer.innerHTML = '<p style="text-align:center; color:var(--text-muted);">No questions found.</p>';
        } else {
            filtered.forEach((q, index) => {
                const item = document.createElement('div');
                item.className = 'search-result-item glass-panel';

                let badgeHtml = '';
                if (q.isSubmitted) {
                    if (q.isCorrect) badgeHtml = '<span class="badge" style="color:#34d399; background: rgba(52, 211, 153, 0.15);">Correct</span>';
                    else badgeHtml = '<span class="badge" style="color:#f87171; background: rgba(248, 113, 113, 0.15);">Incorrect</span>';
                } else {
                    badgeHtml = '<span class="badge" style="color:var(--text-muted); background: rgba(255,255,255,0.05);">Unanswered</span>';
                }

                if (q.isFavorite) badgeHtml += '<span class="badge" style="color:#f59e0b; background: rgba(245, 158, 11, 0.15);"><i class="fas fa-star"></i></span>';
                if (q.isNoted && q.noteText && q.noteText.trim() !== '') badgeHtml += '<span class="badge" style="color:#60a5fa; background: rgba(96, 165, 250, 0.15);"><i class="fas fa-sticky-note"></i></span>';

                let noteHtml = '';
                if (q.isNoted && q.noteText) {
                    noteHtml = `
                    <div style="margin-top: 12px; padding: 12px; background: rgba(96, 165, 250, 0.1); border-left: 3px solid #60a5fa; border-radius: 4px; font-size: 0.95rem; color: #bfdbfe; line-height: 1.5;">
                        <i class="fas fa-sticky-note" style="margin-right: 6px;"></i> <strong>Note:</strong><br>
                        ${q.noteText.replace(/\n/g, '<br>')}
                    </div>`;
                }

                item.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                        <span style="font-size: 0.8rem; font-weight: 600; color: var(--primary); text-transform: uppercase; letter-spacing: 0.5px;">
                            Question ${q.originalIndex + 1}  &bull; ${q.type}
                        </span>
                        <div style="display: flex; gap: 6px;">${badgeHtml}</div>
                    </div>
                    <h4 style="margin: 0 0 8px 0; font-size: 1.1rem; font-weight: 600; color: var(--text-main); line-height: 1.4;">
                        ${q.question}
                    </h4>
                    ${noteHtml}
                `;

                item.addEventListener('click', () => {
                    showModal(`Search Results`, filtered, index);
                });
                listContainer.appendChild(item);
            });
        }
    }

    // ---- Practice Logic ----
    const btnFav = document.getElementById('btn-favorite');
    const btnNote = document.getElementById('btn-note');
    const optionsContainer = document.querySelector('.options-list');
    const btnSubmit = document.getElementById('btn-submit');
    const btnPrev = document.getElementById('btn-prev');

    function renderQuestion() {
        if (currentQuestions.length === 0) return;
        const q = currentQuestions[currentQuestionIndex];

        document.querySelector('.question-indicator').textContent = `QUESTION ${currentQuestionIndex + 1} - ${q.type === 'multiple_choice' ? 'MULTIPLE CHOICE' : 'SINGLE CHOICE'}`;

        const qText = document.querySelector('.question-text');
        qText.textContent = q.question;

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
            btn.textContent = opt;

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

        if (btnSubmit) {
            if (q.isSubmitted) {
                btnSubmit.textContent = (currentQuestionIndex === currentQuestions.length - 1) ? "Finish Module" : "Next Question";
            } else {
                btnSubmit.textContent = "Submit";
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
            if (currentQuestionIndex < currentQuestions.length - 1) {
                currentQuestionIndex++;
                focusedOptionIndex = 0;
                renderQuestion();
            } else {
                switchView('stats-view');
            }
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

    if (btnPrev) {
        btnPrev.addEventListener('click', () => {
            if (currentQuestionIndex > 0) {
                currentQuestionIndex--;
                focusedOptionIndex = 0;
                renderQuestion();
            } else {
                switchView('home-view');
            }
        });
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

        // ---- Main Search in Explorer ----
        const mainSearchContainer = document.getElementById('main-search-container');
        const btnMainSearch = document.getElementById('btn-main-search');
        const inputMainSearch = document.getElementById('search-input');

        if (btnMainSearch && mainSearchContainer && inputMainSearch) {
            btnMainSearch.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!mainSearchContainer.classList.contains('active')) {
                    mainSearchContainer.classList.add('active');
                    inputMainSearch.focus();
                } else {
                    if (inputMainSearch.value.trim() !== '') {
                        // Clear the input on click when open
                        inputMainSearch.value = '';
                        // Trigger input event to update search results
                        inputMainSearch.dispatchEvent(new Event('input'));
                        inputMainSearch.focus();
                    } else {
                        mainSearchContainer.classList.remove('active');
                    }
                }
            });

            inputMainSearch.addEventListener('click', (e) => e.stopPropagation());

            document.addEventListener('click', () => {
                if (inputMainSearch.value.trim() === '') {
                    mainSearchContainer.classList.remove('active');
                }
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
                    submitAnswer();
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
            const progress = currentQuestions.map(q => ({
                id: q.id,
                isFavorite: q.isFavorite,
                isNoted: q.isNoted,
                noteText: q.noteText,
                isSubmitted: q.isSubmitted,
                userAnswers: q.userAnswers,
                isCorrect: q.isCorrect
            }));
            localStorage.setItem('quiz_pc_progress', JSON.stringify(progress));
        }

        function loadProgress() {
            const saved = localStorage.getItem('quiz_pc_progress');
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
                        }
                    });
                } catch(e) { console.error('Failed to load progress', e); }
            }
        }

        // ---- Data Loading ----
        fetch('data/ite302c.csv')
            .then(res => {
                if (!res.ok) throw new Error("Could not fetch CSV");
                return res.text();
            })
            .then(text => {
                currentQuestions = parseCSV(text);
                loadProgress();
                updateHome();
            })
            .catch(err => {
                console.error("CSV loading error:", err);
            });

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
                <span class="bar-label">ITE302C</span>
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
                listContainer.innerHTML = '<p style="text-align:center; color:var(--text-muted);">No questions found in this category.</p>';
                return;
            }

            const q = currentModalList[currentModalIndex];

            // Header (Index & Type)
            const header = document.createElement('div');
            header.style.marginBottom = '20px';
            header.style.fontSize = '0.9rem';
            header.style.color = 'var(--text-muted)';
            header.style.fontWeight = '600';
            header.style.textTransform = 'uppercase';
            header.textContent = `QUESTION ${currentModalIndex + 1} OF ${currentModalList.length} - ${q.type === 'multiple_choice' ? 'MULTIPLE CHOICE' : 'SINGLE CHOICE'}`;
            listContainer.appendChild(header);

            // Question Text
            const qText = document.createElement('h3');
            qText.style.fontSize = '1.3rem';
            qText.style.fontWeight = '500';
            qText.style.marginBottom = '24px';
            qText.textContent = q.question;
            listContainer.appendChild(qText);

            // Options
            const optionsList = document.createElement('div');
            optionsList.className = 'options-list';

            q.options.forEach((opt, idx) => {
                const btn = document.createElement('button');
                btn.className = 'option-btn';
                btn.textContent = opt;
                btn.disabled = true; // Read-only

                const isSelected = q.userAnswers.includes(String(idx));
                const isCorrectAns = q.correctAnswers.includes(String(idx));

                if (isCorrectAns) {
                    btn.classList.add('correct');
                } else if (isSelected && !isCorrectAns) {
                    btn.classList.add('incorrect');
                }

                optionsList.appendChild(btn);
            });

            listContainer.appendChild(optionsList);

            if (q.isNoted && q.noteText) {
                const noteBox = document.createElement('div');
                noteBox.style.marginTop = '24px';
                noteBox.style.padding = '16px';
                noteBox.style.background = 'rgba(96, 165, 250, 0.1)';
                noteBox.style.borderLeft = '3px solid #60a5fa';
                noteBox.style.borderRadius = '8px';
                noteBox.style.fontSize = '1rem';
                noteBox.style.color = '#bfdbfe';
                noteBox.style.lineHeight = '1.5';
                noteBox.innerHTML = `<div style="font-weight: 600; margin-bottom: 6px;"><i class="fas fa-sticky-note" style="margin-right: 6px;"></i> Note:</div>${q.noteText.replace(/\n/g, '<br>')}`;
                listContainer.appendChild(noteBox);
            }

            // Footer (Prev/Next hint)
            const hint = document.createElement('div');
            hint.style.marginTop = '24px';
            hint.style.textAlign = 'center';
            hint.style.color = 'var(--text-muted)';
            hint.style.fontSize = '0.85rem';
            hint.innerHTML = '<i class="fas fa-arrows-alt-h"></i> Use Left/Right arrow keys to navigate';
            listContainer.appendChild(hint);
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

        // Init View
        switchView('home-view');
    }
});
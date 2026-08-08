import { fetchSubjects, fetchCSV } from './parser.js';
import { UI } from './ui.js';

class QuizApp {
    constructor() {
        this.state = {
            currentSubject: null,
            questions: [],
            currentIndex: 0,
            userAnswers: {}
        };

        this.ui = new UI(this.state, this);
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupSmartNav();
        const subjects = await fetchSubjects();
        this.ui.renderSubjects(subjects);
    }

    setupEventListeners() {
        const currentTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', currentTheme);
        this.updateThemeIcons(currentTheme);

        const toggleThemeLogic = () => {
            let theme = document.documentElement.getAttribute('data-theme');
            theme = theme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
            this.updateThemeIcons(theme);
        };

        document.querySelectorAll('.theme-toggle').forEach(btn => {
            btn.addEventListener('click', toggleThemeLogic);
        });

        // Thêm xử lý cho vertical switcher trong Settings
        const verticalToggle = document.getElementById('vertical-theme-toggle');
        if (verticalToggle) {
            verticalToggle.addEventListener('click', toggleThemeLogic);
        }

        document.querySelectorAll('.nav-item').forEach(nav => {
            nav.addEventListener('click', (e) => {
                const target = e.currentTarget.getAttribute('data-target');
                this.navigateTo(target);
            });
        });

        document.getElementById('btn-continue').addEventListener('click', () => {
            this.navigateTo('practice-view');
        });
        document.getElementById('btn-new-session').addEventListener('click', () => {
            this.state.userAnswers = {};
            this.state.currentIndex = 0;
            this.navigateTo('practice-view');
        });

        const btnPracticeMode = document.getElementById('btn-practice-mode');
        
        btnPracticeMode.addEventListener('click', () => {
            this.navigateTo('practice-view');
        });

        const goPrev = () => {
            if (this.state.currentIndex > 0) {
                this.state.currentIndex--;
                const isFc = document.getElementById('flashcard-view').classList.contains('active');
                if (isFc) {
                    this.resetFlashcardState();
                    this.ui.renderFlashcard(this.state.currentIndex);
                } else {
                    this.ui.renderQuestion(this.state.currentIndex);
                }
            }
        };

        const goNext = () => {
            if (this.state.currentIndex < this.state.questions.length - 1) {
                this.state.currentIndex++;
                const isFc = document.getElementById('flashcard-view').classList.contains('active');
                if (isFc) {
                    this.resetFlashcardState();
                    this.ui.renderFlashcard(this.state.currentIndex);
                } else {
                    this.ui.renderQuestion(this.state.currentIndex);
                }
            }
        };

        let swipeStartX = null;
        let swipeStartY = null;

        const practiceView = document.getElementById('practice-view');
        
        practiceView.addEventListener('touchstart', (e) => {
            swipeStartX = e.touches[0].clientX;
            swipeStartY = e.touches[0].clientY;
        }, { passive: true });

        practiceView.addEventListener('touchend', (e) => {
            if (!swipeStartX || !swipeStartY) return;

            let swipeEndX = e.changedTouches[0].clientX;
            let swipeEndY = e.changedTouches[0].clientY;

            let diffX = swipeStartX - swipeEndX;
            let diffY = swipeStartY - swipeEndY;

            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 40) {
                if (diffX > 0) {
                    goNext();
                } else {
                    goPrev();
                }
            }

            swipeStartX = null;
            swipeStartY = null;
        }, { passive: true });
        
        // Flashcard specific logic
        const flipCard = () => {
            const card = document.getElementById('fc-card');
            if(card) {
                card.classList.toggle('is-flipped');
            }
        };
        
        const fcView = document.getElementById('flashcard-view');
        fcView.addEventListener('touchstart', (e) => {
            swipeStartX = e.touches[0].clientX;
            swipeStartY = e.touches[0].clientY;
        }, { passive: true });

        fcView.addEventListener('touchend', (e) => {
            if (!swipeStartX || !swipeStartY) return;
            let swipeEndX = e.changedTouches[0].clientX;
            let swipeEndY = e.changedTouches[0].clientY;
            let diffX = swipeStartX - swipeEndX;
            let diffY = swipeStartY - swipeEndY;

            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 40) {
                if (diffX > 0) goNext();
                else goPrev();
            } else if (Math.abs(diffX) < 10 && Math.abs(diffY) < 10) {
                // simple tap to flip if target is the card
                if(e.target.closest('.fc-container')) {
                   flipCard();
                }
            }
            swipeStartX = null;
            swipeStartY = null;
        }, { passive: true });

        // Flashcard Search
        const fcSearchBtn = document.getElementById('fc-search-btn');
        const fcSearchContainer = document.getElementById('fc-search-container');
        const fcSearchInput = document.getElementById('fc-search-input');
        
        if (fcSearchBtn && fcSearchContainer && fcSearchInput) {
            fcSearchBtn.addEventListener('click', () => {
                fcSearchContainer.classList.toggle('active');
                if (fcSearchContainer.classList.contains('active')) {
                    fcSearchInput.focus();
                } else {
                    fcSearchInput.blur();
                }
            });
            
            fcSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const query = e.target.value.toLowerCase().trim();
                    if (!query) return;
                    
                    const foundIndex = this.state.questions.findIndex(q => q.id.toLowerCase().includes(query));
                    if (foundIndex !== -1) {
                        this.state.currentIndex = foundIndex;
                        this.ui.renderFlashcard(this.state.currentIndex);
                        this.ui.showToast(`Found Question ID: ${this.state.questions[foundIndex].id}`);
                        
                        // Ensure card is front-facing when searching
                        const card = document.getElementById('fc-card');
                        if(card) card.classList.remove('is-flipped');
                        
                        // Auto-hide search bar after successful jump
                        fcSearchContainer.classList.remove('active');
                    } else {
                        this.ui.showToast(`No question found matching "${query}"`, 'error');
                    }
                    e.target.blur(); // dismiss keyboard
                }
            });
        }

        document.getElementById('btn-practice-back').addEventListener('click', () => {
            this.navigateTo('dashboard-view');
        });
        document.getElementById('btn-flashcard-back').addEventListener('click', () => {
            this.navigateTo('dashboard-view');
        });

        document.getElementById('btn-back-subjects').addEventListener('click', () => {
            document.getElementById('bottom-nav').classList.add('hidden');
            this.navigateTo('subject-select-view');
        });
    }

    setupSmartNav() {
        let navTimer;
        const bottomNav = document.getElementById('bottom-nav');

        const hideNav = () => {
            if (!bottomNav.classList.contains('hidden')) {
                bottomNav.classList.add('nav-hidden');
            }
        };

        const showNav = () => {
            bottomNav.classList.remove('nav-hidden');
            resetTimer();
        };
        
        const resetTimer = () => {
            clearTimeout(navTimer);
            navTimer = setTimeout(hideNav, 5000);
        };

        const events = ['touchstart', 'mousemove', 'scroll', 'click'];
        events.forEach(evt => document.addEventListener(evt, () => {
            if (!bottomNav.classList.contains('nav-hidden')) {
                resetTimer();
            }
        }, { passive: true }));

        let startY;
        document.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            if (!startY) return;
            let y = e.touches[0].clientY;
            
            if (startY - y > 30) {
                // Swipe Up to show
                showNav();
                startY = null;
            } else if (y - startY > 30) {
                // Swipe Down to hide
                hideNav();
                startY = null;
            }
        }, { passive: true });

        // Initial timer start
        resetTimer();
    }

    async loadSubject(subject) {
        this.state.currentSubject = subject;
        this.state.userAnswers = {};
        this.state.currentIndex = 0;

        this.state.questions = await fetchCSV(`data/${subject.file}`);

        // Load favorites from local storage
        const savedFavs = localStorage.getItem(`quiz_favorites_${subject.id}`);
        if (savedFavs) {
            try {
                const favIndices = JSON.parse(savedFavs);
                favIndices.forEach(idx => {
                    if (this.state.questions[idx]) {
                        this.state.questions[idx].isFavorite = true;
                    }
                });
            } catch(e) { console.error("Could not parse favorites", e); }
        }

        document.getElementById('bottom-nav').classList.remove('hidden');
        this.navigateTo('dashboard-view');
    }

    toggleFavorite(index) {
        if (!this.state.questions[index]) return;
        this.state.questions[index].isFavorite = !this.state.questions[index].isFavorite;
        
        // Save to local storage
        const favIndices = [];
        this.state.questions.forEach((q, i) => {
            if (q.isFavorite) favIndices.push(i);
        });
        localStorage.setItem(`quiz_favorites_${this.state.currentSubject.id}`, JSON.stringify(favIndices));
        
        // Re-render UI pieces if necessary
        if (document.getElementById('practice-view').classList.contains('active')) {
            this.ui.renderQuestion(this.state.currentIndex);
        }
    }

    navigateTo(viewId) {
        document.querySelectorAll('.view').forEach(v => {
            v.classList.add('hidden');
            v.classList.remove('active');
        });

        const targetView = document.getElementById(viewId);
        targetView.classList.remove('hidden');
        setTimeout(() => targetView.classList.add('active'), 10);

        document.querySelectorAll('.nav-item').forEach(nav => {
            const isActive = nav.getAttribute('data-target') === viewId;
            nav.classList.toggle('active', isActive);
            if (isActive) {
                const index = nav.getAttribute('data-index');
                const indicator = document.getElementById('nav-indicator');
                if (indicator) {
                    indicator.style.transform = `translateX(${index * 100}%)`;
                }
            }
        });

        if (viewId === 'dashboard-view') {
            this.ui.updateDashboard();
            this.ui.updateStats();
        }
        if (viewId === 'practice-view') this.ui.renderQuestion(this.state.currentIndex);
        if (viewId === 'flashcard-view') {
            this.resetFlashcardState();
            this.ui.renderFlashcard(this.state.currentIndex);
        }
        if (viewId === 'bank-view') this.ui.renderBank();
    }
    
    resetFlashcardState() {
        const card = document.getElementById('fc-card');
        if(card && card.classList.contains('is-flipped')) {
            card.classList.remove('is-flipped');
        }
    }

    submitAnswer(qId, answer) {
        this.state.userAnswers[qId] = answer;

        const q = this.state.questions.find(x => x.id === qId);
        if (q) {
            const isCorrect = this.ui.checkIsCorrect(q, answer);
            if (isCorrect) {
                this.ui.showToast("Awesome! That's correct.", "correct");
            } else {
                this.ui.showToast("Oops! That's incorrect.", "incorrect");
            }
        }

        this.ui.renderQuestion(this.state.currentIndex);
    }

    updateThemeIcons(theme) {
        document.querySelectorAll('.theme-toggle i').forEach(icon => {
            if (theme === 'light') {
                icon.className = 'fas fa-sun';
            } else {
                icon.className = 'fas fa-moon';
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new QuizApp();
});

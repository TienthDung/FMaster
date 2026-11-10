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
        this.setupLiquidNavIndicator();
        this.setupUniversalTouchEffects();
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
                if (this.justScrubbed) return;
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
            if (bottomNav && (bottomNav.classList.contains('is-nav-touching') || bottomNav.classList.contains('is-dragging'))) return;
            if (bottomNav && !bottomNav.classList.contains('hidden')) {
                bottomNav.classList.add('nav-hidden');
            }
        };

        const showNav = () => {
            if (bottomNav) bottomNav.classList.remove('nav-hidden');
            resetTimer();
        };
        
        const resetTimer = () => {
            clearTimeout(navTimer);
            navTimer = setTimeout(hideNav, 5000);
        };

        const events = ['touchstart', 'mousemove', 'scroll', 'click'];
        events.forEach(evt => document.addEventListener(evt, () => {
            if (bottomNav && !bottomNav.classList.contains('nav-hidden')) {
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

    setupLiquidNavIndicator() {
        const bottomNav = document.getElementById('bottom-nav');
        const indicator = document.getElementById('nav-indicator');
        if (!bottomNav || !indicator) return;

        const navItems = Array.from(bottomNav.querySelectorAll('.nav-item'));
        if (navItems.length === 0) return;

        let isInteracting = false;
        let isDragging = false;
        let currentHoverIdx = -1;
        let lastMoveX = 0;

        const getItemWidth = () => (bottomNav.clientWidth - 12) / navItems.length;

        const getActiveIndex = () => {
            const activeItem = bottomNav.querySelector('.nav-item.active');
            return activeItem ? parseInt(activeItem.getAttribute('data-index')) : 0;
        };

        const updateIndicatorPosition = (touchX, isMoving = false) => {
            const navRect = bottomNav.getBoundingClientRect();
            const itemWidth = getItemWidth();
            const totalWidth = (navItems.length - 1) * itemWidth;

            // Offset relative to padding (6px)
            const targetX = (touchX - navRect.left - 6) - (itemWidth / 2);
            const clampedX = Math.max(0, Math.min(totalWidth, targetX));

            // Fluid stretching / liquid jelly effect based on movement (scaled larger)
            let scaleX = 1.28;
            let scaleY = 1.20;
            if (isMoving && lastMoveX !== 0) {
                const deltaX = Math.abs(touchX - lastMoveX);
                scaleX = Math.min(1.38, 1.28 + deltaX * 0.02);
                scaleY = Math.max(1.10, 2.48 - scaleX); // preserve liquid volume
            }
            lastMoveX = touchX;

            indicator.style.transition = 'none';
            indicator.style.transform = `translate3d(${clampedX}px, 0, 0) scale(${scaleX.toFixed(3)}, ${scaleY.toFixed(3)})`;

            // Calculate closest nav item
            const closestIdx = Math.max(0, Math.min(navItems.length - 1, Math.round(clampedX / itemWidth)));
            if (closestIdx !== currentHoverIdx) {
                currentHoverIdx = closestIdx;
                navItems.forEach((item, idx) => {
                    item.classList.toggle('is-hovered', idx === closestIdx);
                });
                if (window.navigator && window.navigator.vibrate) {
                    try { window.navigator.vibrate(8); } catch (e) {}
                }
            }
        };

        const startInteraction = (clientX, clientY) => {
            const navRect = bottomNav.getBoundingClientRect();
            if (clientY < navRect.top - 60 || clientY > navRect.bottom + 60) return;

            isInteracting = true;
            isDragging = false;
            lastMoveX = clientX;
            bottomNav.classList.add('is-nav-touching');
            indicator.classList.add('is-active-touch');

            updateIndicatorPosition(clientX, false);
        };

        const moveInteraction = (clientX, clientY, e) => {
            if (!isInteracting) return;
            const navRect = bottomNav.getBoundingClientRect();
            if (clientY < navRect.top - 80 || clientY > navRect.bottom + 80) return;

            isDragging = true;
            if (e && e.cancelable) e.preventDefault();

            indicator.classList.add('is-dragging');
            updateIndicatorPosition(clientX, true);
        };

        const endInteraction = () => {
            if (!isInteracting) return;
            isInteracting = false;

            bottomNav.classList.remove('is-nav-touching');
            indicator.classList.remove('is-active-touch', 'is-dragging');
            navItems.forEach(item => item.classList.remove('is-hovered'));

            // Apple Spring return to resting size and snap into place
            indicator.style.transition = 'transform 0.42s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease';

            if (currentHoverIdx >= 0 && currentHoverIdx < navItems.length) {
                const targetItem = navItems[currentHoverIdx];
                const targetView = targetItem.getAttribute('data-target');
                indicator.style.transform = `translateX(${currentHoverIdx * 100}%) scale(1)`;

                if (isDragging) {
                    this.justScrubbed = true;
                    setTimeout(() => { this.justScrubbed = false; }, 250);
                    if (targetView) this.navigateTo(targetView);
                }
            } else {
                const activeIdx = getActiveIndex();
                indicator.style.transform = `translateX(${activeIdx * 100}%) scale(1)`;
            }

            currentHoverIdx = -1;
            lastMoveX = 0;
            isDragging = false;
        };

        // --- Touch Listeners ---
        bottomNav.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            startInteraction(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });

        bottomNav.addEventListener('touchmove', (e) => {
            if (!isInteracting || e.touches.length !== 1) return;
            moveInteraction(e.touches[0].clientX, e.touches[0].clientY, e);
        }, { passive: false });

        bottomNav.addEventListener('touchend', endInteraction);
        bottomNav.addEventListener('touchcancel', endInteraction);

        // --- Mouse Listeners (Desktop & Chrome DevTools Emulation) ---
        let isMouseDown = false;
        bottomNav.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            isMouseDown = true;
            startInteraction(e.clientX, e.clientY);
        });

        window.addEventListener('mousemove', (e) => {
            if (!isMouseDown) return;
            moveInteraction(e.clientX, e.clientY, e);
        });

        window.addEventListener('mouseup', () => {
            if (isMouseDown) {
                isMouseDown = false;
                endInteraction();
            }
        });
    }

    setupUniversalTouchEffects() {
        const TOUCH_SELECTOR = [
            '.card',
            '.action-card',
            '.stat-row-card',
            '.subject-card',
            '.option-btn',
            '.question-card',
            '.explanation-card',
            '.apple-explanation-card',
            '.explanation-box',
            '.fc-container',
            '.fc-face',
            '.grid-item',
            '.recent-item',
            '.pill',
            '.mode-btn',
            '.apple-btn',
            '.icon-btn',
            '.category-card',
            '.donut-chart',
            '.mobile-search-box',
            '.theme-switcher-vertical',
            '.tag-pill',
            '.btn',
            '.btn-liquid-submit',
            '[data-bubble-touch]'
        ].join(', ');

        let currentActiveTarget = null;
        let startClientX = 0;
        let startClientY = 0;
        let isScrolledDistance = 0;

        const updateCoordinates = (element, clientX, clientY) => {
            if (!element) return;
            const rect = element.getBoundingClientRect();
            const posX = Math.max(0, Math.min(rect.width, clientX - rect.left));
            const posY = Math.max(0, Math.min(rect.height, clientY - rect.top));
            element.style.setProperty('--touch-x', `${posX.toFixed(1)}px`);
            element.style.setProperty('--touch-y', `${posY.toFixed(1)}px`);
        };

        const triggerRippleAtPoint = (element, clientX, clientY) => {
            if (!element || element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') return;
            const rect = element.getBoundingClientRect();
            const ripple = document.createElement('span');
            ripple.className = 'liquid-touch-ripple';
            ripple.style.left = `${clientX - rect.left}px`;
            ripple.style.top = `${clientY - rect.top}px`;
            element.appendChild(ripple);
            setTimeout(() => {
                if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
            }, 550);
        };

        const handleTouchStart = (clientX, clientY, originalTarget) => {
            // Ignore touches on bottom navigation (bottom nav uses dedicated is-nav-touching)
            if (originalTarget && originalTarget.closest && originalTarget.closest('#bottom-nav')) return;

            const targetElement = originalTarget.closest ? originalTarget.closest(TOUCH_SELECTOR) : null;
            if (!targetElement) return;

            currentActiveTarget = targetElement;
            startClientX = clientX;
            startClientY = clientY;
            isScrolledDistance = 0;

            updateCoordinates(targetElement, clientX, clientY);
            triggerRippleAtPoint(targetElement, clientX, clientY);

            targetElement.classList.remove('is-bubble-bouncing');
            targetElement.classList.add('is-glass-touching');
        };

        const handleTouchMove = (clientX, clientY) => {
            // Hiệu ứng vuốt chạm (Fluid Swipe-Touch): Ánh sáng lỏng trượt mượt mà theo ngón tay
            const elementUnderFinger = document.elementFromPoint(clientX, clientY);
            if (!elementUnderFinger) return;

            // Bỏ qua nếu vuốt vào khu vực bottom nav
            if (elementUnderFinger.closest && elementUnderFinger.closest('#bottom-nav')) {
                if (currentActiveTarget) {
                    currentActiveTarget.classList.remove('is-glass-touching');
                    currentActiveTarget = null;
                }
                return;
            }

            const newTarget = elementUnderFinger.closest ? elementUnderFinger.closest(TOUCH_SELECTOR) : null;

            // Nếu ngón tay vuốt trượt sang một container/nút lân cận
            if (newTarget !== currentActiveTarget) {
                if (currentActiveTarget) {
                    currentActiveTarget.classList.remove('is-glass-touching');
                }
                currentActiveTarget = newTarget;
                if (currentActiveTarget) {
                    currentActiveTarget.classList.remove('is-bubble-bouncing');
                    currentActiveTarget.classList.add('is-glass-touching');
                }
            }

            if (currentActiveTarget) {
                updateCoordinates(currentActiveTarget, clientX, clientY);
            }

            const diffX = Math.abs(clientX - startClientX);
            const diffY = Math.abs(clientY - startClientY);
            isScrolledDistance = Math.max(isScrolledDistance, Math.hypot(diffX, diffY));
        };

        const handleTouchEnd = () => {
            if (!currentActiveTarget) return;
            const target = currentActiveTarget;
            currentActiveTarget = null;

            target.classList.remove('is-glass-touching');

            // Nếu là chạm hoặc vuốt nhẹ (không phải cuộn lướt nhanh cả trang), kích hoạt nẩy bong bóng
            if (isScrolledDistance < 25) {
                target.classList.add('is-bubble-bouncing');

                if (window.navigator && window.navigator.vibrate) {
                    try { window.navigator.vibrate(8); } catch (e) {}
                }

                setTimeout(() => {
                    target.classList.remove('is-bubble-bouncing');
                }, 480);
            }
        };

        // Mobile touch listeners
        document.addEventListener('touchstart', (e) => {
            if (e.touches && e.touches.length > 0) {
                const t = e.touches[0];
                handleTouchStart(t.clientX, t.clientY, e.target);
            }
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            if (e.touches && e.touches.length > 0) {
                const t = e.touches[0];
                handleTouchMove(t.clientX, t.clientY);
            }
        }, { passive: true });

        document.addEventListener('touchend', handleTouchEnd, { passive: true });
        document.addEventListener('touchcancel', handleTouchEnd, { passive: true });

        // Desktop mouse support for testing & previewing
        let isMouseDownOnContainer = false;
        document.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            isMouseDownOnContainer = true;
            handleTouchStart(e.clientX, e.clientY, e.target);
        });

        document.addEventListener('mousemove', (e) => {
            if (!isMouseDownOnContainer) return;
            handleTouchMove(e.clientX, e.clientY);
        });

        document.addEventListener('mouseup', () => {
            if (isMouseDownOnContainer) {
                isMouseDownOnContainer = false;
                handleTouchEnd();
            }
        });
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
                    indicator.style.transition = 'transform 0.42s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease';
                    indicator.style.transform = `translateX(${index * 100}%) scale(1)`;
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

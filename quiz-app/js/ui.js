export class UI {
    constructor(state, app) {
        this.state = state;
        this.app = app;
        this.activeFilter = 'all';
    }

    checkIsCorrect(q, answer) {
        if (!q || !answer) return false;
        const correctArr = Array.isArray(q.correctanswer) ? q.correctanswer : [q.correctanswer];
        const answerArr = Array.isArray(answer) ? answer : [answer];

        if (q.type === 'multiple_choice') {
            if (answerArr.length !== correctArr.length) return false;
            return answerArr.every(a => correctArr.includes(a));
        } else {
            return correctArr.includes(answerArr[0]);
        }
    }

    renderSubjects(subjects) {
        const grid = document.getElementById('subject-grid');
        grid.innerHTML = '';
        
        subjects.forEach(subject => {
            const card = document.createElement('div');
            card.className = 'subject-card';
            card.innerHTML = `
                <div class="subject-icon"><i class="${subject.icon || 'fas fa-book'}"></i></div>
                <div class="subject-info">
                    <h3 class="text-color-main">${subject.name}</h3>
                    <p class="text-gray text-sm">${subject.description || 'Tap to start practicing'}</p>
                </div>
            `;
            card.addEventListener('click', () => this.app.loadSubject(subject));
            grid.appendChild(card);
        });
    }

    updateDashboard() {
        const total = this.state.questions.length;
        const answers = this.state.userAnswers;
        const answeredCount = Object.keys(answers).length;
        
        let correct = 0, wrong = 0;
        for (const [id, answer] of Object.entries(answers)) {
            const q = this.state.questions.find(q => q.id === id);
            if (q) {
                if (this.checkIsCorrect(q, answer)) correct++;
                else wrong++;
            }
        }
        
        const accuracy = answeredCount > 0 ? Math.round((correct / answeredCount) * 100) : 0;
        const skipped = total - answeredCount;

        document.getElementById('reviewed-count').textContent = answeredCount;
        document.getElementById('reviewed-total').textContent = total;
        document.getElementById('reviewed-progress').style.width = total > 0 ? `${(answeredCount/total)*100}%` : '0%';
        document.getElementById('correct-rate').textContent = `${accuracy}%`;
        
        document.getElementById('stat-correct').textContent = correct;
        document.getElementById('stat-wrong').textContent = wrong;
        document.getElementById('stat-skipped').textContent = skipped;
        
        const currentIndex = this.state.currentIndex;
        if (total > 0 && currentIndex < total) {
            const currentQ = this.state.questions[currentIndex];
            document.getElementById('continue-desc').textContent = `Question #${currentIndex + 1} — ${currentQ.type.toUpperCase()}`;
        } else {
            document.getElementById('continue-desc').textContent = `Completed or empty`;
        }
        
        this.updateRecentQuestions();
    }
    
    updateRecentQuestions() {
        const list = document.getElementById('recent-list');
        list.innerHTML = '';
        
        const recentIds = Object.keys(this.state.userAnswers).slice(-3);
        if (recentIds.length === 0) {
            list.innerHTML = '<div class="text-gray text-sm">No questions reviewed yet.</div>';
            return;
        }
        
        recentIds.reverse().forEach((id) => {
            const q = this.state.questions.find(q => q.id === id);
            const qIndex = this.state.questions.findIndex(q => q.id === id) + 1;
            if(q) {
                list.innerHTML += `
                    <div class="recent-item">
                        <div class="recent-num">${qIndex}</div>
                        <div class="recent-text text-color-main">${q.question}</div>
                        <div class="recent-badge">${q.type.toUpperCase()}</div>
                    </div>
                `;
            }
        });
    }

    renderQuestion(index) {
        const q = this.state.questions[index];
        if (!q) return;

        document.getElementById('question-counter').textContent = `Question ${index + 1} - ${this.state.questions.length}`;
        document.getElementById('q-type-badge').textContent = q.type.toUpperCase();
        document.getElementById('question-text').textContent = q.question;
        
        const progress = ((index + 1) / this.state.questions.length) * 100;
        document.getElementById('practice-progress').style.width = `${progress}%`;

        const btnFavorite = document.getElementById('btn-favorite');
        if (btnFavorite) {
            btnFavorite.innerHTML = q.isFavorite ? '<i class="fas fa-star" style="color: #F59E0B; text-shadow: 0 0 10px rgba(245, 158, 11, 0.5);"></i>' : '<i class="far fa-star"></i>';
            btnFavorite.onclick = () => this.app.toggleFavorite(index);
        }

        const container = document.getElementById('options-container');
        container.innerHTML = '';
        
        const userAnswer = this.state.userAnswers[q.id];

        q.options.forEach((opt, i) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            const letter = String.fromCharCode(65 + i);
            btn.innerHTML = `<div class="option-letter">${letter}</div> <span class="flex-1">${opt}</span>`;
            
            if (userAnswer) {
                const answerArr = Array.isArray(userAnswer) ? userAnswer : [userAnswer];
                const correctArr = Array.isArray(q.correctanswer) ? q.correctanswer : [q.correctanswer];
                
                const isSelected = answerArr.includes(opt);
                const isOptionCorrect = correctArr.includes(opt);
                
                if (isOptionCorrect) {
                    btn.classList.add('correct');
                } else if (isSelected) {
                    btn.classList.add('wrong');
                }
                btn.disabled = true;
            } else {
                btn.addEventListener('click', () => {
                    if (q.type === 'multiple_choice') {
                        btn.classList.toggle('selected');
                    } else {
                        this.app.submitAnswer(q.id, opt);
                    }
                });
            }
            container.appendChild(btn);
        });

        if (!userAnswer && q.type === 'multiple_choice') {
            const submitBtn = document.createElement('button');
            submitBtn.className = 'btn btn-primary mt-4';
            submitBtn.style.width = '100%';
            submitBtn.textContent = 'Submit Answer';
            submitBtn.addEventListener('click', () => {
                const selectedBtns = container.querySelectorAll('.option-btn.selected span.flex-1');
                const selected = Array.from(selectedBtns).map(el => el.textContent);
                if (selected.length > 0) {
                    this.app.submitAnswer(q.id, selected);
                }
            });
            container.appendChild(submitBtn);
        }


    }

    renderBank() {
        const grid = document.getElementById('bank-grid');
        grid.innerHTML = '';
        
        // Setup filter listeners if not already
        const filterPills = document.querySelectorAll('#bank-filters .pill');
        filterPills.forEach(pill => {
            pill.onclick = (e) => {
                filterPills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                this.activeFilter = pill.getAttribute('data-filter');
                this.renderBank();
            };
        });

        const answers = this.state.userAnswers;
        let correctCount = 0, wrongCount = 0;
        let favCount = 0;

        this.state.questions.forEach((q, i) => {
            if (q.isFavorite) favCount++;
            const ans = answers[q.id];
            
            // Apply filter
            if (this.activeFilter === 'favorites' && !q.isFavorite) return;
            if (this.activeFilter === 'tf' && q.type !== 'true_false') return;
            if (this.activeFilter === 'single' && q.type !== 'single_choice') return;
            if (this.activeFilter === 'multiple' && q.type !== 'multiple_choice') return;

            const btn = document.createElement('button');
            btn.className = 'grid-item';
            
            let iconClass = 'fas fa-circle text-gray';
            let numHtml = `<span>${i + 1}</span>`;
            
            if (ans) {
                if (this.checkIsCorrect(q, ans)) {
                    btn.classList.add('correct');
                    iconClass = 'fas fa-check';
                    correctCount++;
                } else {
                    btn.classList.add('wrong');
                    iconClass = 'fas fa-times';
                    wrongCount++;
                }
            }
            
            if (i === this.state.currentIndex) {
                btn.classList.add('current');
                iconClass = 'fas fa-star'; // current question always has a star or different marker
            }
            
            // Add favorite mini star
            let favHtml = q.isFavorite ? `<i class="fas fa-star" style="position:absolute; top:4px; right:4px; font-size:0.55rem; color:#F59E0B;"></i>` : '';

            btn.innerHTML = `${favHtml}${numHtml}<i class="${iconClass} grid-item-icon"></i>`;
            btn.style.position = 'relative'; // Ensure mini star positions correctly
            
            btn.addEventListener('click', () => {
                this.state.currentIndex = i;
                this.app.navigateTo('practice-view');
            });
            
            grid.appendChild(btn);
        });

        const total = this.state.questions.length;
        const skippedCount = total - correctCount - wrongCount;

        document.getElementById('count-all').textContent = total;
        
        // Update filter counts
        document.getElementById('count-favorites').textContent = favCount;
        const tfCount = this.state.questions.filter(q => q.type === 'true_false').length;
        document.getElementById('count-tf').textContent = tfCount;
        const singleCount = this.state.questions.filter(q => q.type === 'single_choice').length;
        document.getElementById('count-single').textContent = singleCount;
        const multipleCount = this.state.questions.filter(q => q.type === 'multiple_choice').length;
        document.getElementById('count-multiple').textContent = multipleCount;
    }

    updateStats() {
        const total = this.state.questions.length;
        const answers = this.state.userAnswers;
        const answeredCount = Object.keys(answers).length;
        
        let correct = 0, wrong = 0;
        for (const [id, answer] of Object.entries(answers)) {
            const q = this.state.questions.find(q => q.id === id);
            if (q) {
                if (this.checkIsCorrect(q, answer)) correct++;
                else wrong++;
            }
        }
        
        const accuracy = answeredCount > 0 ? Math.round((correct / answeredCount) * 100) : 0;
        const skipped = total - answeredCount;

        const percCorrect = total > 0 ? Math.round((correct/total)*100) : 0;
        const percWrong = total > 0 ? Math.round((wrong/total)*100) : 0;
        const percSkipped = total > 0 ? Math.round((skipped/total)*100) : 0;

        document.getElementById('accuracy-display').textContent = `${accuracy}%`;
        
        const chart = document.getElementById('donut-chart');
        const primColor = getComputedStyle(document.documentElement).getPropertyValue('--cyan').trim() || '#06B6D4';
        const surfColor = getComputedStyle(document.documentElement).getPropertyValue('--surface-highlight').trim() || '#1E293B';
        chart.style.background = `conic-gradient(${primColor} 0% ${accuracy}%, ${surfColor} ${accuracy}% 100%)`;

        document.getElementById('stats-answered-text').textContent = `${answeredCount}/${total} questions answered`;
        document.getElementById('stats-overall-progress').style.width = total > 0 ? `${(answeredCount/total)*100}%` : '0%';

        document.getElementById('stats-correct-val').textContent = correct;
        document.getElementById('bar-correct').style.width = `${percCorrect}%`;

        document.getElementById('stats-incorrect-val').textContent = wrong;
        document.getElementById('bar-incorrect').style.width = `${percWrong}%`;

        document.getElementById('stats-unanswered-val').textContent = skipped;
        document.getElementById('bar-unanswered').style.width = `${percSkipped}%`;
        
        const list = document.getElementById('breakdown-list');
        list.innerHTML = '';

        const breakdown = {};
        this.state.questions.forEach((q) => {
            const cat = q.category || q.type || 'General';
            const catName = cat.charAt(0).toUpperCase() + cat.slice(1).replace(/_/g, ' ');
            if (!breakdown[catName]) breakdown[catName] = { total: 0, correct: 0 };
            breakdown[catName].total++;
            const ans = this.state.userAnswers[q.id];
            if (ans && this.checkIsCorrect(q, ans)) {
                breakdown[catName].correct++;
            }
        });

        for (const [catName, data] of Object.entries(breakdown)) {
            const perc = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
            const card = document.createElement('div');
            card.className = 'stat-row-card mt-3'; 
            card.innerHTML = `
                <div class="stat-row-content">
                    <div class="flex-between mb-2">
                        <span class="text-color-main font-semibold text-sm">${catName}</span>
                        <div class="text-sm">
                            <span class="text-gray">${data.correct}/${data.total}</span>
                        </div>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar-fill bg-cyan" style="width: ${perc}%"></div>
                    </div>
                </div>
            `;
            list.appendChild(card);
        }
    }
}

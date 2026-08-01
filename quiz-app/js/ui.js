export class UI {
    constructor(state, app) {
        this.state = state;
        this.app = app;
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

        document.getElementById('question-counter').textContent = `Q#${index + 1} · ${index + 1}/${this.state.questions.length}`;
        document.getElementById('q-type-badge').textContent = q.type.toUpperCase();
        document.getElementById('question-text').textContent = q.question;
        
        const progress = ((index + 1) / this.state.questions.length) * 100;
        document.getElementById('practice-progress').style.width = `${progress}%`;

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
        
        const answers = this.state.userAnswers;
        let correctCount = 0, wrongCount = 0;

        this.state.questions.forEach((q, i) => {
            const btn = document.createElement('button');
            btn.className = 'grid-item';
            
            let iconClass = 'fas fa-circle text-gray';
            let numHtml = `<span>${i + 1}</span>`;
            
            const ans = answers[q.id];
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
                iconClass = 'fas fa-star';
            }
            
            btn.innerHTML = `${numHtml}<i class="${iconClass} grid-item-icon"></i>`;
            
            btn.addEventListener('click', () => {
                this.state.currentIndex = i;
                this.app.navigateTo('practice-view');
            });
            
            grid.appendChild(btn);
        });

        const total = this.state.questions.length;
        const skippedCount = total - correctCount - wrongCount;

        document.getElementById('count-all').textContent = total;
        document.getElementById('legend-correct').textContent = correctCount;
        document.getElementById('legend-wrong').textContent = wrongCount;
        document.getElementById('legend-skipped').textContent = skippedCount;
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
        document.getElementById('stats-correct-perc').textContent = `${percCorrect}%`;
        document.getElementById('bar-correct').style.width = `${percCorrect}%`;

        document.getElementById('stats-incorrect-val').textContent = wrong;
        document.getElementById('stats-incorrect-perc').textContent = `${percWrong}%`;
        document.getElementById('bar-incorrect').style.width = `${percWrong}%`;

        document.getElementById('stats-unanswered-val').textContent = skipped;
        document.getElementById('stats-unanswered-perc').textContent = `${percSkipped}%`;
        document.getElementById('bar-unanswered').style.width = `${percSkipped}%`;
        
        const list = document.getElementById('breakdown-list');
        list.innerHTML = `
            <div class="card p-4 mb-3" style="border:none; background-color:var(--surface-color);">
                <div class="flex-between mb-2">
                    <span class="text-color-main font-semibold text-sm">Strategy & IT</span>
                    <div class="text-sm">
                        <span class="text-gray mr-2">15/18</span>
                        <span class="text-cyan font-bold">83%</span>
                    </div>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar-fill bg-cyan" style="width: 83%"></div>
                </div>
            </div>
            <div class="card p-4 mb-3" style="border:none; background-color:var(--surface-color);">
                <div class="flex-between mb-2">
                    <span class="text-color-main font-semibold text-sm">Economics & Markets</span>
                    <div class="text-sm">
                        <span class="text-gray mr-2">13/20</span>
                        <span class="text-cyan font-bold">65%</span>
                    </div>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar-fill bg-cyan" style="width: 65%"></div>
                </div>
            </div>
        `;
    }
}

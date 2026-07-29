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
        const subjects = await fetchSubjects();
        this.ui.renderSubjects(subjects);
    }

    setupEventListeners() {
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

        document.getElementById('btn-prev').addEventListener('click', () => {
            if (this.state.currentIndex > 0) {
                this.state.currentIndex--;
                this.ui.renderQuestion(this.state.currentIndex);
            }
        });
        document.getElementById('btn-next').addEventListener('click', () => {
            if (this.state.currentIndex < this.state.questions.length - 1) {
                this.state.currentIndex++;
                this.ui.renderQuestion(this.state.currentIndex);
            }
        });
        document.getElementById('btn-practice-back').addEventListener('click', () => {
            this.navigateTo('dashboard-view');
        });
    }

    async loadSubject(subject) {
        this.state.currentSubject = subject;
        this.state.userAnswers = {};
        this.state.currentIndex = 0;
        
        this.state.questions = await fetchCSV(`data/${subject.file}`);
        
        document.getElementById('bottom-nav').classList.remove('hidden');
        this.navigateTo('dashboard-view');
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

        if (viewId === 'dashboard-view') this.ui.updateDashboard();
        if (viewId === 'practice-view') this.ui.renderQuestion(this.state.currentIndex);
        if (viewId === 'bank-view') this.ui.renderBank();
        if (viewId === 'stats-view') this.ui.updateStats();
    }

    submitAnswer(qId, answer) {
        this.state.userAnswers[qId] = answer;
        this.ui.renderQuestion(this.state.currentIndex);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new QuizApp();
});

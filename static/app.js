const App = {
  user: null,
  progress: [],
  adminStudents: [],
  currentStage: null,
  currentExercise: null,
  currentWordIndex: 0,
  words: [],
  completedExercises: {}, // Track which exercises are done per stage
  jumbleLetters: [],
  answerLetters: [],
  selectedDefinitions: {},
  matchCorrectCount: 0,
  wordResults: [],
  adminAnswers: [],
  viewingStudentId: null,
  viewingStage: null,

  async init() {
    try {
      const res = await fetch('/api/me');
      if (res.ok) {
        this.user = await res.json();
        await this.loadProgress();
        if (this.user.role === 'admin') {
          await this.showAdminDashboard();
        } else {
          this.showDashboard();
        }
      } else {
        this.showLogin();
      }
    } catch (e) {
      this.showLogin();
    }
  },

  showLogin() {
    document.getElementById('app').innerHTML = `
      <div class="login-screen">
        <div class="login-title">SPELL<span>GRID</span></div>
        <div class="login-subtitle">// HIRIYA SPELLING BEE 2026</div>
        <form class="login-form" onsubmit="App.handleLogin(event)">
          <div>
            <label class="label">Select User</label>
            <select class="input" id="username" required>
              <option value="">Select user...</option>
              <option value="admin">Admin</option>
              <option value="student1">Student One</option>
              <option value="student2">Student Two</option>
              <option value="test">Test</option>
            </select>
          </div>
          <div>
            <label class="label">PIN</label>
            <input type="password" class="input" id="pin" maxlength="4" required>
          </div>
          <button type="submit" class="btn btn-cyan">ENTER</button>
        </form>
      </div>
    `;
  },

  async handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const pin = document.getElementById('pin').value;

    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, pin })
    });

    if (res.ok) {
      this.user = await res.json();
      await this.loadProgress();
      if (this.user.role === 'admin') {
        await this.showAdminDashboard();
      } else {
        this.showDashboard();
      }
    } else {
      await this.showModal('Invalid username or PIN');
    }
  },

  async logout() {
    await fetch('/api/logout', { method: 'POST' });
    this.user = null;
    this.showLogin();
  },

  async loadProgress() {
    const res = await fetch('/api/me/progress');
    this.progress = await res.json();
  },

  showDashboard() {
    const stages = [
      { name: 'Emotions – Positive & Anger', color: 'cyan' },
      { name: 'Emotions & Maths', color: 'pink' },
      { name: 'Civics, Biology & Physics', color: 'purple' },
      { name: 'Physics, Chemistry & Biology', color: 'yellow' },
      { name: 'Biology, Business & Geography', color: 'green' }
    ];

    document.getElementById('app').innerHTML = `
      <div class="header">
        <div class="logo">SPELLGRID</div>
        <div class="user-info">
          <span style="font-family: 'Share Tech Mono', monospace; font-size: 12px; color: var(--cyber-cyan);">${this.user.username.toUpperCase()}</span>
          <button class="btn btn-outline" onclick="App.logout()" style="padding: 6px 12px; font-size: 11px;">LOGOUT</button>
        </div>
      </div>
      <div class="container" style="padding-top: 32px;">
        <div style="font-family: 'Share Tech Mono', monospace; font-size: 11px; color: var(--text-muted); letter-spacing: 2px; margin-bottom: 12px;">// SELECT A STAGE</div>
        <div class="stage-row">
          ${this.progress.map((p, i) => {
            const stage = stages[i];
            let statusClass = 'locked';
            let statusText = 'LOCKED';
            if (p.status === 'active') { statusClass = 'active'; statusText = 'IN PROGRESS'; }
            if (p.status === 'submitted') { statusClass = 'submitted'; statusText = 'SUBMITTED'; }
            if (p.status === 'approved') { statusClass = 'complete'; statusText = 'COMPLETE'; }
            
            return `
              <div class="stage-block ${statusClass}" onclick="App.selectStage(${p.stage})" ${p.status === 'locked' ? 'style="cursor: not-allowed;"' : ''}>
                <div class="stage-num" style="color: var(--cyber-${stage.color})">${String(p.stage).padStart(2, '0')}</div>
                <div class="stage-text">${statusText}</div>
              </div>
            `;
          }).join('')}
        </div>

        ${this.currentStage ? `
        <div style="margin-top: 16px;">
          <div style="font-family: 'Share Tech Mono', monospace; font-size: 11px; color: var(--text-muted); letter-spacing: 2px; margin-bottom: 10px;">// STAGE ${String(this.currentStage).padStart(2, '0')} EXERCISES</div>
          <div class="ex-grid">
            <div class="ex-item" onclick="App.startExercise('match')">
              <div class="ex-item-title">🔗 Match the Meaning</div>
              <div class="ex-item-sub">${this.completedExercises[this.currentStage]?.match ? '✓ Complete' : 'Not started'}</div>
            </div>
            <div class="ex-item" onclick="App.startExercise('jumble')">
              <div class="ex-item-title">🔀 Jumbled Word</div>
              <div class="ex-item-sub">${this.completedExercises[this.currentStage]?.jumble ? '✓ Complete' : 'Not started'}</div>
            </div>
            <div class="ex-item" onclick="App.startExercise('fill')">
              <div class="ex-item-title">✏️ Fill the Letters</div>
              <div class="ex-item-sub">${this.completedExercises[this.currentStage]?.fill ? '✓ Complete' : 'Not started'}</div>
            </div>
            <div class="ex-item" onclick="App.startExercise('meaning')">
              <div class="ex-item-title">📝 Write the Meaning</div>
              <div class="ex-item-sub">${this.completedExercises[this.currentStage]?.meaning ? '✓ Complete' : 'Not started'}</div>
            </div>
          </div>
        </div>
        ` : ''}
      </div>
    `;
  },

  async selectStage(stage) {
    const p = this.progress.find(x => x.stage === stage);
    if (p.status === 'locked') return;

    this.currentStage = stage;
    const [wordsRes, statusRes] = await Promise.all([
      fetch(`/api/stage/${stage}/words`),
      fetch(`/api/stage/${stage}/exercise-status`)
    ]);
    this.words = await wordsRes.json();
    const status = await statusRes.json();
    this.completedExercises[stage] = status;
    this.showDashboard();
  },

  async startExercise(type) {
    if (type === 'match' && this.completedExercises[this.currentStage]?.match) {
      await this.showModal('Match the Meaning is already completed. Ask your teacher to reset the session to retry.');
      return;
    }
    this.currentExercise = type;
    this.currentWordIndex = 0;
    this.wordResults = [];

    if (type === 'jumble') {
      this.initJumble();
    } else if (type === 'fill') {
      this.initFill();
    } else if (type === 'match') {
      this.initMatch();
    } else if (type === 'meaning') {
      this.initMeaning();
    }
  },

  initJumble() {
    const word = this.words[this.currentWordIndex];
    const letters = word.word.toLowerCase().split('');
    this.jumbleLetters = this.shuffleArray(letters);
    this.answerLetters = new Array(letters.length).fill(null);
    this.renderJumble();
  },

  renderJumble() {
    const word = this.words[this.currentWordIndex];
    document.getElementById('app').innerHTML = `
      <div class="header">
        <div class="logo">SPELLGRID</div>
        <button class="btn btn-outline" onclick="App.showDashboard()" style="padding: 6px 12px; font-size: 11px;">BACK</button>
      </div>
      <div class="container" style="padding-top: 32px;">
        <div class="exercise-header">
          <div class="exercise-label">// JUMBLE · ${this.currentWordIndex + 1} OF ${this.words.length}</div>
          <div class="progress-dots">
            ${this.words.map((_, i) => `<div class="progress-dot" style="background: ${i < this.currentWordIndex ? (this.wordResults[i] ? 'var(--cyber-green)' : 'var(--cyber-pink)') : i === this.currentWordIndex ? 'var(--cyber-pink)' : 'var(--cyber-border)'}"></div>`).join('')}
          </div>
        </div>
        
        <div class="jumble-container">
          <div class="label">ARRANGE THE LETTERS</div>
          <div class="letters-container">
            ${this.jumbleLetters.map((l, i) => l ? `<div class="letter-tile" onclick="App.selectLetter(${i})">${l}</div>` : '').join('')}
          </div>
          
          <div class="answer-tiles">
            ${this.answerLetters.map((l, i) => `<div class="answer-tile ${l ? '' : 'empty'}" onclick="App.removeLetter(${i})">${l || ''}</div>`).join('')}
          </div>
          
          <div style="font-size: 10px; color: var(--text-muted); margin-top: 10px; font-family: 'Share Tech Mono', monospace;">TAP A LETTER TO PLACE · TAP PLACED LETTER TO REMOVE</div>
        </div>
        
        <div style="display: flex; justify-content: center; gap: 12px; margin-top: 24px;">
          <button class="btn btn-outline" onclick="App.clearJumble()">CLEAR</button>
          <button class="btn btn-cyan" onclick="App.checkJumble()" ${this.answerLetters.every(l => l !== null) ? '' : 'disabled'}>CHECK →</button>
        </div>
      </div>
    `;
  },

  selectLetter(index) {
    const letter = this.jumbleLetters[index];
    const emptyIndex = this.answerLetters.findIndex(x => x === null);
    if (emptyIndex !== -1) {
      this.answerLetters[emptyIndex] = letter;
      this.jumbleLetters[index] = null;
      this.renderJumble();
    }
  },

  removeLetter(index) {
    if (this.answerLetters[index]) {
      const letter = this.answerLetters[index];
      const emptyIndex = this.jumbleLetters.findIndex(x => x === null);
      if (emptyIndex !== -1) {
        this.jumbleLetters[emptyIndex] = letter;
        this.answerLetters[index] = null;
        this.renderJumble();
      }
    }
  },

  clearJumble() {
    this.initJumble();
  },

  async checkJumble() {
    const answer = this.answerLetters.join('');
    const word = this.words[this.currentWordIndex];
    
    const res = await fetch('/api/answers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        word_id: word.id,
        exercise_type: 'jumble',
        answer: answer
      })
    });
    
    const data = await res.json();
    this.wordResults[this.currentWordIndex] = data.is_correct;
    await this.showModal(data.is_correct ? 'Correct!' : 'Wrong!');
    this.nextWord();
  },

  initFill() {
    this.renderFill();
  },

  renderFill() {
    const word = this.words[this.currentWordIndex];
    const letters = word.word.split('');
    
    // Hide first letter and ~30% of remaining
    const hidden = new Array(letters.length).fill(false);
    hidden[0] = true;
    for (let i = 1; i < letters.length; i++) {
      if (Math.random() < 0.3) {
        hidden[i] = true;
      }
    }
    
    document.getElementById('app').innerHTML = `
      <div class="header">
        <div class="logo">SPELLGRID</div>
        <button class="btn btn-outline" onclick="App.showDashboard()" style="padding: 6px 12px; font-size: 11px;">BACK</button>
      </div>
      <div class="container" style="padding-top: 32px;">
        <div class="exercise-header">
          <div class="exercise-label">// FILL LETTERS · ${this.currentWordIndex + 1} OF ${this.words.length}</div>
          <div class="progress-dots">
            ${this.words.map((_, i) => `<div class="progress-dot" style="background: ${i < this.currentWordIndex ? (this.wordResults[i] ? 'var(--cyber-green)' : 'var(--cyber-pink)') : i === this.currentWordIndex ? 'var(--cyber-purple)' : 'var(--cyber-border)'}"></div>`).join('')}
          </div>
        </div>
        
        <div class="fill-container">
          <div class="label">DEFINITION</div>
          <div class="definition">"${word.definition}"</div>
          
          <div class="fill-word">
            ${letters.map((l, i) => hidden[i] 
              ? `<input type="text" class="fill-input" data-index="${i}" maxlength="1" oninput="App.checkFillComplete()">`
              : `<div class="fill-letter">${l.toUpperCase()}</div>`
            ).join('')}
          </div>
        </div>
        
        <div style="display: flex; justify-content: center; gap: 12px; margin-top: 24px;">
          <button class="btn btn-outline" onclick="App.initFill()">CLEAR</button>
          <button class="btn btn-cyan" onclick="App.checkFill()" id="fillCheckBtn" disabled>CHECK →</button>
        </div>
      </div>
    `;
  },

  checkFillComplete() {
    const inputs = document.querySelectorAll('.fill-input');
    const allFilled = Array.from(inputs).every(i => i.value.length > 0);
    document.getElementById('fillCheckBtn').disabled = !allFilled;
  },

  async checkFill() {
    const inputs = document.querySelectorAll('.fill-input');
    const word = this.words[this.currentWordIndex];
    const letters = word.word.split('');
    
    let answer = [...letters];
    inputs.forEach(input => {
      const index = parseInt(input.dataset.index);
      answer[index] = input.value.toLowerCase();
    });
    
    const res = await fetch('/api/answers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        word_id: word.id,
        exercise_type: 'fill',
        answer: answer.join('')
      })
    });
    
    const data = await res.json();
    
    this.wordResults[this.currentWordIndex] = data.is_correct;
    await this.showModal(data.is_correct ? 'Correct!' : 'Wrong!');
    this.nextWord();
  },

  initMatch() {
    if (this.currentWordIndex === 0) {
      this.matchCorrectCount = 0;
    }
    this.renderMatch();
  },

  renderMatch() {
    const word = this.words[this.currentWordIndex];
    document.getElementById('app').innerHTML = `
      <div class="header">
        <div class="logo">SPELLGRID</div>
        <button class="btn btn-outline" onclick="App.showDashboard()" style="padding: 6px 12px; font-size: 11px;">BACK</button>
      </div>
      <div class="container" style="padding-top: 32px;">
        <div class="exercise-header">
          <div class="exercise-label">// MATCH MEANING · ${this.currentWordIndex + 1} OF ${this.words.length}</div>
          <div class="progress-dots">
            ${this.words.map((_, i) => `<div class="progress-dot" style="background: ${i < this.currentWordIndex ? (this.wordResults[i] ? 'var(--cyber-green)' : 'var(--cyber-pink)') : i === this.currentWordIndex ? 'var(--cyber-cyan)' : 'var(--cyber-border)'}"></div>`).join('')}
          </div>
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <div style="font-family: 'Rajdhani', sans-serif; font-size: 32px; font-weight: 700; color: var(--cyber-cyan); margin-bottom: 32px;">${word.word.toUpperCase()}</div>

          <div style="max-width: 600px; margin: 0 auto;">
            <label class="label">TYPE THE EXACT MEANING</label>
            <textarea class="meaning-textarea" id="matchAnswer" placeholder="Type the meaning exactly as it appears..."></textarea>
          </div>
        </div>

        <div style="display: flex; justify-content: center; gap: 12px; margin-top: 24px;">
          <button class="btn btn-outline" onclick="App.renderMatch()">CLEAR</button>
          <button class="btn btn-cyan" onclick="App.checkMatch()">SUBMIT →</button>
        </div>
      </div>
    `;
  },

  async checkMatch() {
    const answer = document.getElementById('matchAnswer').value;
    const word = this.words[this.currentWordIndex];

    if (!answer.trim()) {
      await this.showModal('Please enter an answer');
      return;
    }

    const res = await fetch('/api/answers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        word_id: word.id,
        exercise_type: 'match',
        answer: answer
      })
    });

    const data = await res.json();

    this.wordResults[this.currentWordIndex] = data.is_correct;
    if (data.is_correct) {
      this.matchCorrectCount++;
      await this.showModal('Correct!');
    } else {
      await this.showModal('Wrong!');
    }
    this.nextWord();
  },

  initMeaning() {
    if (this.currentWordIndex === 0) {
      this.meaningWords = this.shuffleArray([...this.words]);
    }
    this.renderMeaning();
  },

  renderMeaning() {
    const word = this.meaningWords[this.currentWordIndex];
    document.getElementById('app').innerHTML = `
      <div class="header">
        <div class="logo">SPELLGRID</div>
        <button class="btn btn-outline" onclick="App.showDashboard()" style="padding: 6px 12px; font-size: 11px;">BACK</button>
      </div>
      <div class="container" style="padding-top: 32px;">
        <div class="exercise-header">
          <div class="exercise-label">// WRITE MEANING · ${this.currentWordIndex + 1} OF ${this.meaningWords.length}</div>
          <div class="progress-dots">
            ${this.meaningWords.map((_, i) => `<div class="progress-dot" style="background: ${i < this.currentWordIndex ? (this.wordResults[i] ? 'var(--cyber-green)' : 'var(--cyber-pink)') : i === this.currentWordIndex ? 'var(--cyber-yellow)' : 'var(--cyber-border)'}"></div>`).join('')}
          </div>
        </div>
        
        <div style="text-align: center; margin: 24px 0;">
          <div style="font-family: 'Rajdhani', sans-serif; font-size: 36px; font-weight: 700; color: var(--cyber-yellow); margin-bottom: 32px;">${word.word.toUpperCase()}</div>
          
          <div style="max-width: 600px; margin: 0 auto;">
            <label class="label">WRITE THE MEANING IN YOUR OWN WORDS</label>
            <textarea class="meaning-textarea" id="meaningAnswer" placeholder="Type your answer here..."></textarea>
          </div>
        </div>
        
        <div style="display: flex; justify-content: center; gap: 12px; margin-top: 24px;">
          <button class="btn btn-outline" onclick="App.initMeaning()">CLEAR</button>
          <button class="btn btn-cyan" onclick="App.checkMeaning()">SUBMIT →</button>
        </div>
      </div>
    `;
  },

  async checkMeaning() {
    const answer = document.getElementById('meaningAnswer').value;
    const word = this.meaningWords[this.currentWordIndex];
    
    if (!answer.trim()) {
      await this.showModal('Please enter an answer');
      return;
    }
    
    const res = await fetch('/api/answers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        word_id: word.id,
        exercise_type: 'meaning',
        answer: answer
      })
    });
    
    const data = await res.json();
    this.wordResults[this.currentWordIndex] = data.is_correct;
    if (data.is_correct) {
      await this.showModal('Good answer!');
    } else {
      await this.showModal('Marked wrong. Wait for the teacher to give you a second chance.');
    }
    this.nextWord();
  },

  async nextWord() {
    this.currentWordIndex++;
    if (this.currentWordIndex >= this.words.length) {
      if (this.currentExercise === 'match') {
        const total = this.words.length;
        const pct = Math.round((this.matchCorrectCount / total) * 100);
        if (this.matchCorrectCount / total >= 0.8) {
          this.completedExercises[this.currentStage].match = true;
          await this.showModal(`Match complete! You got ${this.matchCorrectCount}/${total} correct (${pct}%).`);
        } else {
          await this.showModal(`You got ${this.matchCorrectCount}/${total} correct (${pct}%). You need 80% to pass. Ask your teacher to reset and try again.`);
        }
      } else {
        this.completedExercises[this.currentStage][this.currentExercise] = true;
      }
      const completed = this.completedExercises[this.currentStage];
      const allDone = completed.match && completed.jumble && completed.fill && completed.meaning;
      if (allDone) {
        fetch('/api/stage/' + this.currentStage + '/submit', { method: 'POST' });
        await this.showModal('Stage complete! Submit for teacher assessment.');
      }
      this.showDashboard();
    } else {
      if (this.currentExercise === 'jumble') this.initJumble();
      else if (this.currentExercise === 'fill') this.initFill();
      else if (this.currentExercise === 'match') this.initMatch();
      else if (this.currentExercise === 'meaning') this.initMeaning();
    }
  },

  showModal(message) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;';
      overlay.innerHTML = `
        <div style="background:var(--cyber-bg,#0d1117);border:1px solid var(--cyber-border,#30363d);border-radius:8px;min-width:300px;max-width:480px;font-family:'Share Tech Mono',monospace;">
          <div style="padding:12px 20px;border-bottom:1px solid var(--cyber-border,#30363d);font-size:11px;letter-spacing:3px;color:var(--cyber-cyan,#00d4ff);">SPELLGRID</div>
          <div style="padding:24px 20px;font-size:15px;color:var(--text-primary,#e6edf3);line-height:1.5;">${message}</div>
          <div style="padding:12px 20px;display:flex;justify-content:flex-end;">
            <button id="sg-modal-ok" style="background:var(--cyber-cyan,#00d4ff);color:#000;border:none;padding:8px 24px;font-family:'Share Tech Mono',monospace;font-size:13px;letter-spacing:2px;cursor:pointer;border-radius:4px;">OK</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      const close = () => { document.body.removeChild(overlay); resolve(); };
      overlay.querySelector('#sg-modal-ok').addEventListener('click', close);
      overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    });
  },

  shuffleArray(arr) {
    arr = arr.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  async showAdminDashboard() {
    const res = await fetch('/api/admin/students');
    const students = await res.json();
    this.adminStudents = students;
    
    document.getElementById('app').innerHTML = `
      <div class="header">
        <div class="logo">SPELLGRID</div>
        <div class="user-info">
          <span class="tag tag-pink">ADMIN</span>
          <button class="btn btn-outline" onclick="App.logout()" style="padding: 6px 12px; font-size: 11px;">LOGOUT</button>
        </div>
      </div>
      <div class="container" style="padding-top: 32px;">
        <div style="font-family: 'Share Tech Mono', monospace; font-size: 11px; color: var(--text-muted); letter-spacing: 2px; margin-bottom: 14px;">// STUDENT PROGRESS OVERVIEW</div>
        
        ${students.map(s => `
          <div class="student-card">
            <div class="student-header">
              <div class="student-name">${s.username.toUpperCase()}</div>
              <div style="display: flex; gap: 6px;">
                ${s.progress.map(p => {
                  let tagClass = 'tag-pink';
                  let text = 'S' + p.stage + ' LOCKED';
                  if (p.status === 'active') { tagClass = 'tag-cyan'; text = 'S' + p.stage + ' ACTIVE'; }
                  if (p.status === 'submitted') { tagClass = 'tag-yellow'; text = 'S' + p.stage + ' SUBMITTED'; }
                  if (p.status === 'approved') { tagClass = 'tag-green'; text = 'S' + p.stage + ' APPROVED'; }
                  return `<span class="tag ${tagClass}">${text}</span>`;
                }).join('')}
              </div>
            </div>
            
            <div style="display: flex; gap: 4px; margin-bottom: 12px;">
              ${s.progress.map(p => `<div style="flex: 1; height: 6px; border-radius: 1px; background: ${p.status === 'approved' ? 'var(--cyber-green)' : p.status === 'submitted' ? 'var(--cyber-yellow)' : p.status === 'active' ? 'var(--cyber-cyan)' : 'var(--cyber-border)'};"></div>`).join('')}
            </div>
            
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              ${s.progress.map(p => p.status === 'submitted'
                ? `<button class="btn btn-cyan" style="font-size: 11px; padding: 7px 16px;" onclick="App.approveStage(${s.id}, ${p.stage})">APPROVE STAGE ${p.stage}</button>`
                : ''
              ).join('')}
              <button class="btn btn-outline" style="font-size: 11px; padding: 7px 16px;" onclick="App.viewAnswers(${s.id})">VIEW ANSWERS</button>
              ${s.progress.map(p => p.status !== 'locked'
                ? `<button class="btn" style="font-size: 11px; padding: 7px 16px; color: var(--cyber-pink); border: 1px solid rgba(255,45,120,0.3); background: transparent;" onclick="App.resetStage(${s.id}, ${p.stage})">RESET STAGE ${p.stage}</button>`
                : ''
              ).join('')}
              ${s.progress.map(p => p.status !== 'locked'
                ? `<button class="btn" style="font-size: 11px; padding: 7px 16px; color: var(--cyber-yellow); border: 1px solid rgba(255,200,0,0.3); background: transparent;" onclick="App.lockStage(${s.id}, ${p.stage})">LOCK STAGE ${p.stage}</button>`
                : ''
              ).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  async unlockStage(userId, stage) {
    await fetch('/api/admin/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, stage: stage })
    });
    this.showAdminDashboard();
  },

  async approveStage(userId, stage) {
    await fetch('/api/admin/approve-stage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, stage: stage })
    });
    this.viewingStudentId = null;
    this.viewingStage = null;
    this.showAdminDashboard();
  },

  async resetStage(userId, stage) {
    if (confirm('Are you sure you want to reset this stage? This will delete all answers for this stage.')) {
      await fetch('/api/admin/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, stage: stage })
      });
      this.showAdminDashboard();
    }
  },

  async lockStage(userId, stage) {
    if (confirm(`Lock Stage ${stage} for this student? They will not be able to access it until unlocked.`)) {
      await fetch('/api/admin/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, stage: stage })
      });
      await this.showAdminDashboard();
    }
  },

  async viewAnswers(userId, stage = null) {
    const student = this.adminStudents.find(s => s.id === userId);
    if (!student) {
      await this.showModal('Student not found');
      return;
    }

    const availableStages = student.progress.filter(p => p.status !== 'locked');
    const defaultStage = stage || (this.viewingStudentId === userId && this.viewingStage
      ? this.viewingStage
      : (availableStages.find(p => p.status === 'submitted')?.stage || availableStages[0]?.stage || 1));

    this.viewingStudentId = userId;
    this.viewingStage = defaultStage;

    const res = await fetch(`/api/admin/answers/${userId}/${defaultStage}`);
    this.adminAnswers = await res.json();
    const stageProgress = student.progress.find(p => p.stage === this.viewingStage);
    const stageStatus = stageProgress?.status || 'locked';

    const stageButtons = availableStages.map(p => {
      const active = p.stage === this.viewingStage ? 'btn-cyan' : 'btn-outline';
      return `<button class="btn ${active}" style="font-size: 11px; padding: 7px 16px;" onclick="App.viewAnswers(${userId}, ${p.stage})">STAGE ${p.stage}</button>`;
    }).join('');

    document.getElementById('app').innerHTML = `
      <div class="header">
        <div class="logo">SPELLGRID</div>
        <div class="user-info">
          <span class="tag tag-pink">REVIEW</span>
          <button class="btn btn-outline" onclick="App.showAdminDashboard()" style="padding: 6px 12px; font-size: 11px;">BACK</button>
        </div>
      </div>
      <div class="container" style="padding-top: 32px;">
        <div class="answers-header">
          <div>
            <div style="font-family: 'Share Tech Mono', monospace; font-size: 11px; color: var(--text-muted); letter-spacing: 2px; margin-bottom: 8px;">// ANSWER REVIEW</div>
            <div class="student-name">${student.username.toUpperCase()}</div>
          </div>
          <div class="answers-stage-picker">${stageButtons}</div>
        </div>

        <div class="answers-toolbar">
          ${stageStatus === 'submitted'
            ? `<button class="btn btn-cyan" style="font-size: 11px; padding: 7px 16px;" onclick="App.approveStage(${userId}, ${this.viewingStage})">APPROVE STAGE ${this.viewingStage}</button>`
            : stageStatus === 'approved'
              ? `<span class="tag tag-green">STAGE ${this.viewingStage} APPROVED</span>`
              : ''
          }
          <button class="btn btn-outline" style="font-size: 11px; padding: 7px 16px;" onclick="App.resetStage(${userId}, ${this.viewingStage})">RESET STAGE ${this.viewingStage}</button>
        </div>

        ${this.adminAnswers.length ? this.adminAnswers.map(answer => `
          <div class="answer-card ${answer.is_correct ? 'answer-card-correct' : 'answer-card-wrong'}">
            <div class="answer-card-top">
              <div>
                <div class="answer-word">${answer.word}</div>
                <div class="answer-meta">${answer.exercise_type.toUpperCase()} · ${answer.submitted_at}</div>
              </div>
              <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                <span class="tag ${answer.is_correct ? 'tag-green' : 'tag-pink'}">${answer.is_correct ? 'CORRECT' : 'WRONG'}</span>
                ${answer.teacher_override ? '<span class="tag tag-yellow">TEACHER OVERRIDE</span>' : ''}
              </div>
            </div>

            <div class="answer-grid">
              <div class="answer-panel">
                <div class="label">WORD DEFINITION</div>
                <div class="answer-text">${answer.definition}</div>
              </div>
              <div class="answer-panel">
                <div class="label">STUDENT ANSWER</div>
                <div class="answer-text">${answer.answer ? this.escapeHtml(answer.answer) : '<span style="color: var(--text-muted);">No answer</span>'}</div>
              </div>
            </div>

            <div class="answer-actions">
              <button class="btn btn-cyan" style="font-size: 11px; padding: 7px 16px;" onclick="App.overrideAnswer(${answer.id}, true)">MARK CORRECT</button>
              <button class="btn" style="font-size: 11px; padding: 7px 16px; color: var(--cyber-pink); border: 1px solid rgba(255,45,120,0.3); background: transparent;" onclick="App.overrideAnswer(${answer.id}, false)">MARK WRONG</button>
            </div>
          </div>
        `).join('') : `
          <div class="student-card">
            <div class="student-name">NO ANSWERS YET</div>
            <div style="margin-top: 8px; color: var(--text-secondary);">This student has no recorded answers for stage ${this.viewingStage}.</div>
          </div>
        `}
      </div>
    `;
  },

  async overrideAnswer(answerId, isCorrect) {
    if (!this.viewingStudentId || !this.viewingStage) return;

    await fetch('/api/admin/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer_id: answerId, is_correct: isCorrect })
    });

    this.viewAnswers(this.viewingStudentId, this.viewingStage);
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());

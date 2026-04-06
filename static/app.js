const App = {
  user: null,
  progress: [],
  currentStage: null,
  currentExercise: null,
  currentWordIndex: 0,
  words: [],
  completedExercises: {}, // Track which exercises are done per stage
  jumbleLetters: [],
  answerLetters: [],
  selectedDefinitions: {},

  async init() {
    try {
      const res = await fetch('/api/me');
      if (res.ok) {
        this.user = await res.json();
        await this.loadProgress();
        this.showDashboard();
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
        this.showAdminDashboard();
      } else {
        this.showDashboard();
      }
    } else {
      alert('Invalid username or PIN');
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
    this.completedExercises[stage] = { match: false, jumble: false, fill: false, meaning: false };
    const res = await fetch(`/api/stage/${stage}/words`);
    this.words = await res.json();
    this.showDashboard();
  },

  async startExercise(type) {
    this.currentExercise = type;
    this.currentWordIndex = 0;
    
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
            ${this.words.map((_, i) => `<div class="progress-dot" style="background: ${i < this.currentWordIndex ? 'var(--cyber-green)' : i === this.currentWordIndex ? 'var(--cyber-pink)' : 'var(--cyber-border)'}"></div>`).join('')}
          </div>
        </div>
        
        <div class="jumble-container">
          <div class="label">DEFINITION</div>
          <div class="definition">"${word.definition}"</div>
          
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
          <button class="btn btn-cyan" onclick="App.checkJumble()">CHECK →</button>
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
    
    if (data.is_correct) {
      alert('Correct!');
      this.completedExercises[this.currentStage].jumble = true;
      this.nextWord();
    } else {
      alert('Incorrect. The correct answer is: ' + word.word);
      this.completedExercises[this.currentStage].jumble = true;
      this.nextWord();
    }
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
            ${this.words.map((_, i) => `<div class="progress-dot" style="background: ${i < this.currentWordIndex ? 'var(--cyber-green)' : i === this.currentWordIndex ? 'var(--cyber-purple)' : 'var(--cyber-border)'}"></div>`).join('')}
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
    
    if (data.is_correct) {
      alert('Correct!');
      this.completedExercises[this.currentStage].fill = true;
      this.nextWord();
    } else {
      alert('Incorrect. The correct answer is: ' + word.word);
      this.completedExercises[this.currentStage].fill = true;
      this.nextWord();
    }
  },

  initMatch() {
    // Shuffle definitions
    this.definitions = this.shuffleArray(this.words.map(w => ({ id: w.id, definition: w.definition })));
    this.selectedDefinitions = {};
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
            ${this.words.map((_, i) => `<div class="progress-dot" style="background: ${i < this.currentWordIndex ? 'var(--cyber-green)' : i === this.currentWordIndex ? 'var(--cyber-cyan)' : 'var(--cyber-border)'}"></div>`).join('')}
          </div>
        </div>
        
        <div style="text-align: center; margin: 24px 0;">
          <div style="font-family: 'Rajdhani', sans-serif; font-size: 32px; font-weight: 700; color: var(--cyber-cyan); margin-bottom: 24px;">${word.word.toUpperCase()}</div>
          
          <div style="display: grid; grid-template-columns: 1fr; gap: 8px; max-width: 600px; margin: 0 auto;">
            ${this.definitions.map(d => `
              <div class="panel panel-cyan" style="cursor: pointer; padding: 16px;" onclick="App.selectMatch(${d.id})">
                ${d.definition}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  },

  async selectMatch(defId) {
    const word = this.words[this.currentWordIndex];
    
    const res = await fetch('/api/answers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        word_id: word.id,
        exercise_type: 'match',
        answer: this.words.find(w => w.id === defId)?.word || ''
      })
    });
    
    const data = await res.json();
    
    if (data.is_correct) {
      alert('Correct!');
      this.completedExercises[this.currentStage].match = true;
      this.nextWord();
    } else {
      alert('Incorrect. Try again after teacher assessment.');
      this.completedExercises[this.currentStage].match = true;
      this.showDashboard();
    }
  },

  initMeaning() {
    this.renderMeaning();
  },

  renderMeaning() {
    const word = this.words[this.currentWordIndex];
    document.getElementById('app').innerHTML = `
      <div class="header">
        <div class="logo">SPELLGRID</div>
        <button class="btn btn-outline" onclick="App.showDashboard()" style="padding: 6px 12px; font-size: 11px;">BACK</button>
      </div>
      <div class="container" style="padding-top: 32px;">
        <div class="exercise-header">
          <div class="exercise-label">// WRITE MEANING · ${this.currentWordIndex + 1} OF ${this.words.length}</div>
          <div class="progress-dots">
            ${this.words.map((_, i) => `<div class="progress-dot" style="background: ${i < this.currentWordIndex ? 'var(--cyber-green)' : i === this.currentWordIndex ? 'var(--cyber-yellow)' : 'var(--cyber-border)'}"></div>`).join('')}
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
    const word = this.words[this.currentWordIndex];
    
    if (!answer.trim()) {
      alert('Please enter an answer');
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
    
    if (data.is_correct) {
      alert('Good answer!');
      this.completedExercises[this.currentStage].meaning = true;
    } else {
      alert('Answer submitted for teacher review.\n\nDefinition: "' + word.definition + '"');
      this.completedExercises[this.currentStage].meaning = true;
    }
    
    this.nextWord();
  },

  nextWord() {
    this.currentWordIndex++;
    if (this.currentWordIndex >= this.words.length) {
      // Check if all exercises are complete
      const completed = this.completedExercises[this.currentStage];
      const allDone = completed && completed.match && completed.jumble && completed.fill && completed.meaning;
      
      if (allDone) {
        fetch('/api/stage/' + this.currentStage + '/submit', { method: 'POST' });
        alert('Stage complete! Submit for teacher assessment.');
      } else {
        alert('Exercise complete! You can continue with other exercises.');
      }
      this.showDashboard();
    } else {
      if (this.currentExercise === 'jumble') this.initJumble();
      else if (this.currentExercise === 'fill') this.initFill();
      else if (this.currentExercise === 'match') this.initMatch();
      else if (this.currentExercise === 'meaning') this.initMeaning();
    }
  },

  shuffleArray(arr) {
    arr = arr.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  async showAdminDashboard() {
    const res = await fetch('/api/admin/students');
    const students = await res.json();
    
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
                ? `<button class="btn btn-cyan" style="font-size: 11px; padding: 7px 16px;" onclick="App.unlockStage(${s.id}, ${p.stage})">UNLOCK STAGE ${p.stage + 1}</button>` 
                : ''
              ).join('')}
              <button class="btn btn-outline" style="font-size: 11px; padding: 7px 16px;" onclick="App.viewAnswers(${s.id})">VIEW ANSWERS</button>
              ${s.progress.map(p => p.status !== 'locked' 
                ? `<button class="btn" style="font-size: 11px; padding: 7px 16px; color: var(--cyber-pink); border: 1px solid rgba(255,45,120,0.3); background: transparent;" onclick="App.resetStage(${s.id}, ${p.stage})">RESET STAGE ${p.stage}</button>` 
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

  async viewAnswers(userId) {
    alert('Answers view coming soon');
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());

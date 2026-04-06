from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from flask_session import Session
import sqlite3
import hashlib
import json
import random
import datetime
from fuzzywuzzy import fuzz

app = Flask(__name__)
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SECRET_KEY'] = 'spellgrid_2026_hiriya_school'
app.config['SESSION_PERMANENT'] = False
Session(app)

def get_db():
    db = sqlite3.connect('spellgrid.db')
    db.row_factory = sqlite3.Row
    return db

# Fisher-Yates shuffle
def shuffle_array(arr):
    arr = arr.copy()
    for i in range(len(arr)-1, 0, -1):
        j = random.randint(0, i)
        arr[i], arr[j] = arr[j], arr[i]
    return arr

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    pin = data.get('pin')
    
    if not username or not pin:
        return jsonify({'error': 'Username and PIN required'}), 400
    
    pin_hash = hashlib.sha256(pin.encode('utf-8')).hexdigest()
    
    db = get_db()
    user = db.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    
    if not user or user['pin_hash'] != pin_hash:
        return jsonify({'error': 'Invalid username or PIN'}), 401
    
    session['user_id'] = user['id']
    session['username'] = user['username']
    session['role'] = user['role']
    session['is_test'] = user['is_test']
    
    return jsonify({
        'id': user['id'],
        'username': user['username'],
        'role': user['role'],
        'is_test': user['is_test']
    })

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})

@app.route('/api/me')
def me():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    return jsonify({
        'id': session['user_id'],
        'username': session['username'],
        'role': session['role'],
        'is_test': session['is_test']
    })

@app.route('/api/me/progress')
def my_progress():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    db = get_db()
    progress = db.execute('SELECT * FROM stage_progress WHERE user_id = ?', (session['user_id'],)).fetchall()
    
    result = []
    for p in progress:
        stage = p['stage']
        
        # Calculate completion
        answers = db.execute('''SELECT COUNT(*) as count, SUM(is_correct) as correct 
                               FROM answers 
                               WHERE user_id = ? AND word_id IN (SELECT id FROM words WHERE stage = ?)''',
                            (session['user_id'], stage)).fetchone()
        
        total_words = db.execute('SELECT COUNT(*) as count FROM words WHERE stage = ?', (stage,)).fetchone()['count']
        
        result.append({
            'stage': stage,
            'status': p['status'],
            'word_order': json.loads(p['word_order']) if p['word_order'] else None,
            'answers_count': answers['count'],
            'correct_count': answers['correct'] or 0,
            'total_words': total_words
        })
    
    return jsonify(result)

@app.route('/api/stage/<int:stage_num>/words')
def get_stage_words(stage_num):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    db = get_db()
    progress = db.execute('SELECT * FROM stage_progress WHERE user_id = ? AND stage = ?',
                         (session['user_id'], stage_num)).fetchone()
    
    if not progress or progress['status'] == 'locked':
        return jsonify({'error': 'Stage is locked'}), 403
    
    # Use existing word order or generate new one
    if progress['word_order']:
        word_ids = json.loads(progress['word_order'])
    else:
        words = db.execute('SELECT id FROM words WHERE stage = ?', (stage_num,)).fetchall()
        word_ids = [w['id'] for w in words]
        word_ids = shuffle_array(word_ids)
        db.execute('UPDATE stage_progress SET word_order = ? WHERE user_id = ? AND stage = ?',
                  (json.dumps(word_ids), session['user_id'], stage_num))
        db.commit()
    
    # Get words
    words = db.execute('SELECT id, word, definition, keywords FROM words WHERE id IN ({}) ORDER BY INSTR(?, id)'.format(','.join('?'*len(word_ids))),
                      tuple(word_ids) + (','.join(map(str, word_ids)),)).fetchall()
    
    return jsonify([{
        'id': w['id'],
        'word': w['word'],
        'definition': w['definition'],
        'keywords': w['keywords'].split(',') if w['keywords'] else []
    } for w in words])

@app.route('/api/answers', methods=['POST'])
def submit_answer():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    data = request.json
    word_id = data.get('word_id')
    exercise_type = data.get('exercise_type')
    answer = data.get('answer')
    
    if not word_id or not exercise_type:
        return jsonify({'error': 'Missing required fields'}), 400
    
    db = get_db()
    word = db.execute('SELECT * FROM words WHERE id = ?', (word_id,)).fetchone()
    
    if not word:
        return jsonify({'error': 'Word not found'}), 404
    
    is_correct = False
    
    if exercise_type == 'match':
        is_correct = (answer.lower() == word['word'].lower())
    elif exercise_type == 'jumble':
        is_correct = (answer.lower() == word['word'].lower())
    elif exercise_type == 'fill':
        is_correct = (answer.lower() == word['word'].lower())
    elif exercise_type == 'meaning':
        # Fuzzy matching for meaning
        keywords = word['keywords'].split(',') if word['keywords'] else []
        answer_lower = answer.lower()
        score = 0
        for kw in keywords:
            if kw in answer_lower:
                score += 1
        is_correct = (score >= 1)
    
    # Insert answer
    db.execute('''INSERT INTO answers (user_id, word_id, exercise_type, answer, is_correct)
                 VALUES (?, ?, ?, ?, ?)''',
              (session['user_id'], word_id, exercise_type, answer, is_correct))
    db.commit()
    
    return jsonify({
        'success': True,
        'is_correct': is_correct,
        'correct_answer': word['word'] if exercise_type != 'meaning' else None,
        'definition': word['definition']
    })

@app.route('/api/stage/<int:stage_num>/submit', methods=['POST'])
def submit_stage(stage_num):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    db = get_db()
    db.execute('UPDATE stage_progress SET status = "submitted" WHERE user_id = ? AND stage = ?',
              (session['user_id'], stage_num))
    db.commit()
    
    return jsonify({'success': True})

# Admin endpoints
@app.route('/api/admin/students')
def admin_students():
    if 'user_id' not in session or session['role'] != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    db = get_db()
    users = db.execute('SELECT id, username, role, is_test FROM users WHERE role = "student"').fetchall()
    
    result = []
    for u in users:
        progress = db.execute('SELECT * FROM stage_progress WHERE user_id = ?', (u['id'],)).fetchall()
        result.append({
            'id': u['id'],
            'username': u['username'],
            'is_test': u['is_test'],
            'progress': [{
                'stage': p['stage'],
                'status': p['status']
            } for p in progress]
        })
    
    return jsonify(result)

@app.route('/api/admin/unlock', methods=['POST'])
def admin_unlock():
    if 'user_id' not in session or session['role'] != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.json
    user_id = data.get('user_id')
    stage = data.get('stage')
    
    db = get_db()
    db.execute('UPDATE stage_progress SET status = "active", unlocked_at = ? WHERE user_id = ? AND stage = ?',
              (datetime.datetime.now(), user_id, stage))
    db.commit()
    
    return jsonify({'success': True})

@app.route('/api/admin/reset', methods=['POST'])
def admin_reset():
    if 'user_id' not in session or session['role'] != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.json
    user_id = data.get('user_id')
    stage = data.get('stage')
    
    db = get_db()
    # Delete answers for this stage
    db.execute('DELETE FROM answers WHERE user_id = ? AND word_id IN (SELECT id FROM words WHERE stage = ?)',
              (user_id, stage))
    # Reset progress
    db.execute('UPDATE stage_progress SET status = "active", word_order = NULL WHERE user_id = ? AND stage = ?',
              (user_id, stage))
    db.commit()
    
    return jsonify({'success': True})

@app.route('/api/admin/answers/<int:user_id>/<int:stage>')
def admin_get_answers(user_id, stage):
    if 'user_id' not in session or session['role'] != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    db = get_db()
    answers = db.execute('''SELECT a.*, w.word, w.definition 
                           FROM answers a 
                           JOIN words w ON a.word_id = w.id 
                           WHERE a.user_id = ? AND w.stage = ?
                           ORDER BY a.submitted_at DESC''',
                        (user_id, stage)).fetchall()
    
    return jsonify([{
        'id': a['id'],
        'word_id': a['word_id'],
        'word': a['word'],
        'definition': a['definition'],
        'exercise_type': a['exercise_type'],
        'answer': a['answer'],
        'is_correct': a['is_correct'],
        'teacher_override': a['teacher_override'],
        'submitted_at': a['submitted_at']
    } for a in answers])

@app.route('/api/admin/override', methods=['POST'])
def admin_override():
    if 'user_id' not in session or session['role'] != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.json
    answer_id = data.get('answer_id')
    is_correct = data.get('is_correct')
    
    db = get_db()
    db.execute('UPDATE answers SET is_correct = ?, teacher_override = 1 WHERE id = ?',
              (is_correct, answer_id))
    db.commit()
    
    return jsonify({'success': True})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

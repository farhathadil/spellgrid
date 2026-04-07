from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from flask_session import Session
import sqlite3
import hashlib
import json
import random
import datetime
import re
import math
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

STOPWORDS = {
    'the', 'and', 'or', 'to', 'of', 'in', 'is', 'a', 'an', 'that', 'which', 'for',
    'with', 'on', 'by', 'at', 'from', 'as', 'into', 'through', 'during', 'before',
    'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once',
    'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more',
    'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
    'than', 'too', 'very', 'can', 'will', 'just', 'should', 'now', 'it', 'its', 'this',
    'these', 'those', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'but',
    'if', 'because', 'while', 'also', 'about', 'would', 'could', 'their', 'they', 'them',
    'your', 'you', 'his', 'her', 'our', 'who', 'whom', 'any', 'may', 'must', 'many',
    'much', 'having'
}

def extract_keywords(text):
    tokens = re.findall(r"[a-zA-Z]+", text.lower())
    return {token for token in tokens if len(token) > 2 and token not in STOPWORDS}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
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
    
    # Get words in the stored shuffle order
    placeholders = ','.join('?' * len(word_ids))
    rows = db.execute(
        f'SELECT id, word, definition, keywords FROM words WHERE id IN ({placeholders})',
        tuple(word_ids)
    ).fetchall()
    order = {wid: i for i, wid in enumerate(word_ids)}
    words = sorted(rows, key=lambda w: order[w['id']])

    return jsonify([{
        'id': w['id'],
        'word': w['word'],
        'definition': w['definition'],
        'keywords': w['keywords'].split(',') if w['keywords'] else []
    } for w in words])

@app.route('/api/stage/<int:stage_num>/exercise-status')
def get_exercise_status(stage_num):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    db = get_db()
    total = db.execute('SELECT COUNT(*) as count FROM words WHERE stage = ?', (stage_num,)).fetchone()['count']

    status = {}
    for ex_type in ('match', 'jumble', 'fill', 'meaning'):
        row = db.execute(
            '''SELECT COUNT(DISTINCT word_id) as answered,
                      SUM(is_correct) as correct
               FROM answers
               WHERE user_id = ? AND exercise_type = ?
               AND word_id IN (SELECT id FROM words WHERE stage = ?)''',
            (session['user_id'], ex_type, stage_num)
        ).fetchone()
        answered = row['answered'] or 0
        correct = int(row['correct'] or 0)
        status[ex_type] = {
            'completed': (answered >= total and total > 0),
            'correct': correct,
            'total': total
        }

    return jsonify(status)

@app.route('/api/answers', methods=['POST'])
def submit_answer():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    data = request.get_json(silent=True) or {}
    word_id = data.get('word_id')
    exercise_type = data.get('exercise_type')
    answer = data.get('answer')
    
    if not word_id or not exercise_type:
        return jsonify({'error': 'Missing required fields'}), 400
    if exercise_type not in {'match', 'jumble', 'fill', 'meaning'}:
        return jsonify({'error': 'Invalid exercise type'}), 400
    if not isinstance(answer, str) or not answer.strip():
        return jsonify({'error': 'Answer is required'}), 400
    
    db = get_db()
    word = db.execute('SELECT * FROM words WHERE id = ?', (word_id,)).fetchone()
    
    if not word:
        return jsonify({'error': 'Word not found'}), 404

    progress = db.execute('SELECT * FROM stage_progress WHERE user_id = ? AND stage = ?',
                         (session['user_id'], word['stage'])).fetchone()
    if not progress or progress['status'] != 'active':
        return jsonify({'error': 'Stage is not available for answers'}), 403
    
    is_correct = False
    answer_normalized = answer.strip()
    
    if exercise_type == 'match':
        # Student must type the definition exactly (case-insensitive, whitespace-normalised)
        expected = ' '.join(word['definition'].lower().split())
        given = ' '.join(answer_normalized.lower().split())
        is_correct = (given == expected)
    elif exercise_type == 'jumble':
        is_correct = (answer_normalized.lower() == word['word'].lower())
    elif exercise_type == 'fill':
        is_correct = (answer_normalized.lower() == word['word'].lower())
    elif exercise_type == 'meaning':
        # Grade against the curated stored keywords first, then fall back to the definition text.
        definition = word['definition'].lower()
        answer_lower = answer_normalized.lower()

        answer_keywords = extract_keywords(answer_lower)
        expected_keywords = extract_keywords(word['keywords'] or '')
        if not expected_keywords:
            expected_keywords = extract_keywords(definition)

        keyword_matches = len(answer_keywords & expected_keywords)
        # Require 80% of expected keywords — ceil ensures short definitions
        # (e.g. "Extremely angry" = 2 keywords) need all keywords, not just one.
        required_matches = max(1, math.ceil(len(expected_keywords) * 0.8))

        # Only apply fuzzy phrase matching if the answer has at least 2 meaningful keywords,
        # preventing single letters/stopword-only answers from matching via partial_ratio.
        phrase_match = (
            len(answer_keywords) >= 2 and (
                fuzz.token_set_ratio(answer_lower, definition) >= 85 or
                fuzz.partial_ratio(answer_lower, definition) >= 85
            )
        )

        is_correct = keyword_matches >= required_matches or phrase_match
    
    # Insert answer
    db.execute('''INSERT INTO answers (user_id, word_id, exercise_type, answer, is_correct)
                 VALUES (?, ?, ?, ?, ?)''',
              (session['user_id'], word_id, exercise_type, answer_normalized, is_correct))
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
    progress = db.execute('SELECT * FROM stage_progress WHERE user_id = ? AND stage = ?',
                         (session['user_id'], stage_num)).fetchone()
    if not progress or progress['status'] != 'active':
        return jsonify({'error': 'Stage is not available for submission'}), 403

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
    
    data = request.get_json(silent=True) or {}
    user_id = data.get('user_id')
    stage = data.get('stage')
    if not user_id or not stage:
        return jsonify({'error': 'Missing required fields'}), 400
    
    db = get_db()
    progress = db.execute('SELECT * FROM stage_progress WHERE user_id = ? AND stage = ?',
                         (user_id, stage)).fetchone()
    if not progress:
        return jsonify({'error': 'Stage not found'}), 404
    if progress['status'] != 'locked':
        return jsonify({'error': 'Only locked stages can be unlocked'}), 400

    db.execute('UPDATE stage_progress SET status = "active", unlocked_at = ? WHERE user_id = ? AND stage = ?',
              (datetime.datetime.now(), user_id, stage))
    db.commit()
    
    return jsonify({'success': True})

@app.route('/api/admin/approve-stage', methods=['POST'])
def admin_approve_stage():
    if 'user_id' not in session or session['role'] != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json(silent=True) or {}
    user_id = data.get('user_id')
    stage = data.get('stage')
    if not user_id or not stage:
        return jsonify({'error': 'Missing required fields'}), 400

    db = get_db()
    progress = db.execute('SELECT * FROM stage_progress WHERE user_id = ? AND stage = ?',
                         (user_id, stage)).fetchone()
    if not progress:
        return jsonify({'error': 'Stage not found'}), 404
    if progress['status'] != 'submitted':
        return jsonify({'error': 'Only submitted stages can be approved'}), 400

    db.execute('UPDATE stage_progress SET status = "approved" WHERE user_id = ? AND stage = ?',
              (user_id, stage))

    next_stage = stage + 1
    next_progress = None
    if next_stage <= 5:
        next_progress = db.execute('SELECT * FROM stage_progress WHERE user_id = ? AND stage = ?',
                                  (user_id, next_stage)).fetchone()
        if next_progress and next_progress['status'] == 'locked':
            db.execute('UPDATE stage_progress SET status = "active", unlocked_at = ? WHERE user_id = ? AND stage = ?',
                      (datetime.datetime.now(), user_id, next_stage))

    db.commit()

    return jsonify({
        'success': True,
        'approved_stage': stage,
        'next_stage_unlocked': bool(next_progress and next_progress['status'] == 'locked'),
        'next_stage': next_stage if next_stage <= 5 else None
    })

@app.route('/api/admin/lock', methods=['POST'])
def admin_lock():
    if 'user_id' not in session or session['role'] != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json(silent=True) or {}
    user_id = data.get('user_id')
    stage = data.get('stage')
    if not user_id or not stage:
        return jsonify({'error': 'Missing required fields'}), 400

    db = get_db()
    progress = db.execute('SELECT * FROM stage_progress WHERE user_id = ? AND stage = ?',
                         (user_id, stage)).fetchone()
    if not progress:
        return jsonify({'error': 'Stage not found'}), 404
    if progress['status'] == 'locked':
        return jsonify({'error': 'Stage is already locked'}), 400

    db.execute('UPDATE stage_progress SET status = "locked" WHERE user_id = ? AND stage = ?',
               (user_id, stage))
    db.commit()
    return jsonify({'success': True})

@app.route('/api/admin/reset', methods=['POST'])
def admin_reset():
    if 'user_id' not in session or session['role'] != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json(silent=True) or {}
    user_id = data.get('user_id')
    stage = data.get('stage')
    if not user_id or not stage:
        return jsonify({'error': 'Missing required fields'}), 400
    
    db = get_db()
    # Delete answers for this stage
    db.execute('DELETE FROM answers WHERE user_id = ? AND word_id IN (SELECT id FROM words WHERE stage = ?)',
              (user_id, stage))
    # Reset progress
    db.execute('UPDATE stage_progress SET status = "active", word_order = NULL WHERE user_id = ? AND stage = ?',
              (user_id, stage))
    db.commit()
    
    return jsonify({'success': True})

@app.route('/api/admin/reset-exercise', methods=['POST'])
def admin_reset_exercise():
    if 'user_id' not in session or session['role'] != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json(silent=True) or {}
    user_id = data.get('user_id')
    stage = data.get('stage')
    exercise_type = data.get('exercise_type')
    valid_types = ('match', 'jumble', 'fill', 'meaning')
    if not user_id or not stage or exercise_type not in valid_types:
        return jsonify({'error': 'Missing or invalid fields'}), 400

    db = get_db()
    db.execute(
        '''DELETE FROM answers WHERE user_id = ? AND exercise_type = ?
           AND word_id IN (SELECT id FROM words WHERE stage = ?)''',
        (user_id, exercise_type, stage)
    )
    # If stage was submitted/approved, revert to active so student can redo this exercise
    db.execute(
        "UPDATE stage_progress SET status = 'active' WHERE user_id = ? AND stage = ? AND status != 'locked'",
        (user_id, stage)
    )
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
    
    data = request.get_json(silent=True) or {}
    answer_id = data.get('answer_id')
    is_correct = data.get('is_correct')
    if answer_id is None or is_correct is None:
        return jsonify({'error': 'Missing required fields'}), 400
    
    db = get_db()
    db.execute('UPDATE answers SET is_correct = ?, teacher_override = 1 WHERE id = ?',
              (is_correct, answer_id))
    db.commit()
    
    return jsonify({'success': True})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

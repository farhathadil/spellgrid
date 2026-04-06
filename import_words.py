import sqlite3
import csv
import hashlib

def init_db():
    conn = sqlite3.connect('spellgrid.db')
    c = conn.cursor()
    
    # Create users table
    c.execute('''CREATE TABLE IF NOT EXISTS users
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  username TEXT UNIQUE NOT NULL,
                  pin_hash TEXT NOT NULL,
                  role TEXT NOT NULL,
                  is_test BOOLEAN DEFAULT 0)''')
    
    # Create words table
    c.execute('''CREATE TABLE IF NOT EXISTS words
                 (id INTEGER PRIMARY KEY,
                  word TEXT NOT NULL,
                  definition TEXT NOT NULL,
                  stage INTEGER NOT NULL,
                  keywords TEXT)''')
    
    # Create stage_progress table
    c.execute('''CREATE TABLE IF NOT EXISTS stage_progress
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  user_id INTEGER NOT NULL,
                  stage INTEGER NOT NULL,
                  status TEXT DEFAULT 'locked',
                  word_order TEXT,
                  unlocked_at DATETIME,
                  FOREIGN KEY(user_id) REFERENCES users(id),
                  UNIQUE(user_id, stage))''')
    
    # Create answers table
    c.execute('''CREATE TABLE IF NOT EXISTS answers
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  user_id INTEGER NOT NULL,
                  word_id INTEGER NOT NULL,
                  exercise_type TEXT NOT NULL,
                  answer TEXT,
                  is_correct BOOLEAN,
                  teacher_override BOOLEAN DEFAULT 0,
                  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                  FOREIGN KEY(user_id) REFERENCES users(id),
                  FOREIGN KEY(word_id) REFERENCES words(id))''')
    
    # Create default users
    users = [
        ('admin', '1234', 'admin', False),
        ('student1', '1111', 'student', False),
        ('student2', '2222', 'student', False),
        ('test', '0000', 'student', True)
    ]
    
    for username, pin, role, is_test in users:
        pin_hash = hashlib.sha256(pin.encode('utf-8')).hexdigest()
        try:
            c.execute('INSERT INTO users (username, pin_hash, role, is_test) VALUES (?, ?, ?, ?)',
                     (username, pin_hash, role, is_test))
        except sqlite3.IntegrityError:
            pass
    
    # Import words from CSV
    with open('../Spelling_Bee_2026_Grade7_8.csv', 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader)  # Skip header line 1
        next(reader)  # Skip header line 2
        
        for row in reader:
            if not row or not row[0].isdigit():
                continue
                
            word_id = int(row[0])
            word = row[1]
            definition = row[2]
            stage = (word_id - 1) // 20 + 1
            
            # Simple keyword extraction
            keywords = []
            stopwords = {'the', 'and', 'or', 'to', 'of', 'in', 'is', 'a', 'an', 'that', 'which', 'for', 'with', 'on', 'by', 'at', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 'now'}
            words = definition.lower().split()
            for w in words:
                w = w.strip('.,()[]":;!?')
                if len(w) > 3 and w not in stopwords:
                    keywords.append(w)
            
            keywords_str = ','.join(list(set(keywords))[:5])
            
            try:
                c.execute('INSERT INTO words (id, word, definition, stage, keywords) VALUES (?, ?, ?, ?, ?)',
                         (word_id, word, definition, stage, keywords_str))
            except sqlite3.IntegrityError:
                pass
    
    # Initialize stage progress for all users
    c.execute('SELECT id, is_test FROM users')
    for user_id, is_test in c.fetchall():
        for stage in range(1, 6):
            status = 'active' if (stage == 1 or is_test) else 'locked'
            try:
                c.execute('INSERT INTO stage_progress (user_id, stage, status) VALUES (?, ?, ?)',
                         (user_id, stage, status))
            except sqlite3.IntegrityError:
                pass
    
    conn.commit()
    conn.close()
    print("Database initialized successfully!")
    print("Default users created:")
    print("  admin    / PIN: 1234")
    print("  student1 / PIN: 1111")
    print("  student2 / PIN: 2222")
    print("  test     / PIN: 0000")

if __name__ == '__main__':
    init_db()

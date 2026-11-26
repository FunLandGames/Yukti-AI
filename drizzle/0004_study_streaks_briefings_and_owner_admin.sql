CREATE TABLE study_days (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  day TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'quiz',
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX study_days_user_day ON study_days (user_id, day);
--> statement-breakpoint
CREATE TABLE daily_briefings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  day TEXT NOT NULL,
  content_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX daily_briefings_user_day ON daily_briefings (user_id, day);
--> statement-breakpoint
UPDATE users SET role = 'admin' WHERE lower(email) = 'typeforyou11@gmail.com';
--> statement-breakpoint
INSERT OR IGNORE INTO settings (key, value) VALUES ('admin_emails', 'typeforyou11@gmail.com');
--> statement-breakpoint
UPDATE settings SET value = value || ',typeforyou11@gmail.com' WHERE key = 'admin_emails' AND instr(lower(replace(value, ' ', '')), 'typeforyou11@gmail.com') = 0;

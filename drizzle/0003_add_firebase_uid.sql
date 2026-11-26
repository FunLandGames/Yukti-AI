ALTER TABLE users ADD COLUMN firebase_uid TEXT;
--> statement-breakpoint
CREATE UNIQUE INDEX users_firebase_uid ON users (firebase_uid);

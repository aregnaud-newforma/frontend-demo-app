CREATE TABLE "accounts" (
	"session" text PRIMARY KEY NOT NULL,
	"id" text NOT NULL,
	"nom" text NOT NULL,
	"prenom" text NOT NULL,
	"email" text NOT NULL,
	"telephone" text,
	"langue" text NOT NULL,
	"bio" text NOT NULL
);

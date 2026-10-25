CREATE TABLE "ai_model_settings" (
	"org_id" varchar(191) NOT NULL,
	"action" varchar(64) NOT NULL,
	"model_provider" text NOT NULL,
	"model_slug" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ai_model_settings_org_id_action_pk" PRIMARY KEY("org_id","action")
);
--> statement-breakpoint
ALTER TABLE "ai_model_settings" ADD CONSTRAINT "ai_model_settings_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
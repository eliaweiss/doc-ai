CREATE TABLE "mini_apps_history" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"mini_app_id" varchar(191) NOT NULL,
	"org_id" varchar(191) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"color" varchar(7),
	"icon" varchar(100),
	"code" text NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mini_apps" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"org_id" varchar(191) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"color" varchar(7),
	"icon" varchar(100),
	"code" text NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mini_apps_history" ADD CONSTRAINT "mini_apps_history_mini_app_id_mini_apps_id_fk" FOREIGN KEY ("mini_app_id") REFERENCES "public"."mini_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mini_apps_history" ADD CONSTRAINT "mini_apps_history_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mini_apps" ADD CONSTRAINT "mini_apps_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mini_apps_history_mini_app_id_idx" ON "mini_apps_history" USING btree ("mini_app_id");--> statement-breakpoint
CREATE INDEX "mini_apps_history_org_idx" ON "mini_apps_history" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "mini_apps_history_created_at_idx" ON "mini_apps_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "mini_apps_history_org_mini_app_idx" ON "mini_apps_history" USING btree ("org_id","mini_app_id");--> statement-breakpoint
CREATE INDEX "mini_apps_org_idx" ON "mini_apps" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "mini_apps_org_user_idx" ON "mini_apps" USING btree ("org_id","user_id");
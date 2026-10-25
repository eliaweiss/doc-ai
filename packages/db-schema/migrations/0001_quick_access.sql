CREATE TABLE "quick_access" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"org_id" varchar(191) NOT NULL,
	"user_id" varchar(191) NOT NULL,
	"app_id" varchar(191) NOT NULL,
	"app_type" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quick_access" ADD CONSTRAINT "quick_access_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quick_access" ADD CONSTRAINT "quick_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "quick_access_org_user_app_idx" ON "quick_access" USING btree ("org_id","user_id","app_id","app_type");--> statement-breakpoint
CREATE INDEX "quick_access_org_user_idx" ON "quick_access" USING btree ("org_id","user_id");
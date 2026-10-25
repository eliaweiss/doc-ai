CREATE TABLE "accounts" (
	"id" varchar(191) NOT NULL,
	"user_id" varchar(191) NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" timestamp,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id"),
	CONSTRAINT "accounts_provider_provider_account_id_unique" UNIQUE("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "ai_processing_queue" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"org_id" varchar(191) NOT NULL,
	"document_id" varchar(191) NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"action" text NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"last_error" text,
	"retry_after" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "ai_usage_logs" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"org_id" varchar(191) NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"action" text NOT NULL,
	"model_gateway_id" varchar(191) NOT NULL,
	"model_slug" varchar(191) NOT NULL,
	"model_provider" text NOT NULL,
	"ai_provider" text DEFAULT '' NOT NULL,
	"ai_key_last_4_digits" varchar(4) NOT NULL,
	"is_gateway" boolean DEFAULT false NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"cached_tokens" integer,
	"cost_milli_cent" integer NOT NULL,
	"applied_cost_milli_cent" integer,
	"entity_id" varchar(191),
	"entity_type" text,
	"page_number" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_data" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"org_id" varchar(191) NOT NULL,
	"document_id" varchar(191) NOT NULL,
	"schema_entity_version" integer DEFAULT 1 NOT NULL,
	"header_data" jsonb,
	"line_items" jsonb,
	"total_amount" double precision,
	"transaction_type" text,
	"document_date" text DEFAULT now() NOT NULL,
	"due_date" text,
	"base_amount" double precision,
	"notifications" jsonb,
	"deleted_at" timestamp,
	"document_deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_data_document_idx" UNIQUE("document_id")
);
--> statement-breakpoint
CREATE TABLE "document_metadata" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"org_id" varchar(191) NOT NULL,
	"document_id" varchar(191) NOT NULL,
	"type" varchar(64) NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_metadata_doc_type_unique" UNIQUE("document_id","type")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"org_id" varchar(191) NOT NULL,
	"folder_id" varchar(191) NOT NULL,
	"doc_type" text,
	"file_name" text,
	"file_extension" text,
	"content_type" text NOT NULL,
	"s3_key" text NOT NULL,
	"content_hash" text,
	"page_count" integer,
	"processed_pages" integer[],
	"extraction_version" varchar(191) DEFAULT '1' NOT NULL,
	"extraction_status" text DEFAULT 'PENDING' NOT NULL,
	"last_extracted_at" timestamp,
	"last_indexed_at" timestamp,
	"extraction_errors" jsonb,
	"institution_id" varchar(191),
	"currency" text,
	"exchange_rate_to_base" numeric,
	"description" text,
	"document_date" varchar(50),
	"ocr_result_ptr" jsonb,
	"s3_region" text NOT NULL,
	"s3_bucket" text NOT NULL,
	"upload_complete" boolean DEFAULT false NOT NULL,
	"is_test" boolean DEFAULT false NOT NULL,
	"is_dataset" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_types" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"entity_version" integer DEFAULT 1 NOT NULL,
	"org_id" varchar(191) NOT NULL,
	"name" varchar(50) NOT NULL,
	"display_name" varchar(100),
	"description" text,
	"extraction_hint" text,
	"template_name" varchar(50),
	"header_schema" jsonb NOT NULL,
	"line_item_schemas" jsonb,
	"is_dataset" boolean DEFAULT false,
	"is_system" boolean DEFAULT false,
	"default_folder_id" varchar(191),
	"folder_mapping" jsonb,
	"icon" varchar(50),
	"color" varchar(7),
	"sample_documents" jsonb,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_types_unique_name" UNIQUE("org_id","name")
);
--> statement-breakpoint
CREATE TABLE "folders" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"org_id" varchar(191) NOT NULL,
	"name" text NOT NULL,
	"parent_id" varchar(191),
	"type" text DEFAULT 'GENERAL' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_root" boolean DEFAULT false NOT NULL,
	"description" text,
	"color" text,
	"document_count" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "institutions" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"org_id" varchar(191) NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"type" text,
	"domain" text,
	"description" text,
	"metadata" jsonb,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "institution_unique_org_name" UNIQUE("org_id","normalized_name")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"org_id" varchar(191) NOT NULL,
	"document_id" varchar(191),
	"notification_type" text DEFAULT 'DOCUMENT' NOT NULL,
	"metadata" jsonb,
	"level" text NOT NULL,
	"message" text NOT NULL,
	"field_path" text,
	"formula_field" text,
	"status" text DEFAULT 'NEW' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"base_currency" text DEFAULT 'USD' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"owner_user_id" varchar(191) NOT NULL,
	"max_pages_per_doc" integer DEFAULT 10 NOT NULL,
	"shared_with_emails" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"webhook_id" varchar(191),
	"webhook_secret" text,
	"webhook_callback_url" text,
	"webhook_signing_secret" text,
	"email_id" varchar(191),
	"email_forward_address" text,
	"email_forward_enabled" boolean DEFAULT false NOT NULL,
	"email_notify_on_upload" boolean DEFAULT false NOT NULL,
	"color" varchar(7),
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_email_id_unique" UNIQUE("email_id")
);
--> statement-breakpoint
CREATE TABLE "process_locks" (
	"id" integer PRIMARY KEY NOT NULL,
	"lock_flag" boolean DEFAULT false NOT NULL,
	"last_acquired" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reconciliation_links" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"org_id" varchar(191) NOT NULL,
	"source_ref" jsonb NOT NULL,
	"target_ref" jsonb NOT NULL,
	"date" varchar(50) NOT NULL,
	"amount" real NOT NULL,
	"currency" varchar(3) NOT NULL,
	"type" varchar(20) DEFAULT 'manual' NOT NULL,
	"confidence" real DEFAULT 1 NOT NULL,
	"edge_type" varchar(20),
	"metadata" jsonb,
	"created_by" varchar(191),
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_ledger_trace_sessions" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"org_id" varchar(191) NOT NULL,
	"user_id" varchar(191) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(1000),
	"options" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_queries" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"org_id" varchar(191) NOT NULL,
	"user_id" varchar(191) NOT NULL,
	"name" text NOT NULL,
	"query" text NOT NULL,
	"filters" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_reconciliation_sessions" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"org_id" varchar(191) NOT NULL,
	"user_id" varchar(191) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(1000),
	"source_entity_key" varchar(191) NOT NULL,
	"source_query" text NOT NULL,
	"source_date_from" varchar(50),
	"source_date_to" varchar(50),
	"source_selection" jsonb DEFAULT '[]' NOT NULL,
	"target_entity_key" varchar(191) NOT NULL,
	"target_query" text NOT NULL,
	"target_date_from" varchar(50),
	"target_date_to" varchar(50),
	"target_selection" jsonb DEFAULT '[]' NOT NULL,
	"amount" varchar(50),
	"currency" varchar(3),
	"options" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_index" (
	"entity_id" varchar(191) PRIMARY KEY NOT NULL,
	"org_id" varchar(191) NOT NULL,
	"document_id" varchar(191) NOT NULL,
	"entity_type" text NOT NULL,
	"content" text NOT NULL,
	"collection_key" varchar(100),
	"schema_type" varchar(200) NOT NULL,
	"doc_type" varchar(100) NOT NULL,
	"date" text NOT NULL,
	"description" text NOT NULL,
	"amount" double precision NOT NULL,
	"currency" varchar(3) NOT NULL,
	"is_dataset" boolean DEFAULT false NOT NULL,
	"is_duplicate" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"session_token" text NOT NULL,
	"user_id" varchar(191) NOT NULL,
	"expires" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"otp_value" text,
	"otp_expires_at" timestamp,
	"is_admin" boolean DEFAULT false NOT NULL,
	"roles" text[] DEFAULT '{}' NOT NULL,
	"opt_in_email" boolean DEFAULT true NOT NULL,
	"cognito_sub" varchar(255),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_processing_queue" ADD CONSTRAINT "ai_processing_queue_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_processing_queue" ADD CONSTRAINT "ai_processing_queue_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_data" ADD CONSTRAINT "document_data_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_data" ADD CONSTRAINT "document_data_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_metadata" ADD CONSTRAINT "document_metadata_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_metadata" ADD CONSTRAINT "document_metadata_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_links" ADD CONSTRAINT "reconciliation_links_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_ledger_trace_sessions" ADD CONSTRAINT "saved_ledger_trace_sessions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_queries" ADD CONSTRAINT "saved_queries_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_reconciliation_sessions" ADD CONSTRAINT "saved_reconciliation_sessions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_index" ADD CONSTRAINT "search_index_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_index" ADD CONSTRAINT "search_index_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_queue_pending_idx" ON "ai_processing_queue" USING btree ("status","retry_after","priority");--> statement-breakpoint
CREATE INDEX "ai_queue_org_status_idx" ON "ai_processing_queue" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "ai_queue_in_progress_idx" ON "ai_processing_queue" USING btree ("status","started_at");--> statement-breakpoint
CREATE INDEX "ai_queue_document_idx" ON "ai_processing_queue" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "ai_usage_logs_org_timestamp_idx" ON "ai_usage_logs" USING btree ("org_id","timestamp");--> statement-breakpoint
CREATE INDEX "ai_usage_logs_org_action_idx" ON "ai_usage_logs" USING btree ("org_id","action");--> statement-breakpoint
CREATE INDEX "ai_usage_logs_entity_idx" ON "ai_usage_logs" USING btree ("org_id","entity_id","entity_type");--> statement-breakpoint
CREATE INDEX "ai_usage_logs_org_model_idx" ON "ai_usage_logs" USING btree ("org_id","model_gateway_id");--> statement-breakpoint
CREATE INDEX "document_data_date_idx" ON "document_data" USING btree ("org_id","document_date") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "document_data_amount_idx" ON "document_data" USING btree ("org_id","total_amount") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "document_data_header_gin_idx" ON "document_data" USING gin ("header_data" jsonb_path_ops);--> statement-breakpoint
CREATE INDEX "document_data_items_gin_idx" ON "document_data" USING gin ("line_items" jsonb_path_ops);--> statement-breakpoint
CREATE INDEX "document_org_type_created_idx" ON "documents" USING btree ("org_id","doc_type","created_at");--> statement-breakpoint
CREATE INDEX "document_org_status_idx" ON "documents" USING btree ("org_id","extraction_status");--> statement-breakpoint
CREATE INDEX "document_org_folder_idx" ON "documents" USING btree ("org_id","folder_id","created_at");--> statement-breakpoint
CREATE INDEX "document_active_idx" ON "documents" USING btree ("org_id","doc_type") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "document_content_hash_idx" ON "documents" USING btree ("org_id","content_hash");--> statement-breakpoint
CREATE INDEX "document_types_org_id_idx" ON "document_types" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "folders_org_parent_idx" ON "folders" USING btree ("org_id","parent_id");--> statement-breakpoint
CREATE INDEX "folders_org_system_idx" ON "folders" USING btree ("org_id","is_system");--> statement-breakpoint
CREATE INDEX "folders_deleted_at_idx" ON "folders" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "institution_org_name_idx" ON "institutions" USING btree ("org_id","normalized_name");--> statement-breakpoint
CREATE INDEX "institution_org_deleted_idx" ON "institutions" USING btree ("org_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "notification_org_status_idx" ON "notifications" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "notification_document_idx" ON "notifications" USING btree ("org_id","document_id") WHERE document_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "notification_type_idx" ON "notifications" USING btree ("org_id","notification_type","status");--> statement-breakpoint
CREATE INDEX "notification_active_idx" ON "notifications" USING btree ("org_id","created_at") WHERE status IN ('NEW', 'PENDING');--> statement-breakpoint
CREATE INDEX "organization_owner_user_id_idx" ON "organizations" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "organization_deleted_at_idx" ON "organizations" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "organization_webhook_id_idx" ON "organizations" USING btree ("webhook_id");--> statement-breakpoint
CREATE INDEX "organization_email_id_idx" ON "organizations" USING btree ("email_id");--> statement-breakpoint
CREATE INDEX "reconciliation_links_org_idx" ON "reconciliation_links" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "reconciliation_links_source_idx" ON "reconciliation_links" USING gin ("source_ref" jsonb_path_ops);--> statement-breakpoint
CREATE INDEX "reconciliation_links_target_idx" ON "reconciliation_links" USING gin ("target_ref" jsonb_path_ops);--> statement-breakpoint
CREATE INDEX "reconciliation_links_type_idx" ON "reconciliation_links" USING btree ("org_id","type");--> statement-breakpoint
CREATE INDEX "saved_ledger_trace_sessions_org_user_idx" ON "saved_ledger_trace_sessions" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE INDEX "saved_ledger_trace_sessions_created_at_idx" ON "saved_ledger_trace_sessions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "saved_query_org_user_idx" ON "saved_queries" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE INDEX "saved_reconciliation_sessions_org_user_idx" ON "saved_reconciliation_sessions" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE INDEX "saved_reconciliation_sessions_created_at_idx" ON "saved_reconciliation_sessions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "search_index_org_entity_type_idx" ON "search_index" USING btree ("org_id","entity_type");--> statement-breakpoint
CREATE INDEX "search_index_document_idx" ON "search_index" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "search_index_entity_idx" ON "search_index" USING btree ("org_id","entity_id","entity_type");--> statement-breakpoint
CREATE INDEX "search_index_search_content_idx" ON "search_index" USING gin (to_tsvector('english', "content"));--> statement-breakpoint
CREATE INDEX "search_index_content_trgm_idx" ON "search_index" USING gin ("content" gin_trgm_ops);
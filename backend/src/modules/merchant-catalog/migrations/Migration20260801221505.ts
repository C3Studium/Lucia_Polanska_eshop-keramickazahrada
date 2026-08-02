import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260801221505 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "seasonal_selection" drop constraint if exists "seasonal_selection_handle_unique";`);
    this.addSql(`alter table if exists "collection_profile" drop constraint if exists "collection_profile_collection_id_unique";`);
    this.addSql(`alter table if exists "collection_category_assignment" drop constraint if exists "collection_category_assignment_category_id_unique";`);
    this.addSql(`create table if not exists "collection_category_assignment" ("id" text not null, "collection_id" text not null, "category_id" text not null, "display_order" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "collection_category_assignment_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_collection_category_assignment_collection_id" ON "collection_category_assignment" ("collection_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_collection_category_assignment_category_id_unique" ON "collection_category_assignment" ("category_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_collection_category_assignment_deleted_at" ON "collection_category_assignment" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "collection_profile" ("id" text not null, "collection_id" text not null, "description" text null, "cover_image_url" text null, "mobile_image_url" text null, "storefront_visible" boolean not null default true, "display_order" integer not null default 0, "seo_title" text null, "seo_description" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "collection_profile_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_collection_profile_collection_id_unique" ON "collection_profile" ("collection_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_collection_profile_deleted_at" ON "collection_profile" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "seasonal_selection" ("id" text not null, "title" text not null, "handle" text not null, "description" text null, "cover_image_url" text null, "mobile_image_url" text null, "publication_status" text check ("publication_status" in ('draft', 'published', 'archived')) not null default 'draft', "starts_at" timestamptz null, "ends_at" timestamptz null, "linked_price_list_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "seasonal_selection_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_seasonal_selection_handle_unique" ON "seasonal_selection" ("handle") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_seasonal_selection_deleted_at" ON "seasonal_selection" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "seasonal_selection_item" ("id" text not null, "product_id" text not null, "display_order" integer not null default 0, "selection_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "seasonal_selection_item_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_seasonal_selection_item_product_id" ON "seasonal_selection_item" ("product_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_seasonal_selection_item_selection_id" ON "seasonal_selection_item" ("selection_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_seasonal_selection_item_selection_product_unique" ON "seasonal_selection_item" ("selection_id", "product_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_seasonal_selection_item_deleted_at" ON "seasonal_selection_item" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "seasonal_selection" add constraint "seasonal_selection_date_range_check" check ("starts_at" is null or "ends_at" is null or "ends_at" > "starts_at");`);
    this.addSql(`alter table if exists "seasonal_selection_item" add constraint "seasonal_selection_item_selection_id_foreign" foreign key ("selection_id") references "seasonal_selection" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "seasonal_selection_item" drop constraint if exists "seasonal_selection_item_selection_id_foreign";`);
    this.addSql(`alter table if exists "seasonal_selection" drop constraint if exists "seasonal_selection_date_range_check";`);

    this.addSql(`drop table if exists "collection_category_assignment" cascade;`);

    this.addSql(`drop table if exists "collection_profile" cascade;`);

    this.addSql(`drop table if exists "seasonal_selection" cascade;`);

    this.addSql(`drop table if exists "seasonal_selection_item" cascade;`);
  }

}

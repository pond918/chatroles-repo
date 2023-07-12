-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable
CREATE TABLE "roles" (
    "pk" BIGSERIAL NOT NULL,
    "id" VARCHAR(31) NOT NULL,
    "nick" VARCHAR(39) NOT NULL,
    "avatar" VARCHAR(1023),
    "goal" VARCHAR(255) NOT NULL,
    "skills" VARCHAR(127)[],
    "professionals" VARCHAR(31)[],
    "help" VARCHAR(511),
    "entries" JSON[],
    "tags" VARCHAR(15)[],
    "published" BOOLEAN DEFAULT false,
    "created_by" VARCHAR(31) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted" BOOLEAN DEFAULT false,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hosts" (
    "pk" BIGSERIAL NOT NULL,
    "id" VARCHAR(31) NOT NULL,
    "role_id" VARCHAR(31) NOT NULL,
    "on_create" JSON,
    "on_init" JSON,
    "on_created" JSON,
    "on_pre_entry" JSON,
    "on_entries" JSON[],
    "on_post_entry" JSON,
    "on_finish" JSON,
    "singleton" BOOLEAN NOT NULL DEFAULT false,
    "members" JSON[],
    "published" BOOLEAN DEFAULT false,
    "released_no" VARCHAR(15),
    "created_by" VARCHAR(31) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted" BOOLEAN DEFAULT false,

    CONSTRAINT "hosts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actors" (
    "pk" BIGSERIAL NOT NULL,
    "id" VARCHAR(31) NOT NULL,
    "nick" VARCHAR(39) NOT NULL,
    "avatar" VARCHAR(1023),
    "ctx_id" INTEGER,
    "role_id" VARCHAR(31) NOT NULL,
    "host_id" VARCHAR(31),
    "singleton" BOOLEAN DEFAULT false,
    "parent_id" VARCHAR(31) NOT NULL,
    "owner_id" VARCHAR(31) NOT NULL,
    "created_by" VARCHAR(31) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted" BOOLEAN DEFAULT false,
    "auth_token" VARCHAR(255) NOT NULL,

    CONSTRAINT "actors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "pk" BIGSERIAL NOT NULL,
    "id" VARCHAR(31) NOT NULL,
    "realm" VARCHAR(8) NOT NULL DEFAULT 'local',
    "realm_token" VARCHAR(127),
    "info" JSONB,
    "username" VARCHAR(39) NOT NULL,
    "username_lower" VARCHAR(39) NOT NULL,
    "nick" VARCHAR(39),
    "avatar" VARCHAR(1023),
    "email" VARCHAR(128),
    "emailValid" BOOLEAN DEFAULT false,
    "res_configs" JSON[],
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted" BOOLEAN DEFAULT false,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_nodes" (
    "pk" BIGSERIAL NOT NULL,
    "id" VARCHAR(31) NOT NULL,
    "key" VARCHAR(31) NOT NULL,
    "parent_id" VARCHAR(31) NOT NULL DEFAULT '',
    "version_id" VARCHAR(31) NOT NULL,
    "domain" VARCHAR(31),
    "actor_id" VARCHAR(31) NOT NULL,
    "content" JSON NOT NULL,
    "summary" VARCHAR(63),
    "embedding" vector(768),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted" BOOLEAN DEFAULT false,

    CONSTRAINT "memory_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_versions" (
    "pk" BIGSERIAL NOT NULL,
    "id" VARCHAR(31) NOT NULL,
    "key" VARCHAR(31) NOT NULL,
    "actor_id" VARCHAR(31) NOT NULL,
    "content" JSON NOT NULL,
    "language" VARCHAR(15),
    "published" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted" BOOLEAN DEFAULT false,

    CONSTRAINT "memory_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotas" (
    "pk" BIGSERIAL NOT NULL,
    "id" VARCHAR(31) NOT NULL,
    "user_id" VARCHAR(31) NOT NULL,
    "runtime" VARCHAR(8) NOT NULL,
    "type" VARCHAR(8) NOT NULL,
    "name" VARCHAR(31) NOT NULL,
    "quota" INTEGER NOT NULL,
    "invalid_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "reset" JSON,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted" BOOLEAN DEFAULT false,

    CONSTRAINT "quotas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_id_key" ON "roles"("id");

-- CreateIndex
CREATE INDEX "roles_id_idx" ON "roles"("id");

-- CreateIndex
CREATE UNIQUE INDEX "hosts_id_key" ON "hosts"("id");

-- CreateIndex
CREATE INDEX "hosts_id_idx" ON "hosts"("id");

-- CreateIndex
CREATE INDEX "hosts_role_id_idx" ON "hosts"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "actors_id_key" ON "actors"("id");

-- CreateIndex
CREATE INDEX "actors_id_idx" ON "actors"("id");

-- CreateIndex
CREATE INDEX "actors_host_id_idx" ON "actors"("host_id");

-- CreateIndex
CREATE INDEX "actors_parent_id_idx" ON "actors"("parent_id");

-- CreateIndex
CREATE INDEX "actors_owner_id_idx" ON "actors"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "actors_parent_id_nick_key" ON "actors"("parent_id", "nick");

-- CreateIndex
CREATE UNIQUE INDEX "users_id_key" ON "users"("id");

-- CreateIndex
CREATE INDEX "users_id_idx" ON "users"("id");

-- CreateIndex
CREATE UNIQUE INDEX "users_realm_username_lower_key" ON "users"("realm", "username_lower");

-- CreateIndex
CREATE UNIQUE INDEX "memory_nodes_id_key" ON "memory_nodes"("id");

-- CreateIndex
CREATE INDEX "memory_nodes_actor_id_idx" ON "memory_nodes"("actor_id");

-- CreateIndex
CREATE UNIQUE INDEX "memory_nodes_actor_id_version_id_domain_key_key" ON "memory_nodes"("actor_id", "version_id", "domain", "key");

-- CreateIndex
CREATE UNIQUE INDEX "memory_versions_id_key" ON "memory_versions"("id");

-- CreateIndex
CREATE INDEX "memory_versions_actor_id_idx" ON "memory_versions"("actor_id");

-- CreateIndex
CREATE UNIQUE INDEX "memory_versions_actor_id_key_key" ON "memory_versions"("actor_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "quotas_id_key" ON "quotas"("id");

-- CreateIndex
CREATE INDEX "quotas_user_id_idx" ON "quotas"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "quotas_user_id_runtime_type_name_key" ON "quotas"("user_id", "runtime", "type", "name");

-- AddForeignKey
ALTER TABLE "hosts" ADD CONSTRAINT "hosts_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actors" ADD CONSTRAINT "actors_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "hosts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

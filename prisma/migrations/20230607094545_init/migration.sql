-- CreateTable
CREATE TABLE "roles" (
    "pk" BIGSERIAL NOT NULL,
    "id" VARCHAR(31) NOT NULL,
    "nick" VARCHAR(39) NOT NULL,
    "avatar" VARCHAR(1023),
    "goal" VARCHAR(255) NOT NULL,
    "skills" VARCHAR(127)[],
    "professionals" VARCHAR(31)[],
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
    "username" VARCHAR(39) NOT NULL,
    "username_lower" VARCHAR(39) NOT NULL,
    "res_configs" JSON[],
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted" BOOLEAN DEFAULT false,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "users_username_lower_key" ON "users"("username_lower");

-- CreateIndex
CREATE INDEX "users_id_idx" ON "users"("id");

-- AddForeignKey
ALTER TABLE "hosts" ADD CONSTRAINT "hosts_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actors" ADD CONSTRAINT "actors_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "hosts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

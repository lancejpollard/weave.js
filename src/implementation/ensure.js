
const CONFIG = require('./config')
const {
  PROPERTY_TABLE_CREATOR,
  createChunkShardShardTable,
  createChunkShardTable,
  createInitialChunkShardShardRecord,
  createTypeTypeSchema,
  createTypeOrganizationRecord,
} = require('./create')

async function ensureCenter(knex) {
  await ensureChunkShardShardTable(knex)
  await ensureChunkShardTable(knex)
  await ensureInitialChunkShardShardRecord(knex)
}

async function ensureChunkShardShardTable(knex) {
  const hasTable = await knex.schema.hasTable(CONFIG.TABLE.CHUNK_SHARD_SHARD)
  if (!hasTable) {
    await createChunkShardShardTable(knex)
  }
}

async function ensureChunkShardTable(knex) {
  const hasTable = await knex.schema.hasTable(CONFIG.TABLE.CHUNK_SHARD)
  if (!hasTable) {
    await createChunkShardTable(knex)
  }
}

async function ensureInitialChunkShardShardRecord(knex) {
  const shard = await knex(CONFIG.TABLE.CHUNK_SHARD_SHARD)
    .where('id', 0)
    .first()

  if (shard) {
    return shard
  }

  return await createInitialChunkShardShardRecord(knex)
}

/**
 * Creates the base schemas on the base database connection,
 * to keep things simple for smaller-scale apps (or beginnings).
 */

async function ensureBaseSchema(knex) {
  await ensureEachPropertyTable(knex)
  await ensureTypeTypeRecord(knex)
  // await ensureTypeOrganizationRecord(knex)
}

async function ensureEachPropertyTable(knex) {
  for (const name in PROPERTY_TABLE_CREATOR) {
    const call = PROPERTY_TABLE_CREATOR[name]
    const hasTable = await knex.schema.hasTable(`mesh_${name}`)
    if (!hasTable) {
      await call(knex)
    }
  }
}

async function ensureTypeTypeRecord(knex) {
  await createTypeTypeSchema(knex)
}

async function ensureTypeOrganizationRecord(knex) {
  await createTypeOrganizationRecord(knex)
}

module.exports = {
  ensureCenter,
  ensureChunkShardShardTable,
  ensureBaseSchema,
}

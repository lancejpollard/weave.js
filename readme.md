
# Weave.js

A layer above a network of Postgres shards for dealing with records modeled as graph objects.

NOT WORKING YET, still just in concept phase.

## Usage

```
npm install @lancejpollard/weave.js
```

### `attach({ url })`

```js
const attach = require('@lancejpollard/weave.js')

const weave = await attach({
  url: `postgresql://localhost:5432/postgres_graphql_test`
})
```

Debug knex queries (which is used under the hood), by doing:

```bash
DEBUG=knex:query,knex:tx,knex:bindings node your-script
```

### `weave.select(query)`

```js
const { type } = await weave.select({
  type: {
    single: true,
    filter: {
      name: 'type'
    },
    select: {
      name: true,
      properties: {
        select: {
          name: true,
          propertyTypes: {
            select: {
              name: true
            }
          }
        }
      }
    }
  }
})
```

Note, when you get back an array from `select`, you also get back a `totalCount`, so you know how many records there are. Here is an example response:

```js
{
  totalCount: 10000,
  list: [
    { name: 'type' },
    { name: 'organization' },
    { name: 'agent' },
    { name: 'user' },
    ...
  ]
}
```

#### Filter `between`

```js
const { person } = await weave.select({
  person: {
    filter: {
      age: {
        between: {
          min: 20,
          max: 30
        }
      }
    },
    select: {
      name: true
    }
  }
})
```

#### Filter `in`

```js
const { person } = await weave.select({
  person: {
    filter: {
      id: {
        in: [1, 2, 3]
      }
    },
    select: {
      name: true
    }
  }
})
```

#### Filter `not`

```js
const { person } = await weave.select({
  person: {
    filter: {
      id: {
        not: {
          in: [1, 2, 3]
        }
      }
    },
    select: {
      name: true
    }
  }
})
```

#### Sort

```js
const { type } = await weave.select({
  type: {
    sort: {
      descending: ['name']
    },
    select: {
      name: true
    }
  }
})
```

#### Pagination

```js
const { person } = await weave.select({
  person: {
    max: 100,
    offset: 1000,
    select: {
      name: true
    }
  }
})
```

### `weave.create(record, [projection])`

Create a record.

```js
const { prime } = await weave.create({
  prime: [orgId, typeId],
  slug: 'foo',
  title: 'Foo',
})
```

You can also specify what fields to get back.

```js
const org = await weave.create({
  prime: [orgId, typeId],
  slug: 'foo',
  title: 'Foo',
}, {
  prime: true,
  slug: true,
  title: true
})
```

### `weave.create(list, [projection])`

You can create many records at a time.

### `weave.update(query, updates, [projection])`

```js
await weave.update({
  prime: [orgId, typeId, objectId, chunkId],
}, {
  slug: 'bar',
  title: 'Bar',
}, {
  slug: true,
  title: true,
})
```

### `weave.commit(fn)`

```js
await weave.commit(async () => {
  weave.create(...)
  weave.update(...)
})
```

### `weave.survey()`

Get list of shards and database table metadata of the system, to aid in the debugging process.

### `weave.remove({ prime }, [projection])`

Remove record by ID.

```js
await weave.remove({
  prime: [orgId, typeId, objId, chunkId]
})
```

### `weave.remove(list, [projection])`

Remove many records at once.

### `weave.revoke()`

Remove the whole database system, be careful. Useful for testing weave during development.

### `weave.detach()`

Turn off the database connections.

## Architecture

The (org, type, source, shard) is a key for an object.

- 1 central one of these
  - chunk_shard_shard (what table is for what type of thing)
    - id
    - shard_url
- a few of these
  - chunk_shard (where to search for all the records)
    - organization_id (bigint)
    - type_id (int)
    - chunk_id (bigint)
    - shard_url (string or null)
    - current (if it's the currently writable chunk)
    - last_index (the last object id, which is also the count, for this chunk)
    - id_salt (so it appears random when resolving, random number between 0 and int)
- n of these shards
  - property value tables
    - attachment (bucket is <shard>, folder is org/type/source/property/value)
      - object_organization_id (bigint)
      - object_type_id (don't need the chunk_id, because on this machine we already know it contains records in that chunk)
      - object_id (integer possibilities)
      - index (-1 for non-list items, actually, the schema tells us if it is an array)
      - property_id (integer)
      - bucket_id
      - value_id (id, biginteger)
    - char (can be searched against as key)
      - org
      - type
      - shard
      - source
      - index (-1 for non-list items)
      - property (integer)
      - value (char, 255)
    - text (cannot be searched against as key)
      - org
      - type
      - shard
      - source
      - index (-1 for non-list items)
      - property (integer)
      - value (text)
    - decimal
    - integer
    - boolean
    - timestamp
    - attachment (s3 bucket name, plus object id)
    - link table (has org, type, source for link, "data binding")
      - object-org
      - object-type
      - object-shard
      - object-source
      - index (-1 for non-list items)
      - property (integer)
      - value-org
      - value-type
      - value-shard
      - value-source
      - is-deleted
    - object table

### Property Types

smallinteger

- attachment: 0
- char: 1
- text: 2
- decimal: 3
- integer: 4
- boolean: 5
- timestamp: 6
- link: 7
- object: 8

### Integral Tables

- type: 0
- property: 1 (property table)
  - slug
  - title
  - type
  - islist
  - validation-list
  - formatter-list
- organization: 2
  - slug
  - title
  - image
  - logo
- person: 3
- bot: 4
- membership: 5
- invite: 6
- agent: 7
  - guest (unregistered agent, try to track though)
  - session token
  - email
  - password-salt
  - password-hash
- action: 8
  - type (create, update, delete)
  - timestamp
  - agent
  - agent-shard
  - (org, type, shard, source, property, value)
- vote: 9
  - type (flag, agreement, disagreement)
  - action-id
  - action-shard
- image: 10 (object which references several paths for different sizes, and a preview blur hash, as well as the sizes)
  - preview_url (base64 data)
  - sources
    - width
    - height
    - size
    - attachment
      - bucket_id
      - value_hash

## Algorithms

Should probably use a [two-phase commit](https://dropbox.tech/infrastructure/cross-shard-transactions-at-10-million-requests-per-second) to do transactions.

Pagination/sorting requires [3 passes](https://engineering.medallia.com/blog/posts/sorting-and-paging-on-distributed-data/) potentially.

All of the schema data is contained in the primary node.

Can divide the ID generation tables into separate tables with various chunks so you can get new IDs without worrying if the table is being blocked. Let us say 4096 ID tables. Then in JS memory, we tell what tables are locked, so we get ID from unlocked table.

### Security

You have to have permission to edit the organization or specific records within the organization to edit.

[Permissions](https://cazzer.medium.com/designing-the-most-performant-row-level-security-strategy-in-postgres-a06084f31945) on a per-record level idea. [More info](https://cloud.google.com/bigquery/docs/row-level-security-intro).

### Insertion

Every few records inserted, it checks the database size to see if it is close to MAX in size. Once it is close to MAX in size, it spawns off another shard.

## Permissions, Authorization, and Access Control Lists

### Handle Permissions on a Single Record

```js
{
  access: [
    {
      aspect: '/org_id/type_id/chunk_id/object_id',
      action: ['update'],
      access: [
        {
          aspect: 'fielda',
          action: ['reject']
        },
        {
          aspect: 'fieldb',
          action: ['update', 'delete']
        }
      ]
    },
  ]
}
```

### Handle Permissions on All Records of Specific Type

```js
{
  access: [
    {
      aspect: '/*/specific_type',
      access: [
        {
          aspect: 'field1',
        }
      ]
    }
  ],
}
```

### Handle Permissions Matching Specific Conditions

```js
{
  access: [
    {
      aspect: '/*/specific_type_id',
      action: ['remove'],
      access: [
        {
          aspect: '/field1',
          action: ['select', 'update']
        }
      ]
    }
  ],
  review: {
    filter: [
      {
        source: '/specific_type/author/id'
        relation: '=',
        target: '/current_agent/id'
      }
    ],
    select: {
      current_agent: {
        id: true
      },
      specific_type: {
        author: {
          id: true
        }
      }
    }
  }
}
```

### Allow User who is Group Member to Access all Records Group Owns

```js
{
  access: [
    {
      aspect: '/*',
      access: ['select'],
      access: [
        {
          aspect: '/*',
          action: ['manage']
        }
      ]
    }
  ],
  review: {
    filter: [
      {
        source: '/current_agent/memberships/organization/id',
        relation: '=',
        target: '/record/owner/id'
      }
    ]
    select: {
      current_agent: {
        memberships: {
          organization: {
            id: true
          }
        }
      },
      record: {
        owner: {
          id: true
        }
      }
    }
  }
}
```

### Handle All Records for an Organization

```js
{
  source: {
    organization: {
      id: true
    }
  },
  access: [
    {
      aspect: '/[source/organization/id]/*',
      action: ['manage']
    }
  ],
}
```

### Override Specific Actions with Finer Detail

```js
{
  access: [
    {
      aspect: '/org_id/*',
      action: ['manage'],
      access: [
        {
          revoke: true,
          aspect: '/field1',
          action: ['manage']
        },
        {
          aspect: '/field2',
          action: ['select']
        }
      ]
    }
  ],
  source: {
    organization: {
      id: true
    }
  }
}
```

Create a "binding" to a policy "template" with specific variables.

- **policy_template**
- **policy** (one created for each template at least, binding to variables)
- **permit** (assiging a user to a specific policy binding)

```
agent
  permits

permit
  agent
  policy

policy
  binding
  template

policy_template
  source
```

### Policy Template in Detail

This is the last policy template defined, but expanded to show how it might look in the database.

```js
{
  access: [
    {
      aspect: {
        keys: [
          { name: 'organization', value: '[source/organization/id]' },
          { name: 'type', value: null },
        ]
      },
      action: [
        {
          type: 3
        }
      ],
      access: [
        {
          revoke: true,
          aspect: {
            property: 'field1'
          },
          action: [
            {
              type: 3
            }
          ]
        },
        {
          aspect: {
            property: 'field2'
          },
          action: [
            {
              type: 1
            }
          ]
        }
      ]
    }
  ],
  source: {
    organization: {
      id: true
    }
  }
}
```

So then as many of the policies and templates can be loaded into memory as possible, so it works quickly.

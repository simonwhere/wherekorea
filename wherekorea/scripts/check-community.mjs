import { readFile } from 'node:fs/promises'
import { resolve, isAbsolute, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

// Deliberately no database URL, service-role key, or hosted-project connection.
// Supply an already installed official @electric-sql/pglite package directory.
const packagePath = process.argv[2]
if (!packagePath || !isAbsolute(packagePath)) {
  console.error('Usage: node scripts/check-community.mjs /absolute/path/to/node_modules/@electric-sql/pglite')
  process.exitCode = 1
} else {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
  let db
  try {
    const metadata = JSON.parse(await readFile(join(packagePath, 'package.json'), 'utf8'))
    if (metadata.name !== '@electric-sql/pglite') throw new Error('Expected the official @electric-sql/pglite package.')
    const { PGlite } = await import(pathToFileURL(join(packagePath, 'dist/index.js')).href)
    db = new PGlite()
    const files = [
      'supabase/tests/bootstrap.sql',
      'supabase/migrations/202610170001_community_questions.sql',
      'supabase/tests/community.sql',
      'supabase/migrations/202610180001_community_inbox.sql',
      'supabase/tests/community-inbox.sql',
      'supabase/migrations/202610180002_community_guests.sql',
      'supabase/tests/community-guests.sql',
      'supabase/migrations/202610200001_community_inbox_repair.sql',
      'supabase/tests/community-inbox-repair.sql',
      'supabase/migrations/202611040001_community_meetups.sql',
      'supabase/tests/community-meetups.sql',
    ]
    for (const file of files) {
      const sql = await readFile(join(root, file), 'utf8')
      await db.exec(sql)
      console.log(`PASS ${file}`)
    }
    // Independent catalog checks: a forgotten GRANT on a new table/function must
    // fail even if the happy-path fixture suite never calls that new entry point.
    const exposedTables = await db.query(`
      select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='community_private' and c.relkind in ('r','p') and
        (not c.relrowsecurity or has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
         or has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
    `)
    assert.deepEqual(exposedTables.rows, [], 'Community tables must have RLS and no direct API-role privileges.')
    const privateAccess = await db.query(`
      select has_schema_privilege('anon','community_private','USAGE') as anon,
        has_schema_privilege('authenticated','community_private','USAGE') as authenticated
    `)
    assert.deepEqual(privateAccess.rows, [{ anon: false, authenticated: false }])
    const anonFunctions = await db.query(`
      select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname like 'community_%' and has_function_privilege('anon',p.oid,'EXECUTE')
      order by p.proname
    `)
    assert.deepEqual(anonFunctions.rows.map(row => row.proname), ['community_get_question', 'community_list_meetups', 'community_list_questions', 'community_status'])
    const defaultExecute = await db.query(`
      select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace,
        lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      where (n.nspname='community_private' or (n.nspname='public' and p.proname like 'community_%'))
        and a.grantee=0 and a.privilege_type='EXECUTE'
    `)
    assert.deepEqual(defaultExecute.rows, [], 'No community function may inherit PUBLIC execute.')
    console.log('PASS independent catalog audit: direct-table denial, private schema, anonymous RPC allowlist, no PUBLIC execute')
    // Reproduce the hosted ordering gap: base + guests, but no inbox migration.
    // Use a second isolated database, never destructive changes to the first one.
    const gap = new PGlite()
    try {
      for (const file of ['supabase/tests/bootstrap.sql','supabase/migrations/202610170001_community_questions.sql','supabase/migrations/202610180002_community_guests.sql']) {
        await gap.exec(await readFile(join(root,file),'utf8'))
      }
      await gap.exec(`insert into auth.users(id,is_anonymous) values('14000000-0000-4000-8000-000000000001',true);
        insert into community_private.profiles(user_id,display_name) values('14000000-0000-4000-8000-000000000001','Preserved guest');
        insert into community_private.questions(id,author_id,city,title,body) values('24000000-0000-4000-8000-000000000001','14000000-0000-4000-8000-000000000001','andong','Preserved question','Existing content must survive.');
        insert into community_private.comments(id,question_id,author_id,body) values('34000000-0000-4000-8000-000000000001','24000000-0000-4000-8000-000000000001','14000000-0000-4000-8000-000000000001','Existing comment');
        update community_private.settings set guest_enabled=true,posting_enabled=false;`)
      const repair = await readFile(join(root,'supabase/migrations/202610200001_community_inbox_repair.sql'),'utf8')
      await gap.exec(repair)
      const stateBefore = (await gap.query(`select public.community_status() as state`)).rows[0].state
      assert.deepEqual(stateBefore,{guestEnabled:true,postingEnabled:false,guestSchemaVersion:1,inboxSchemaVersion:1})
      await gap.exec(await readFile(join(root,'supabase/tests/community-inbox-repair.sql'),'utf8'))
      // Rerunning must preserve existing content, receipts and switch values.
      await gap.exec(`insert into community_private.reply_notifications(recipient_id,comment_id) values('14000000-0000-4000-8000-000000000001','34000000-0000-4000-8000-000000000001');`)
      await gap.exec(repair)
      const kept = (await gap.query(`select
        (select count(*)::int from community_private.profiles) as profiles,
        (select count(*)::int from community_private.questions) as questions,
        (select count(*)::int from community_private.comments) as comments,
        (select count(*)::int from community_private.reply_notifications) as receipts,
        (select posting_enabled from community_private.settings where singleton) as posting,
        (select guest_enabled from community_private.settings where singleton) as guests`)).rows[0]
      assert.deepEqual(kept,{profiles:1,questions:1,comments:1,receipts:1,posting:false,guests:true})
      console.log('PASS missing-inbox reproduction, guest ownership, repair retry, content/receipt/switch preservation')
    } finally { await gap.close() }
    const version = await db.query('select version()')
    console.log(`Community SQL checks passed in isolated ${version.rows[0].version.split(' on ')[0]}.`)
    console.log('No hosted Supabase, CAPTCHA, email delivery, multi-session concurrency or production deployment was tested.')
  } catch (error) {
    console.error('Community SQL checks failed:', error instanceof Error ? error.message : 'Unknown error')
    process.exitCode = 1
  } finally {
    await db?.close()
  }
}

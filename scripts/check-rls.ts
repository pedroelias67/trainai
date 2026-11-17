/**
 * Looks for tables the public internet can reach.
 *
 * Supabase serves every table in `public` over PostgREST, and the key that
 * opens it is NEXT_PUBLIC_SUPABASE_ANON_KEY — public by definition, shipped in
 * the browser bundle. What stops a stranger reading a table is Row-Level
 * Security, and `prisma db push` does not enable it on tables it creates.
 *
 * That is not a hypothetical. GarminDay was added on 13 November 2026 and sat
 * readable, writable and deletable by anyone until Supabase's own advisor
 * noticed four days later. Every other table had been protected; this one was
 * new, and nothing in the workflow said so.
 *
 * The app is unaffected by RLS: Prisma connects as `postgres`, which has
 * BYPASSRLS. Enabling it costs nothing here and closes the door outside.
 *
 * Run after any schema change:
 *   npx tsx scripts/check-rls.ts
 *
 * To fix what it reports:
 *   ALTER TABLE public."Nome" ENABLE ROW LEVEL SECURITY;
 *   REVOKE ALL ON public."Nome" FROM anon, authenticated;
 */
import { prisma } from "@/lib/prisma";

async function main() {
  const semRls = await prisma.$queryRawUnsafe<Array<{ relname: string }>>(
    `select c.relname from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
      order by c.relname`
  );

  const concessoes = await prisma.$queryRawUnsafe<Array<{ grantee: string; table_name: string }>>(
    `select distinct grantee, table_name from information_schema.role_table_grants
      where table_schema = 'public' and grantee in ('anon', 'authenticated')
      order by table_name, grantee`
  );

  if (semRls.length === 0 && concessoes.length === 0) {
    console.log("Tudo fechado: nenhuma tabela sem RLS, nenhuma permissão a anon.");
    return;
  }

  if (semRls.length > 0) {
    console.error(`\nTABELAS SEM RLS (${semRls.length}) — legíveis de fora com a chave pública:`);
    for (const t of semRls) {
      console.error(`   ${t.relname}`);
      console.error(`      ALTER TABLE public."${t.relname}" ENABLE ROW LEVEL SECURITY;`);
    }
  }

  if (concessoes.length > 0) {
    console.error(`\nPERMISSÕES A ANON/AUTHENTICATED (${concessoes.length}):`);
    for (const g of concessoes) {
      console.error(`   ${g.grantee} em ${g.table_name}`);
      console.error(`      REVOKE ALL ON public."${g.table_name}" FROM ${g.grantee};`);
    }
  }

  // Non-zero so this can sit in front of a deploy and actually stop one.
  process.exitCode = 1;
}

main()
  .catch(e => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
